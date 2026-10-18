# Ampliação extracurricular — 17/10/2026

## Escopo e plano

Pedido autorizado: ampliar fontes oficiais de eventos, hackathons, competições e projetos extracurriculares, auditar cada URL antes da ativação e conferir o resultado no Radar.

Lote limitado a quatro edições com conteúdo acessível pelo coletor protegido: XV JECT/IFMG Formiga, Datathon FGV EESP, 14º Torneio Robocode/CPS e projeto Amazônia/UniEVANGÉLICA 2027. Cada edição deve produzir uma ficha; vagas, equipes, trilhas e atividades internas não viram fichas adicionais. Hackathons bloqueados ou encerrados não serão ativados para preencher a categoria.

Arquivos previstos: normalizador dedicado `radar-academico/src/lib/ingestion/normalize-extracurricular-20261017.ts`, integração em `programme-catalogue.ts`, leitura do suplemento PDF pelos leitores existentes em `index.ts` e `recheck.ts`, testes de regressão, migração aditiva de configuração `0036_audited_extracurricular_editions.sql`, auditoria JSON em `references/` e este relatório.

Fluxo: guardar evidências e decisões por URL; validar identidade, inscrição, público, prazos, localização e condições; testar encerramento, expiração e alteração de evidência; conferir CI completo; renovar inventário e backup restaurável; implantar apenas Radar; ativar somente URLs aprovadas; executar ingestão limitada por fonte; comparar IDs/campos e validar filtros no site. Não alterar fontes existentes, DNS, segredos, proxy ou aplicações vizinhas.

O coletor continua sujeito a allowlists, robots, limites de tamanho, SSRF e intervalo. Formulários, login e checkout não são submetidos nem consultados como fonte de dados pessoais. A UniEVANGÉLICA requer duas leituras por ciclo: notícia e chamamento oficial; não presumir remuneração a partir da hospedagem coberta ou destacar taxa como benefício.

## Estado

Em implementação. Nenhuma nova fonte foi ativada em produção nesta etapa.
