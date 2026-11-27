import "server-only";
import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
import { getSql } from "@/lib/members/db";
import { applicationOrigin, sendMemberMail } from "@/lib/members/mail";
import { matchRadarProfile } from "./profile-match";
import { listRadarOpportunities } from "./radar-client";
import { planRadarDigest, radarMatchesForMail } from "./radar-preference-digest";
import type { RadarEmail, RadarPreferences } from "./radar-preferences";

type Recipient = {
  user_id: string;
  email_option: RadarEmail;
  email_enabled_at: Date;
  settings: RadarPreferences;
};

type Delivery = {
  delivery_key: string;
  opportunity_ids: string[];
  subject: string;
  body: string;
  sent_at: Date | null;
  created_at: Date;
};

const retryHours = 18;
const batchSize = 5;

async function reserveAttempt(tx: TransactionSql, day: string, limit: number) {
  const rows = await tx`insert into radar_preference_mail_budget (day, attempts) values (${day}::date, 1)
    on conflict (day) do update set attempts=radar_preference_mail_budget.attempts+1
    where radar_preference_mail_budget.attempts<${limit} returning day`;
  return rows.length > 0;
}

export async function runRadarPreferenceMail() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const limit = Number(process.env.RADAR_PROFILE_MAIL_DAILY_LIMIT ?? 10);
  const dailyLimit = Number.isInteger(limit) && limit >= 1 && limit <= 50 ? limit : 10;
  const origin = applicationOrigin();
  const sql = getSql();
  const empty = { examined: 0, accepted: 0, failed: 0 };
  const [budget] = await sql<{ attempts: number }[]>`select attempts from radar_preference_mail_budget where day=${day}::date`;
  if (budget?.attempts >= dailyLimit) return empty;
  const due = sql`
    p.email_option <> 'off' and not u.blocked and u.email_verified and (
      p.mail_checked_at is null or p.mail_checked_at <= now() - interval '23 hours' or (
        p.mail_checked_at <= now() - interval '1 hour' and exists (
          select 1 from radar_preference_delivery d where d.user_id=p.user_id and d.sent_at is null
          and d.body <> '' and d.created_at >= now() - ${retryHours} * interval '1 hour'
        )
      )
    )`;
  const recipients = await sql<{ user_id: string }[]>`
    select p.user_id from radar_preference p join "user" u on u.id=p.user_id
    where ${due} order by p.mail_checked_at nulls first, p.user_id limit ${batchSize}
  `;
  if (!recipients.length) return empty;
  const catalogue = await listRadarOpportunities();
  let accepted = 0;
  let failed = 0;
  for (const { user_id: userId } of recipients) {
    try {
      const key = await sql.begin(async tx => {
        const [recipient] = await tx<Recipient[]>`
          select p.user_id, p.email_option, p.email_enabled_at, p.settings
          from radar_preference p join "user" u on u.id=p.user_id
          where p.user_id=${userId} and ${due} for update of p skip locked
        `;
        if (!recipient) return null;
        await tx`update radar_preference_delivery set subject='', body='' where user_id=${userId} and sent_at is null
          and body <> '' and created_at < now() - ${retryHours} * interval '1 hour'`;
        const history = await tx<Delivery[]>`
          select delivery_key, opportunity_ids, subject, body, sent_at, created_at
          from radar_preference_delivery where user_id=${userId} order by created_at
        `;
        const retry = history.find(item => !item.sent_at && item.body);
        if (retry) {
          if (!await reserveAttempt(tx, day, dailyLimit)) return null;
          await tx`update radar_preference set mail_checked_at=now() where user_id=${userId}`;
          return retry.delivery_key;
        }
        const hidden = await tx<{ opportunity_id: string }[]>`
          select opportunity_id from radar_recommendation_dismissal where user_id=${userId}
        `;
        const matches = radarMatchesForMail(matchRadarProfile(catalogue, recipient.settings,
          new Set(hidden.map(item => item.opportunity_id)), now), now, recipient.email_enabled_at);
        const plan = planRadarDigest(matches, recipient.email_option, now, {
          keys: new Set(history.map(item => item.delivery_key)),
          opportunityIds: new Set(history.flatMap(item => item.opportunity_ids)),
        }, origin);
        if (plan && !await reserveAttempt(tx, day, dailyLimit)) return null;
        await tx`update radar_preference set mail_checked_at=now() where user_id=${userId}`;
        if (!plan) return null;
        await tx`insert into radar_preference_delivery (user_id, delivery_key, opportunity_ids, subject, body)
          values (${userId}, ${plan.key}, ${plan.opportunityIds}, ${plan.subject}, ${plan.body})`;
        return plan.key;
      });
      if (!key) continue;
      const sent = await sql.begin(async tx => {
        // Serialize with opt-out and settings updates. Retries keep the same
        // payload and provider key, including after an ambiguous response.
        const [current] = await tx<(Recipient & Delivery & { email: string })[]>`
          select u.email, p.email_option, p.email_enabled_at, p.settings, d.*
          from radar_preference p join "user" u on u.id=p.user_id
          join radar_preference_delivery d on d.user_id=p.user_id
          where p.user_id=${userId} and d.delivery_key=${key} and d.body <> '' and d.sent_at is null
          and d.created_at >= now() - ${retryHours} * interval '1 hour'
          and p.email_option <> 'off' and not u.blocked and u.email_verified
          for update of p, d skip locked
        `;
        if (!current) return false;
        const hidden = await tx<{ opportunity_id: string }[]>`
          select opportunity_id from radar_recommendation_dismissal where user_id=${userId}
        `;
        const currentTime = new Date();
        const matches = radarMatchesForMail(matchRadarProfile(catalogue, current.settings,
          new Set(hidden.map(item => item.opportunity_id)), currentTime), currentTime, current.email_enabled_at);
        const eligible = new Set(matches.map(item => item.opportunity.id));
        if (!current.opportunity_ids.every(id => eligible.has(id))) {
          await tx`update radar_preference_delivery set subject='', body='' where user_id=${userId} and delivery_key=${key}`;
          return false;
        }
        const idempotencyKey = createHash("sha256").update(`radar-profile:${userId}:${key}`).digest("hex");
        await sendMemberMail({ to: current.email, subject: current.subject, text: current.body, key: idempotencyKey });
        await tx`update radar_preference_delivery set sent_at=now(), subject='', body=''
          where user_id=${userId} and delivery_key=${key}`;
        return true;
      });
      if (sent) accepted++;
    } catch {
      failed++;
    }
  }
  return { examined: recipients.length, accepted, failed };
}
