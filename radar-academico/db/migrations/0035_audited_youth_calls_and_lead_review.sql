-- Exact activation URLs passed the production fetcher on the VPS with these paths.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,
 verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,crawl_interval_hours,notes
)
select id,name,institution,acronym,'official_reference',url,array[domain],array[path],array[url],'html',array['mixed'],array[coverage],categories,60,true,'verified',
 'operator_authorized_agent',url,now(),'codex:operator-authorized-agent',now(),24,notes
from (values
 ('cps-virtual-mobility-031-2026','CPS — Mobilidade virtual ARI031/2026','Centro Paula Souza','CPS',
 'https://arinter.cps.sp.gov.br/editais-abertos/','arinter.cps.sp.gov.br','/editais-abertos/','SP',array['intercambios'],
 'Auditoria VPS15/10/2026, robots e caminho exato. Somente bloco ARI031/2026: mobilidade virtual, eMovies/INILATmov+, alunos FATEC, inscrições ABERTAS até08/12 e dois links de candidatura. Uma ficha por processo; não dividir parceiros/componentes/destinos. Não consultar formulários nem PDF hospedado em domínio cujo robots está indisponível. Requisitos específicos e apoio financeiro ausentes da listagem ficam explicitamente não confirmados. Não presumir viagem, remuneração, gratuidade, idade ou localização; não confundir com intercâmbio cultural CPS já publicado.'),
 ('ufsc-nilt-motivation-letters-2026','UFSC NILT — Cartas de motivação para intercâmbios','Universidade Federal de Santa Catarina','UFSC',
 'https://niltsinter.ufsc.br/cursos-chamadas-abertos/','niltsinter.ufsc.br','/cursos-chamadas-abertos/','SC',array['formacao'],
 'Auditoria VPS15/10/2026, robots e caminho exato. Somente oficina Cartas de motivação para intercâmbios acadêmicos; estudantes/técnicos/docentes UFSC, inscrição1-19/10/2026 por contato oficial, realização27/10-13/11/2026, presencial/online. Formação, não vaga de intercâmbio/estágio. Não publicar cursos autoinstrucionais ou itens vizinhos. Sem valor, gratuidade ou cidade física presumidos. Um programa por ficha, uma página/dia; prazo comprovado rege retirada.')
) as audited(id,name,institution,acronym,url,domain,path,coverage,categories,notes)
on conflict(id) do nothing;

