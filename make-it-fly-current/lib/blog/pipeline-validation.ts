import { z } from "zod";

export const EDITORIAS = { ia: "Inteligência artificial", startups: "Startups", "ciencia-espaco": "Ciência e espaço", tecnologia: "Tecnologia", oportunidades: "Oportunidades" } as const;
export const sourceSchema = z.object({
  id: z.string().regex(/^[A-Z0-9_-]{1,40}$/), name: z.string().trim().min(3).max(100),
  editoria: z.enum(["ia", "startups", "ciencia-espaco", "tecnologia", "oportunidades"]),
  url: z.string().url().max(500), article_hosts: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]+$/)).min(1).max(10),
  interval_minutes: z.number().int().min(60).max(1440), keywords: z.array(z.string().trim().min(1).max(100)).max(30),
  enabled: z.boolean(), feed_content_approved: z.boolean(),
  collection_approval_reference: z.string().trim().max(500), rights_reference: z.string().trim().max(500),
}).superRefine((s, ctx) => {
  let url: URL;
  try { url = new URL(s.url); } catch { ctx.addIssue({ code: "custom", path: ["url"], message: "Use um endereço HTTPS válido." }); return; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !s.article_hosts.includes(url.hostname)) ctx.addIssue({ code: "custom", path: ["url"], message: "Use HTTPS em um dos domínios permitidos." });
  if (s.enabled && s.collection_approval_reference.length < 8) ctx.addIssue({ code: "custom", path: ["collection_approval_reference"], message: "Registre a autorização de coleta." });
  if (s.feed_content_approved && s.rights_reference.length < 8) ctx.addIssue({ code: "custom", path: ["rights_reference"], message: "Registre a autorização de uso editorial." });
});
export type PipelineSource = z.infer<typeof sourceSchema> & { type: "rss" };
export const candidateKey = z.string().regex(/^[a-f0-9]{64}$/);
export const coverSchema = z.object({
  candidate_id: candidateKey, prompt: z.string().trim().min(20).max(2500),
  alt: z.string().trim().min(3).max(160), caption: z.string().trim().min(10).max(300),
}).refine(v => new TextEncoder().encode(v.prompt).length + 128 <= 1024, { message: "Reduza a descrição visual para respeitar o limite de consumo." });
export const pipelineMessages: Record<string, string> = {
  topic_locked_after_start: "A área da pauta fica vinculada ao primeiro uso para preservar o limite por tópico. Abra outra pesquisa para um enquadramento diferente.",
  saved: "Alterações salvas.", queued: "Pedido enviado à fila. O worker fará a verificação de consumo antes de gerar.",
  paused: "Geração pausada. A captação pode continuar.", resumed: "Pausa removida. Os limites e as verificações continuam ativos.",
  cover_applied: "Capa aplicada ao rascunho. Revise o artigo no editor.",
  invalid: "Revise os campos e as referências de autorização.", conflict: "O item mudou ou já existe um pedido em andamento. Atualize a página.",
  unavailable: "A Central Editorial ainda precisa ser instalada no banco deste ambiente.",
  unresolved: "Há consumo pendente ou acima da reserva. É necessária a reconciliação antes de retomar.",
  failed: "Não foi possível salvar. Nenhuma nova chamada de IA foi iniciada por esta ação.",
};
export function pipelineReason(code: string | null | undefined): string {
  const reasons: Record<string, string> = {
    topic_frequency: "Esta área já atingiu o limite diário ou semanal de matérias iniciadas.",
    comparison_required: "Conclua a comparação das evidências antes de criar o rascunho.",
    comparison_incomplete: "Monte o dossiê e compare os fatos antes da redação.",
    comparison_review_required: "A comparação desta versão precisa ser refeita antes de continuar.",
    compatibility_below_90: "Menos de 90% dos fatos relevantes estão convergentes.",
    critical_fact_unresolved: "Há fato crítico ausente, pendente ou contraditório.",
    independence_unverified: "Falta fonte primária ou apuração/análise independente conferida.",
    event_unverified: "Confirme se os documentos tratam do mesmo acontecimento e escopo.",
    invalid_comparison: "A comparação não apresentou uma matriz verificável.",
    quote_not_in_document: "Um trecho citado não corresponde literalmente ao documento.",
    invalid_claim_references: "O texto não vinculou corretamente os fatos aprovados às evidências.",
    evidence_changed: "O dossiê mudou durante a geração; resultado retido para revisão.",
    attempt_limit: "Limite de tentativas da pauta atingido, incluindo comparação e redação.",
    google_subscription_unverified: "Login e assinatura Google precisam ser conferidos.",
    google_call_limit: "Limite local de chamadas atingido. Aguarde o próximo período.",
    google_token_limit: "Limite local de uso atingido. Aguarde o próximo período.",
    google_quota_low: "Cota Google abaixo de 20%. Geração suspensa para preservar a assinatura.",
    google_quota_exhausted: "Cota Google esgotada. Sem fallback pago; a execução exige conferência antes de retomar.",
    google_auth_required: "O cliente Google precisa de novo login.",
    google_execution_unknown: "Execução Google incerta. Não será repetida automaticamente.",
    google_client_unverified: "Cliente oficial Google ainda não homologado.",
    google_client_changed: "O cliente Google mudou de versão e precisa ser conferido.",
    google_timeout: "Tempo limite atingido. Confira o resultado antes de retomar.",
    google_quota_unavailable: "Não foi possível conferir a cota Google. Nenhuma geração iniciada.",
    google_client_unavailable: "Cliente oficial Google indisponível neste ambiente.",
    manually_reconciled: "Consumo conferido e reconciliado pelo operador.",
    existing_artifact_imported: "Capa já gerada validada e importada, sem nova geração.",
    google_usage_missing: "Uso Google não informado; reserva mantida para conferência.",
  generation_disabled: "Geração desativada na configuração", credentials_missing: "Credencial do worker não configurada",
    benefit_unverified: "Créditos sem verificação recente", price_missing: "Preço do modelo não aprovado", image_price_missing: "Preço da imagem não aprovado",
    price_unapproved_or_expired: "Preço sem aprovação vigente", image_price_unapproved_or_expired: "Preço da imagem sem aprovação vigente",
    paused: "Pausa ativa", article_budget: "Limite da matéria insuficiente", daily_budget: "Limite diário atingido", cycle_budget: "Limite do ciclo ou saldo seguro insuficiente",
    draft_frequency: "Limite de matérias por dia ou semana atingido", unknown_charge: "Cobrança do texto incerta", unknown_image_charge: "Cobrança da imagem incerta",
    invalid_usage: "Consumo do texto sem confirmação", invalid_image_usage: "Consumo da imagem sem confirmação", usage_exceeded_reservation: "Consumo excedeu a reserva",
    human_review_required: "Revisão editorial necessária", post_changed_requires_review: "Artigo alterado durante a geração; revise a capa",
    source_changed_after_reservation: "Fonte alterada após o início", source_approval_changed: "Aprovação da fonte mudou", input_limit: "Dossiê maior que o limite",
    image_prompt_limit: "Descrição visual maior que o limite", worker_interrupted: "Execução interrompida; verificar histórico",
    operator_pause: "Pausa solicitada pelo editor", operator_hold: "Pauta retida pelo editor", invalid_structure: "Texto fora do formato esperado",
    unsupported_numbers: "Número sem suporte no dossiê", copied_passage: "Trecho semelhante à fonte", invalid_image: "Arquivo de imagem inválido",
    waiting_for_editor: "Aguardando pedido do editor", no_approved_sources: "Nenhuma fonte aprovada", storage_cap: "Limite de armazenamento atingido",
  };
  return code ? reasons[code] ?? "Verificação necessária" : "—";
}
