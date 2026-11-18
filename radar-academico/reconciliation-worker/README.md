# Renovação isolada da conciliação

Perfil Compose `finance`, desativado por padrão. O processo usa apenas uma
credencial administrativa com permissão `api.usage.read` e um login separado
`radar_ai_reconciler`, com acesso a duas funções e sem acesso direto a tabelas.
A chave de geração, web, scheduler, blog e chaves existentes não são alterados.

O operador precisa comprovar uma concessão gratuita vigente, ausência de recarga
automática, consumo completo da organização e preços aprovados. Registra uma
âncora privada em `radar_ai.reconciliation_anchor` com ciclo, mês, saldo da concessão,
expiração, custos e compromissos no momento da prova, referência e tarifa.
Nenhuma âncora, segredo ou ativação vem da migração.

A cada hora, o processo consulta GET `/v1/organization/costs` na conta da âncora,
exige paginação completa, USD e resposta recente. A chave nunca é enviada ao
endereço público de preços. A tabela Standard oficial deve continuar correspondendo
exatamente à tarifa aprovada. Reduções inesperadas de custos, falhas, redirecionamento,
respostas parciais e alterações de preço impedem a renovação.

A função renova apenas prova e validade das tarifas existentes por até duas horas,
limitadas ao fim do ciclo e da concessão. Desconta o maior custo adicional do
provedor ou compromisso local, incluindo operações incertas. Preserva o teto de
US$ 50/mês, divisão 30/15/5 e limites por operação/dia. Não ativa IA pausada, importa
novos créditos, troca conta/modelo/preço nem abre um novo mês. A virada mensal exige
nova conciliação do operador; a coleta gratuita permanece ativa.

Segredos montados somente neste serviço:
- `reconciliation.env`: `OPENAI_ADMIN_KEY=...`, apenas leitura de uso/custos.
- `reconciliation-database-url`: URL PostgreSQL do login exclusivo.

Teste sintético HTTP: `npm run test:ai-foundation`. Regras SQL são testadas na suíte
principal e devem ser conferidas em PostgreSQL restaurado antes da instalação.
O comando `node reconciliation-worker/cli.mjs check` consulta custos e tenta renovar
a prova uma vez, sem geração de conteúdo. Logs mostram somente estado e motivo,
sem credenciais, respostas privadas ou conteúdo de oportunidades.
