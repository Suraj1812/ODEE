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
  sqlMigration: document.querySelector("#sqlMigration"),
  apiChanges: document.querySelector("#apiChanges"),
  testQueries: document.querySelector("#testQueries"),
  studentForm: document.querySelector("#studentForm"),
  resetButton: document.querySelector("#resetButton"),
  attackButton: document.querySelector("#attackButton"),
  attackResult: document.querySelector("#attackResult"),
  modalTriggers: document.querySelectorAll("[data-modal-target]"),
  modalClosers: document.querySelectorAll("[data-close-modal]"),
  modals: document.querySelectorAll(".modal-shell")
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
    <span class="context-label">Active tenant</span>
    <strong>${context.user.tenantName}</strong>
    <span class="context-subtitle">${context.user.name} · ${context.user.role}</span>
    <div class="context-meta">
      <span class="mini-chip">Tenant: ${context.user.tenantId}</span>
      <span class="mini-chip">Students: ${context.visibleStudents}</span>
    </div>
  `;
}

function renderStudents(students) {
  elements.studentList.innerHTML = "";

  if (students.length === 0) {
    elements.studentList.innerHTML = `<div class="student-empty">No students in this tenant.</div>`;
    return;
  }

  students.forEach((student) => {
    const article = document.createElement("article");
    article.className = "student-row";
    const initials = student.name
      .split(" ")
      .map((part) => part[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase();

    article.innerHTML = `
      <div class="student-primary">
        <span class="student-avatar">${initials}</span>
        <div class="student-copy">
          <h4>${student.name}</h4>
          <p>${student.id}</p>
        </div>
      </div>
      <span class="pill">${student.grade}</span>
      <span class="track-text">${student.learningTrack}</span>
      <span class="city-text">${student.city}</span>
    `;
    elements.studentList.appendChild(article);
  });
}

function renderSolution(solution) {
  renderCode(elements.sqlMigration, solution.sqlMigration);
  renderCode(elements.apiChanges, solution.apiChanges);
  renderCode(elements.testQueries, solution.testQueries);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  const openModalExists = Array.from(elements.modals).some(
    (item) => !item.classList.contains("hidden")
  );

  if (!openModalExists) {
    document.body.classList.remove("modal-open");
  }
}

function closeAllModals() {
  elements.modals.forEach((modal) => closeModal(modal));
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
  closeAllModals();
  elements.attackResult.textContent = "Student created.";
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

elements.modalTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    openModal(trigger.dataset.modalTarget);
  });
});

elements.modalClosers.forEach((closer) => {
  closer.addEventListener("click", () => {
    const modal = closer.closest(".modal-shell");
    if (modal) {
      closeModal(modal);
    } else {
      closeAllModals();
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
  }
});

bootstrap().catch((error) => {
  elements.contextBox.innerHTML = `<strong>App failed to load</strong><span>${error.message}</span>`;
});
