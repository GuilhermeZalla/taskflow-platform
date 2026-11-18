import { t as translate } from "@/i18n/core";
import { useLanguage } from "@/i18n/react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useWorkData } from "@/features/work/useWorkData";
import { completed } from "@/features/work/workflow";
import { PageHeading, Feedback, statusLabel } from "@/components/ui/Shared";
import { formatProjectDate, projectStatusLabel } from "./project-list";
import type { DemoMember } from "@/services/demo";
export function ProjectDetails() {
  useLanguage();
  const {id} = useParams();
  const work = useWorkData();
  const project = work.data?.projects.find(item => item.id === id);
  const members = useQuery({queryKey:["workspace-members",project?.workspaceId],enabled:!!project, retry:1,queryFn:async () => (await api.get<DemoMember[]>("/api/members",{params:{workspaceId:project!.workspaceId}})).data});
  const tasks = work.data?.tasks.filter(task => task.projectId === id) || [];
  const done = tasks.filter(task => completed(task.status)).length;
  const percent = tasks.length ? Math.round(done/tasks.length*100) : 0;
  return <>
    <Link className="back-link" to="/projects">{translate("← Voltar")}</Link>
    <Feedback loading={work.isLoading} error={!!work.error} retry={work.refetch}>
      {!project ? <div className="feedback"><h1>{translate("Projeto não encontrado ou sem acesso.")}</h1><Link to="/projects">{translate("Ver projetos")}</Link></div> : <>
        <PageHeading title={project.name} description={work.data?.spaces.find(space => space.id === project.workspaceId)?.name || translate("Espaço de trabalho")} action={<Link className="button secondary" to={"/projects/"+id+"/edit"}>{translate("Editar projeto")}</Link>}/>
        <div className="project-detail-meta"><span className="badge">{projectStatusLabel(project.status)}</span><span>{translate("Início:")} {formatProjectDate(project.startDate)}</span><span>{translate("Prazo:")} {formatProjectDate(project.dueDate)}</span></div>
        <div className="project-detail-layout">
          <section className="project-detail-main"><h2>{translate("Objetivo")}</h2><p className="project-objective">{project.description || translate("Adicione uma descrição para explicar o resultado esperado deste projeto.")}</p>
            <div className="project-detail-progress"><h2>{translate("Progresso")}</h2><strong>{tasks.length ? percent+"%" : "—"}</strong><p>{translate("{done} de {total} tarefas concluídas",{done,total:tasks.length})}</p>{!!tasks.length && <progress aria-label={translate("Progresso")} max={tasks.length} value={done}/>}</div>
            <div className="section-heading"><h2>{translate("Tarefas")}</h2><Link className="text-action" to={"/tasks/create?projectId="+id}>{translate("Nova tarefa")}</Link></div>
            <div className="project-detail-tasks">{tasks.map(task => <Link key={task.id} to={"/tasks/"+task.id+"/edit"}><span><strong>{task.title}</strong><small>{task.assignedToName || translate("Sem responsável")} · {formatProjectDate(task.dueDate)}</small></span><span className="badge">{statusLabel(task.status)}</span></Link>)}</div>
            {!tasks.length && <p>{translate("Nenhuma tarefa neste projeto. Adicione a primeira entrega para começar.")}</p>}
            <Link className="button secondary" to={"/tasks?view=board&projectId="+id}>{translate("Abrir quadro do projeto")}</Link>
          </section>
          <aside className="project-detail-team"><h2>{translate("Equipe do espaço")}</h2><p className="muted">{translate("Pessoas do espaço de trabalho. Os responsáveis por cada entrega aparecem nas tarefas.")}</p><Feedback loading={members.isLoading} error={members.isError} retry={members.refetch}><ul>{members.data?.map(member => <li key={member.id}><strong>{member.name}</strong><small>{translate(({Responsável:"Responsável pelo espaço",Colaborador:"Colaborador",Owner:"Proprietário",Manager:"Gestor",Member:"Colaborador",Observer:"Observador"} as Record<string,string>)[member.role] || member.role)}</small></li>)}</ul>{!members.data?.length && <p>{translate("Nenhum participante disponível.")}</p>}</Feedback><Link to="/teams">{translate("Ver equipe")}</Link></aside>
        </div>
      </>}
    </Feedback>
  </>;
}
