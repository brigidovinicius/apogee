insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,
  crawl_interval_hours,notes
) values (
  'joinville-paid-internship-003-2025','Joinville — estágio remunerado 003/2025',
  'Prefeitura de Joinville','PMJ','municipal_government',
  'https://www.joinville.sc.gov.br/eventos/inscricao-processo-seletivo-estagio-remunerado-edital-no-003-2025-sgp/',
  array['www.joinville.sc.gov.br','sei.joinville.sc.gov.br'],
  array['/eventos/inscricao-processo-seletivo-estagio-remunerado-edital-no-003-2025-sgp/','/sei/publicacoes/controlador_publicacoes.php'],
  array['https://www.joinville.sc.gov.br/eventos/inscricao-processo-seletivo-estagio-remunerado-edital-no-003-2025-sgp/'],'html',
  array['undergraduate_student'],array['Santa Catarina'],array['carreira'],90,true,'verified',
  'operator_authorized_agent','https://www.joinville.sc.gov.br/eventos/inscricao-processo-seletivo-estagio-remunerado-edital-no-003-2025-sgp/',
  now(),'codex:official-source-review',now(),24,
  'Serviço de inscrição e edital SEI oficiais conferidos em 14/10/2026; robots públicos permitem os caminhos. Canal de candidatura disponível de 14/08/2025 a 13/08/2027. Cadastro de reserva, sem garantia de convocação; uma ficha por edital, preservando cursos e requisitos. Bolsa de 1 ou 1,5 salário mínimo conforme carga horária, sem converter para valor monetário inferido. Duas páginas oficiais por confirmação.'
), (
  'trt-udesc-hackathon-2026','Hackathon Tecnologia contra o Tráfico de Pessoas 2026',
  'Tribunal Regional do Trabalho da 12ª Região e Udesc','TRT-SC/UDESC','official_reference',
  'https://trt-sc.my.canva.site/hackathon-udesc-trt',array['trt-sc.my.canva.site'],
  array['/hackathon-udesc-trt'],array['https://trt-sc.my.canva.site/hackathon-udesc-trt'],'html',
  array['mixed','high_school_student'],array['Santa Catarina'],array['competicoes','eventos'],95,true,'verified',
  'operator_authorized_agent','https://www.udesc.br/cct/noticia/udesc_joinville_e_trt-sc_lancam_hackathon_com_r__13_mil_em_premiacoes',
  now(),'codex:official-source-review',now(),24,
  'Hotsite oficial do TRT-SC/UDESC indicado como página oficial do evento pela notícia institucional Udesc, conferida em 14/10/2026. O hotsite confirma inscrição até 28/10/2026, gratuidade e participação a partir de 16 anos sem formação específica; robots retorna 404. Ler somente o JSON público incorporado, sem executar JavaScript ou carregar outros domínios. Uma ficha para a edição; 60 vagas e R$ 13 mil de premiação total não multiplicam fichas nem representam remuneração por participante.'
), (
  'ufsc-augm-grado-2027-1','UFSC/AUGM — Escala Grado 2027.1',
  'Universidade Federal de Santa Catarina — SINTER','UFSC/SINTER','federal_university',
  'https://sinter.ufsc.br/files/2026/09/Edital_11_SINTER_2026_-_Escala_Grado_2027.1.pdf',array['sinter.ufsc.br'],
  array['/files/2026/09/Edital_11_SINTER_2026_-_Escala_Grado_2027.1.pdf'],
  array['https://sinter.ufsc.br/files/2026/09/Edital_11_SINTER_2026_-_Escala_Grado_2027.1.pdf'],'html',
  array['undergraduate_student'],array['Santa Catarina','Internacional'],array['intercambios','bolsas'],90,true,'verified',
  'operator_authorized_agent','https://sinter.ufsc.br/editais-abertos/?lang=pt',
  now(),'codex:official-source-review',now(),24,
  'Edital oficial e tabela de editais abertos conferidos em 14/10/2026; robots retorna 404. Graduação UFSC, inscrições até 21/10/2026. Apoio financeiro e isenção de taxas comprovados no PDF. Uma edição para 11 vagas em quatro países; não multiplicar destinos nem inferir localização do intercâmbio a partir do endereço da UFSC. Leitura PDF limitada às dez primeiras páginas, que contêm os requisitos, inscrições e benefícios.'
), (
  'ufsc-outgoing-2027-1','UFSC — intercâmbio Outgoing 2027.1',
  'Universidade Federal de Santa Catarina — SINTER','UFSC/SINTER','federal_university',
  'https://sinter.ufsc.br/files/2026/04/Edital_2_SINTER_-_Outgoing_2026.2.pdf',array['sinter.ufsc.br'],
  array['/files/2026/04/Edital_2_SINTER_-_Outgoing_2026.2.pdf'],
  array['https://sinter.ufsc.br/files/2026/04/Edital_2_SINTER_-_Outgoing_2026.2.pdf'],'html',
  array['undergraduate_student'],array['Santa Catarina','Internacional'],array['intercambios'],85,true,'verified',
  'operator_authorized_agent','https://sinter.ufsc.br/editais-abertos/?lang=pt',
  now(),'codex:official-source-review',now(),24,
  'Edital oficial conferido em 14/10/2026; robots retorna 404. PDF contém duas janelas, sendo vigente a candidatura ao semestre 2027.1 até 15/11/2026. Os prazos dos destinos podem ser anteriores e exigem antecedência de 30 dias, informada na ficha. Isenção de taxas acadêmicas, sem auxílio financeiro do programa. Uma ficha para a edição, sem multiplicar universidades conveniadas. País, UF e cidade do destino permanecem desconhecidos.'
)
on conflict (id) do nothing;
