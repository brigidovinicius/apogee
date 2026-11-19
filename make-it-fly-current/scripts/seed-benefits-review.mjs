// Synthetic local review only. Real research offers may be supplied privately as drafts.
import { readFile } from "node:fs/promises";
import { recordBenefitCheck } from "./member-benefits-monitor.mjs";
export async function seedBenefitsReview(sql, manifestPath) {
  const [owner] = await sql`select current_user as role`;
  if (owner.role !== 'apogee_local' || process.env.APOGEE_BENEFITS_REVIEW !== '1') throw Error('Seed restrito à revisão local.');
  const categories = [['criar-com-ia','Criar com IA'],['automatizar','Automatizar'],['organizar-trabalho','Organizar trabalho'],['clientes-e-vendas','Clientes e vendas']];
  for (const [index,[slug,name]] of categories.entries()) await sql`insert into member_benefit_category(id,slug,name,status,sort_order,updated_by)
    values(${'local-category-'+slug},${slug},${name},'published',${index},'revisaoadmin') on conflict do nothing`;
  const fixtures = [
    ['local-benefit-video', '[Teste local] Criar um vídeo', 'criar-com-ia'],
    ['local-benefit-automation', '[Teste local] Automatizar uma tarefa', 'automatizar'],
    ['local-benefit-writing', '[Teste local] Organizar uma pesquisa', 'organizar-trabalho'],
    ...Array.from({ length: 12 }, (_, index) => ['local-benefit-journey-' + (index + 1), `Oferta de validação ${String(index + 1).padStart(2, '0')}`, categories[index % categories.length][0]]),
  ];
  for (const [id,name,category] of fixtures) {
    await sql`insert into member_benefit(id,name,partner,description,evidence_url,eligibility,availability,starts_at,ends_at,redemption,redemption_url,status,reviewed_by)
      values(${id},${name},'Parceiro sintético','Oferta fictícia para testar a navegação. Não concede desconto, licença ou créditos reais.',
        'https://example.org/local-test-agreement','Conta sintética com assinatura anual ou administração.','Somente neste ambiente local.',now()-interval '1 day',now()+interval '30 days',
        'Inicie o resgate para testar o histórico. Nenhum parceiro será acionado e nenhum cadastro externo é necessário.','https://example.org/local-test-redemption','published','revisaoadmin')
        on conflict(id) do update set redemption_url=excluded.redemption_url where member_benefit.redemption_url=''`;
    await sql`insert into member_benefit_organization(benefit_id,category_id,provider_label,provider_access) values(${id},${'local-category-'+category},'Ambiente de teste','included') on conflict do nothing`;
    const [receipt] = await sql`select public.member_benefit_monitor_revision(b) as revision from member_benefit b where b.id=${id}`;
    await recordBenefitCheck(sql, { id, revision: receipt.revision, checkedAt: new Date().toISOString() }, { outcome: "verified", reason: "Ficha sintética para revisão local" });
  }
  await sql`insert into member_benefit(id,name,partner,description,status,reviewed_by) values('local-benefit-draft','[Teste local] Rascunho privado','Parceiro sintético','Não pode aparecer para membros.','draft','revisaoadmin') on conflict do nothing`;
  if (!manifestPath) return;
  const manifest = JSON.parse(await readFile(manifestPath,'utf8'));
  if (manifest.status !== 'private_research_not_for_import_or_publication' || !Array.isArray(manifest.offers) || manifest.offers.length > 30) throw Error('Manifesto de pesquisa inválido.');
  for (const offer of manifest.offers) {
    if (offer.apogeePublicationStatus !== 'research_only' || offer.apogeeAgreementStatus !== 'not_confirmed' || !/^[a-zA-Z0-9_-]{1,70}$/.test(offer.id) || typeof offer.tool !== 'string' || typeof offer.offerSummary !== 'string') throw Error('Candidata sem estado de rascunho válido.');
    const source = new URL(offer.sourceUrl);
    if (source.protocol !== 'https:' || source.hostname !== 'www.joinsecret.com' || source.username || source.password) throw Error('Fonte de pesquisa inválida.');
    source.hash = ''; source.search = '';
    const id = 'local-candidate-'+offer.id;
    await sql`insert into member_benefit(id,name,partner,description,eligibility,availability,status,reviewed_by)
      values(${id},${(offer.tool+' — '+offer.offerSummary).slice(0,140)},${offer.tool.slice(0,140)},${offer.offerSummary.slice(0,2000)},
        ${String(offer.eligibility??'').slice(0,2000)},'Em conferência. Parceria Apogee não confirmada.','draft','revisaoadmin') on conflict do nothing`;
    const category = categories.find(([,name]) => name === offer.category)?.[0];
    await sql`insert into member_benefit_organization(benefit_id,category_id,provider_label,provider_access,source_url)
      values(${id},${category?'local-category-'+category:null},'Secret — parceria em negociação',${offer.providerAccessObserved?.includes('Premium')?'premium':'unconfirmed'},${source.toString()}) on conflict do nothing`;
  }
}
