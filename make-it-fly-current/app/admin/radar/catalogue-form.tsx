"use client";
import { interfaceText } from "@/lib/presentation-text.mjs";
import { useActionState, useState } from "react";
import { adminStyles as styles } from "@/components/admin/admin-ui";
import type { RadarManagedOpportunity, RadarEditorialSource } from "@/lib/opportunities/radar-editorial-client";
import { OPPORTUNITY_CATEGORIES } from "@/lib/opportunities/types";
import { saveRadarOpportunity, deleteRadarOpportunity } from "./actions";
const benefits = { academic_scholarship: "Bolsa acadêmica", research_scholarship: "Bolsa de pesquisa", extension_scholarship: "Bolsa de extensão", monitor_scholarship: "Monitoria", internship: "Estágio", financial_aid: "Auxílio financeiro", housing_aid: "Moradia", mobility_aid: "Mobilidade", prize: "Prêmio", project_funding: "Fomento", unpaid_opportunity: "Oportunidade não remunerada", other: "Outro" };
const applicants = { undergraduate_student: "Graduação", postgraduate_student: "Pós-graduação", high_school_student: "Ensino médio", graduate_professional: "Profissional formado", professor: "Professor", researcher: "Pesquisador", company: "Empresa", institution: "Instituição", mixed: "Público diverso" };
const routes = { direct_student_application: "Inscrição direta", application_via_university: "Pela universidade", application_via_department: "Pelo departamento", application_via_professor: "Pelo professor", application_via_project_coordinator: "Pelo coordenador", institutional_call: "Chamada institucional", invitation_only: "Por convite" };
function options(values: Record<string, string>) { return Object.entries(values).map(([value, label]) => <option value={value} key={value}>{label}</option>); }
export function CatalogueForm({ item, sources }: { item?: RadarManagedOpportunity; sources: RadarEditorialSource[] }) {
  const [state, saveAction, saving] = useActionState(saveRadarOpportunity, { error: "" });
  const [deletion, deleteAction, deleting] = useActionState(deleteRadarOpportunity, { error: "" });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(item?.categories ?? []);
  const deadline = item?.deadlineAt ? item.deadlinePrecision === "date_only" ? item.deadlineAt.slice(0,10) : new Date(item.deadlineAt).toISOString() : "";
  const [values, setValues] = useState<Record<string, string | boolean>>(() => ({
    title: item?.title ?? "", institution: item?.institution ?? "", officialSourceId: item?.officialSourceId ?? "",
    officialUrl: item?.officialUrl ?? "", benefitType: item?.benefitType ?? "", applicantType: item?.applicantType ?? "",
    applicationRoute: item?.applicationRoute ?? "", opportunityStatus: item?.opportunityStatus ?? "", deadlinePrecision: item?.deadlinePrecision ?? "",
    deadlineInput: item?.deadlinePrecision === "exact_datetime" ? deadline.slice(0,19) : deadline,
    deadlineTimezone: item?.deadlinePrecision === "exact_datetime" ? "Z" : "",
    eventStartPrecision: item?.eventStartsAt ? item.eventStartsAt.length === 10 ? "date_only" : "exact_datetime" : "",
    eventStartInput: item?.eventStartsAt ? item.eventStartsAt.length === 10 ? item.eventStartsAt : new Date(item.eventStartsAt).toISOString().slice(0,19) : "",
    eventStartTimezone: item?.eventStartsAt && item.eventStartsAt.length > 10 ? "Z" : "",
    stateCode: item?.stateCode ?? "", cityName: item?.cityName ?? "", isCourse: item?.isCourse ?? false,
    nationallyEligible: item?.nationallyEligible ?? false, requirementsText: item?.requirementsText ?? "", amountText: item?.amountText ?? "",
    evidenceExcerpt: item?.evidence.opportunity_status?.excerpt ?? item?.evidence.deadline_at?.excerpt ?? "",
  }));
  const bind = (field: string) => ({ value: String(values[field] ?? ""), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value, ...(field === "deadlinePrecision" ? { deadlineInput: "" } : {}), ...(field === "eventStartPrecision" ? { eventStartInput: "" } : {}) }));
  } });
  const check = (field: string) => ({ checked: values[field] === true, onChange: (event: React.ChangeEvent<HTMLInputElement>) => { const checked = event.target.checked; setValues((previous) => ({ ...previous, [field]: checked })); } });
  return <section className={styles.surface}>
    <h2>{item ? "Editar oportunidade" : "Criar oportunidade"}</h2><p>Salvar atualiza o catálogo público. Preencha apenas informações sustentadas pela fonte oficial.</p>
    <form action={saveAction} className={styles.catalogueForm}>
      <input type="hidden" name="id" value={item?.id ?? ""} /><input type="hidden" name="version" value={item?.version ?? 0} />
      <label className={styles.field}><span>Fonte oficial</span><select name="officialSourceId" required {...bind("officialSourceId")}><option value="">Selecione</option>{sources.filter((s) => !item || s.id === item.officialSourceId).map((s) => <option key={s.id} value={s.id}>{interfaceText(s.name)}</option>)}</select></label>
      <label className={styles.field}><span>Título</span><input name="title" required maxLength={500} {...bind("title")} /></label>
      <label className={styles.field}><span>Instituição</span><input name="institution" required maxLength={500} {...bind("institution")} /></label>
      <label className={styles.field}><span>Link oficial</span><input name="officialUrl" type="url" required maxLength={2000} {...bind("officialUrl")} /></label>
      <label className={styles.field}><span>Tipo de oportunidade</span><select name="benefitType" required {...bind("benefitType")}><option value="">Selecione</option>{options(benefits)}</select></label>
      <fieldset className={styles.categoryFieldset}><legend>Categorias de navegação</legend>
        <p>Selecione todas as áreas comprovadas pela fonte. A mesma ficha pode aparecer em mais de uma categoria.</p>
        {OPPORTUNITY_CATEGORIES.map(({ id, label }) => <label key={id} className={styles.categoryOption}>
          <input type="checkbox" name="categories" value={id} checked={selectedCategories.includes(id)}
            onChange={(event) => setSelectedCategories((previous) => event.target.checked ? [...previous, id] : previous.filter((value) => value !== id))} /> {label}
        </label>)}
      </fieldset>
      <label className={styles.field}><span>Público</span><select name="applicantType" required {...bind("applicantType")}><option value="">Selecione</option>{options(applicants)}</select></label>
      <label className={styles.field}><span>Como se inscrever</span><select name="applicationRoute" required {...bind("applicationRoute")}><option value="">Selecione</option>{options(routes)}</select></label>
      <label className={styles.field}><span>Estado das inscrições</span><select name="opportunityStatus" required {...bind("opportunityStatus")}><option value="">Selecione</option><option value="open">Abertas</option><option value="upcoming">Abertura futura confirmada</option></select></label>
      <label className={styles.field}><span>Precisão do prazo</span><select name="deadlinePrecision" required {...bind("deadlinePrecision")}><option value="">Selecione</option><option value="date_only">Data, sem horário</option><option value="exact_datetime">Data e horário com fuso</option><option value="continuous_flow">Fluxo contínuo explícito</option>{selectedCategories.includes("eventos") ? <option value="not_informed">Prazo não informado - evento com inscrições abertas</option> : null}</select></label>
      <input type="hidden" name="deadlineAt" value={["continuous_flow", "not_informed"].includes(String(values.deadlinePrecision)) ? "" : values.deadlinePrecision === "exact_datetime" ? `${values.deadlineInput}${values.deadlineTimezone}` : String(values.deadlineInput)} />
      {values.deadlinePrecision && !["continuous_flow", "not_informed"].includes(String(values.deadlinePrecision)) ? <label className={styles.field}><span>Encerramento das inscrições</span><input name="deadlineInput" step={1} required type={values.deadlinePrecision === "exact_datetime" ? "datetime-local" : "date"} {...bind("deadlineInput")} /></label> : null}
      {values.deadlinePrecision === "exact_datetime" ? <label className={styles.field}><span>Fuso do horário informado</span><select name="deadlineTimezone" required {...bind("deadlineTimezone")}><option value="">Selecione</option><option value="-03:00">Brasília (UTC−3)</option><option value="Z">UTC</option></select></label> : null}
      <input type="hidden" name="eventStartsAt" value={!selectedCategories.includes("eventos") || !values.eventStartPrecision ? "" : values.eventStartPrecision === "exact_datetime" ? `${values.eventStartInput}${values.eventStartTimezone}` : String(values.eventStartInput)} />
      {selectedCategories.includes("eventos") ? <>
        <label className={styles.field}><span>Início do evento confirmado na fonte</span><select required={values.deadlinePrecision === "not_informed"} aria-describedby="event-start-help" {...bind("eventStartPrecision")}><option value="">Não informado</option><option value="date_only">Data, sem horário</option><option value="exact_datetime">Data e horário com fuso</option></select><small id="event-start-help">Sem prazo de inscrição, o início é obrigatório e retira a ficha do catálogo. Se a fonte informar apenas a data, a retirada ocorre no começo desse dia em Brasília.</small></label>
        {values.eventStartPrecision ? <label className={styles.field}><span>Data de início do evento</span><input step={1} required type={values.eventStartPrecision === "exact_datetime" ? "datetime-local" : "date"} {...bind("eventStartInput")} /></label> : null}
        {values.eventStartPrecision === "exact_datetime" ? <label className={styles.field}><span>Fuso do início do evento</span><select required {...bind("eventStartTimezone")}><option value="">Selecione</option><option value="-03:00">Brasília (UTC−3)</option><option value="Z">UTC</option></select></label> : null}
      </> : null}
      <label><input name="isCourse" type="checkbox" {...check("isCourse")} /> É um curso</label>
      <label><input name="nationallyEligible" type="checkbox" {...check("nationallyEligible")} /> Elegibilidade em todo o Brasil confirmada na fonte (deixe UF e cidade vazias)</label>
      <label className={styles.field}><span>UF, quando informada</span><input name="stateCode" maxLength={2} {...bind("stateCode")} /></label>
      <label className={styles.field}><span>Cidade, quando informada</span><input name="cityName" maxLength={120} {...bind("cityName")} /></label>
      <label className={styles.field}><span>Requisitos, quando informados</span><textarea name="requirementsText" maxLength={6000} {...bind("requirementsText")} /></label>
      <label className={styles.field}><span>Apoio ou benefício, quando informado</span><textarea name="amountText" maxLength={2000} {...bind("amountText")} /></label>
      <label className={styles.field}><span>Trecho da fonte que confirma inscrições, prazo, início do evento e abrangência</span><textarea name="evidenceExcerpt" required maxLength={4000} {...bind("evidenceExcerpt")} /></label>
      {state.error ? <p role="alert">{state.error}</p> : null}<button className={styles.button} disabled={saving || deleting || !sources.length || !selectedCategories.length}>{saving ? "Salvando…" : "Salvar no catálogo ao vivo"}</button>
    </form>
    {item ? <form action={deleteAction} className={styles.catalogueForm}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="version" value={item.version} />
      <label><input type="checkbox" name="confirmDelete" required /> Excluir esta oportunidade do catálogo público</label>
      {deletion.error ? <p role="alert">{deletion.error}</p> : null}<button className={styles.secondaryButton} disabled={saving || deleting}>{deleting ? "Excluindo…" : "Excluir oportunidade"}</button></form> : null}
  </section>;
}
