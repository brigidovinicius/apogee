# Recuperação da pesquisa editorial — 14/11/2026

O worker havia criado apenas uma matéria porque as 36 perguntas de apoio já
tinham sido escritas ou retidas. Uma comparação rejeitada tornava a pergunta
inacessível para sempre, mesmo após a obtenção de contexto melhor. A assinatura
Google e o orçamento não eram o bloqueio observado.

## Mudança

- Acrescenta nove perguntas distintas, uma para cada tópico ainda vazio no dia,
  com duas instituições cadastradas por pergunta. Melhora também as referências
  específicas para ramificações Git e modelos de implantação em nuvem.
- Usa o maior excerto contíguo que couber no teto de entrada já existente.
- Permite reapurar uma pergunta ainda não escrita após uma única comparação
  factual rejeitada, somente com evidência textual diferente. Trocar a data ou o
  identificador da captura não basta. Prioriza perguntas novas e limita leituras
  de recuperação a uma seleção por pergunta/dia.
- Preserva recibos, versões, fatos críticos substantivos e o limite acumulado de
  três tentativas de comparação/redação. Fontes novas exigem nova comparação
  Google; fatos críticos anteriores não podem ser omitidos ou rebaixados.
- Registra separadamente uma observação operacional sobre uma lacuna de um
  excerto antigo. Isso não exclui limitações de estudos ou resultados negativos.
- Mantém 90%, confirmação dos fatos críticos, bloqueios editoriais, verificação
  de conteúdo repetido, revisão humana e importação apenas em rascunho.

## Banco e implantação

A migração `012` substitui as duas funções de pesquisa/comparação, sem ampliar
permissões, excluir histórico ou alterar artigos existentes. A implantação deve
atualizar somente o worker, com backup restaurado e a migração testada em cópia.
O site, Radar, assinatura, credenciais e configuração de consumo são preservados.

Os testes de regressão cobrem rejeição de evidência idêntica, nova comparação com
contexto diferente, manutenção dos fatos críticos, limite de tentativas, acesso
somente a rascunhos e geração simulada de dez artigos com capas creditadas.
Os testes usam respostas sintéticas e não fazem chamadas reais de IA.

Para o lote de hoje, os nove dossiês novos foram validados com fontes públicas,
testados em transação com rollback e entregues à fila existente sem aprovar
fatos, inserir revisão humana, publicar ou zerar qualquer contador de consumo.
