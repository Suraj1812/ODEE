import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/app.js";

function startTestServer() {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

test("tenant A only sees tenant A students", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/demo/students`, {
      headers: {
        "x-demo-user": "user-tenant-a-admin"
      }
    });

    assert.equal(response.status, 200);
    const students = await response.json();
    assert.equal(students.length, 2);
    assert.ok(students.every((student) => student.tenantId === "tenant-a"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("tenant B cannot read tenant A student by id", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/demo/students/stu-a-101`, {
      headers: {
        "x-demo-user": "user-tenant-b-admin"
      }
    });

    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.error, "not_found");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server stamps tenant_id from authenticated context", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const createResponse = await fetch(`${baseUrl}/api/demo/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-demo-user": "user-tenant-b-admin"
      },
      body: JSON.stringify({
        name: "Sneha Kulkarni",
        grade: "Class 9",
        learningTrack: "AI Reading Coach",
        city: "Dharwad",
        tenantId: "tenant-a"
      })
    });

    assert.equal(createResponse.status, 201);
    const student = await createResponse.json();
    assert.equal(student.tenantId, "tenant-b");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
