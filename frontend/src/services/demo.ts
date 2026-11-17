import { getLanguage } from "../i18n/core.ts";

const key = "taskflow.demo.v1";
export const isPublicDemo = import.meta.env?.VITE_PUBLIC_DEMO === "true";
export const isDemo = () => isPublicDemo || sessionStorage.getItem("taskflow.preview") === "true";
export function startDemo() {
  sessionStorage.setItem("taskflow.preview", "true");
}
const exampleDate = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    "T12:00:00Z"
  );
};
const initial = {
  workspaces: [
    {
      id: "studio",
      name: "Estúdio de produto",
      description: "Planejamento e entregas da equipe.",
      createdAt: "2026-11-01",
    },
  ],
  projects: [
    {
      id: "website",
      startDate: exampleDate(-4),
      dueDate: exampleDate(14),
      workspaceId: "studio",
      name: "Novo site institucional",
      description: "Uma experiência mais clara para apresentar o produto.",
      status: "Active",
    },
    {
      id: "app",
      startDate: exampleDate(-7),
      dueDate: exampleDate(10),
      workspaceId: "studio",
      name: "Experiência do aplicativo",
      description: "Melhorias nos principais fluxos de uso.",
      status: "Active",
    },
  ],
  tasks: [
    {
      id: "t1",
      dueDate: exampleDate(3),
      assignedToId: "camila",
      assignedToName: "Camila Nunes",
      projectId: "website",
      title: "Revisar a navegação principal",
      description: "Validar os caminhos entre as páginas com a equipe.",
      status: "InProgress",
      priority: "High",
    },
    {
      id: "t2",
      dueDate: exampleDate(7),
      assignedToId: "renato",
      assignedToName: "Renato Lima",
      projectId: "website",
      title: "Preparar conteúdo das páginas",
      description: "Organizar textos e materiais para publicação.",
      status: "ToDo",
      priority: "Medium",
    },
    {
      id: "t3",
      dueDate: exampleDate(10),
      projectId: "app",
      title: "Validar o fluxo de cadastro",
      description: "Conferir mensagens de orientação e estados de erro.",
      status: "ToDo",
      priority: "High",
    },
    {
      id: "t4",
      projectId: "app",
      title: "Definir estrutura dos formulários",
      description: "Documentar campos e comportamentos.",
      status: "Done",
      priority: "Low",
    },
  ],
};
export const demoStorageKey = key;
export type DemoMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  workspaceId: string;
  workspaceName?: string;
};
export type DemoActivity = {
  id: string;
  resource: string;
  title: string;
  action: string;
  createdAt: string;
  actorName?: string;
};
export type UserNotification = {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};
const seedMembers: DemoMember[] = [
  {
    id: "camila",
    name: "Camila Nunes",
    email: "camila@example.invalid",
    role: "Responsável",
    workspaceId: "studio",
  },
  {
    id: "renato",
    name: "Renato Lima",
    email: "renato@example.invalid",
    role: "Colaborador",
    workspaceId: "studio",
  },
];
const sampleCopy: Record<string, string> = {
  "Estúdio de produto": "Product studio",
  "Planejamento e entregas da equipe.": "Team planning and delivery.",
  "Novo site institucional": "New company website",
  "Uma experiência mais clara para apresentar o produto.":
    "A clearer way to introduce the product.",
  "Experiência do aplicativo": "App experience",
  "Melhorias nos principais fluxos de uso.": "Improvements to core user journeys.",
  "Revisar a navegação principal": "Review primary navigation",
  "Validar os caminhos entre as páginas com a equipe.": "Validate page journeys with the team.",
  "Preparar conteúdo das páginas": "Prepare page content",
  "Organizar textos e materiais para publicação.": "Organize copy and assets for publication.",
  "Validar o fluxo de cadastro": "Validate the sign-up flow",
  "Conferir mensagens de orientação e estados de erro.":
    "Review guidance messages and error states.",
  "Definir estrutura dos formulários": "Define form structure",
  "Documentar campos e comportamentos.": "Document fields and behavior.",
  "Camila Nunes": "Camila Nunes",
  "Renato Lima": "Renato Lima",
};
const portugueseCopy = Object.fromEntries(
  Object.entries(sampleCopy).map(([portuguese, english]) => [english, portuguese]),
);
function localizeSample(value: any): any {
  if (Array.isArray(value)) return value.map(localizeSample);
  if (!value || typeof value !== "object") return value;
  const copy = getLanguage() === "en" ? sampleCopy : portugueseCopy;
  return Object.fromEntries(
    Object.entries(value).map(([field, content]) => [
      field,
      typeof content === "string" &&
      ["name", "title", "description", "assignedToName"].includes(field)
        ? (copy[content] ?? content)
        : localizeSample(content),
    ]),
  );
}
function demoNestedResource(
  db: Record<string, Array<Record<string, any>>>,
  path: string[],
  method: string,
  body: any,
): { data: any; status: number } | null {
  const [kind, id, resource, relatedId] = path;
  if (!kind || !id || !resource) return null;
  const record = db[kind]?.find((item) => item["id"] === id);
  if (!record) throw new Error("Registro não encontrado.");
  const workspaceId = kind === "workspaces"
    ? id
    : db["projects"]?.find((project) => project["id"] === record["projectId"])?.["workspaceId"];
  if (!workspaceId) throw new Error("Espaço de trabalho não encontrado.");

  if (kind === "workspaces" && resource === "labels" && !relatedId) {
    db["labels"] ??= [];
    if (method === "get") {
      return { data: db["labels"].filter((label) => label["workspaceId"] === workspaceId), status: 200 };
    }
    if (method === "post") {
      const name = body?.name?.trim();
      if (!name || name.length > 50 || !/^#[0-9a-f]{6}$/i.test(body?.color || ""))
        throw new Error("Informe uma etiqueta e uma cor válidas.");
      if (db["labels"]!.some((label) => label["workspaceId"] === workspaceId && label["name"] === name))
        throw new Error("Já existe uma etiqueta com esse nome neste espaço.");
      const label = { id: crypto.randomUUID(), workspaceId, name, color: body.color.toUpperCase() };
      db["labels"].push(label);
      return { data: label, status: 201 };
    }
  }

  if (kind === "tasks" && resource === "labels" && !relatedId) {
    db["labels"] ??= [];
    db["taskLabels"] ??= [];
    if (method === "get") {
      const ids = db["taskLabels"].filter((link) => link["taskId"] === id).map((link) => link["labelId"]);
      return { data: db["labels"].filter((label) => ids.includes(label["id"])), status: 200 };
    }
    if (method === "put") {
      const ids = [...new Set(body?.labelIds || [])];
      if (ids.some((labelId) => !db["labels"]!.some((label) => label["id"] === labelId && label["workspaceId"] === workspaceId)))
        throw new Error("Todas as etiquetas precisam pertencer ao mesmo espaço da tarefa.");
      db["taskLabels"] = db["taskLabels"].filter((link) => link["taskId"] !== id);
      db["taskLabels"].push(...ids.map((labelId) => ({ taskId: id, labelId })));
      return { data: null, status: 204 };
    }
  }

  if (kind === "tasks" && resource === "dependencies") {
    db["taskDependencies"] ??= [];
    if (method === "get" && !relatedId) {
      return { data: db["taskDependencies"].filter((link) => link["taskId"] === id).map((link) => {
        const prerequisite = db["tasks"]!.find((task) => task["id"] === link["dependsOnTaskId"]);
        return { dependsOnTaskId: link["dependsOnTaskId"], title: prerequisite?.["title"], status: prerequisite?.["status"] };
      }), status: 200 };
    }
    if (method === "post" && !relatedId) {
      const prerequisite = db["tasks"]!.find((task) => task["id"] === body?.dependsOnTaskId);
      const prerequisiteWorkspace = db["projects"]!.find((project) => project["id"] === prerequisite?.["projectId"])?.["workspaceId"];
      if (!prerequisite || prerequisiteWorkspace !== workspaceId || prerequisite["id"] === id)
        throw new Error("As tarefas precisam pertencer ao mesmo espaço e ser diferentes.");
      if (db["taskDependencies"].some((link) => link["taskId"] === id && link["dependsOnTaskId"] === prerequisite["id"]))
        throw new Error("Essa dependência já existe.");
      const pending = [prerequisite["id"]];
      const visited = new Set<string>();
      while (pending.length) {
        const current = pending.shift()!;
        if (current === id) throw new Error("Essa dependência criaria um ciclo.");
        if (!visited.has(current)) {
          visited.add(current);
          pending.push(...db["taskDependencies"].filter((link) => link["taskId"] === current).map((link) => link["dependsOnTaskId"]));
        }
      }
      db["taskDependencies"].push({ taskId: id, dependsOnTaskId: prerequisite["id"] });
      return { data: { taskId: id, dependsOnTaskId: prerequisite["id"] }, status: 201 };
    }
    if (method === "delete" && relatedId) {
      if (!db["taskDependencies"].some((link) => link["taskId"] === id && link["dependsOnTaskId"] === relatedId))
        throw new Error("Dependência não encontrada.");
      db["taskDependencies"] = db["taskDependencies"].filter((link) => link["taskId"] !== id || link["dependsOnTaskId"] !== relatedId);
      return { data: null, status: 204 };
    }
  }

  if (kind === "tasks" && resource === "subtasks") {
    db["subtasks"] ??= [];
    if (method === "get" && !relatedId)
      return { data: db["subtasks"].filter(item => item["taskId"] === id), status: 200 };
    const item = db["subtasks"].find(item => item["taskId"] === id && item["id"] === relatedId);
    if (relatedId && !item) throw new Error("Subtarefa não encontrada.");
    if ((method === "post" && !relatedId) || (method === "put" && relatedId)) {
      const title = body?.title?.trim();
      if (!title || title.length > 200 || typeof body?.isCompleted !== "boolean")
        throw new Error("A subtarefa deve ter entre 1 e 200 caracteres.");
      if (item) { item["title"] = title; item["isCompleted"] = body.isCompleted; }
      else db["subtasks"].push({ id: crypto.randomUUID(), taskId: id, title, isCompleted: body.isCompleted, createdAt: new Date().toISOString() });
      return { data: item || db["subtasks"].at(-1), status: item ? 204 : 201 };
    }
    if (method === "delete" && item) {
      db["subtasks"] = db["subtasks"].filter(subtask => subtask !== item);
      return { data: null, status: 204 };
    }
  }

  if (kind === "tasks" && resource === "comments" && !relatedId) {
    db["comments"] ??= [];
    if (method === "get") return { data: db["comments"].filter((comment) => comment["taskId"] === id), status: 200 };
    if (method === "post") {
      const content = body?.content?.trim();
      if (!content || content.length > 2000) throw new Error("O comentário deve ter entre 1 e 2.000 caracteres.");
      const mentionedIds = [...new Set(body?.mentionedUserIds || [])];
      if (mentionedIds.some((userId) => !db["members"]?.some((member) => member["id"] === userId && member["workspaceId"] === workspaceId)))
        throw new Error("Só é possível mencionar pessoas deste espaço.");
      const comment = {
        id: crypto.randomUUID(), taskId: id, content,
        authorName: getLanguage() === "en" ? "Demo user" : "Usuário de demonstração",
        createdAt: new Date().toISOString(),
      };
      db["comments"].push(comment);
      return { data: comment, status: 201 };
    }
  }
  throw new Error("Recurso indisponível na demonstração.");
}

export async function demoAdapter(config: any) {
  const db = JSON.parse(localStorage.getItem(key) || JSON.stringify(initial)) as Record<
    string,
    Array<Record<string, any>>
  >;
  db["members"] ??= seedMembers.map((m) => ({ ...m }));
  db["activities"] ??= [];
  const path = (config.url || "").replace("/api/", "").split("/");
  const [kind, id] = path;
  if (!["workspaces", "projects", "tasks", "members", "activities", "notifications"].includes(kind))
    throw new Error("Recurso indisponível na demonstração.");
  db["notifications"] ??= [];
  const method = (config.method || "get").toLowerCase();
  const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  const nested = demoNestedResource(db, path, method, body);
  if (nested) {
    localStorage.setItem(key, JSON.stringify(db));
    return { ...nested, data: method === "get" ? localizeSample(nested.data) : nested.data, statusText: "OK", headers: {}, config };
  }
  if (kind === "activities" && method !== "get") throw new Error("O histórico é somente leitura.");
  if (kind === "notifications" && id === "read-all" && method === "put") {
    for (const notification of db[kind]!) notification["isRead"] = true;
    localStorage.setItem(key, JSON.stringify(db));
    return { data: null, status: 204, statusText: "No Content", headers: {}, config };
  }
  let data: any = db[kind];
  let previous: any;
  if (id) {
    previous = db[kind]!.find((x) => x["id"] === id);
    if (!previous) throw new Error("Registro não encontrado.");
    data = previous;
  }
  if (kind === "members" && ["post", "put"].includes(method)) {
    if (
      !body?.name?.trim() ||
      !body?.email?.includes("@") ||
      !db["workspaces"]?.some((w) => w["id"] === body.workspaceId)
    )
      throw new Error("Informe nome, e-mail e um espaço válido.");
    if (
      db[kind]!.some((m) => m["email"].toLowerCase() === body.email.toLowerCase() && m["id"] !== id)
    )
      throw new Error("Este e-mail já está na equipe de demonstração.");
  }
  if (method === "post") {
    data = { ...body, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    db[kind]!.push(data);
  }
  if (method === "put") {
    if (!id) throw new Error("Informe o registro a atualizar.");
    Object.assign(data, body, { updatedAt: new Date().toISOString() });
  }
  if (method === "delete") {
    if (!id) throw new Error("Informe o registro a excluir.");
    const removedProjectIds = kind === "projects"
      ? [id]
      : kind === "workspaces"
        ? db["projects"]!.filter((project) => project["workspaceId"] === id).map((project) => project["id"])
        : [];
    const removedTaskIds = kind === "tasks"
      ? [id]
      : db["tasks"]!.filter((task) => removedProjectIds.includes(task["projectId"])).map((task) => task["id"]);
    db[kind] = db[kind]!.filter((x) => x["id"] !== id);
    const projectIds =
      kind === "workspaces"
        ? db["projects"]!.filter((x) => x["workspaceId"] === id).map((x) => x["id"])
        : kind === "projects"
          ? [id]
          : [];
    if (projectIds.length) {
      db["tasks"] = db["tasks"]!.filter((x) => !projectIds.includes(x["projectId"]));
      db["projects"] = db["projects"]!.filter((x) => !projectIds.includes(x["id"]));
    }
    if (kind === "workspaces")
      db["members"] = db["members"]!.filter((x) => x["workspaceId"] !== id);
    if (removedTaskIds.length) {
      db["taskLabels"] = (db["taskLabels"] || []).filter((link) => !removedTaskIds.includes(link["taskId"]));
      db["taskDependencies"] = (db["taskDependencies"] || []).filter((link) =>
        !removedTaskIds.includes(link["taskId"]) && !removedTaskIds.includes(link["dependsOnTaskId"]));
      db["comments"] = (db["comments"] || []).filter((comment) => !removedTaskIds.includes(comment["taskId"]));
      db["subtasks"] = (db["subtasks"] || []).filter((item) => !removedTaskIds.includes(item["taskId"]));
    }
    if (kind === "workspaces")
      db["labels"] = (db["labels"] || []).filter((label) => label["workspaceId"] !== id);
    if (kind === "members")
      for (const t of db["tasks"]!)
        if (t["assignedToId"] === id) {
          t["assignedToId"] = null;
          t["assignedToName"] = null;
        }
  }
  if (kind === "tasks" && ["post", "put"].includes(method)) {
    const member = db["members"]!.find((m) => m["id"] === data.assignedToId);
    data.assignedToName = member?.["name"] || null;
  }
  if (method !== "get") {
    db["activities"]!.unshift({
      id: crypto.randomUUID(),
      resource: kind,
      title: data?.title || data?.name || previous?.title || previous?.name || "Registro",
      action: method === "post" ? "criado" : method === "delete" ? "excluído" : "atualizado",
      createdAt: new Date().toISOString(),
    });
  }
  if (method === "get" && !id && config.params)
    data = data.filter((x: any) =>
      Object.entries(config.params).every(([k, v]) => !v || x[k] === v),
    );
  localStorage.setItem(key, JSON.stringify(db));
  if (kind === "tasks" && method === "get") {
    const comments = new Map<string, number>();
    const subtasks = new Map<string, { total: number; complete: number }>();
    const labels = new Map((db["labels"] || []).map(label => [label["id"], label]));
    const assignedLabels = new Map<string, Array<Record<string, any>>>();
    for (const comment of db["comments"] || []) comments.set(comment["taskId"], (comments.get(comment["taskId"]) || 0) + 1);
    for (const item of db["subtasks"] || []) {
      const counts = subtasks.get(item["taskId"]) || { total: 0, complete: 0 };
      counts.total++; if (item["isCompleted"]) counts.complete++;
      subtasks.set(item["taskId"], counts);
    }
    for (const link of db["taskLabels"] || []) {
      const label = labels.get(link["labelId"]);
      if (label) assignedLabels.set(link["taskId"], [...(assignedLabels.get(link["taskId"]) || []), label]);
    }
    const summary = (task: Record<string, any>) => ({ ...task,
      commentCount: comments.get(task["id"]) || 0,
      subtaskCount: subtasks.get(task["id"])?.total || 0,
      completedSubtaskCount: subtasks.get(task["id"])?.complete || 0,
      labels: (assignedLabels.get(task["id"]) || []).sort((a, b) => a["name"].localeCompare(b["name"])),
    });
    data = Array.isArray(data) ? data.map(summary) : summary(data);
  }
  return {
    data: method === "get" ? localizeSample(data) : data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}
