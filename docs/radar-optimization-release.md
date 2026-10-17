# Radar — integração e preparação de release

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

A sessão já existente do usuário no navegador integrado também abriu a área de membros em produção antes do deploy. Isso confirma o acesso atual, mas não prova a nova revisão publicada.

## VPS e gate pendente

Preflight inicial por SSH: `srv1439756`, checkouts limpos, Apogee em `a7357bdedb4b95b9a0ded0d7a65ea28ea570ce0a`, Radar em `bb82cafc3595c8b8ef8157699cbd354435411762`, serviços web saudáveis, cerca de 49 GiB livres. Nenhum serviço foi alterado.

Uma consulta posterior de metadados terminou em timeout SSH. O procedimento local de preflight exige nova autorização para retomar após esse erro; a pergunta foi enviada ao usuário. Não houve nova tentativa SSH, backup remoto, troca de SHA, migração, recriação de container ou deploy nesta etapa.

O script local de backup está preparado para gerar dumps de snapshots consistentes e comparar fingerprints após restauração isolada, sem parar o scheduler. Antes de executar, retomar o preflight e confirmar novamente SHAs, imagens de rollback, saúde e configuração. Publicar somente as duas aplicações web necessárias; o scheduler faz chamadas HTTP e não teve seu script alterado. Não alterar banco de produção, fontes, DNS, proxy, credenciais ou serviços vizinhos.

Depois do deploy, validar os cenários públicos e com a sessão real de membros, incluindo filtro explícito, prévia e expansão de cursos, SC/Gaspar, limpeza, paginação, responsividade, countdown e fontes oficiais. Registrar imagens, SHAs de containers e saúde efetivamente observados. O relatório anterior `make-it-fly-current/docs/radar-optimization-20261016.md` documenta a implementação local, não um deploy.
