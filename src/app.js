import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  demoUsers,
  getSolution,
  initialNotes,
  initialStudents
} from "./data/solution.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260323_multi_tenant_isolation.sql"
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createState() {
  return {
    users: clone(demoUsers),
    students: clone(initialStudents),
    notes: clone(initialNotes)
  };
}

function createStudentId(tenantId, studentCount) {
  const prefix = tenantId === "tenant-a" ? "stu-a" : "stu-b";
  return `${prefix}-${300 + studentCount}`;
}

function resolveDemoUser(req, users) {
  const requestedUserId = req.header("x-demo-user");
  if (!requestedUserId) {
    return users[0];
  }

  return users.find((user) => user.id === requestedUserId) ?? null;
}

export function createApp() {
  const app = express();
  const state = createState();
  const sqlMigration = fs.readFileSync(migrationPath, "utf8");

  app.use(express.json());
  app.use(express.static(publicDir));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "odee-multi-tenant-demo",
      users: state.users.length,
      students: state.students.length
    });
  });

  app.get("/api/solution", (_req, res) => {
    res.json(getSolution(sqlMigration));
  });

  app.get("/api/demo/users", (_req, res) => {
    res.json(state.users);
  });

  app.use("/api/demo", (req, res, next) => {
    const user = resolveDemoUser(req, state.users);

    if (!user) {
      return res.status(401).json({ error: "invalid_demo_user" });
    }

    req.user = user;
    next();
  });

  app.get("/api/demo/context", (req, res) => {
    res.json({
      user: req.user,
      visibleStudents: state.students.filter(
        (student) => student.tenantId === req.user.tenantId
      ).length
    });
  });

  app.get("/api/demo/students", (req, res) => {
    const visibleStudents = state.students.filter(
      (student) => student.tenantId === req.user.tenantId
    );

    res.json(visibleStudents);
  });

  app.get("/api/demo/students/:id", (req, res) => {
    const student = state.students.find((item) => item.id === req.params.id);

    if (!student || student.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: "not_found" });
    }

    const notes = state.notes.filter((note) => note.studentId === student.id);

    res.json({
      ...student,
      notes
    });
  });

  app.post("/api/demo/students", (req, res) => {
    const student = {
      id: createStudentId(req.user.tenantId, state.students.length),
      tenantId: req.user.tenantId,
      name: String(req.body.name || "").trim(),
      grade: String(req.body.grade || "").trim(),
      learningTrack: String(req.body.learningTrack || "").trim(),
      city: String(req.body.city || "").trim()
    };

    if (!student.name || !student.grade || !student.learningTrack || !student.city) {
      return res.status(400).json({
        error: "validation_failed",
        message: "name, grade, learningTrack, and city are required."
      });
    }

    state.students.push(student);
    res.status(201).json(student);
  });

  app.post("/api/demo/reset", (_req, res) => {
    const nextState = createState();
    state.users.splice(0, state.users.length, ...nextState.users);
    state.students.splice(0, state.students.length, ...nextState.students);
    state.notes.splice(0, state.notes.length, ...nextState.notes);
    res.status(204).end();
  });

  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  return app;
}
