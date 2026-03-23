const state = {
  userId: localStorage.getItem("odee-demo-user") || "",
  users: [],
  solution: null
};

const blockTargets = {
  "tenant-a": "stu-b-201",
  "tenant-b": "stu-a-101"
};

const elements = {
  userSelect: document.querySelector("#userSelect"),
  contextBox: document.querySelector("#contextBox"),
  studentList: document.querySelector("#studentList"),
  principles: document.querySelector("#principles"),
  sqlMigration: document.querySelector("#sqlMigration"),
  apiChanges: document.querySelector("#apiChanges"),
  testQueries: document.querySelector("#testQueries"),
  studentForm: document.querySelector("#studentForm"),
  resetButton: document.querySelector("#resetButton"),
  attackButton: document.querySelector("#attackButton"),
  attackResult: document.querySelector("#attackResult")
};

function activeUser() {
  return state.users.find((user) => user.id === state.userId) ?? state.users[0];
}

async function api(path, options = {}) {
  const user = activeUser();
  const headers = new Headers(options.headers || {});

  if (user?.id) {
    headers.set("x-demo-user", user.id);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Request failed");
  }

  return payload;
}

function renderList(target, items) {
  target.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  });
}

function renderCode(target, value) {
  target.textContent = value;
}

function renderUsers() {
  elements.userSelect.innerHTML = "";

  state.users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = `${user.name} · ${user.tenantName} · ${user.role}`;
    elements.userSelect.appendChild(option);
  });

  if (!state.userId && state.users.length > 0) {
    state.userId = state.users[0].id;
  }

  elements.userSelect.value = state.userId;
}

function renderContext(context) {
  elements.contextBox.innerHTML = `
    <strong>${context.user.tenantName}</strong>
    <span>${context.user.name} · ${context.user.role}</span>
    <div class="context-meta">
      <span class="mini-chip">${context.user.tenantId}</span>
      <span class="mini-chip">${context.visibleStudents} visible</span>
    </div>
  `;
}

function renderStudents(students) {
  elements.studentList.innerHTML = "";

  if (students.length === 0) {
    elements.studentList.innerHTML = `<div class="student-card"><p>No students in this tenant.</p></div>`;
    return;
  }

  students.forEach((student) => {
    const article = document.createElement("article");
    article.className = "student-card";
    article.innerHTML = `
      <h4>${student.name}</h4>
      <p>${student.id}</p>
      <div class="student-meta">
        <span class="pill">${student.grade}</span>
        <span class="pill">${student.learningTrack}</span>
        <span class="pill">${student.city}</span>
      </div>
    `;
    elements.studentList.appendChild(article);
  });
}

function renderSolution(solution) {
  renderList(elements.principles, [
    "Rows are scoped by tenant_id.",
    "The server stamps tenant_id on writes.",
    "RLS blocks cross-tenant reads."
  ]);
  renderCode(elements.sqlMigration, solution.sqlMigration);
  renderCode(elements.apiChanges, solution.apiChanges);
  renderCode(elements.testQueries, solution.testQueries);
}

async function refreshDemo() {
  const [context, students] = await Promise.all([
    api("/api/demo/context"),
    api("/api/demo/students")
  ]);

  renderContext(context);
  renderStudents(students);
  elements.attackResult.textContent = "Ready.";
}

async function runAttack() {
  const user = activeUser();
  const targetId = blockTargets[user.tenantId];

  try {
    await api(`/api/demo/students/${targetId}`);
    elements.attackResult.textContent = `Unexpectedly received access to ${targetId}.`;
  } catch (error) {
    elements.attackResult.textContent = `Blocked: ${targetId} -> ${error.message}`;
  }
}

async function bootstrap() {
  const [users, solution] = await Promise.all([
    api("/api/demo/users", { headers: {} }),
    api("/api/solution", { headers: {} })
  ]);

  state.users = users;
  state.solution = solution;

  if (!state.users.find((user) => user.id === state.userId)) {
    state.userId = state.users[0]?.id || "";
  }

  renderUsers();
  renderSolution(solution);
  await refreshDemo();
}

elements.userSelect.addEventListener("change", async (event) => {
  state.userId = event.target.value;
  localStorage.setItem("odee-demo-user", state.userId);
  await refreshDemo();
});

elements.studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.studentForm);

  const payload = {
    name: formData.get("name"),
    grade: formData.get("grade"),
    learningTrack: formData.get("learningTrack"),
    city: formData.get("city"),
    tenantId: "do-not-trust-client-tenant"
  };

  await api("/api/demo/students", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  elements.studentForm.reset();
  await refreshDemo();
});

elements.resetButton.addEventListener("click", async () => {
  await api("/api/demo/reset", {
    method: "POST"
  });
  await refreshDemo();
});

elements.attackButton.addEventListener("click", async () => {
  await runAttack();
});

bootstrap().catch((error) => {
  elements.contextBox.innerHTML = `<strong>App failed to load</strong><span>${error.message}</span>`;
});
