import { t as translate } from "@/i18n/core";
import { useLanguage } from "@/i18n/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import type { Project, Task, Workspace } from "@/types";
import { PageHeading, Feedback, action, normalized, statusLabel } from "@/components/ui/Shared";
import { useCurrentUser } from "@/features/work/useCurrentUser";
import { isDemo, loadDemoExamples } from "@/services/demo";
import { useQueryClient } from "@tanstack/react-query";
import { summarizeOverview, formatDeadline, scopeWork, groupPriorities } from "./overview";
export function Home() {
  useLanguage();
  const [workspaceId, setWorkspaceId] = useState("");
  const [mine, setMine] = useState(false);
  const [exampleMessage, setExampleMessage] = useState("");
  const currentUser = useCurrentUser();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["overview"],
    retry: 1,
    queryFn: async () => {
      const [tasks, projects, spaces] = await Promise.all([
        api.get<Task[]>("/api/tasks"),
        api.get<Project[]>("/api/projects"),
        api.get<Workspace[]>("/api/workspaces"),
      ]);
      return { tasks: tasks.data, projects: projects.data, spaces: spaces.data };
    },
  });
  const scoped = scopeWork(query.data?.projects || [],query.data?.tasks || [],mine,currentUser.id);
  const summary = summarizeOverview(
    scoped.projects,
    scoped.tasks,
    workspaceId,
  );
  const groups = groupPriorities(summary.priorities);
  const selected = query.data?.spaces.find((s) => s.id === workspaceId);
  return (
    <>
      <PageHeading
        eyebrow={translate("PAINEL DE TRABALHO")}
        title={translate("Visão geral")}
        description={translate("Prioridades, progresso e prazos do seu trabalho.")}
        action={action("/tasks/create", translate("Nova tarefa"))}
      />
      <Feedback loading={query.isLoading} error={!!query.error} retry={query.refetch}>
        <div className="work-scope-switch" role="group" aria-label={translate("Escopo do trabalho")}>
          <button aria-pressed={mine} disabled={!currentUser.id} onClick={() => setMine(true)}>{translate("Meu trabalho")}</button>
          <button aria-pressed={!mine} onClick={() => setMine(false)}>{translate("Toda a equipe")}</button>
          {isDemo() && <button className="quiet" onClick={() => { try { loadDemoExamples(); void cache.invalidateQueries(); setExampleMessage("Exemplos carregados. Suas alterações foram preservadas."); } catch { setExampleMessage("Não foi possível carregar os exemplos neste navegador."); } }}>{translate("Carregar exemplos")}</button>}
        </div>
        {exampleMessage && <p role="status" className="notice">{translate(exampleMessage)}</p>}
        {currentUser.error && <p className="muted">{translate("Não foi possível identificar sua conta. A visão da equipe continua disponível.")}</p>}
        <div className="overview-scope">
          <label htmlFor="overview-workspace">
            {translate("Espaço de trabalho")}{" "}
            <select
              id="overview-workspace"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            >
              <option value="">{translate("Todos os espaços")}</option>
              {query.data?.spaces.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <span aria-live="polite">
            {selected?.name || translate("Visão consolidada")} · {summary.tasks.length}{" "}
            {summary.tasks.length === 1 ? translate("tarefa") : translate("tarefas")}
          </span>
        </div>
        <div className="metrics overview-metrics">
          {[
            [translate("Tarefas em aberto"), summary.open, translate("Aguardando conclusão")],
            [translate("Concluídas"), summary.completed, translate("Entregas realizadas")],
            [translate("Projetos ativos"), summary.activeProjects, translate("Frentes em andamento")],
            [translate("Prazos vencidos"), summary.overdue, translate("Precisam de atenção")],
          ].map(([label, value, note]) => (
            <div className="metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          ))}
        </div>
        <div className="overview-grid">
          <section className="panel" aria-labelledby="priorities-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{translate("FOCO AGORA")}</p>
                <h2 id="priorities-title">{translate("Próximos passos")}</h2>
              </div>
              <Link to="/tasks">{translate("Ver tarefas →")}</Link>
            </div>
            <p className="section-description">
              {translate("Prioridade mais alta primeiro; depois, prazo de entrega.")}{" "}
            </p>
            {Object.entries(groups).filter(([, tasks]) => tasks.length).map(([group, tasks]) => <section className="priority-group" key={group} aria-label={translate(({late:"Atrasadas",today:"Hoje",upcoming:"Próximos dias",undated:"Sem prazo"} as Record<string,string>)[group]!)}><h3>{translate(({late:"Atrasadas",today:"Hoje",upcoming:"Próximos dias",undated:"Sem prazo"} as Record<string,string>)[group]!)} <span>{tasks.length}</span></h3>{tasks.slice(0,3).map((t) => (
              <Link to={"/tasks/" + t.id + "/edit"} className="task-line" key={t.id}>
                <span aria-hidden="true" className={"task-check " + normalized(t.status)} />
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    {summary.projects.find((p) => p.id === t.projectId)?.name ||
                      translate("Projeto")}
                    {t.dueDate && Number.isFinite(Date.parse(t.dueDate))
                      ? " · " + formatDeadline(t.dueDate)
                      : ""}
                  </small>
                </div>
                <span className={"badge " + normalized(t.priority)}>{statusLabel(t.priority)}</span>
              </Link>
            ))}</section>)}
            {!summary.priorities.length && (
              <div className="overview-empty">
                <h3>
                  {mine ? translate("Nenhuma tarefa em aberto atribuída a você") : summary.tasks.length
                    ? translate("Tudo em dia neste espaço")
                    : translate("Seu próximo passo começa aqui")}
                </h3>
                <p>
                  {mine ? translate("Consulte toda a equipe para acompanhar as outras entregas.") : summary.tasks.length
                    ? translate("Todas as tarefas foram concluídas.")
                    : translate("Crie um projeto para reunir tarefas, definir responsáveis e acompanhar prazos.")}
                </p>
                <Link to={summary.projects.length ? "/tasks/create" : "/projects/create"}>
                  {summary.projects.length ? translate("Criar tarefa") : translate("Criar projeto")}{" "}
                  →
                </Link>
              </div>
            )}
          </section>
          <section className="project-overview" aria-labelledby="progress-title">
            <div className="section-heading">
              <h2 id="progress-title">{translate(mine ? "Meu progresso nos projetos" : "Progresso dos projetos")}</h2>
              <Link to="/projects">{translate("Ver todos →")}</Link>
            </div>
            {summary.progress.slice(0, 4).map(({ project, total, completed, percent }, i) => (
              <Link
                className="project-row project-progress-row"
                to={"/projects/" + project.id}
                key={project.id}
              >
                <span className="project-index">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.description || translate("Sem descrição adicionada.")}</p>
                  <div className="project-completion">
                    <span>
                      {total
                        ? completed + translate(" de ") + total + translate(" tarefas concluídas")
                        : translate("Nenhuma tarefa cadastrada")}
                    </span>
                    <strong>{total ? percent + "%" : "—"}</strong>
                  </div>
                  {total > 0 && (
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={translate("Conclusão de ") + project.name}
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: percent + "%" }} />
                    </div>
                  )}
                </div>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
            {!summary.progress.length && (
              <div className="overview-empty">
                <h3>{translate("Nenhum projeto neste espaço")}</h3>
                <p>{translate("Crie um projeto para reunir tarefas, definir responsáveis e acompanhar prazos.")}</p>
              </div>
            )}
            <Link className="text-action" to="/projects/create">
              {translate("+ Criar projeto")}{" "}
            </Link>
          </section>
        </div>
        <section className="deadline-section" aria-labelledby="deadline-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{translate("PLANEJAMENTO")}</p>
              <h2 id="deadline-title">{translate("Prazos a acompanhar")}</h2>
            </div>
            <span className="muted">{translate("Tarefas e projetos em aberto")}</span>
          </div>
          {summary.deadlines.length ? (
            <div className="deadline-list">
              {summary.deadlines.slice(0, 5).map((item) => (
                <Link
                  to={"/tasks?projectId=" + item.projectId}
                  className="deadline-row"
                  key={item.type + item.id}
                >
                  <time dateTime={item.date}>{formatDeadline(item.date)}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.type === "task" ? translate("Tarefa") : translate("Projeto")} ·{" "}
                      {summary.projects.find((p) => p.id === item.projectId)?.name}
                    </small>
                  </div>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="deadline-empty">
              <strong>{translate("Nenhum prazo definido para os itens em aberto.")}</strong>
              <p>
                {translate(
                  "As datas de entrega disponíveis nos projetos e tarefas aparecem aqui, em ordem cronológica.",
                )}{" "}
              </p>
            </div>
          )}
        </section>
      </Feedback>
    </>
  );
}
