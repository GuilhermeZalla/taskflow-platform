import { t as translate, localizeError } from "@/i18n/core";
import { useLanguage } from "@/i18n/react";
import { useState, useRef, useEffect } from "react";
import { adjacentStage, droppedStage } from "./board";
import { EntityForm } from "@/components/ui/EntityForm";
import { useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, handleApiError } from "@/services/api";
import type { Task } from "@/types";
import { PageHeading, Feedback, action, statusLabel } from "@/components/ui/Shared";
import { useWorkData } from "@/features/work/useWorkData";
import { filterTasks, taskStatus, completed, isOverdue } from "@/features/work/workflow";
import { formatProjectDate } from "@/features/projects/project-list";
export function Tasks() {
  useLanguage();
  const [params, setParams] = useSearchParams();
  const query = useWorkData();
  const cache = useQueryClient();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const filters = {
    search: params.get("search") || "",
    status: params.get("status") || "all",
    priority: params.get("priority") || "all",
    projectId: params.get("projectId") || "",
    sort: params.get("sort") || "priority",
  };
  const [rememberedView, setRememberedView] = useState(() => { try { return localStorage.getItem("taskflow.tasks.view") === "list" ? "list" : "board"; } catch { return "board"; } });
  const view = params.has("view") ? params.get("view") === "board" ? "board" : "list" : rememberedView;
  const [panel, setPanel] = useState<{ id?: string; status?: string } | null>(null);
  const panelRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const moving = useRef(false);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number; target: string } | null>(null);
  const dragRef = useRef<typeof drag>(null);
  function openPanel(value: { id?: string; status?: string }) { opener.current = document.activeElement as HTMLElement; setPanel(value); }
  function closePanel() {
    panelRef.current?.close();
    setPanel(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
      else document.querySelector<HTMLButtonElement>('.view-toggle button[aria-pressed="true"]')?.focus();
    });
  }
  useEffect(() => { if (panel && !panelRef.current?.open) panelRef.current?.showModal(); }, [panel]);
  const update = (key: string, value: string) => {
    if (key === "view") { setRememberedView(value); try { localStorage.setItem("taskflow.tasks.view", value); } catch { /* Session preference still works without storage. */ } }
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true, flushSync: true });
  };
  const items = filterTasks((query.data?.tasks || []).map(task => optimistic[task.id] ? { ...task, status: optimistic[task.id] as Task["status"] } : task), filters);
  async function change(t: Task, status: string, remove = false) {
    if (
      remove &&
      !confirm(
        translate("Excluir a tarefa “") +
          t.title +
          translate("”? Esta ação não pode ser desfeita."),
      )
    )
      return;
    if (moving.current) return;
    moving.current = true;
    if (!remove) setOptimistic({ [t.id]: status });
    setBusy(t.id);
    setMessage("");
    setFailed(false);
    try {
      if (remove) await api.delete("/api/tasks/" + t.id);
      else {
        await api.put("/api/tasks/" + t.id, { ...t, status });
        cache.setQueryData<typeof query.data>(["work-data"], old => old ? { ...old, tasks: old.tasks.map(item => item.id === t.id ? { ...item, status: status as Task["status"] } : item) } : old);
      }
      await cache.invalidateQueries();
      setMessage(remove ? "Tarefa excluída." : "Tarefa atualizada.");
    } catch (e) {
      setFailed(true);
      setMessage(handleApiError(e).message);
    } finally {
      setBusy("");
      moving.current = false;
      setOptimistic({});
    }
  }
  function row(t: Task, asBoardCard = false) {
    return (
      <article className={"task-line task-record" + (asBoardCard ? " task-board-card" : "") + (drag?.id === t.id ? " is-dragging" : "")} key={t.id}
        style={drag?.id === t.id ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}>
        {asBoardCard && <button className="task-drag-handle" disabled={!!busy} aria-label={translate("Mover tarefa") + ": " + t.title} aria-describedby="board-move-help"
          onKeyDown={event => { if (event.key === "Escape") { dragRef.current = null; setDrag(null); return; } if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const next = adjacentStage(taskStatus(t.status), event.key === "ArrowRight" ? 1 : -1); if (next) void change(t, canonicalStatus(next)); }}
          onPointerDown={event => { if (busy || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); const value = { id: t.id, x: event.clientX, y: event.clientY, dx: 0, dy: 0, target: "" }; dragRef.current = value; setDrag(value); }}
          onPointerMove={event => { const current = dragRef.current; if (!current || current.id !== t.id) return; const column = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-board-status]"); const value = { ...current, dx: event.clientX-current.x, dy: event.clientY-current.y, target: column?.dataset["boardStatus"] || "" }; dragRef.current = value; setDrag(value); }}
          onPointerUp={event => { const current = dragRef.current; dragRef.current = null; setDrag(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (current) { const target = droppedStage(taskStatus(t.status), current.target, current.dx, current.dy); if (target) void change(t, canonicalStatus(target)); } }}
          onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>⠿</button>}
        <button
          className={"task-check " + (completed(t.status) ? "done" : taskStatus(t.status))}
          disabled={!!busy}
          aria-label={
            (completed(t.status) ? translate("Reabrir ") : translate("Concluir ")) + t.title
          }
          onClick={() => void change(t, completed(t.status) ? "ToDo" : "Done")}
        >
          {completed(t.status) ? "✓" : ""}
        </button>
        <div className="task-copy">
          {asBoardCard && (
            <small className="task-board-project">
              {query.data?.projects.find((p) => p.id === t.projectId)?.name || translate("Projeto")}
            </small>
          )}
          {asBoardCard ? <button className="task-title task-title-button" onClick={() => openPanel({ id: t.id })}>{t.title}</button> : <Link className="task-title" to={"/tasks/" + t.id + "/edit"}>{t.title}</Link>}
          {!asBoardCard && (
            <small>
              {query.data?.projects.find((p) => p.id === t.projectId)?.name || translate("Projeto")}
            </small>
          )}
          {t.description && <p className="task-description">{t.description}</p>}
          <div className="task-details">
            <span className={isOverdue(t.dueDate, t.status) ? "due-late" : ""}>
              {t.dueDate
                ? translate("Prazo: ") + formatProjectDate(t.dueDate)
                : translate("Sem prazo definido")}
            </span>
            {t.assignedToName && <span>{t.assignedToName}</span>}
          </div>
        </div>
        <div className="task-row-controls">
          <span className={"badge " + t.priority.toLowerCase()}>{statusLabel(t.priority)}</span>
          <label className={"task-status-control" + (asBoardCard ? " board-card-hidden-control" : "")}>
            <span className="sr-only">
              {translate("Status de")} {t.title}
            </span>
            <select
              disabled={!!busy}
              value={taskStatus(t.status)}
              onChange={(e) => void change(t, canonicalStatus(e.target.value))}
            >
              {[
                ["todo", translate("A fazer")],
                ["inprogress", translate("Em andamento")],
                ["review", translate("Em revisão")],
                ["done", translate("Concluída")],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="task-row-actions">
            <Link
              className={"quiet" + (asBoardCard ? " board-card-open" : "")}
              to={"/tasks/" + t.id + "/edit"}
              aria-label={translate("Editar ") + t.title}
            >
              {translate("Editar")}{" "}
            </Link>
            <button
              className={"quiet delete" + (asBoardCard ? " board-card-hidden-control" : "")}
              disabled={!!busy}
              onClick={() => void change(t, t.status, true)}
              aria-label={translate("Excluir ") + t.title}
            >
              {translate("Excluir")}{" "}
            </button>
          </div>
        </div>
      </article>
    );
  }
  const canonicalStatus = (key: string) =>
    (
      { todo: "ToDo", inprogress: "InProgress", review: "Review", done: "Done" } as Record<
        string,
        string
      >
    )[key] || key;
  return (
    <>
      <PageHeading
        title={translate("Tarefas")}
        description={translate("Prioridades, responsáveis e entregas em um só lugar.")}
        action={action(
          "/tasks/create" + (filters.projectId ? "?projectId=" + filters.projectId : ""),
          translate("Nova tarefa"),
        )}
      />
      <div className="task-filters">
        <label>
          {translate("Buscar tarefas")}{" "}
          <input
            type="search"
            placeholder={translate("Título ou descrição…")}
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <label>
          {translate("Projeto")}{" "}
          <select value={filters.projectId} onChange={(e) => update("projectId", e.target.value)}>
            <option value="">{translate("Todos os projetos")}</option>
            {query.data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate("Status")}{" "}
          <select value={filters.status} onChange={(e) => update("status", e.target.value)}>
            <option value="all">{translate("Todos os status")}</option>
            {["todo", "inprogress", "review", "done"].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate("Prioridade")}{" "}
          <select value={filters.priority} onChange={(e) => update("priority", e.target.value)}>
            <option value="all">{translate("Todas")}</option>
            {["urgent", "high", "medium", "low"].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translate("Ordenar")}{" "}
          <select value={filters.sort} onChange={(e) => update("sort", e.target.value)}>
            <option value="priority">{translate("Prioridade")}</option>
            <option value="deadline">{translate("Prazo")}</option>
            <option value="name">{translate("Nome")}</option>
          </select>
        </label>
      </div>
      <div className="project-results">
        <span role="status">
          {items.length} {items.length === 1 ? translate("tarefa") : translate("tarefas")}
        </span>
        <div className="view-toggle">
          {[
            ["list", translate("Lista")],
            ["board", translate("Quadro")],
          ].map(([v, l]) => (
            <button key={v} aria-pressed={view === v} onClick={() => update("view", v!)}>
              {l}
            </button>
          ))}
        </div>
        <button className="quiet" onClick={() => setParams({ view })}>
          {translate("Limpar filtros")}{" "}
        </button>
      </div>
      {message && (
        <p className={failed ? "error" : "notice"} role={failed ? "alert" : "status"}>
          {failed ? localizeError(message) : translate(message)}
        </p>
      )}
      {view === "board" && <p className="board-help" id="board-move-help">{translate("Arraste pela alça para mudar de etapa. Use as setas esquerda/direita na alça ou o seletor de status.")}</p>}
      <Feedback loading={query.isLoading} error={!!query.error} retry={query.refetch}>
        {view === "list" && !items.length ? (
          <div className="feedback">
            <h2>{translate("Nenhuma tarefa nesta seleção")}</h2>
            <p>{translate("Ajuste os filtros ou registre o próximo passo do projeto.")}</p>
            {action("/tasks/create", translate("Criar tarefa"))}
          </div>
        ) : view === "list" ? (
          <section className="panel task-list">{items.map((task) => row(task))}</section>
        ) : (
          <div className="board" aria-describedby="board-move-help">
            {[
              "todo",
              "inprogress",
              "review",
              "done",
              ...new Set(
                items
                  .map((t) => taskStatus(t.status))
                  .filter((s) => !["todo", "inprogress", "review", "done"].includes(s)),
              ),
            ].map((key) => (
              <section className={"board-column" + (drag?.target === key ? " is-drop-target" : "")} data-board-status={key} key={key}>
                <h2>
                  {statusLabel(key)}
                  <span>{items.filter((t) => taskStatus(t.status) === key).length}</span>
                </h2>
                {items.filter((t) => taskStatus(t.status) === key).map((task) => row(task, true))}
                {!items.some((t) => taskStatus(t.status) === key) && (
                  <p className="board-empty">{translate("Sem tarefas nesta etapa.")}</p>
                )}
                <button className="text-action" onClick={() => openPanel({ status: canonicalStatus(key) })}>{translate("+ Adicionar tarefa")}</button>
              </section>
            ))}
          </div>
        )}
      </Feedback>
      {panel && <dialog ref={panelRef} className="task-detail-drawer" aria-label={translate("Detalhes da tarefa")} onCancel={event => { event.preventDefault(); closePanel(); }} onClick={event => { if (event.target === event.currentTarget) closePanel(); }}><div className="task-drawer-content"><EntityForm key={panel.id || panel.status || "new"} kind="tasks" recordId={panel.id} initialStatus={panel.status} initialProjectId={filters.projectId} onComplete={closePanel}/></div></dialog>}
    </>
  );
}
