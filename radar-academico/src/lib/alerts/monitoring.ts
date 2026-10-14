import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { withAdminTransaction } from "@/lib/db/client";
import { publishedOpportunityPredicate } from "@/lib/db/publication-filter";
import { eventHasNotStarted } from "@/lib/ingestion/event-start";
import { alertMailConfiguration, alertsAvailable, sendAlertMail } from "./mail";

export class AlertError extends Error { constructor(message: string, public status = 400) { super(message); } }
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[a-f0-9]{64}$/;
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function normalizedAlertEmail(value: unknown) {
  if (typeof value !== "string") throw new AlertError("Informe um e-mail válido");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)) throw new AlertError("Informe um e-mail válido");
  return email;
}
type Snapshot = Record<string, unknown> & { title: string; state: string; officialUrl: string | null };
type Row = Record<string, unknown> & { id: string; live: boolean; title: string; categories: string[]; event_starts_at: string | null; deadline_at: string | Date | null; source_page_url: string | null };
const opportunityQuery = `select o.*, ${publishedOpportunityPredicate} as live,
  (select source_page_url from opportunity_sources where opportunity_id=o.id and active order by is_primary desc,created_at desc limit 1) as source_page_url
  from opportunities o`;
export function monitoringSnapshot(row: Row): Snapshot {
  const started = row.categories.includes("eventos") && row.event_starts_at && !eventHasNotStarted(row.event_starts_at);
  return { title: row.title, state: started ? "event_started" : row.live || ["closed","cancelled","suspended","result_published"].includes(String(row.opportunity_status)) ? String(row.opportunity_status) : "withdrawn",
    deadline: row.deadline_at instanceof Date ? row.deadline_at.toISOString() : row.deadline_at,
    deadlinePrecision: row.deadline_precision, eventStartsAt: row.event_starts_at,
    requirements: row.requirements_text, benefit: row.amount_text,
    categories: [...row.categories].sort(), stateCode: row.state_code, cityName: row.city_name,
    institution: row.institution, officialUrl: row.source_page_url };
}
function links(confirm: string, unsubscribe: string) {
  // Fixed public destination; never accept callback URLs from subscription requests.
  const base = "https://www.apogee.community/oportunidades/avisos";
  return { confirm: `${base}?acao=confirmar&token=${confirm}`, unsubscribe: `${base}?acao=cancelar&token=${unsubscribe}` };
}
async function allowance(client: PoolClient, key: string, max: number, seconds: number) {
  const result = await client.query<{ count: number }>(`insert into opportunity_alert_limits (key,count,resets_at) values ($1,1,now()+$2*interval '1 second')
    on conflict (key) do update set count=case when opportunity_alert_limits.resets_at<=now() then 1 else opportunity_alert_limits.count+1 end,
    resets_at=case when opportunity_alert_limits.resets_at<=now() then excluded.resets_at else opportunity_alert_limits.resets_at end returning count`, [key,seconds]);
  return result.rows[0].count <= max;
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
    if (!row?.live || row.deadline_at !== null) throw new AlertError("Acompanhamento indisponível para esta oportunidade",409);
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
      const row = (await client.query<Row>(`${opportunityQuery} where o.id=$1`,[sub.opportunity_id])).rows[0];
      if (!row?.live) throw new AlertError("Esta oportunidade já saiu do catálogo",409);
      await client.query("update opportunity_alert_subscriptions set status='active',confirmed_at=now(),last_snapshot=$2,updated_at=now() where id=$1",[sub.id,monitoringSnapshot(row)]);
      await client.query("update opportunity_alert_outbox set status='cancelled',payload='{}' where subscription_id=$1 and kind='confirmation' and status in ('pending','sending')",[sub.id]);
    }
    return { ok:true };
  });
}
const labels: Record<string,string> = { title:"título",state:"situação das inscrições ou do evento",deadline:"prazo de inscrição",deadlinePrecision:"informação do prazo",eventStartsAt:"início do evento",requirements:"requisitos",benefit:"apoio ou benefício",categories:"categorias",stateCode:"estado",cityName:"cidade",institution:"organizador",officialUrl:"página oficial" };
export function changedFields(before: Snapshot, after: Snapshot) {
  return Object.keys(labels).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>labels[key]);
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
      const row=(await client.query<Row>(`${opportunityQuery} where o.id=$1`,[sub.opportunity_id])).rows[0];
      if (!row) continue;
      const snapshot=monitoringSnapshot(row), fields=changedFields(sub.last_snapshot,snapshot);
      if (fields.length) {
        const urls=links("",sub.unsubscribe_token);
        const notices: Record<string,string> = { event_started:"O evento começou e saiu do catálogo de inscrições.",
          closed:"As inscrições foram encerradas e a oportunidade saiu do catálogo.",
          cancelled:"A oportunidade foi cancelada e saiu do catálogo.",
          suspended:"As inscrições foram suspensas. Consulte a fonte oficial para acompanhar eventual retomada.",
          withdrawn:"A oportunidade saiu do catálogo. Confira a fonte oficial para saber a situação atual." };
        const state = notices[snapshot.state] ?? "A fonte oficial ou a equipe atualizou a oportunidade.";
        await client.query(`insert into opportunity_alert_outbox (subscription_id,fingerprint,kind,payload) values ($1,$2,'change',$3) on conflict do nothing`,
          [sub.id,fingerprint([row.version,snapshot]),{subject:`Radar Apogee: atualização de ${snapshot.title.replace(/[\r\n]/g," ").slice(0,150)}`,text:`${snapshot.title}\n\n${state}\nMudanças: ${fields.join(", ")}.\nPrazo registrado: ${snapshot.deadline ?? "não informado"}.\nInício do evento: ${snapshot.eventStartsAt ?? "não informado"}.\n\nConsulte os dados atuais e a página oficial:\nhttps://www.apogee.community/oportunidades\n${snapshot.officialUrl ?? ""}\n\nCancelar avisos:\n${urls.unsubscribe}` }]);
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