-- Review exact saved leads only; no automatic activation of a discovered URL.
-- Per-link reasons and official-index evidence hashes are versioned in
-- references/source-audit-57-candidates-20261015.json.
update discovery_leads lead set status=review.status,reviewed_at=now()
from (values
 ('0e80f8b9-409b-4d63-81ae-a7b5b3523343'::uuid,'cps-arinter-open-calls','https://arinter.cps.sp.gov.br/8-concurso-cif-2026/','reviewing'),
 ('31d328cd-27ca-4275-a6c4-a5c82d78dcfd'::uuid,'cps-arinter-open-calls','https://arinter.cps.sp.gov.br/intercambio-cultural-cps-2026/','mapped'),
 ('bd01535e-e9b1-45bf-8eaf-11111a70166a'::uuid,'cps-arinter-open-calls','https://arinter.cps.sp.gov.br/promaips-2027-1/','reviewing'),
 ('d9fb5a48-926a-44b6-9715-82d05474fc2d'::uuid,'cps-arinter-open-calls','https://arintersql.azurewebsites.net/form.aspx','dismissed'),
 ('377600cc-bcb6-485b-9dfc-27eb450ffe44'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/07/Edital-SANTANDER-2026-FATEC-ARI-018-2026-Retificado-em-170725.pdf','dismissed'),
 ('ac1f6dbd-8218-4ccf-af37-e482b14596b9'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/08/Edital-ARI-31-2026-PROGRAMA-DE-MOBILIDADE-VIRTUAL-UNIFICADO-.pdf','reviewing'),
 ('0e3bbf0b-b0d8-468c-91fa-febd1156b093'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/09/1-E-Edital-ARI-33-2026-15-Intercambio-Cultural-ETEC-Presencial-RevLAMC-23set26.pdf','mapped'),
 ('9628d531-c8a0-4f0a-9636-0e7322e7ce54'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/09/2-E-Edital-ARI-34-2026-15-Intercambio-Cultural-ETEC-EaD-RevLAMC-23set26.pdf','mapped'),
 ('90a52141-90bf-4867-a86d-3dcae409a3cf'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/09/4-E-Edital-ARI-36-2026-15-Intercambio-Cultural-FATEC-EaD-RevLAMC-23set26.pdf','mapped'),
 ('83a5d57c-40d8-44b3-9ce8-3fda3e5d459a'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/09/5-E-Edital-ARI-37-2026-15-Intercambio-Cultural-FATEC-AMS-RevLAMC-23set26.pdf','mapped'),
 ('4d874651-4e11-4037-900d-87f8433adcda'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/09/E-Edital-ARI-039.2026-Expanish-e-Academia-Uruguai_y.pdf','reviewing'),
 ('27a85866-7145-4f78-96ec-ef62f785f555'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/09/EDITAL-ARI-040.2026-Aulas-Virtuais-de-Coreano_Ok.pdf','dismissed'),
 ('057f77f9-2b78-4b7a-b082-5838dacdd797'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/09/L-Lista-de-Classificacao-Indicados-Edital-ARI-018-2026-Santander-Apoio.pdf','dismissed'),
 ('6cfaecbe-8442-4cbb-b030-b974c286ccbc'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/3-E-Edital-ARI-35-2026-15-Intercambio-Cultural-FATEC-Presencial-RevLAMC-Retificado-8out26.pdf','mapped'),
 ('a2ae8d71-69ee-42d9-ace3-ee421447a540'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/6-E-Edital-ARI-38-2026-15-Intercambio-Cultural-FATEC-Implantacao-RevLAMC-Retificado-8out26.pdf','mapped'),
 ('472ef74b-8619-40da-a34c-0eab6740383a'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/E-Edital-ARI-41-2026-PROMAIPS-RevLA-13out2026-Retificado-Publicado.pdf','reviewing'),
 ('1cb4195d-0965-4d0e-9ede-24ff61157a28'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/E-Edital-ARI-42-2026-PROMAIPS-TUL-Retificado-RevLA-14out26.pdf','reviewing'),
 ('a5285cee-ac59-491f-a7c3-1c13a81dc7bc'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/E-Edital-ARI-44-2026-8-Concurso-de-Gastronomia-ICIF-2026-1.pdf','reviewing'),
 ('cd9c2957-9b13-49e4-b8c6-727ab901eb1a'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/Edital-Disciplinas-Estrangeiras-2027-FATEC-ARI-043-2026.pdf','reviewing'),
 ('803e24cd-79a8-42c1-975a-6b862d36d23b'::uuid,'cps-arinter-open-calls','https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/Lista-de-Classificacao-FINAL-Edital-ARI-040-2026-Coreano-Virtual_FINAL.pdf','dismissed'),
 ('92f91bc8-c09b-4d16-908e-aeac54620cf5'::uuid,'cps-arinter-open-calls','https://emovies.oui-iohe.org/','reviewing'),
 ('d5d1705c-3df6-4427-9c27-0e8e1496e948'::uuid,'cps-arinter-open-calls','https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=xWS-6vVodkqDAZV3pnnkSZcj7rZ15w1DllmnA7HdNb5UMjRLNjM0SDVMMVM4T1hFQjREOUI3NVZERi4u','dismissed'),
 ('e34bf73f-f013-4299-93c6-3312f3887b61'::uuid,'cps-arinter-open-calls','https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=xWS-6vVodkqDAZV3pnnkSZcj7rZ15w1DllmnA7HdNb5UOU8yRDVBTFpaNjlPTzc5UU9HT0xTVk1SUC4u','dismissed'),
 ('51071bf2-b72c-4c21-a7b7-af320ec6ea47'::uuid,'cps-arinter-open-calls','https://forms.cloud.microsoft/r/2tR2H6kN8H','dismissed'),
 ('aeaa0e0e-c9fe-45e2-b0df-d2c9c3eb6776'::uuid,'cps-arinter-open-calls','https://forms.gle/EbT5q4Z4ztuDjcbX6','dismissed'),
 ('d8e5c1d2-0c00-42ad-aeae-ea0bc0db3002'::uuid,'cps-arinter-open-calls','https://www.cps.sp.gov.br/fatecs-terao-dez-novas-unidades-e-ampliarao-oferta-em-engenharia-tecnologia-e-saude-em-2027/','dismissed'),
 ('b9adc12e-442e-42b6-af29-20960601a062'::uuid,'cps-arinter-open-calls','https://www.learnchile.cl/INILATmov/','reviewing'),
 ('56a0ecc9-b0e0-44c6-84b5-29b2f0f4570e'::uuid,'ufsc-sinter-open-calls','https://drive.google.com/file/d/1RxiRA2WzAfczyLgusmUj2qKIQ2JL4CZx/view?usp=sharing','dismissed'),
 ('3e6c38fe-2d31-44ee-9dbe-b5d0379d4da4'::uuid,'ufsc-sinter-open-calls','https://drive.google.com/file/d/1pUfmlBXVN8QItO6h7yDGVq7-tn9XjJLQ/view?usp=sharing','dismissed'),
 ('c05cf972-8c14-420b-ab46-3b1dab425d7c'::uuid,'ufsc-sinter-open-calls','https://idiomassemfronteiras.paginas.ufsc.br/cursos-2/','reviewing'),
 ('a2bfe2be-7a32-4025-989d-7f9b17b62a20'::uuid,'ufsc-sinter-open-calls','https://institutoconfucio.unicamp.br/2026/01/19/inscricoes-abertas-para-os-cursos-de-mandarim-do-1o-semestre-de-2026/','dismissed'),
 ('4a27f346-2ca0-4c3b-b543-dc522c4903dc'::uuid,'ufsc-sinter-open-calls','https://niltsinter.ufsc.br/cursos-chamadas-abertos/','mapped'),
 ('f6e186aa-c02b-410e-b229-734cbd5ea6fe'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/01/14/inscricoes-abertas-para-os-cursos-de-mandarim-do-1o-semestre-de-2025-sala-de-aula-confucio/','dismissed'),
 ('cb6a8193-9a22-409f-b59b-b16f508164e9'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/02/06/bolsa-merito-do-mre-para-estudantes-pec-g-primeiro-semestre-de-2025-inscricoes-de-7225-ate-1422025/','dismissed'),
 ('cf9a8988-d19f-49a7-8170-101de445e75b'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/03/12/fundacion-botin-lanca-a-xvi-edicao-do-programa-de-fortalecimento-da-funcao-publica-na-america-latina/','dismissed'),
 ('f4a97c9d-2747-41cc-a329-8b5e016ff4d8'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/06/30/inscricoes-para-os-cursos-de-mandarim-do-2o-semestre-pelo-instituto-confucio-na-unicamp/','dismissed'),
 ('7a000f14-50e2-4ebb-acdc-d5ff9a346619'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/07/18/chamada-32025sinter-convite-a-projetos-de-pesquisa-ou-extensao-que-desejam-apoiar-financeiramente-seus-participantes-estudantes-de-graduacao-na-participacao-nas-xxxii-jornadas-de-jovens-investigad/','dismissed'),
 ('26a176c8-bd30-4e3f-9b37-a8d6e9e367da'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/09/02/chamada-no-22025sinterpropesq-credenciamento-de-pesquisadores-da-ufsc-na-blue-zone-da-cop30-prazo-592025/','dismissed'),
 ('055525c6-7ef1-4936-a0ff-4937b6afdab3'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/09/26/chamada-n-12025sinter-cplmunesco-participacao-de-docentes-da-ufsc/','dismissed'),
 ('cf17c5f5-3c06-4083-8b5b-d726d2c661fd'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/09/29/chamada-42025sinter-oportunidade-de-bolsa-para-alunos-de-graduacao-na-hochschule-ravensburg-weingarten-hrw-alemanha-prazo-23102025/','dismissed'),
 ('ebe19922-bc94-4a48-80f8-f4b97d7f90d7'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/10/02/homologados-tutores-e-cadastro-de-reserva-2025-para-os-cursos-do-isf-conforme-o-edital-no-92025sinter/','dismissed'),
 ('66a0e0ab-1c39-4b32-aa61-cc3edbe3cc2b'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2025/10/10/chamada-52025sinter-oportunidade-de-bolsa-para-alunos-de-graduacao-na-offenburg-university-of-applied-sciences-alemanha-prazo-23102025/','dismissed'),
 ('403384a1-fc6e-4007-a28c-8750db18a275'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2026/03/13/chamada-12026sinter-oportunidade-de-bolsa-para-alunos-de-graduacao-na-offenburg-university-of-applied-sciences-alemanha-prazo-26032026/','dismissed'),
 ('865dcca8-33c2-4225-b073-8c6b82800859'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2026/03/25/chamada-22026sinter-oportunidade-de-bolsa-para-alunos-de-graduacao-na-universidad-militar-nueva-granada-colombia-prazo-17042026/','dismissed'),
 ('0bfc71fb-4a7d-4c5e-904d-8ad39467e83d'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2026/03/26/chamada-no-12026niltsinter-demandas-de-traducao-portugues%e2%87%94ingles-ate-15112026/','dismissed'),
 ('eeb19edf-2ac1-4e5c-864b-b1e51635682c'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2026/05/12/chamada-no-12026sinter-ichin-selecao-de-estudantes-de-graduacao-e-pos-graduacao-da-ufsc-para-a-2026-shanghai-summer-school-ate-15-de-maio-de-2026/','dismissed'),
 ('3a9415a8-9257-47c0-9c92-61b0c3235f78'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/2026/05/12/chamada-no-32026sinter-manifestacao-de-interesse-em-cooperacao-internacional-com-universidades-africanas-prazo-2252026/','dismissed'),
 ('8dc55b08-d6a7-4b3f-b50c-7fbf8b2e8a91'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/bolsas-pec-g/','reviewing'),
 ('7f69630a-c7dd-4b6c-bf92-17aa34a7723e'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/eventos-e-cursos/?lang=pt','reviewing'),
 ('5b558abb-4cd9-4476-9f63-553dfb46fcb7'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/files/2025/04/Edital_6_SINTER_2025_-_Escala_Grado_2025.2.pdf','dismissed'),
 ('901f1798-e087-4cd3-abb3-d98a23620d00'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/files/2025/10/Edital_12_SINTER_2025_-_Escala_Docente.pdf','dismissed'),
 ('6b9ea7a5-2f94-454a-b215-330ff3bf2d1c'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/files/2026/04/Edital-7-SINTER-2026-BOLSISTAS-IDIOMAS-ISF_Assinado.pdf','dismissed'),
 ('0122bf8b-9440-41a3-85fc-0a90643b1bc7'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/files/2026/10/Edital_13_SINTER_2026_-_Escala_Gestores_y_Administradores_2027_.pdf','reviewing'),
 ('a9c72441-6cef-45bd-8f34-9efc7bc3e911'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/files/2026/10/Edital_1_SINTER_PROPG_2026_-_Escala_Posgrado_2026_.pdf','reviewing'),
 ('e3ae81cf-d8dd-4ef8-84fc-f72d481dd208'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/files/2026/10/Retificacao_EDITAL_12_SINTER_2026_Programa_Escala_Docente_2027.pdf','reviewing'),
 ('32851efe-d21a-44f8-a462-1083789245fc'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/intercambio-virtual/?lang=pt','reviewing'),
 ('c90acae6-9a8a-4699-b2ee-3bc5e21946a3'::uuid,'ufsc-sinter-open-calls','https://sinter.ufsc.br/vigentes/?lang=pt','reviewing')
) as review(id,target_id,url,status)
where lead.id=review.id and lead.target_id=review.target_id and lead.url=review.url
 and lead.status in ('new','reviewing');
