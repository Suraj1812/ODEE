-- ODEE multi-tenant isolation migration
-- Shared database, shared schema, strict tenant isolation via tenant_id + RLS

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  role text not null check (role in ('tenant_admin', 'teacher', 'student')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_tenant_id
  on public.user_profiles (tenant_id);

create or replace function public.current_user_tenant_id()
returns uuid
language sql
stable
as $$
  select up.tenant_id
  from public.user_profiles up
  where up.user_id = (select auth.uid())
    and up.status = 'active'
  limit 1
$$;

-- Example existing table retrofit: students
alter table public.students
  add column if not exists tenant_id uuid;

-- Example backfill. Replace legacy_customer_id with your real ownership column.
-- update public.students s
-- set tenant_id = t.id
-- from public.tenants t
-- where t.legacy_customer_id = s.customer_id
--   and s.tenant_id is null;

alter table public.students
  alter column tenant_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_tenant_fk'
  ) then
    alter table public.students
      add constraint students_tenant_fk
      foreign key (tenant_id)
      references public.tenants(id)
      on delete restrict;
  end if;
end $$;

create index if not exists idx_students_tenant_id
  on public.students (tenant_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_id_tenant_key'
  ) then
    alter table public.students
      add constraint students_id_tenant_key unique (id, tenant_id);
  end if;
end $$;

-- Example child table retrofit: student_notes
alter table public.student_notes
  add column if not exists tenant_id uuid;

-- update public.student_notes sn
-- set tenant_id = s.tenant_id
-- from public.students s
-- where s.id = sn.student_id
--   and sn.tenant_id is null;

alter table public.student_notes
  alter column tenant_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_notes_tenant_fk'
  ) then
    alter table public.student_notes
      add constraint student_notes_tenant_fk
      foreign key (tenant_id)
      references public.tenants(id)
      on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_notes_student_fk'
  ) then
    alter table public.student_notes
      add constraint student_notes_student_fk
      foreign key (student_id, tenant_id)
      references public.students(id, tenant_id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_student_notes_tenant_id
  on public.student_notes (tenant_id);

-- RLS
alter table public.tenants enable row level security;
alter table public.tenants force row level security;

alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;

alter table public.students enable row level security;
alter table public.students force row level security;

alter table public.student_notes enable row level security;
alter table public.student_notes force row level security;

drop policy if exists "read own tenant" on public.tenants;
create policy "read own tenant"
on public.tenants
for select
to authenticated
using (
  id = (select public.current_user_tenant_id())
);

drop policy if exists "read own profile" on public.user_profiles;
create policy "read own profile"
on public.user_profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
);

drop policy if exists "same tenant only on students" on public.students;
create policy "same tenant only on students"
on public.students
for all
to authenticated
using (
  (select auth.uid()) is not null
  and tenant_id = (select public.current_user_tenant_id())
)
with check (
  (select auth.uid()) is not null
  and tenant_id = (select public.current_user_tenant_id())
);

drop policy if exists "same tenant only on student_notes" on public.student_notes;
create policy "same tenant only on student_notes"
on public.student_notes
for all
to authenticated
using (
  (select auth.uid()) is not null
  and tenant_id = (select public.current_user_tenant_id())
)
with check (
  (select auth.uid()) is not null
  and tenant_id = (select public.current_user_tenant_id())
);

-- Test snippet for Supabase SQL tests
-- set local role authenticated;
-- set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
-- select count(*) from public.students;
-- set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
-- select count(*) from public.students where id = 'stu-a-101';
