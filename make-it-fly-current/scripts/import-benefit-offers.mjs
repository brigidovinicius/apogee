import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";
import { loadBenefitOffers, recordBenefitCheck, ruleKey } from "./member-benefits-monitor.mjs";
import { sourceSession } from "./benefit-source-check.mjs";

const categoryNames = {
  desenvolvimento: "Desenvolvimento", hospedagem: "Hospedagem e nuvem", dados: "Dados e análise",
  design: "Design e criação", produtividade: "Produtividade", seguranca: "Segurança",
  aprendizagem: "Aprendizagem", marketing: "Marketing e atendimento", financeiro: "Financeiro",
};

async function ingest(offers, editorId) {
  const check = sourceSession();
  const verified = [];
  for (const offer of offers) {
    const checkedAt = new Date().toISOString();
    const result = await check(offer);
    if (result.outcome === "verified") verified.push({ ...offer, checkedAt, result });
    else console.log(JSON.stringify({ id: offer.id, ...result }));
  }
  console.log(JSON.stringify({ candidates: offers.length, verified: verified.length, belowTarget: verified.length < 100 }));
  if (!editorId) return;
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, max: 1, connect_timeout: 10 });
  try {
    await importApprovedBenefitOffers(sql, verified, editorId);
  } finally {
    await sql.end();
  }
}

export async function importApprovedBenefitOffers(sql, verified, editorId) {
  const keys = new Set(verified.map(offer => ruleKey(offer.source,offer.redeem)));
  if (keys.size !== verified.length || verified.some(offer => offer.result.outcome !== "verified")) {
    throw Error("O lote contém ofertas duplicadas ou sem verificação positiva.");
  }
  if (verified.length < 100) throw Error("A rodada não confirmou as 100 ofertas exigidas.");
  return sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext('member_benefit_import'))`;
    const editors = await tx`select id from "user" where id=${editorId} and role='admin' and blocked=false for share`;
    if (!editors.length) throw Error("Selecione um editor ativo que aprovou o lote.");
    const inventory = await tx`select id,evidence_url,redemption_url,status from member_benefit order by id for update`;
    const existing = new Map(inventory.map(row => [ruleKey(row.evidence_url,row.redemption_url), row]));
    for (const offer of verified) {
      const [category] = await tx`insert into member_benefit_category(id,slug,name,status,updated_by)
        values(${randomUUID()},${offer.category},${categoryNames[offer.category]},'published',${editorId})
        on conflict(slug) do nothing returning id,status`;
      const [matchedCategory] = category ? [category] : await tx`select id,status from member_benefit_category where slug=${offer.category} for share`;
      if (matchedCategory.status !== "published") throw Error("Uma categoria do lote está indisponível.");

      const previous = existing.get(ruleKey(offer.source,offer.redeem));
      if (previous && previous.status !== "published") throw Error("Existe uma ficha desse lote em revisão ou arquivada.");
      const id = previous?.id ?? offer.id;
      if (!previous) {
        await tx`insert into member_benefit(id,name,partner,description,evidence_url,eligibility,availability,verified_at,
          redemption,redemption_url,status,sort_order,reviewed_by,audience)
          values(${id},${offer.condition},${offer.partner},${offer.condition},${offer.source},${offer.eligibility},${offer.availability},
          ${offer.checkedAt},${offer.instructions},${offer.redeem},'published',${offer.sort},${editorId},${offer.audience})`;
        await tx`insert into member_benefit_organization(benefit_id,category_id,provider_label,source_url)
          values(${id},${matchedCategory.id},${offer.program},${offer.source})`;
        await tx`insert into member_deliverable_audit(id,actor_id,entity_type,entity_id,action,status)
          values(${randomUUID()},${editorId},'benefit',${id},'create','published')`;
      } else if (offer.id === "hostgator-rosa") {
        await tx`update member_benefit set sort_order=0,reviewed_by=${editorId},reviewed_at=now()
          where id=${id} and sort_order<>0`;
      }
      const [revision] = await tx`select public.member_benefit_monitor_revision(b) as revision from member_benefit b where b.id=${id}`;
      await recordBenefitCheck(tx, { id, revision: revision.revision, checkedAt: offer.checkedAt }, offer.result);
    }
    const [total] = await tx`select count(distinct (evidence_url,redemption_url))::int as n from member_benefit b where public.member_benefit_is_available(b)`;
    if (total.n < 100) throw Error("A contagem final não atingiu 100 ofertas. O lote foi revertido.");
    return total.n;
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--publish" || !/^[\w-]{1,128}$/.test(args[1]))) {
    throw Error("Execute sem argumentos para verificar fontes ou use --publish com o ID do editor autorizado.");
  }
  await ingest(await loadBenefitOffers(), args[1]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error && !error.code ? error.message : "Lote interrompido antes de concluir a publicação.");
    process.exitCode = 1;
  });
}
