# Radar — integração, deploy e validação em produção

## Resultado confirmado

- PR integrado: https://github.com/brigidovinicius/apogee/pull/67
- Merge em main: `7c2f34625b7a52860481e344d4101e9cd8d34645`.
- Head funcional aprovado: `a9256286d3589051e60925375f0240bd5f9bed19`.
- CI aprovado: https://github.com/brigidovinicius/apogee/actions/runs/39019133955
- Quatro jobs aprovados: Radar, site, legado e PostgreSQL/área de membros.
- 293 testes do site, 244 do Radar, quatro do legado e integração PostgreSQL da galeria aprovados, além do teste de sessão real descrito abaixo.
- As branches de prioridade pública e otimização foram integradas com resolução dos conflitos. O contrato compartilhado usa `orderOpportunityFeed` e `editorialFeed`; as regras novas de vestibular explícito e paginação no servidor prevalecem onde substituem a apresentação antiga.

## Área de membros

O CI cria um banco descartável separado e usa Better Auth real para cadastrar um membro sintético e obter uma sessão válida. Testa: catálogo protegido, 24 entradas na primeira página, página seguinte sem duplicatas, vestibular apenas sob seleção explícita, SC/Gaspar, busca sem acentos, retorno a Todas, bloqueio de administração e rejeição de sessão inválida. A ponte Radar usa dados exclusivamente sintéticos e loopback. Nenhum usuário ou sessão de produção é criado.

A primeira execução do CI aprovou os três aplicativos e encontrou uma expectativa errada no teste novo: o admin existente redireciona para `/admin/acesso-negado`, em vez de retornar 404. A asserção foi corrigida, sem alterar autorização de produção. A segunda execução aprovou todos os jobs, incluindo o E2E autenticado.

A sessão já existente do usuário no navegador integrado abriu a área de membros depois do deploy. A conta administrativa estava na pré-visualização de usuário; o papel de membro comum foi validado separadamente pelo E2E do CI. Em produção passaram: 24 entradas iniciais, página 2 sem repetir títulos, vestibular explícito, listas completas de 59/41 cursos, SC/Gaspar com duas opções do IFSC, Todas preservando localização e retirando vestibulares, limpeza e busca `inovacao` encontrando títulos com acentos. As duas abas foram restauradas ao catálogo sem filtros. Nenhum cadastro ou aviso foi enviado.

## Publicação confirmada em 17/10/2026

Após a autorização explícita para retomar o mesmo SSH, o preflight confirmou `root@srv1439756`, checkouts limpos, Apogee em `a7357bdedb4b95b9a0ded0d7a65ea28ea570ce0a` e Radar em `bb82cafc3595c8b8ef8157699cbd354435411762`, ambos saudáveis e `.env` com modo 600. A consulta fresca de disco mostrou 87 GiB disponíveis; o valor anterior era histórico.

Backup válido: `/opt/apogee-backups/radar-optimization-20261017T144410Z`, diretório 700, dumps e cópias protegidas de configuração com checksums conferidos. Snapshots consistentes foram restaurados em bancos temporários isolados; contagens e fingerprints do conteúdo coincidiram nas 13 tabelas do Radar e 14 de membros. Os bancos temporários foram removidos. A primeira passagem apontou para o banco administrativo vazio do container de membros; ela não foi aceita como validação. O backup acima foi repetido com o banco efetivo `apogee_membros`. O diretório anterior `radar-optimization-20261017T144323Z` foi preservado e não é o backup de referência.

O merge publicado e o head aprovado pelo CI têm a mesma árvore `a4620aadee482b5888b4efd4db2c735f6bc2a35f`. As duas aplicações foram atualizadas por fetch explícito de main e checkout destacado no SHA exato `7c2f34625b7a52860481e344d4101e9cd8d34645`. As migrações não diferem das revisões anteriores. Compose `config -q`, builds sequenciais e labels das imagens passaram antes da recriação restrita a `web` com `--no-deps --no-build --force-recreate`.

Em `2026-10-17T14:50:38Z`, ambos os checkouts estavam limpos e os containers saudáveis, com zero reinícios, na revisão aprovada:

| Aplicação | Imagem |
|---|---|
| Apogee site | `sha256:0071315399ae30cf7930bdc80d6424c42d1cb71d12b92583f2df1c4ec9ed98e5` |
| Radar | `sha256:8445c2c83bb413d4a1a62516bb9bee1a9bcca353f8089fc7cd1d7596885cf639` |

