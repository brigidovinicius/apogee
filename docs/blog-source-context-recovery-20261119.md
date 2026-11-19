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

Validação em ambiente isolado: 175 testes unitários e 106 cenários PostgreSQL
aprovados, sem chamadas a provedores. A validação inclui o aproveitamento do
contexto de uma fonte longa, a seleção dos títulos públicos, preservação do
histórico, limites de consumo, geração de dez artigos sintéticos com capas e
agendamento nativo. O piloto real e o CI da revisão final são gates separados.
Não há migração ou alteração de configuração privada nesta correção.

Também foi identificado um bloqueio na ordem da pesquisa: uma recuperação ou
explicativo sem dossiê e sem sequer fazer requisições HTTP encerrava o ciclo,
impedindo a seleção de notícias recentes. Esses resultados vazios agora cedem
a vez. Uma preparação bem-sucedida ou uma pesquisa que usou HTTP mantém sua
prioridade e o orçamento único do ciclo. Um cenário de banco verifica ambos
os caminhos com fontes sintéticas e nenhuma chamada a provedor.

Manchetes oficiais “Introducing/Announcing Gemini <versão> <modelo>” passam a
identificar o lançamento exato quando uma cobertura de outra autoria o nomeia
na mesma janela de 48 horas. Versões, variantes, rumores e datas divergentes
continuam excluídos. Isso seleciona documentos para comparação; nunca aprova
fatos, independência editorial, imagens ou publicação.

O piloto real confirmou a reserva menor em duas comparações Google e preservou
ambas as pautas em retenção: as referências ainda não corroboraram todos os
fatos críticos. Não se declara concluído o lote real com base em testes
sintéticos ou em pares de fontes selecionados sem comparação aprovada.

Na recuperação real por API, um dossiê cabia no transporte Google, mas excedia
o mesmo limite de 18 mil bytes com campos repetidos e fatos protegidos enviados
duas vezes no JSON. A API agora usa o mesmo transporte por colunas do Google,
preservando todos os valores, citações e fatos protegidos. No caso observado,
o pedido cai de 18.381 para 17.849 bytes, com zero chamadas durante a medição.
O limite de entrada, a reserva financeira e o máximo de saída não mudam.
