# Contexto de fontes e reserva Google — 19/11/2026

O primeiro lote real da versão 464ba55 confirmou seis artigos completos, mas
comparações de IA ainda rejeitaram afirmações que não constavam dos trechos
capturados. A rejeição permanece obrigatória; não se altera a exigência de 90%.

Esta correção preserva títulos de seções públicas quando o site os implementa
como botões de acordeão dentro de headings. Botões de ações, navegação,
elementos ocultos e scripts continuam excluídos. A versão da extração muda para
exigir nova leitura, preservando as capturas e comparações anteriores.

O dossiê distribui o espaço não usado por uma fonte curta para sua fonte mais
longa. Os excertos continuam contíguos, com offsets Unicode conferidos contra
a captura, e o pedido serializado continua sujeito ao mesmo teto de bytes.
O prompt delimita o assunto dos explicativos pela pergunta editorial, mantendo
as ressalvas pertinentes, divergências e todos os fatos críticos anteriores.

A comparação Google reserva o menor valor entre o teto configurado e seu
envelope de entrada/saída mais 10 mil tokens de margem para o cliente oficial.
Com a configuração atual, a reserva cai de 60 mil para 30 mil por comparação.
O uso real continua registrado; exceder a reserva bloqueia novas gerações.
Não há aumento dos limites diários/semanais, das chamadas, nem redução da
reserva de 20% da assinatura. Texto e capa mantêm suas reservas atuais.

Validação em ambiente isolado: 173 testes unitários e 105 cenários PostgreSQL
aprovados, sem chamadas a provedores. A validação inclui o aproveitamento do
contexto de uma fonte longa, a seleção dos títulos públicos, preservação do
histórico, limites de consumo, geração de dez artigos sintéticos com capas e
agendamento nativo. O piloto real e o CI da revisão final são gates separados.
Não há migração ou alteração de configuração privada nesta correção.
