# Recuperação de monitores — 01/11/2026

Auditoria pelo mesmo transporte seguro do Radar (robots, TLS, proteção de rede e limite de resposta). O pacote é um candidato local: não foi aplicado na produção. Não transforma competição fechada em inscrição aberta.

O inventário inicial continha 13 alvos pendentes e um bloqueio de Agropecuária. Foram conferidos 28 endereços, incluindo alternativas institucionais. Seis recuperações qualificadas:

| Alvo | Destino validado | Alcance |
| --- | --- | --- |
| OBE Empreendedorismo | https://obempreende.com.br/ | Acesso recuperado; Expacer identificada na página oficial de patrocínio. Edição conhecida encerrada. |
| OBRL | https://www.obrl.com.br/ | Acesso recuperado; calendário separa inscrições, provas e resultados. |
| OSM | https://www.osmsertao.com.br/ | Acesso recuperado; autoria corroborada pela FGV CDMC. |
| Física | https://www1.fisica.org.br/olimpiada/2026/index.php | Monitor da edição conhecida; descoberta automática de 2027 não demonstrada. |
| Estatística | https://www.icmc.usp.br/noticias | Notícias do organizador como contingência; site próprio ainda falha em TLS/SNI. |
| História de Sergipe | https://seduc.se.gov.br/ | Portal institucional de descoberta; nenhuma data corrente inferida. |

A autoria da OSM consta na [FGV CDMC](https://cdmc.fgv.br/noticia/fgv-cdmc-apoia-terceira-edicao-da-olimpiada-sertaneja-de-matematica). A Expacer é identificada no [site da OBE Empreendedorismo](https://obempreende.com.br/patrocinio/). A relação do ICMC com a OBE aparece na [notícia institucional](https://www.icmc.usp.br/noticias/7379-oportunidade-alunos-da-usp-podem-integrar-a-equipe-organizadora-da-olimpiada-brasileira-de-estatistica). A relação com OEHSE consta no [portal de Sergipe](https://seduc.se.gov.br/sergipe-promove-1a-olimpiada-estadual-de-historia-para-estudantes-do-ensino-basico/).

Sete dependências externas persistem:

| Alvo | Impedimento observado |
| --- | --- |
| OBMACS | Certificado TLS inválido, inclusive alternativa www. |
| OBB / Butantan | Acesso bloqueado no transporte seguro; alternativa ESIB também não qualificou. |
| OPM | TLS inválido nas duas variantes oficiais. |
| ONHB | Resposta não utilizável pelo fetcher; consulta independente retornou HTTP 503. |
| Wolfram | HTTP 406. |
| Cianorte | Bloqueio de acesso/robots, inclusive rota institucional atual. |
| Polymathos | Formulário fechado; nenhum monitor institucional estável acessível validado. |

Agropecuária respondeu em uma rodada intermediária, mas voltou a apresentar `url_or_network_disallowed` na última auditoria entregue. Portanto permanece com acesso instável/bloqueado; a consulta intermediária não comprova recuperação operacional.

Dados e evidências sanitizadas: `../../radar-academico/references/radar-completion-20261101/`. Hash vinculando candidatos, recuperações, instalador, auditoria e transporte:

`108d38a13e24250e82e0e0968adfa524885b4e7b3b09abf0a9ae7fd34439774e`

O instalador exige auditoria correspondente com até 24 horas. Para uma implantação posterior, repetir a auditoria. Só modifica o alvo ainda desabilitado, sem verificação e com URL/organizador/notas/revisão originais exatos; edições e alterações posteriores do operador são preservadas. O padrão é plano sem escrita. Aplicação exige autorização operacional e conexão de editor; nenhum segredo integra este pacote.
