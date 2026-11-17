import test from "node:test";
import assert from "node:assert/strict";
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
  };
};
Object.defineProperty(globalThis, "localStorage", { value: memory(), configurable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: memory(), configurable: true });
const { isDemo, startDemo, demoAdapter } = await import("./demo.ts");
const { setLanguage } = await import("../i18n/core.ts");
test("preview requires explicit opt-in and does not create a real access token", () => {
  sessionStorage.clear();
  assert.equal(isDemo(), false);
  startDemo();
  assert.equal(isDemo(), true);
  assert.equal(localStorage.getItem("accessToken"), null);
});
test("preview creation, completion and deletion persist between requests", async () => {
  localStorage.clear();
  const created = await demoAdapter({
    url: "/api/tasks",
    method: "post",
    data: JSON.stringify({ title: "Validation", projectId: "website", status: "ToDo" }),
  });
  const id = created.data.id;
  assert.ok(id);
  await demoAdapter({ url: "/api/tasks/" + id, method: "put", data: { status: "Done" } });
  assert.equal(
    (await demoAdapter({ url: "/api/tasks", method: "get" })).data.find((t) => t.id === id).status,
    "Done",
  );
  await demoAdapter({ url: "/api/tasks/" + id, method: "delete" });
  assert.equal(
    (await demoAdapter({ url: "/api/tasks", method: "get" })).data.some((t) => t.id === id),
    false,
  );
});
test("project filters isolate tasks and empty filters retain all records", async () => {
  localStorage.clear();
  const filtered = await demoAdapter({
    url: "/api/tasks",
    method: "get",
    params: { projectId: "website" },
  });
  assert.ok(filtered.data.length);
  assert.ok(filtered.data.every((t) => t.projectId === "website"));
  assert.equal(
    (await demoAdapter({ url: "/api/tasks", method: "get", params: { projectId: "" } })).data
      .length,
    4,
  );
});
test("sample preview content follows the selected language without rewriting saved data", async () => {
  localStorage.clear();
  setLanguage("en");
  const english = await demoAdapter({ url: "/api/tasks", method: "get" });
  assert.equal(english.data[0].title, "Review primary navigation");
  assert.equal(english.data[0].assignedToName, "Camila Nunes");
  assert.equal(
    localStorage.getItem("taskflow.demo.v1").includes("Revisar a navegação principal"),
    true,
  );
  setLanguage("pt-BR");
  const portuguese = await demoAdapter({ url: "/api/tasks", method: "get" });
  assert.equal(portuguese.data[0].title, "Revisar a navegação principal");
  setLanguage("en");
});
test("unknown resources and nonexistent updates fail visibly", async () => {
  await assert.rejects(() => demoAdapter({ url: "/api/unknown", method: "get" }));
  await assert.rejects(() =>
    demoAdapter({ url: "/api/tasks/nonexistent", method: "put", data: { status: "Done" } }),
  );
});

test("detail reads and edits retain the same record and produce a local activity", async () => {
  localStorage.clear();
  const first = (await demoAdapter({ url: "/api/tasks/t1", method: "get" })).data;
  assert.equal(first.id, "t1");
  await demoAdapter({
    url: "/api/tasks/t1",
    method: "put",
    data: { title: "Revisado", dueDate: "2026-11-20T12:00:00Z" },
  });
  assert.equal((await demoAdapter({ url: "/api/tasks/t1", method: "get" })).data.title, "Revisado");
  const events = (await demoAdapter({ url: "/api/activities", method: "get" })).data;
  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Revisado");
  await assert.rejects(() =>
    demoAdapter({ url: "/api/activities", method: "post", data: { title: "fake" } }),
  );
});
test("task editor collaboration lists and changes use local demo collections", async () => {
  localStorage.clear();
  for (const url of [
    "/api/workspaces/studio/labels",
    "/api/tasks/t1/labels",
    "/api/tasks/t1/dependencies",
    "/api/tasks/t1/comments",
  ]) {
    assert.deepEqual((await demoAdapter({ url, method: "get" })).data, []);
  }
  const label = (await demoAdapter({
    url: "/api/workspaces/studio/labels", method: "post",
    data: { name: "Design", color: "#557A66" },
  })).data;
  await demoAdapter({ url: "/api/tasks/t1/labels", method: "put", data: { labelIds: [label.id] } });
  assert.equal((await demoAdapter({ url: "/api/tasks/t1/labels", method: "get" })).data[0].name, "Design");

  await demoAdapter({ url: "/api/tasks/t1/dependencies", method: "post", data: { dependsOnTaskId: "t2" } });
  assert.equal((await demoAdapter({ url: "/api/tasks/t1/dependencies", method: "get" })).data[0].dependsOnTaskId, "t2");
  await demoAdapter({ url: "/api/tasks/t1/dependencies/t2", method: "delete" });
  assert.deepEqual((await demoAdapter({ url: "/api/tasks/t1/dependencies", method: "get" })).data, []);

  await demoAdapter({ url: "/api/tasks/t1/comments", method: "post", data: { content: "Review this", mentionedUserIds: ["camila"] } });
  assert.equal((await demoAdapter({ url: "/api/tasks/t1/comments", method: "get" })).data[0].content, "Review this");
});

