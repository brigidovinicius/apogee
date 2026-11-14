# Radar: fontes internacionais e validação de publicação

## Release autorizada e implantada

- PR [#171](https://github.com/brigidovinicius/apogee/pull/171), integrado em
  14/11/2026 como `d6a422d8207cb04eefe9819c082f948dc5a4de30`.
- SHA expressamente autorizado e implantado, sem substituir pelo merge:
  `59c508bfc719805a1ec105315ff44bae60ce54e6`.
- CI [43526441321](https://github.com/brigidovinicius/apogee/actions/runs/43526441321):
  seis checks aprovados. Apenas Radar web/agendador foram recriados.
- Corte às 11h24 de 14/11, Brasília. Ambos ativos, web saudável, zero reinícios.
  Imagem e commit de rollback: `2b4660cbd131f0009c082bb27c2ed39b5fa37a34`.
- Backup de 9.514.076 bytes, SHA-256
  `f8f2409461c6583661d5878eed772584e97afe6fc4cfc0cdeef921b7271e6142`,
  restaurado em PostgreSQL isolado sem rede: 1.453 fichas e 104 fontes.
- Nenhuma migração. Configurações, certificados, 29 containers vizinhos,
  edições administrativas, exclusões e fontes/alvos pausados preservados.
  Site permaneceu na imagem `27e5e96b004815356829f01920f85b45011f80b4`.
- As três fontes foram ativadas às 11h26 usando o script do SHA autorizado.
  Google e Kiro consultados às 11h31; WeMakeDevs às 11h38. Os três registros
  têm `check_interval_hours=24` e política de elegibilidade para o Brasil.
- A primeira consulta descobriu 12 links (Google 2, Kiro 2, WeMakeDevs 8).
  Isso não comprova publicação. A ficha precisa ser criada após o corte,
  com `verification_method=automatic`, execução de persistência correspondente
  e presença no catálogo. Os cadastros editoriais do dia 13 não contam.
- Foi executada uma rodada limitada `leadsOnly` pelo operador para validar o
  mesmo processador automático: cinco links, zero criações/publicações.
  Esse acionamento não deve ser descrito como rodada espontânea do agendador.

Comandos: `git fetch` por branch explícita, worktree remoto isolado para build,
`docker build` apenas Radar, smoke sem rede, `git switch --detach` no SHA
autorizado, Compose `up -d --no-deps --no-build --force-recreate web` e depois
`scheduler`. O SQL de configuração foi lido por `git show` do mesmo SHA.
Não houve `git pull`, reset, limpeza de projetos, edição de segredos ou
alteração de serviços vizinhos.

Auditoria privada na VPS:
`/opt/apogee-backups/radar-global-events-20261114-59c508b/`.
Inclui backup/restauração, imagem/smoke, baseline, corte, fontes ativas,
verificação de preservação, fila, observação e comprovação de publicação.

## Bloqueio real encontrado após o corte

A [lista oficial](https://www.wemakedevs.org/hackathons) anuncia o
[Toggle Wars](https://www.wemakedevs.org/hackathons/flagsmith), de 26 a 29/11.
Sua FAQ diz que desenvolvedores de qualquer lugar do mundo podem participar;
o evento é online e gratuito. O cadastro usa conta WeMakeDevs na própria página.

No SHA implantado, o nome criativo sem “hackathon” era descartado na seleção.
Além disso, a página sem `main`/JSON-LD, com título ilustrado e FAQ em inglês,
não era compreendida pelo extrator. O teste reproduziu ambos os bloqueios.

A correção subsequente fica isolada em `fix/radar-wemakedevs-20261114`:

- Contexto “Hackathons” aplicado somente aos cards datados, de mesmo domínio,
  filhos da lista oficial exata. Não libera títulos em outros sites ou páginas.
- Adaptador restrito à autoria WeMakeDevs, URL auditada e template comprovado.
  Exige FAQ única, ano explícito, calendário válido, modalidade e cadastro
  disponíveis. Não importa data editorial nem presume o ano atual.
- “Developers from anywhere in the world” só vale como resposta de participação;
  rodapé, patrocinador ou regra externa não substituem a elegibilidade.
- Início/fim armazenados com precisão de dia. Horários IST permanecem na
  descrição; nenhuma conversão de fuso é presumida. A submissão do projeto
  não vira prazo de inscrição. Símbolo `$` não vira automaticamente `USD`.
- Aviso de fechamento/cancelamento ou novo prazo de inscrição retém a página;
  uma reconsulta bem-sucedida retira a ficha quando as condições deixam de valer.

Essa correção não está implantada por esta autorização: um novo SHA exige novo
gate de deploy. Testes locais usam banco e datas sintéticas; a verificação
adicional com HTML completo capturado não faz requisições de rede nem publica.
