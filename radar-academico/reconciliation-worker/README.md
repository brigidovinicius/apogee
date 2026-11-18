# Renovação isolada da conciliação

Perfil Compose `finance`, desativado por padrão. O processo usa apenas uma
credencial administrativa com permissão `api.usage.read` e um login separado
`radar_ai_reconciler`, com acesso às funções financeiras limitadas e sem acesso direto a tabelas.
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
novos créditos ou troca conta/modelo/preço. A coleta gratuita permanece ativa.

## Virada mensal automática

A migração `0061_automatic_month_opening.sql` adiciona uma opção desativada por
padrão: `automatic_months` na âncora original. A instalação autorizada pode ativá-la
somente para a âncora vigente. Nenhum crédito, segredo ou ativação é semeado.

Com essa opção, o mesmo serviço acorda logo após a meia-noite de Brasília na virada
do mês. Antes de abrir o período, lê os custos do novo mês e de toda a janela da
âncora original, verifica preços e atualidade das respostas e chama uma transação
restrita. A transação confere conta, mês esperado, controle manual e concessão ainda
válida, carrega as reservas incertas e mantém o teto de 50 milhões de microdólares
e os limites de 30/15/5. Duas tentativas simultâneas não criam duas aberturas.

O novo ciclo referencia a mesma concessão, seu vencimento e consumo acumulado:
virar o calendário não renova o crédito. Sem saldo positivo comprovado, a abertura
não ocorre e as chamadas de IA ficam bloqueadas. Uma concessão nova ou vencida
exige evidência nova; a permissão `api.usage.read` não autoriza consultar ou alterar
o faturamento nem permite presumir recargas.

Custos da organização sem recibo local confirmado são importados na faixa Radar,
incluindo consumo ocorrido antes da abertura ou entre verificações. A API fornece
baldes diários UTC; sobreposição com o mês anterior e custos ainda incertos ficam
contabilizados conservadoramente. Importações nunca são subtraídas por atraso do
provedor. A API e sua paginação estão na [referência oficial de custos](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs).

Uma pausa do operador, concessão expirada, preço alterado, conta divergente,
evidência incompleta ou abertura já criada por outro fluxo não são sobrescritos.
Se a verificação falhar, o processo tenta novamente na próxima rodada; a prova
existente vence normalmente, sem estender validade por erro.

Rollback: voltar somente à imagem anterior do `finance-worker` e desativar
`automatic_months` na âncora original. As tabelas, recibos e ciclos permanecem
preservados. O trabalhador anterior não abre meses novos. Uma restauração de banco
não faz parte do rollback normal e não deve apagar consumo já registrado.

Segredos montados somente neste serviço:
- `reconciliation.env`: `OPENAI_ADMIN_KEY=...`, apenas leitura de uso/custos.
- `reconciliation-database-url`: URL PostgreSQL do login exclusivo.

Teste sintético HTTP: `npm run test:ai-foundation`. Regras SQL são testadas na suíte
principal e devem ser conferidas em PostgreSQL restaurado antes da instalação.
O comando `node reconciliation-worker/cli.mjs check` consulta custos e tenta renovar
a prova uma vez, sem geração de conteúdo. Logs mostram somente estado e motivo,
sem credenciais, respostas privadas ou conteúdo de oportunidades.
