# Inventário de olimpíadas — pesquisa de 30/10/2026

Referência: 30 de outubro de 2026, America/Sao_Paulo. Pesquisa pública, sem autenticação, inscrição, envio de formulários, alteração de produção ou integração ao Radar.

## Resultado auditável

- **100 identidades educacionais distintas**, com fonte primária de organizador ou fonte institucional responsável. **99** permanecem no recorte acadêmico quando se exclui a competição técnica SENAI marcada `scope_review`.
- Situação das inscrições: **3 abertas**, **72 encerradas**, **1 futura anunciada**, **24 sem janela atual confirmada**.
- Alcance atribuído a partir das fontes: 89 nacionais, 10 estaduais e 1 regional. Alcance é um atributo de pesquisa, sujeito à revisão dos regulamentos quando não explícito.
- 84 registros vieram dos candidatos do catálogo UFSM; 12 OBOs adicionais e OBI, ONHB, OBRAC e OBSMA completaram o inventário. As 3 OBOs já presentes na UFSM foram deduplicadas; o conjunto tem **15 OBOs**, sem contar o portal NOIC como uma 16ª competição.
- Métodos: 65 leituras HTTP diretas de fonte primária, 21 leituras pela ferramenta web e 14 verificações por conteúdo indexado de fonte primária. `search_primary` não implica que a página respondeu ao acesso direto.
- O campo `organizer` está nulo em **2 registros** (OSM e OBE Empreendedorismo), pois a entidade responsável não ficou identificável no texto público lido. Alguns registros identificam a equipe/comissão, com ressalva quando a pessoa jurídica permanece desconhecida. Isso não é prova de inexistência da organização.

## Três inscrições vigentes, com condições

