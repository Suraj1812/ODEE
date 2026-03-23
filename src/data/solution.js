export const demoUsers = [
  {
    id: "user-tenant-a-admin",
    name: "Asha Rao",
    role: "tenant_admin",
    tenantId: "tenant-a",
    tenantName: "Customer A"
  },
  {
    id: "user-tenant-a-teacher",
    name: "Meera Joshi",
    role: "teacher",
    tenantId: "tenant-a",
    tenantName: "Customer A"
  },
  {
    id: "user-tenant-b-admin",
    name: "Kabir Shah",
    role: "tenant_admin",
    tenantId: "tenant-b",
    tenantName: "Customer B"
  }
];

export const initialStudents = [
  {
    id: "stu-a-101",
    tenantId: "tenant-a",
    name: "Riya Patil",
    grade: "Class 7",
    learningTrack: "Adaptive Math",
    city: "Mysuru"
  },
  {
    id: "stu-a-102",
    tenantId: "tenant-a",
    name: "Arjun Gowda",
    grade: "Class 8",
    learningTrack: "Science Foundations",
    city: "Hubballi"
  },
  {
    id: "stu-b-201",
    tenantId: "tenant-b",
    name: "Naina Deshmukh",
    grade: "Class 6",
    learningTrack: "English Fluency",
    city: "Belagavi"
  }
];

export const initialNotes = [
  {
    id: "note-a-1",
    studentId: "stu-a-101",
    tenantId: "tenant-a",
    note: "Needs Kannada support content in algebra practice."
  },
  {
    id: "note-b-1",
    studentId: "stu-b-201",
    tenantId: "tenant-b",
    note: "High engagement on spoken English voice drills."
  }
];

export const taskBreakdown = [
  "Audit every table and label it as tenant-owned or global/shared before touching production data.",
  "Create the tenant root model and a user-to-tenant membership table mapped to Supabase Auth users.",
  "Add tenant_id to all tenant-owned tables, backfill legacy rows, then enforce NOT NULL and indexing.",
  "Replace global uniqueness and foreign keys with tenant-safe composite constraints where needed.",
  "Enable RLS on each tenant-owned table and add SELECT, INSERT, UPDATE, and DELETE policies.",
  "Update API writes so tenant_id always comes from authenticated context, never from the client payload.",
  "Add isolation tests for positive and negative access paths, then roll out table by table."
];

export const schemaChanges = [
  "Add `public.tenants` as the organization root and `public.user_profiles` as the auth-to-tenant mapping table.",
  "Store `tenant_id uuid not null` on every customer-owned row such as students, classrooms, assessments, and notes.",
  "Add an index on each `tenant_id` and convert global unique keys into scoped ones like `unique (tenant_id, external_student_id)`.",
  "Use composite foreign keys like `(student_id, tenant_id)` to stop cross-tenant child-row references.",
  "Keep truly shared catalogs global, for example curriculum templates or language packs."
];

export const apiChanges = `// Express example: tenant_id is stamped by the server, not trusted from the body.
app.post("/api/demo/students", requireDemoUser, (req, res) => {
  const student = {
    id: createStudentId(req.user.tenantId),
    tenantId: req.user.tenantId,
    name: req.body.name,
    grade: req.body.grade,
    learningTrack: req.body.learningTrack,
    city: req.body.city
  };

  state.students.push(student);
  res.status(201).json(student);
});

app.get("/api/demo/students/:id", requireDemoUser, (req, res) => {
  const student = state.students.find((item) => item.id === req.params.id);

  if (!student || student.tenantId !== req.user.tenantId) {
    return res.status(404).json({ error: "not_found" });
  }

  res.json(student);
});`;

export const testQueries = `-- Simulate a Tenant A user in Supabase/Postgres tests
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select count(*) from public.students;
select count(*) from public.students where id = 'stu-a-101';

-- Switch to Tenant B and retry the same lookup
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) from public.students where id = 'stu-a-101';

-- Expected: Tenant A sees its row, Tenant B gets 0 rows.`;

export const summary = [
  "We can retrofit multi-tenancy without a rewrite by adding tenant_id to customer-owned tables.",
  "RLS moves tenant isolation into PostgreSQL, so accidental API bugs do not expose cross-customer data.",
  "The first safe milestone is students plus child tables, then the same pattern rolls across the rest of the schema.",
  "The biggest delivery risk is legacy backfill quality and missing tenant-scoped foreign keys on child records.",
  "I would escalate only tenant-membership rules, internal support access, and any planned cross-tenant analytics."
];

export function getSolution(sqlMigration) {
  return {
    title: "ODEE Multi-Tenant Isolation Plan",
    subtitle: "Supabase-ready architecture with a live frontend/backend isolation demo",
    taskBreakdown,
    schemaChanges,
    sqlMigration,
    apiChanges,
    testQueries,
    summary
  };
}
