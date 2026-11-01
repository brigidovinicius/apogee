import { randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { withAdminTransaction } from "@/lib/db/client";
import { publishedOpportunityPredicate } from "@/lib/db/publication-filter";
import { eventHasNotStarted } from "@/lib/ingestion/event-start";
import { alertMailConfiguration, alertsAvailable, sendAlertMail } from "./mail";

import { AlertError,idPattern,tokenPattern,fingerprint,tokenHash,normalizedAlertEmail,links,allowance } from "./subscription-core";
import { queueSeriesChange,seriesIsAvailable } from "./series";
export { AlertError,fingerprint,normalizedAlertEmail } from "./subscription-core";
type Snapshot = Record<string, unknown> & { title: string; state: string; officialUrl: string | null };
type Row = Record<string, unknown> & { id: string; live: boolean; title: string; categories: string[]; event_starts_at: string | null; deadline_at: string | Date | null; source_page_url: string | null };
function snapshotDate(value: unknown, dateOnly = false) {
  if (value === undefined || value === null || value === "") return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return dateOnly ? text.slice(0, 10) : text.length > 10 && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : text;
}
function normalizedSnapshot(value: Snapshot): Snapshot {
  return { ...value, deadline: snapshotDate(value.deadline, value.deadlinePrecision === "date_only"),
    eventStartsAt: snapshotDate(value.eventStartsAt) };
}
function calendarSnapshot(value: unknown) {
  const discovery = value as { editions?: { id: string; name: string; stages: { id: string; name: string; kind: string; start: string; end?: string }[] }[] } | null;
  return (discovery?.editions ?? []).map(edition => ({ id: edition.id, name: edition.name,
    stages: edition.stages.map(stage => ({ id: stage.id, name: stage.name, kind: stage.kind,
      start: snapshotDate(stage.start), end: snapshotDate(stage.end) })).sort((a,b) => a.id.localeCompare(b.id)) })).sort((a,b) => a.id.localeCompare(b.id));
}
const opportunityQuery = `select o.*, ${publishedOpportunityPredicate} as live,
  (select source_page_url from opportunity_sources where opportunity_id=o.id and active order by is_primary desc,created_at desc limit 1) as source_page_url
  from opportunities o`;
export function monitoringSnapshot(row: Row): Snapshot {
  const started = row.categories.includes("eventos") && row.event_starts_at && !eventHasNotStarted(row.event_starts_at);
  const terminal = ["cancelled","suspended","result_published"].includes(String(row.opportunity_status));
  return { title: row.title, state: row.deleted_at ? "withdrawn" : terminal ? String(row.opportunity_status) : started ? "event_started" : row.live || row.opportunity_status === "closed" ? String(row.opportunity_status) : "withdrawn",
    deadline: snapshotDate(row.deadline_at, row.deadline_precision === "date_only"),
    deadlinePrecision: row.deadline_precision, eventStartsAt: snapshotDate(row.event_starts_at), calendar: calendarSnapshot(row.discovery),
    requirements: row.requirements_text, benefit: row.amount_text,
    categories: [...row.categories].sort(), stateCode: row.state_code, cityName: row.city_name,
    institution: row.institution, officialUrl: row.source_page_url };
}
export async function subscribeToOpportunity(input: Record<string, unknown>) {
  if (!alertsAvailable()) throw new AlertError("Avisos por e-mail ainda não estão disponíveis",503);
  const email = normalizedAlertEmail(input.email);
  if (typeof input.opportunityId !== "string" || !idPattern.test(input.opportunityId) || input.consent !== true) throw new AlertError("Confirme que deseja receber avisos desta oportunidade");
  return withAdminTransaction(async (client) => {
    // Serialize the same address/programme to make simultaneous requests idempotent.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`alert:${input.opportunityId}:${email}`]);
    const global = await allowance(client,"subscribe:global",100,86400);
    const address = await allowance(client,`subscribe:${tokenHash(email)}`,3,3600);
    if (!global || !address) return { ok: true }; // Non-enumerating response; no additional mail queued.
    const row = (await client.query<Row>(`${opportunityQuery} where o.id=$1`,[input.opportunityId])).rows[0];
    if (!row?.live) throw new AlertError("Acompanhamento indisponível para esta oportunidade",409);
    const old = (await client.query("select id,status,confirm_expires_at from opportunity_alert_subscriptions where opportunity_id=$1 and email=$2 for update",[input.opportunityId,email])).rows[0];
    if (old?.status === "active" || old?.status === "pending" && new Date(old.confirm_expires_at) > new Date()) return { ok: true };
    const confirm = randomBytes(32).toString("hex"), unsubscribe = randomBytes(32).toString("hex");
    const saved = await client.query<{id:string}>(`insert into opportunity_alert_subscriptions
      (opportunity_id,email,confirm_hash,unsubscribe_hash,unsubscribe_token,confirm_expires_at,last_snapshot)
      values ($1,$2,$3,$4,$5,now()+interval '24 hours',$6)
      on conflict (opportunity_id,email) do update set status='pending',confirm_hash=excluded.confirm_hash,
      unsubscribe_hash=excluded.unsubscribe_hash,unsubscribe_token=excluded.unsubscribe_token,confirm_expires_at=excluded.confirm_expires_at,
      last_snapshot=excluded.last_snapshot,consent_at=now(),confirmed_at=null,updated_at=now() returning id`,
      [input.opportunityId,email,tokenHash(confirm),tokenHash(unsubscribe),unsubscribe,monitoringSnapshot(row)]);
    const urls = links(confirm,unsubscribe);
    await client.query("update opportunity_alert_outbox set status='cancelled',payload='{}' where subscription_id=$1 and status in ('pending','sending')",[saved.rows[0].id]);
    await client.query(`insert into opportunity_alert_outbox (subscription_id,fingerprint,kind,payload) values ($1,$2,'confirmation',$3)`,
      [saved.rows[0].id,tokenHash(confirm),{ subject:"Confirme o acompanhamento no Radar Apogee",text:`Você solicitou avisos sobre: ${row.title}.\n\nConfirme em até 24 horas:\n${urls.confirm}\n\nSe não foi você, ignore esta mensagem ou cancele:\n${urls.unsubscribe}\n\nUsaremos seu e-mail somente para avisos desta oportunidade.` }]);
    return { ok: true };
  });
}
export async function updateAlertSubscription(action: "confirm" | "unsubscribe", token: unknown) {
  if (typeof token !== "string" || !tokenPattern.test(token)) throw new AlertError("Link inválido ou expirado");
  return withAdminTransaction(async (client) => {
    const column = action === "confirm" ? "confirm_hash" : "unsubscribe_hash";
    const sub = (await client.query(`select * from opportunity_alert_subscriptions where ${column}=$1 for update`,[tokenHash(token)])).rows[0];
    if (!sub) throw new AlertError("Link inválido ou expirado");
    if (action === "unsubscribe") {
      await client.query("update opportunity_alert_subscriptions set status='unsubscribed',updated_at=now() where id=$1",[sub.id]);
      await client.query("update opportunity_alert_outbox set status='cancelled',payload='{}' where subscription_id=$1 and status in ('pending','sending')",[sub.id]);
    } else if (sub.status !== "active") {
      if (sub.status !== "pending" || new Date(sub.confirm_expires_at) <= new Date()) throw new AlertError("Link inválido ou expirado");
      if(sub.target_id) {
        if(!await seriesIsAvailable(client,sub.target_id))throw new AlertError("Acompanhamento indisponível para esta competição",409);
      } else {
        const row = (await client.query<Row>(`${opportunityQuery} where o.id=$1`,[sub.opportunity_id])).rows[0];
        if (!row?.live) throw new AlertError("Esta oportunidade já saiu do catálogo",409);
      }
      // Keep the requested snapshot so changes published before confirmation are not lost.
      await client.query("update opportunity_alert_subscriptions set status='active',confirmed_at=now(),updated_at=now() where id=$1",[sub.id]);
      await client.query("update opportunity_alert_outbox set status='cancelled',payload='{}' where subscription_id=$1 and kind='confirmation' and status in ('pending','sending')",[sub.id]);
    }
    return { ok:true };
  });
}
const labels: Record<string,string> = { title:"título",state:"situação das inscrições ou do evento",deadline:"prazo de inscrição",deadlinePrecision:"informação do prazo",eventStartsAt:"início do evento",calendar:"calendário e etapas",requirements:"requisitos",benefit:"apoio ou benefício",categories:"categorias",stateCode:"estado",cityName:"cidade",institution:"organizador",officialUrl:"página oficial" };
function changedKeys(before: Snapshot, after: Snapshot) {
  const previous = normalizedSnapshot(before), current = normalizedSnapshot(after);
  return Object.keys(labels).filter(key => !(key === "calendar" && before.calendar === undefined) && !isDeepStrictEqual(previous[key],current[key]));
}
export function changedFields(before: Snapshot, after: Snapshot) {
  return changedKeys(before, after).map(key => labels[key]);
}
function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "não informado";
  if (key === "calendar") return (value as ReturnType<typeof calendarSnapshot>).flatMap(edition => edition.stages.map(stage =>
    `${stage.name}: ${displayValue("date", stage.start)}${stage.end ? ` a ${displayValue("date", stage.end)}` : ""}`)).join("; ") || "não informado";
  if ((key === "deadline" || key === "eventStartsAt" || key === "date") && typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Intl.DateTimeFormat("pt-BR", { day:"2-digit",month:"2-digit",year:"numeric",timeZone:"America/Sao_Paulo",
      ...(value.length > 10 ? { hour:"2-digit" as const,minute:"2-digit" as const } : {}) }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
  }
  const translated: Record<string,string> = { open:"inscrições abertas",upcoming:"inscrições futuras",closed:"inscrições encerradas",cancelled:"cancelado",suspended:"suspenso",result_published:"resultado publicado",event_started:"evento iniciado",withdrawn:"fora do catálogo",date_only:"data sem horário informado",exact_datetime:"data e horário",not_informed:"não informado",continuous_flow:"fluxo contínuo" };
  return (typeof value === "string" ? translated[value] ?? value : Array.isArray(value) ? value.join(", ") : String(value)).replace(/\s+/g," ").slice(0,1000);
}
export function changeDetails(before: Snapshot, after: Snapshot) {
  const previous = normalizedSnapshot(before), current = normalizedSnapshot(after);
  // Email confirmation does not grant access to protected opportunity details.
  const publicFields = new Set(["title","state","deadline","deadlinePrecision","eventStartsAt","calendar","categories","stateCode","cityName","institution"]);
  return changedKeys(before,after).map(key => publicFields.has(key)
    ? `${labels[key]}: ${displayValue(key,previous[key])} → ${displayValue(key,current[key])}`
    : `${labels[key]}: informação atualizada; consulte os detalhes no Radar.`).join("\n");
}
export async function pruneAlertData() {
  await withAdminTransaction(async (client) => {
    await client.query("delete from opportunity_alert_subscriptions where status='pending' and confirm_expires_at<now()-interval '7 days' or status in ('completed','unsubscribed') and updated_at<now()-interval '30 days'");
    await client.query("delete from opportunity_alert_limits where resets_at<now()-interval '1 day'");
  });
}
export async function queueOpportunityChanges() {
  return withAdminTransaction(async (client) => {
    const subs = (await client.query(`select * from opportunity_alert_subscriptions where status='active' order by checked_at nulls first limit 100 for update skip locked`)).rows;
    let queued=0;
    for (const sub of subs) {
      if(sub.target_id) {queued+=await queueSeriesChange(client,sub);continue;}
      const row=(await client.query<Row>(`${opportunityQuery} where o.id=$1`,[sub.opportunity_id])).rows[0];
      if (!row) continue;
      const snapshot=monitoringSnapshot(row), fields=changedFields(sub.last_snapshot,snapshot);
      // An inconclusive extraction is not a confirmed cancellation or withdrawal.
      if (!row.live && !row.deleted_at && !["closed","cancelled","suspended","result_published"].includes(String(row.opportunity_status)) && snapshot.state !== "event_started") {
        await client.query("update opportunity_alert_subscriptions set checked_at=now() where id=$1",[sub.id]);
        continue;
      }
      if (fields.length) {
        const urls=links("",sub.unsubscribe_token);
        const notices: Record<string,string> = { event_started:"O evento começou e saiu do catálogo de inscrições.",
          closed:"As inscrições foram encerradas e a oportunidade saiu do catálogo.",
          cancelled:"A oportunidade foi cancelada e saiu do catálogo.",
          suspended:"As inscrições foram suspensas. Consulte a fonte oficial para acompanhar eventual retomada.",
          withdrawn:"A oportunidade saiu do catálogo. Confira a fonte oficial para saber a situação atual." };
        const state = notices[snapshot.state] ?? "A fonte oficial ou a equipe atualizou a oportunidade.";
        await client.query(`insert into opportunity_alert_outbox (subscription_id,fingerprint,kind,payload) values ($1,$2,'change',$3) on conflict do nothing`,
          [sub.id,fingerprint([row.version,snapshot]),{subject:`Radar Apogee: atualização de ${snapshot.title.replace(/[\r\n]/g," ").slice(0,150)}`,text:`${snapshot.title}\n\n${state}\n\nO que mudou:\n${changeDetails(sub.last_snapshot,snapshot)}\n\nPrazo registrado: ${displayValue("deadline",snapshot.deadline)}.\nInício do evento: ${displayValue("eventStartsAt",snapshot.eventStartsAt)}.\n\nConsulte os dados atuais no Radar:\nhttps://www.apogee.community/oportunidades/oportunidade--radar-${row.id}\n\nCancelar avisos:\n${urls.unsubscribe}` }]);
        queued++;
      }
      await client.query("update opportunity_alert_subscriptions set last_snapshot=$2,checked_at=now(),status=case when $3 then 'completed' else status end,updated_at=case when $3 then now() else updated_at end where id=$1",[sub.id,snapshot,["closed","cancelled","event_started","result_published"].includes(snapshot.state)]);
    }
    return queued;
  });
}
export async function runOpportunityAlerts() {
  // Retention continues during mail outages or a rollback that disables sending.
  await pruneAlertData();
  const queued=await queueOpportunityChanges();
  const config=alertMailConfiguration();
  if (!config) return {enabled:false,queued,sent:0,failed:0};
  let sent=0,failed=0;
  for(let i=0;i<5;i++) {
    const job=await withAdminTransaction(async(client)=>{
      await client.query("select pg_advisory_xact_lock(hashtextextended('radar:mail-budget',0))");
      const result=(await client.query(`select j.*,s.email from opportunity_alert_outbox j join opportunity_alert_subscriptions s on s.id=j.subscription_id
        where (j.status='pending' or j.status='sending' and j.lease_until<now()) and j.next_attempt_at<=now() and j.attempts<5
        and (j.kind='confirmation' and s.status='pending' and s.confirm_expires_at>now() or j.kind='change' and s.status in ('active','completed'))
        order by j.created_at limit 1 for update of j skip locked`)).rows[0];
      if (!result) return null;
      // Fixed UTC day; each Resend attempt reserves a slot, including retries and confirmations.
      const day=new Date().toISOString().slice(0,10);
      const budget=await client.query<{count:number}>("select count from opportunity_alert_limits where key=$1 for update",[`send:${day}`]);
      if ((budget.rows[0]?.count ?? 0)>=config.dailyLimit) return null;
      await allowance(client,`send:${day}`,config.dailyLimit,172800);
      await client.query("update opportunity_alert_outbox set status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' where id=$1",[result.id]);
      return result;
    });
    if (!job) break;
    try {
      // Check a cancellation again immediately before transmission.
      const allowed=await withAdminTransaction(async(client)=>(await client.query("select id from opportunity_alert_outbox where id=$1 and status='sending'",[job.id])).rows.length>0);
      if (!allowed) continue;
      await sendAlertMail({to:job.email,...job.payload,messageId:`<${job.id}@apogee.community>`});
      await withAdminTransaction(client=>client.query("update opportunity_alert_outbox set status='sent',sent_at=now(),payload='{}',lease_until=null where id=$1 and status='sending'",[job.id]));
      sent++;
    } catch {
      failed++;
      await withAdminTransaction(client=>client.query("update opportunity_alert_outbox set status=case when attempts>=5 then 'failed' else 'pending' end,lease_until=null,next_attempt_at=now()+interval '1 hour' where id=$1 and status='sending'",[job.id]));
    }
  }
  return {enabled:true,queued,sent,failed};
}