test("demo collaboration rejects invalid references and dependency cycles", async () => {
  localStorage.clear();
  await assert.rejects(() => demoAdapter({ url: "/api/tasks/t1/labels", method: "put", data: { labelIds: ["missing"] } }));
  await assert.rejects(() => demoAdapter({ url: "/api/tasks/t1/comments", method: "post", data: { content: "  " } }));
  await assert.rejects(() => demoAdapter({ url: "/api/tasks/t1/unknown", method: "get" }));
  await demoAdapter({ url: "/api/tasks/t1/dependencies", method: "post", data: { dependsOnTaskId: "t2" } });
  await assert.rejects(() => demoAdapter({ url: "/api/tasks/t2/dependencies", method: "post", data: { dependsOnTaskId: "t1" } }));
  assert.deepEqual((await demoAdapter({ url: "/api/tasks/t2/dependencies", method: "get" })).data, []);
});

test("deleting a demo task clears its collaboration records", async () => {
  localStorage.clear();
  const label = (await demoAdapter({ url: "/api/workspaces/studio/labels", method: "post", data: { name: "Design", color: "#557A66" } })).data;
  await demoAdapter({ url: "/api/tasks/t1/labels", method: "put", data: { labelIds: [label.id] } });
  await demoAdapter({ url: "/api/tasks/t2/dependencies", method: "post", data: { dependsOnTaskId: "t1" } });
  await demoAdapter({ url: "/api/tasks/t1/comments", method: "post", data: { content: "Review this" } });
  await demoAdapter({ url: "/api/tasks/t1", method: "delete" });
  assert.deepEqual((await demoAdapter({ url: "/api/tasks/t2/dependencies", method: "get" })).data, []);
  const stored = JSON.parse(localStorage.getItem("taskflow.demo.v1"));
  assert.deepEqual(stored.taskLabels, []);
  assert.deepEqual(stored.comments, []);
});

test("demo members reject duplicate email and removal clears task assignment", async () => {
  localStorage.clear();
  await demoAdapter({ url: "/api/tasks/t1", method: "put", data: { assignedToId: "camila" } });
  assert.equal(
    (await demoAdapter({ url: "/api/tasks/t1", method: "get" })).data.assignedToName,
    "Camila Nunes",
  );
  await assert.rejects(() =>
    demoAdapter({
      url: "/api/members",
      method: "post",
      data: { name: "Other", email: "camila@example.invalid", workspaceId: "studio" },
    }),
  );
  await demoAdapter({ url: "/api/members/camila", method: "delete" });
  assert.equal(
    (await demoAdapter({ url: "/api/tasks/t1", method: "get" })).data.assignedToId,
    null,
  );
});
test("deleting a demo workspace cascades its projects, tasks and members", async () => {
  localStorage.clear();
  await demoAdapter({ url: "/api/workspaces/studio", method: "delete" });
  for (const kind of ["projects", "tasks", "members"])
    assert.equal((await demoAdapter({ url: "/api/" + kind, method: "get" })).data.length, 0);
  await assert.rejects(() => demoAdapter({ url: "/api/tasks/t1", method: "get" }));
});

test("checklists and card summaries follow edits and are isolated by task", async () => {
  localStorage.clear();
  const first = (await demoAdapter({ url: "/api/tasks/t1/subtasks", method: "post", data: { title: "  Check spacing  ", isCompleted: false } })).data;
  const second = (await demoAdapter({ url: "/api/tasks/t1/subtasks", method: "post", data: { title: "Check keyboard", isCompleted: true } })).data;
  assert.equal(first.title, "Check spacing");
  await demoAdapter({ url: "/api/tasks/t1/comments", method: "post", data: { content: "Ready to review" } });
  const label = (await demoAdapter({ url: "/api/workspaces/studio/labels", method: "post", data: { name: "UX", color: "#244C3B" } })).data;
  await demoAdapter({ url: "/api/tasks/t1/labels", method: "put", data: { labelIds: [label.id] } });
  const cards = (await demoAdapter({ url: "/api/tasks", method: "get" })).data;
  const summary = cards.find(item => item.id === "t1");
  assert.equal(summary.commentCount, 1);
  assert.equal(summary.subtaskCount, 2);
  assert.equal(summary.completedSubtaskCount, 1);
  assert.equal(summary.labels[0].name, "UX");
  assert.equal(cards.find(item => item.id === "t2").subtaskCount, 0);
  assert.deepEqual((await demoAdapter({ url: "/api/tasks/t2/subtasks", method: "get" })).data, []);
  await assert.rejects(() => demoAdapter({ url: `/api/tasks/t2/subtasks/${first.id}`, method: "put", data: { title: "Wrong task", isCompleted: true } }));
  await assert.rejects(() => demoAdapter({ url: "/api/tasks/t1/subtasks", method: "post", data: { title: " ", isCompleted: false } }));
  await assert.rejects(() => demoAdapter({ url: "/api/tasks/t1/subtasks", method: "post", data: { title: "x".repeat(201), isCompleted: false } }));
  await demoAdapter({ url: `/api/tasks/t1/subtasks/${first.id}`, method: "put", data: { title: first.title, isCompleted: true } });
  assert.equal((await demoAdapter({ url: "/api/tasks/t1", method: "get" })).data.completedSubtaskCount, 2);
  await demoAdapter({ url: `/api/tasks/t1/subtasks/${second.id}`, method: "delete" });
  assert.equal((await demoAdapter({ url: "/api/tasks/t1", method: "get" })).data.subtaskCount, 1);
  await demoAdapter({ url: "/api/tasks/t1", method: "delete" });
  assert.deepEqual(JSON.parse(localStorage.getItem("taskflow.demo.v1")).subtasks, []);
});
