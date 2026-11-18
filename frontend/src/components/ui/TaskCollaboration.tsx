import type { Subtask } from "@/types";
import { t as translate, localizeError } from "@/i18n/core";
import { useLanguage } from "@/i18n/react";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, handleApiError } from "@/services/api";
import { useWorkData } from "@/features/work/useWorkData";

type Comment = { id: string; userId: string; authorName: string; content: string; createdAt: string };
type Label = { id: string; name: string; color: string };
type Dependency = { dependsOnTaskId: string; title: string; status: string };
type Member = { id: string; name: string; email?: string };

export function TaskCollaboration({ taskId, projectId, section = "all" }: { taskId: string; projectId: string; section?: string }) {
  useLanguage();
  const cache = useQueryClient();
  const work = useWorkData();
  const [content, setContent] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [labelName, setLabelName] = useState("");
  const [dependencyId, setDependencyId] = useState("");
  const [error, setError] = useState("");
  const project = work.data?.projects.find((item) => item.id === projectId);
  const workspaceId = project?.workspaceId;
  const members = useQuery({ queryKey: ["workspace-members", workspaceId], enabled: !!workspaceId, queryFn: async () => (await api.get<Member[]>("/api/members", { params: { workspaceId } })).data });
  const subtasks = useQuery({ queryKey: ["task-subtasks", taskId], queryFn: async () => (await api.get<Subtask[]>(`/api/tasks/${taskId}/subtasks`)).data });
  const comments = useQuery({ queryKey: ["task-comments", taskId], queryFn: async () => (await api.get<Comment[]>(`/api/tasks/${taskId}/comments`)).data });
  const labels = useQuery({ queryKey: ["workspace-labels", workspaceId], enabled: !!workspaceId, queryFn: async () => (await api.get<Label[]>(`/api/workspaces/${workspaceId}/labels`)).data });
  const assignedLabels = useQuery({ queryKey: ["task-labels", taskId], queryFn: async () => (await api.get<Label[]>(`/api/tasks/${taskId}/labels`)).data });
  const dependencies = useQuery({ queryKey: ["task-dependencies", taskId], queryFn: async () => (await api.get<Dependency[]>(`/api/tasks/${taskId}/dependencies`)).data });
  const reload = async () => { await cache.invalidateQueries(); };
  async function act(action: () => unknown) {
    if (acting.current) return;
    acting.current = true; setBusy(true); setError("");
    try { await action(); await reload(); }
    catch (e) { setError(localizeError(handleApiError(e).message)); }
    finally { acting.current = false; setBusy(false); }
  }
  const taskOptions = work.data?.tasks.filter((item) => item.id !== taskId && work.data?.projects.find((p) => p.id === item.projectId)?.workspaceId === workspaceId) || [];
  return <div className="task-collaboration">
    {error && <p className="error" role="alert">{error}</p>}
    <fieldset className="collaboration-controls" disabled={busy}>
    <section className="task-checklist" hidden={section !== "all" && section !== "checklist"}><h2>{translate("Checklist")}</h2>
      {subtasks.isError ? <p role="alert">{translate("Não foi possível carregar o checklist.")} <button className="quiet" onClick={() => void subtasks.refetch()}>{translate("Tentar novamente")}</button></p> : subtasks.isLoading ? <p role="status">{translate("Carregando…")}</p> : <>
        {!!subtasks.data?.length && <p className="checklist-summary" role="status">{translate("{done} de {total} concluídas", { done: subtasks.data.filter(item => item.isCompleted).length, total: subtasks.data.length })}</p>}
        <ul className="checklist-items">{subtasks.data?.map(item => <li key={item.id}>
          <label><input type="checkbox" disabled={busy} checked={item.isCompleted} onChange={event => void act(() => api.put(`/api/tasks/${taskId}/subtasks/${item.id}`, { title: item.title, isCompleted: event.target.checked }))}/><span className={item.isCompleted ? "completed" : ""}>{item.title}</span></label>
          <button className="quiet delete" disabled={busy} aria-label={translate("Remover subtarefa") + ": " + item.title} onClick={() => void act(() => api.delete(`/api/tasks/${taskId}/subtasks/${item.id}`))}>{translate("Remover")}</button>
        </li>)}</ul>
      </>}
      <form className="inline-form" onSubmit={event => { event.preventDefault(); void act(async () => { await api.post(`/api/tasks/${taskId}/subtasks`, { title: subtaskTitle, isCompleted: false }); setSubtaskTitle(""); }); }}>
        <input aria-label={translate("Nova subtarefa")} placeholder={translate("Nova subtarefa")} maxLength={200} value={subtaskTitle} onChange={event => setSubtaskTitle(event.target.value)}/>
        <button className="button secondary" disabled={busy || !subtaskTitle.trim()}>{translate("Adicionar")}</button>
      </form>
    </section>
    <section hidden={section !== "all" && section !== "organization"}><h2>{translate("Etiquetas")}</h2>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void act(async () => { const created = await api.post<Label>(`/api/workspaces/${workspaceId}/labels`, { name: labelName, color: "#557A66" }); await api.put(`/api/tasks/${taskId}/labels`, { labelIds: [...(assignedLabels.data || []).map((x) => x.id), created.data.id] }); setLabelName(""); }); }}>
        <input aria-label={translate("Nova etiqueta")} value={labelName} onChange={(e) => setLabelName(e.target.value)} placeholder={translate("Nova etiqueta")} maxLength={50} />
        <button className="button secondary" disabled={!workspaceId || !labelName.trim()}>{translate("Adicionar")}</button>
      </form>
      {labels.data?.map((label) => <label key={label.id} className="task-label"><input type="checkbox" checked={!!assignedLabels.data?.some((x) => x.id === label.id)} onChange={(e) => void act(() => api.put(`/api/tasks/${taskId}/labels`, { labelIds: e.target.checked ? [...(assignedLabels.data || []).map((x) => x.id), label.id] : (assignedLabels.data || []).filter((x) => x.id !== label.id).map((x) => x.id) }))} /><i style={{ background: label.color }} />{label.name}</label>)}
    </section>
    <section hidden={section !== "all" && section !== "organization"}><h2>{translate("Dependências")}</h2>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void act(() => api.post(`/api/tasks/${taskId}/dependencies`, { dependsOnTaskId: dependencyId })); setDependencyId(""); }}>
        <select aria-label={translate("Tarefa pré-requisito")} value={dependencyId} onChange={(e) => setDependencyId(e.target.value)}><option value="">{translate("Selecione uma tarefa")}</option>{taskOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
        <button className="button secondary" disabled={!dependencyId}>{translate("Vincular")}</button>
      </form>
      {dependencies.data?.map((item) => <div className="task-extra-row" key={item.dependsOnTaskId}><span>{item.title} · {item.status}</span><button className="quiet" onClick={() => void act(() => api.delete(`/api/tasks/${taskId}/dependencies/${item.dependsOnTaskId}`))}>{translate("Remover")}</button></div>)}
    </section>
    <section hidden={section !== "all" && section !== "comments"}><h2>{translate("Comentários")}</h2>
      <form onSubmit={(e) => { e.preventDefault(); void act(async () => { await api.post(`/api/tasks/${taskId}/comments`, { content, mentionedUserIds: mentioned }); setContent(""); setMentioned([]); }); }}>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} required placeholder={translate("Escreva um comentário…")} />
        <label>{translate("Mencionar participantes")} <select multiple value={mentioned} onChange={(e) => setMentioned(Array.from(e.target.selectedOptions, (option) => option.value))}>{members.data?.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <button className="button" disabled={!content.trim()}>{translate("Comentar")}</button>
      </form>
      {comments.isLoading && <p role="status">{translate("Carregando…")}</p>}
      {comments.isError && <p role="alert">{translate("Não foi possível carregar os comentários.")} <button className="quiet" onClick={() => void comments.refetch()}>{translate("Tentar novamente")}</button></p>}
      {!comments.isLoading && !comments.isError && !comments.data?.length && <p className="muted">{translate("Nenhum comentário ainda. Registre uma decisão ou uma atualização sobre esta tarefa.")}</p>}
      {comments.data?.map((comment) => <article className="task-comment" key={comment.id}><strong>{comment.authorName}</strong><time>{new Date(comment.createdAt).toLocaleString()}</time><p>{comment.content}</p></article>)}
    </section>
    </fieldset>
  </div>;
}