A comparação dos IDs dos containers confirmou que somente os dois web mudaram. Scheduler, bancos, proxy, ALU e demais serviços preservaram seus IDs. O script do scheduler não mudou; sua chamada normal de `2026-10-17T14:52:42Z` terminou `completed`, sem falhas e sem fontes vencidas para processar nessa rodada. Isso confirma o ciclo HTTP, não uma nova auditoria ou coleta de todas as fontes. A última conferência manteve os dois web saudáveis, zero reinícios e 82 GiB livres.

Imagens anteriores permanecem disponíveis para rollback: site `a7357bdedb4b95b9a0ded0d7a65ea28ea570ce0a` / `sha256:4b529b72868a4ae4207dac1ee086480a077ad6c73f91128565d72c1016608593`; Radar `bb82cafc3595c8b8ef8157699cbd354435411762` / `sha256:94588d3fbab7ed117b2f9443a7d3e1dbb9ebff5148bcdf73dd55b29732b141d9`. O rollback de código usa essas imagens e checkouts; não exige alteração de esquema.

Não houve migração, ativação de fontes, alteração de dados por esta operação, DNS, Caddy, credenciais, certificados, volumes ou redes. O scheduler permaneceu em execução normal durante os snapshots e o deploy.

## Cenários e integridade observados

- Antes/depois da troca: exatamente os mesmos 1.170 IDs publicados únicos, sem adições/exclusões. Público e administração com os mesmos IDs e zero diferenças nos campos comuns em ambas as leituras.
- O catálogo de hoje tem 1.072 entradas após agrupar 100 cursos em dois processos; o padrão mostra 1.070 ao reservar esses dois processos para o filtro explícito. A captura inicial de 16/10 tinha 1.180 registros brutos; o valor atual já era 1.170 antes da troca e não representa exclusão pelo deploy. Categorias se sobrepõem e não devem ser somadas.
- Público inicial: 200, 24 cards, nenhum vestibular, sete eventos/competições primeiro, cabeçalho sem os textos removidos e fonte Instrument Serif já existente. Página seguinte: 24 títulos sem sobreposição com a primeira.
- Vestibular: dois cards convencionais, 59/41 cursos, prévia de quatro nomes distintos, listas completas expansíveis com área de rolagem de 352 px. SC/Gaspar: um processo e dois cursos; requisitos e vagas disponíveis, sem a pontuação `prova:.`.
- Mobile público em 390 × 844: largura da página 390 px, cards de 358 px, nenhum overflow horizontal; seleção de UF/cidade, limpeza, expansão e rolagem dos cursos funcionaram. Desktop público e membros foram conferidos no navegador.
- Filtro de premiação financeira: um resultado, hackathon TRT-SC/UDESC, `R$ 13.000,00` em negrito. Countdown manteve datas, fuso Brasília e avisos de início/horário desconhecido.
- HTTPS anônimo: público e filtros 200; membros e admin 307 para login com `next` preservado. Cookie inválido não expõe cards, emite redirecionamento server-side. Canonical público correto, `index, follow` e `nosniff` presentes.
- HTML inicial público: 181.953 bytes nesta leitura, com 24 registros. A medição local anterior de redução do JSON em 98,2% continua sendo benchmark do snapshot, não uma medição de Core Web Vitals de campo.

## Evidências e limites

Relatório de implementação: `make-it-fly-current/docs/radar-optimization-20261016.md`. Evidências locais desta publicação:

- `/private/tmp/radar-optimization-deploy-20261017.log`
- `/private/tmp/radar-catalogue-predeploy-20261017.json`
- `/private/tmp/radar-catalogue-postdeploy-20261017.json`
- `/private/tmp/radar-production-http-results-20261017.json`
- `/Users/viniciusbrigido/.codex/visualizations/2026/10/16/01a1470e-c6f4-7092-a3fe-d8802cc6d075/radar-production-browser-results-20261017.json`
- Capturas no mesmo diretório: `radar-production-desktop-20261017.png`, `radar-production-cards-20261017.png` e `radar-production-mobile-20261017.png`.

A suíte local adicional integrada permanece aguardando outros processos na fila global; não foi usada como gate nem houve encerramento de processos alheios. O CI oficial completo e os builds da VPS passaram. Não foram medidos Core Web Vitals de campo, nem realizado um novo login OAuth ou nova coleta forçada em produção. A próxima iteração deve auditar fontes oficiais de eventos/projetos para ampliar cobertura real; o ranking melhora descoberta, mas não cria oportunidades nem resolve sozinho a concentração histórica em cursos.

Este registro documental é posterior à publicação e não altera o SHA funcional implantado.