| Identidade | Janela confirmada | Condição para o Radar |
|---|---|---|
| [Olimpíada de Literatura](https://www.olimpiadadeliteratura.com.br/) | 30/10/2026, às 23h59 | Prazo de hoje; revalidar antes de publicar. Quatro provas por obra/categoria foram agrupadas em uma identidade. |
| [Olimpíada do Oceano](https://olimpiada.maredeciencia.eco.br/) | Educadores que Inspiram: 20/11/2026; Desafio WOA: 10/12/2026 | Anunciar apenas essas modalidades. Conhecimento encerrou 20/09; projetos e produções encerraram 20/10. |
| [OBAPO 2027 — renovação](https://olimpikei.com.br/obapo-2027-renovacao/) | 27/10 a 20/11/2026 | Exclusiva a escolas participantes de 2025/2026. Inscrição geral: 21/11/2026 a 31/03/2027, ainda futura na data de referência. |

As janelas múltiplas constam em `registration_windows`. O `deadline_on` único representa a janela atual assinalada; o texto de elegibilidade em `notes` é obrigatório para impedir comunicação ampla indevida.

## A conta “88” não foi confirmada como total nacional

O número foi tratado como alvo mínimo de pesquisa, não como uma estatística comprovada. Nenhuma fonte consultada demonstrou que o Brasil possui exatamente 88 olimpíadas. A própria fonte institucional UFSM publica um catálogo mais amplo, que mistura olimpíadas, torneios, desafios, mostras, entidades e calendários de fases. Superar 88 registros não demonstra cobertura completa do país.

Rotas públicas observadas no código da própria interface UFSM:

- [Portal UFSM](https://olimpiadas.ufsm.br/) e [calendário](https://olimpiadas.ufsm.br/calendarioedicoes).
- O HTML do calendário aponta `events: '/buscar_edicoes_site'`. Esse endpoint retornou **810 eventos**, incluindo início/fim de inscrição e fases/provas.
- O JavaScript público `https://olimpiadas.ufsm.br/js/portal.min.js?v=1.3` aponta a busca GET `/buscaredicoes` com os filtros da interface. [Consulta pública sem filtros](https://olimpiadas.ufsm.br/buscaredicoes?olimpiada=0&area=0&anoEscolar=0&dataInicio=&dataFim=) retornou **160 edições** de **126 cadastros** distintos.
- Foi guardado apenas o catálogo reduzido de descoberta em `ufsm-catalog-discovery.json`. Dados administrativos presentes no payload não foram copiados.
- Datas da UFSM serviram para descoberta. Datas importadas no inventário foram confirmadas em fonte primária; ausência de calendário atual permaneceu `unconfirmed`.

O [CNPq](https://www.gov.br/cnpq/pt-br/assuntos/popularizacao-da-ciencia/olimpiadas-cientificas) foi usado como orientação institucional de descoberta, não como edital de inscrições de estudantes. Chamadas de financiamento de organizadores e ingresso universitário por medalhas não viraram olimpíadas novas.

## Duplicatas e divergências resolvidas

- Fases estaduais/nacional da OBR e modalidades/níveis da OBI, OBM e demais competições foram mantidos na mesma identidade.
- OBA e OBAFOG têm identidades próprias e regras distintas, apesar de compartilharem sistema e inscrição; permanecem duas entradas.
- A Mirim OBMEP tem regulamento e calendário próprios; foi distinguida da OBMEP regular.
- OBS Saber e OBS Sociologia; OBE Estatística e OBE Empreendedorismo têm siglas iguais e identidades diferentes.
- Vitalis/Instituto Vertere e OBMED/Olimpikei são eventos de organizadores diferentes; os identificadores e observações evitam mesclá-los apenas pelo nome Medicina.
- O movimento MMO e o portal agregado NOIC não foram contados como competições.
- OBOArt aparece como Arte na página própria e Artes no portfólio; uma única entrada.
- OMU aparece como estadual na UFSM, mas sua página organizadora menciona alunos de todo o Brasil; inventário registra alcance nacional com ressalva.

## Alertas de atualização necessários ao monitoramento

1. **Inglês e Espanhol: não estão abertas segundo o regulamento.** As páginas mantêm banners de abertura, mas os regulamentos oficiais da terceira edição fixam fim em **23/10/2026**. [Regulamento OI](https://oingles.com/storage/regulations/regulamento-olimpiada-de-ingles-3a-edicao1783436003.pdf), [regulamento OE](https://olimpiadadeespanhol.com/storage/regulations/regulamento-olimpiada-de-espanhol-3a-edicao1783436018.pdf).
2. **OPA, OPEF e OPEFOG** informam expressamente que **não haverá edição em 2026**, por reestruturação. Estão `closed`, para monitorar retorno, sem inventar edição/data futura.
3. **OBA/OBAFOG:** o cabeçalho oficial prorrogou inscrições para **08/05/2026**, superando o prazo inicial de 01/05 ainda mantido no corpo da [mesma página](https://site.oba.org.br/inscricoes).
4. **OBGP:** o resumo traz início em 2025, mas lotes e cronograma detalhado correspondem a 01/06/2026. Foi usada a parte detalhada, com divergência registrada.
5. **ONIA, OBFis, OBE Empreendedorismo e OBECON:** páginas contêm blocos de ciclos diferentes ou chamadas genéricas. Datas específicas da edição e resultados prevaleceram sobre banners.
6. **OBL:** a comissão anuncia 16ª edição para fevereiro de 2027; o torneio aberto de 23/10/2026 não foi contado como outra olimpíada.
7. **Migrações:** ONIC aponta atualmente para `ilustraciencia.ufv.br`; OBBS redireciona para SynBioBR. Foram preservadas fontes institucionais de origem e URLs atuais.
8. **Acesso:** algumas páginas retornaram 403/503, erro de TLS/DNS ou erro interno. Onde existia conteúdo primário indexado, isso ficou marcado como `search_primary`; não foi contornado acesso privado. Não foram preservadas respostas de erro com detalhes internos de servidores.

## Pendências fora das 100 entradas

As 42 referências restantes da descoberta UFSM não são automaticamente 42 olimpíadas faltantes. A tabela distingue outros tipos de competição, agregadores e candidatos ainda sem validação primária suficiente.

| Referência UFSM | Nome | Tratamento nesta pesquisa |
|---|---|---|
| LigMat (68) | Liga de Matemática | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| ILO (231) | Olimpíada Internacional de Lógica | Internacional; não usado para completar o alvo de olimpíadas brasileiras. |
| Canguru (28) | Concurso Internacional Canguru de Matemática Brasil | Internacional; não usado para completar o alvo de olimpíadas brasileiras. |
| MMO (71) | Movimento Meninas Olimpicas | Movimento ou agregado; não é identidade adicional de competição. |
| TBR (216) | Torneio Brasil de Robótica | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| BMO (189) | Bilingual Minds Olympiad | Candidato bilíngue ainda não validado em página primária nesta passagem. |
| TBS (185) | Torneio Brasileiro de Sustentabilidade | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| TELA (190) | Torneio de Expressão em Linguagens Audiovisuais | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| OBGeoinfo (206) | Olimpíada Brasileira de Geoinformação | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| AMO (66) | Olimpíada de Matemática das Américas | Internacional; não usado para completar o alvo de olimpíadas brasileiras. |
| OF (186) | Olimpiada de Filmes | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| Bebras (200) | Desafio Bebras Brasil | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| ONGB (199) | Olimpíada Nacional GLOBE Brasil | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| SBC (69) | Maratona SBC de Programação (Superior) | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| TM² (108) | Torneio Meninas na Matemática | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| ONAD (43) | Olimpíada Nacional de Astronomia Digital | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| CoRA (204) | Competicão de Robôs Autônomos | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| Jacob Palis (197) | Competição Jacob Palis Júnior de Matemática | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| TFC (111) | Torneio Feminino de Computação | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| TFM (12) | Torneio de Física para Meninas | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| Maratona Tech (218) | Maratona Tech | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| OE (178) | Olimpíada de Empreendedorismo | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| OIMC (62) | Olimpíada Internacional de Matemática e do Conhecimento | Internacional; não usado para completar o alvo de olimpíadas brasileiras. |
| TBC (54) | Torneio Brasileiro de Ciências | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| MNR (70) | Mostra Nacional de Robótica | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| TNBio (48) | Torneio Nacional de Biologia | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| Olimpíada Titãs (223) | Olimpíada Titãs da Matemática | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| Elon Lages (198) | Competição Elon Lages Lima de Matemática | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| OCESQ (113) | Olimpíada Cearense do Ensino Superior de Química (Estadual) | Página indicada redireciona a portal de química com outras competições; OCESQ específica não confirmada. |
| OBES (117) | Olimpíada Brasileira de Empreendedorismo Social | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| OBC (179) | Olimpíada Brasileira de Cristianismo | Religiosa; enquadramento científico/educacional precisa de revisão. Não contada. |
| TVQ (24) | Torneio Virtual de Química | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| OIMSF (40) | Olimpíada Internacional Matemática Sem Fronteiras | Internacional; não usado para completar o alvo de olimpíadas brasileiras. |
| Restaura (55) | Olimpíada Brasileira de Restauração de Ecossistemas | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| Dr.CT (224) | Competição Internacional de Pensamento Computacional | Internacional; não usado para completar o alvo de olimpíadas brasileiras. |
| TNF (49) | Torneio Nacional de Física | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| NOIC (21) | Olimpíadas Brasileiras ONLINE do NOIC | Movimento ou agregado; não é identidade adicional de competição. |
| ONDA (37) | Olimpíada Nacional de Aplicativos | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| DNA (67) | Desafio Nacional Acadêmico | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| IYPT (29) | Torneio Brasileiro de Jovens Físicos | Outro formato de competição/torneio/mostra; reservar para expansão de competições. |
| OBCH (114) | OBCH- Olimpíada Brasileira de Ciências Humanas | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |
| OBCPD (115) | Olimpíada Brasileira de Ciências Políticas | Candidato real indicado pela UFSM, mas página primária inacessível, insuficiente, formulário sem contexto ou URL migrada; não usado na contagem. |

A lista tampouco esgota os projetos regionais brasileiros. A [AOBM reconhece 53 iniciativas apoiadas em 2026](https://www.obm.org.br/competicoes/regionais/), muitas com identidade própria. Elas precisam de consulta às suas páginas institucionais para confirmar organizador, alcance, edição e inscrição. Não foram copiadas em massa para completar contagem.

## Arquivos e validação

- `olympiads.json`: array de 100 objetos; datas ISO ou nulas, fontes por entrada e notas de restrição.
- `olympiads-source-audit.json`: índice reduzido de evidências e método.
- `ufsm-catalog-discovery.json`: 126 cadastros reduzidos, para continuidade da descoberta.
- `olympiads-research.md`: este relatório.

Validação local: JSON legível, IDs únicos, campos obrigatórios presentes, enumerações de status/método válidas, datas ISO válidas e contagens recalculadas. Não houve teste de formulário, criação de conta ou inscrição. Nenhum alvo deste arquivo foi publicado ou ativado no Radar por esta pesquisa.

## Conciliação com o Radar existente

A consulta do catálogo de produção confirmou a OBVC já cadastrada (`obvc-2026`). Ela foi incluída no inventário, sem duplicar a ficha: passam a ser **101 identidades pesquisadas**, sendo **100 no recorte acadêmico**, com a exclusão técnica SENAI mantida. Situações: 4 abertas, 72 encerradas, 1 futura e 24 sem janela atual confirmada. A publicação de qualquer ficha depende da verificação atual do coletor. O total não é uma afirmação de cobertura nacional exaustiva.
