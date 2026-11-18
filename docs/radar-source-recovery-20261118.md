# Correção de fontes e prioridade FDE — 18/11/2026

## Problema e comportamento resultante

A CAPES moveu duas notícias do caminho de defeso eleitoral para o de notícias, e a FAPESP transferiu seu portal de oportunidades para um subdomínio próprio. Os coletores anteriores falhavam nessas mudanças. A versão candidata usa os caminhos oficiais atuais, mantém os URLs antigos como referências e preserva a identidade numérica das fichas FAPESP.

Os quadros de empregos registrados têm preferência quando a consulta está vencida. Mantêm o intervalo de seis horas, o lease transacional e as exigências atuais de fonte auditada, trabalho remoto e elegibilidade explícita para residentes no Brasil. LATAM isoladamente permanece insuficiente.

## Correções

- CAPES PDSE/PDAI: atualizar as duas URLs de notícias nos normalizadores e acrescentar seus caminhos à fonte persistida. O calendário continua sendo conferido no programa e na notícia. A edição PDAI expirada não é reaberta.
- FAPESP: usar `https://oportunidades.fapesp.br/`, reconhecer fichas atuais e legadas pelo mesmo ID numérico e manter a deduplicação, os aliases históricos e exclusões do administrador. O prefixo raiz do subdomínio novo não libera outras páginas no domínio antigo.
- OBVC: reconhecer o texto atual de inscrições encerradas com a mesma data auditada. A mudança não reabre a edição.
- Hack Brasil: atualizar a evidência e os requisitos após a organização retirar a exigência das três ferramentas. Manter as regras atuais de vigência e de exibição de eventos; nenhuma reabertura é forçada.
- Transporte HTML: uma nova tentativa, após dois segundos, apenas para 502/503/504. `Retry-After`, 401/403/429, erros DNS/TLS e bloqueios explícitos continuam encerrando a tentativa. Cada consulta mantém os controles de robots, tamanho, redirecionamento e prazo total existente.

A migração `0062_source_canonical_paths.sql` altera somente os perfis CAPES PDSE/PDAI e o perfil legado exato da FAPESP. Preserva ativação, estado de verificação, curadoria e demais fontes. Apenas fontes já ativas e verificadas ficam devidas para a próxima consulta. O catálogo é atualizado pela ingestão automática normal, sem cadastro manual de oportunidades.

## Evidências oficiais

- [Notícia PDSE atual](https://www.gov.br/capes/pt-br/assuntos/noticias/doutorado-sanduiche-no-exterior-tem-prazos-e-criterios-de-selecao-alterados).
- [Notícia PDAI atual](https://www.gov.br/capes/pt-br/assuntos/noticias/prazo-de-inscricao-no-pdai-e-prorrogado-ate-26-de-outubro).
- [Portal FAPESP atual](https://oportunidades.fapesp.br/), destino do redirecionamento oficial de `https://fapesp.br/oportunidades/`.
- [OBVC](https://obvc.com.br/) e [Hack Brasil](https://hackbrasil.com/).

Os snapshots completos e os descritores de produção foram mantidos na pasta local ignorada `.local/source-recovery/`. Não entram no Git nem são usados para fabricar oportunidades.

## Validação local

- Suíte Radar: 807 testes passaram; 38 testes condicionais não executados.
- PostgreSQL nativo descartável: 28 testes passaram, incluindo publicação automática sob RLS, prioridade de empregos, identidade FAPESP entre hosts, preservação de URLs históricos, retirada administrativa e falha de transporte sem falsa conclusão de fechamento.
- Reprocessamento sem rede de 14 snapshots/coletores: normalizadores corrigidos passaram; nove feeds de empregos com duas candidatas publicáveis. As duas já existentes não são contadas como vagas novas. Os demais anúncios permanecem sujeitos aos mesmos bloqueios.
- Validação final com Node 22.23.2 e Next.js 16.4.6, alinhados ao lockfile: tipagem, lint, 89 testes financeiros sem provedor, build standalone e teste de inicialização isolada passaram. A auditoria de dependências de produção retornou zero vulnerabilidades após repetir uma consulta que falhou por comunicação com o registry.
- O ambiente foi isolado por cópia APFS. A remoção dos dois artefatos locais da tentativa incompleta foi expressamente autorizada; código, relatórios e dependências originais foram preservados. O lockfile não foi alterado.
- O candidato foi atualizado para o main 4752338 (PRs de benefícios e blog preservados). A árvore inteira do Radar permaneceu idêntica à testada: cca1988b7d766e20993768c572978bcc87cceeed.

## Orçamento e limites

O teto continua **US$ 50 por mês**, com **US$ 30 para Radar, US$ 15 para empregos e US$ 5 para rechecagens/recuperação**. Não há mudança em contratos financeiros, funções de orçamento, credenciais, modelos ou conciliação mensal. A migração foi conferida contra o estado financeiro anterior no teste PostgreSQL.

A auditoria dos coletores usa GETs públicos gratuitos. O reprocessamento usa arquivos locais e os testes usam transportes simulados; nenhum deles chama modelos pagos. A liberação em produção continua condicionada à comprovação de crédito e aos limites existentes.

Na consulta ao vivo com a nova tentativa limitada, SINTER Gestores/Docente, Experimenta e NILT responderam; o conteúdo atual não confirma mais as edições antigas, que continuam retidas. Os artigos SINTER informam encerramento das candidaturas em 09/11 e 03/11, respectivamente; o índice atual não confirma essas chamadas como abertas. O perfil NILT não confunde novas oficinas com a edição anterior. Propesq continuou com falha de acesso e a fonte PMI/Sympla não passou pela verificação de robots. Restrições de robots não são contornadas. A nova tentativa não garante disponibilidade do provedor nem novas ofertas qualificadas a cada dia.

## Publicação e rollback

Esta nota descreve um candidato local; não comprova CI remota, merge, deploy ou publicação de novas fichas em produção.

Depois de autorização explícita para o SHA candidato e o deploy:

1. Confirmar main, árvore remota limpa, saúde, revisões, capacidade e configurações; obter backup e ensaiar restauração/migração isolada.
2. Após CI aprovada, construir a imagem do SHA aprovado e atualizar somente o web do Radar e a migração 0062. Preservar site/blog, agendador, IA, financeiro, configurações e volumes.
3. Observar ciclos nativos do agendador e registrar separadamente links vistos, fichas criadas, atualizações, publicações e retenções. Conferir o catálogo público/membros e o estado financeiro.
4. Confirmar as nove fontes de empregos sem alterar sua elegibilidade ou forçar vagas novas.

Rollback: conservar a imagem anterior e o snapshot dos três perfis. Se necessário, pausar apenas as fontes afetadas e restaurar o web e seus perfis com a autorização operacional aplicável. Preservar fichas, IDs, aliases históricos, curadoria e exclusões. Não restaurar o banco inteiro sobre novas atividades do catálogo.
