# Blog: foco editorial e lote adicional

## Escopo autorizado

Em 15/11/2026 o titular confirmou a revisão e autorizou publicar somente os posts
41 a 50. A publicação foi concluída pelo painel, com revisão de matriz e revisão
final registradas, e as dez páginas, capas e fontes foram conferidas.

Depois escolheu dez matérias diárias: quatro de Tecnologia, três de IA e três de
Negócios; também autorizou mais dez hoje para testar o fluxo. O lote adicional e
toda produção futura permanecem em rascunho. Google oficial, sem APIs pagas,
recarga, créditos extras ou execução pela assinatura Codex; convergência mínima
de 90% e confirmação de todos os fatos críticos continuam obrigatórias.

## Implementação

- Compartilhar as regras de distribuição entre pesquisa, seleção, reserva e painel.
  IA constitui uma pauta própria, sem consumir simultaneamente a meta de Tecnologia.
  Ciência permanece no acervo; a produção automática passa a selecionar os três focos.
- Preservar os contadores integrais. A exceção datada de hoje identifica os dez
  posts anteriores como linha de base; apenas o progresso do lote extra os exclui.
  Tokens, chamadas, totais diários e semanais não são apagados nem descontados.
- Usar a exceção de consumo já existente: até 80 chamadas no dia e reserva local
  de 15 mil tokens por chamada. Continuam os tetos de 180 mil/dia e 900 mil/semana,
  280 chamadas/semana, execução serial e margem Google de 20%. Se faltar cota,
  reter a matéria; não trocar para API paga.
- Notícias recentes têm prioridade. Explicativos reais podem complementar a meta,
  com datas identificadas, sem reciclar artigos nem chamar material antigo de anúncio.
  Tradução de unidades e impactos de negócio devem permanecer apoiados nas fontes.
- O painel deve distinguir os dez anteriores do lote extra 4/3/3, sem tratar revisão
  automática como aprovação humana.

## Validação e release

Cobrir distribuição, não duplicação de IA, reservas incertas, limite semanal,
expiração à meia-noite de Brasília, linha de base, retenção por 89%/fato crítico,
recibos e capas, importação apenas como rascunho e progresso do painel.
Testar primeiro com fixtures e PostgreSQL isolado; só depois usar Google real.
Preservar a fila local e o site ativo de outro chat. Push, PR e ativação de um novo
SHA serão apresentados para aprovação após a versão ficar concreta e testada.

Arquivos previstos: módulo compartilhado editorial-plan, policy/store/pesquisa/
explicativos/editorial do worker, painel/dados do blog, testes correspondentes e
catálogo de perguntas caso referências reais adicionais sejam necessárias.

## Evidência anterior à implantação

- 123 testes unitários do worker, 74 cenários PostgreSQL isolados e 15 verificações
  do painel aprovados; tipos, lint e `git diff --check` aprovados. Nenhuma chamada
  real de provedor foi feita por esses testes. A fila local permaneceu intacta.
- Sete perguntas novas usam pares oficiais já cadastrados (Google, Microsoft,
  SBA e business.gov.au); todas as páginas foram lidas pelo leitor público do
  worker, respeitando hosts e robots. Os planos existentes e sua ordem foram
  preservados. A comparação real de cada pauta ainda pode retê-la.
- A versão pública passou de 47564aa para b6810ce enquanto validávamos. Preparar
  a release a partir desse visual já ativo, somando somente a curadoria do blog
  já aprovada e este foco. Não retroceder a comunidade, loja ou tipografia.
- Antes da troca, repetir tipos/lint/testes na árvore combinada, construir as duas
  imagens, restaurar o backup e conferir novamente o SHA ativo sob deploy.lock.
