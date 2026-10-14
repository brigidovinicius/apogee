# Radar — lote CAPES/PDAI em 14/10/2026

A candidata CAPES importada usava uma rota que retorna 404. A auditoria individual encontrou páginas oficiais atuais do PDAI, CLIMAT-AMSUD e PDSE, todas HTTP 200, sem redirecionamento e com robots permitido. Ativar **somente PDAI, Edital 23/2026**. CLIMAT exige inscrição em segundo calendário internacional ainda não auditado; PDSE tem janela futura e seleção interna por IES e requer sua própria adaptação. Nenhum dos dois é publicado nesta etapa.

## Plano e evidência

- Cruzar duas páginas exatas: calendário atual do PDAI e notícia oficial da prorrogação. O calendário comprova 26/10/2026; a notícia do mesmo edital confirma 23h59 e horário de Brasília, além da candidatura pelo sistema eletrônico da CAPES.
- Uma ficha para a seleção, sem multiplicar 200 bolsas de mestrado, 100 de doutorado, graus ou rodadas. Restrita a indígenas e PPGs participantes; consultar documentos e lista oficiais.
- Ler valores mensais e duração da tabela atual. Na auditoria: mestrado R$ 2.100 por até 24 meses, doutorado R$ 3.100 por até 48 meses, após seleção e implementação. Não prometer concessão individual.
- Não inventar endereço de formulário, abrangência nacional, país, UF ou cidade. Os links para manual SICAPES e documentos ficam acessíveis na página oficial; nenhum formulário/PDF é consultado ou submetido.

Arquivos: normalizador PDAI, integração em `programme-catalogue.ts`, regra de vazio válido em ingestão/rechecagem, estado terminal com evidência na rechecagem, migração 0028, auditoria JSON, fixtures e testes, PRD e este documento. A Apogee continua pela ponte existente. Não adicionar serviços, APIs pagas, automações ou custos.

## Gates e recuperação

209 testes Radar aprovados, typecheck e lint sem erros. Incluem orçamento de duas páginas, datas conflitantes, retificações contraditórias, fuso, prazo vencido, página parcial, rede indisponível, RLS, deduplicação, retirada, tombstone e estado terminal com evidência. Os dois HTML reais passaram pelo adaptador e gate de publicação sem dublês.

Antes de aplicar: CI aprovado no SHA final; checkout remoto limpo e imagem com revisão exata; backup protegido de Radar/Apogee e configurações, restauração isolada, contagens e impressões digitais por tabela iguais. Só recriar web/scheduler Radar.

Rollback desta fonte nova: pausar `capes-pdai-23-2026` e voltar a imagem Radar `e2caeb02e501ea74e25f95037403868c72761d35`, preservando banco e histórico. Confirmar imagem, saúde e scheduler. Recuperação de dados começa em banco isolado e reconciliação; não sobrescrever alterações posteriores com um dump. Site permanece `b8731c4e845d4a292b4f0b8ad03b49680506ce9c`.

A base anterior ao lote tinha 1.038 IDs únicos, paridade público/admin e os mesmos IDs recebidos pela Apogee. Os recibos e deltas posteriores serão registrados no artefato externo, sem antecipar resultado de produção.
