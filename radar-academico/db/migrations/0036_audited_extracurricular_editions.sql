-- Individual URL evidence: references/source-audit-extracurricular-20261017.json.
-- Stage verified sources INACTIVE. Activation is a separate, explicitly recorded
-- operation after the approved adapter is deployed and VPS URL checks pass.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,
 verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,crawl_interval_hours,notes
)
select id,name,institution,acronym,source_type,url,array[domain],paths,array[url],'html',audience,coverage,categories,
 85,false,'verified','operator_authorized_agent',url,now(),'codex:operator-authorized-agent',now(),24,notes
from (values
 ('fgv-eesp-datathon-7-2026','FGV EESP — 7º Datathon de Moedas Digitais 2026','Fundação Getulio Vargas — FGV EESP','FGV','corporate_organizer',
  'https://eesp.fgv.br/evento/7o-desafio-de-dados-datathon-de-moedas-digitais-da-fgv-eesp','eesp.fgv.br',
  array['/evento/7o-desafio-de-dados-datathon-de-moedas-digitais-da-fgv-eesp'],array['undergraduate_student'],array['Brasil'],array['competicoes','pesquisa'],
  'Auditoria 17/10/2026, URL exata e robots pelo coletor protegido. Competição online para graduandos no Brasil, equipes de 3–5 ou candidatura individual sujeita a agrupamento, até 20 equipes; inscrição 22/09–23/10/2026. Participação gratuita; prêmios de R$7 mil/5 mil/3 mil por equipe conforme colocação. Abertura 30/10 às9h Brasília; calendário genérico da página não substitui datas rotuladas. Uma edição, não equipes, vagas em cursos ou edições anteriores. Não presumir bolsa mensal nem prêmio por pessoa.'),
 ('cps-robocode-14-2026','CPS — 14º Torneio Robocode 2026','Centro Paula Souza','CPS','state_government',
  'https://robotica.cps.sp.gov.br/robocode-2026','robotica.cps.sp.gov.br',array['/robocode-2026'],array['mixed'],array['SP'],array['competicoes','pesquisa'],
  'Auditoria 17/10/2026, página da edição cruzada com notícia do CPS. Alunos Etec/Fatec matriculados, equipes de até3 e uma equipe por aluno, autorização de imagem e regras de código. Fase local, inscrição e relatório até30/10/2026; final remota em novembro. Uma competição; não multiplicar equipes, batalhas ou guias. Não assumir elegibilidade nacional, gratuidade ou prêmio financeiro. Não seguir links encurtados/formulários; encaminhar à página oficial auditada.'),
 ('ifmg-formiga-xv-ject-2026','IFMG Formiga — XV JECT 2026','Instituto Federal de Minas Gerais — Campus Formiga','IFMG','federal_institute',
  'https://www.formiga.ifmg.edu.br/todas-noticias/3944-xv-ject-abre-inscricoes-para-participacao-em-programacao-com-mais-de-30-atividades','www.formiga.ifmg.edu.br',
  array['/todas-noticias/3944-xv-ject-abre-inscricoes-para-participacao-em-programacao-com-mais-de-30-atividades'],array['mixed'],array['MG'],array['eventos','pesquisa'],
  'Auditoria 17/10/2026, notícia atualizada6/10 informa inscrição até20/10 e realização27–29/10/2026. Evento presencial gratuito em Formiga/MG, aberto ao público em geral. Abertura na CDL; demais locais/horários na programação. Uma jornada, não mais de30 fichas pelas atividades internas. Link Even3 preservado apenas na fonte, sem acessar checkout ou coletar participantes. Não confundir oportunidade de carreira anunciada na feira com vaga efetiva.'),
 ('unievangelica-amazonia-extension-2027','UniEVANGÉLICA — Amazônia Cidadã 2027','Universidade Evangélica de Goiás — UniEVANGÉLICA','UniEVANGÉLICA','corporate_organizer',
  'https://www4.unievangelica.edu.br/noticia/unievangelica-abre-inscricoes-para-projeto-de-extensao-e-responsabilidade-social-na-amazonia','www4.unievangelica.edu.br',
  array['/noticia/unievangelica-abre-inscricoes-para-projeto-de-extensao-e-responsabilidade-social-na-amazonia','/storage/19222/Chamamento-Amaz%C3%B4nia.pdf'],
  array['undergraduate_student'],array['Brasil'],array['pesquisa','bolsas'],
  'Auditoria 17/10/2026, notícia Edição2027 e chamamento oficial lido integralmente, ambos sob proteção de robots. Requer duas páginas por ciclo, incluindo extração do PDF. Inscrição15–30/10/2026; 17 vagas com cursos/períodos específicos e duas de instituições internacionais conveniadas. Voluntários PAGANTES: apoio parcial somente em hospedagem; passagens próprias e alimentação R$500 sem reembolso por desistência. Não apresentar como remunerado/gratuito, não usar Anápolis como local da missão nem inventar UF amazônica. Viagem25/04–1/05/2027 sujeita a clima/navegabilidade. Uma seleção, não17 fichas ou uma por curso. Formulário não é consultado.')
) audited(id,name,institution,acronym,source_type,url,domain,paths,audience,coverage,categories,notes)
on conflict(id) do nothing;
