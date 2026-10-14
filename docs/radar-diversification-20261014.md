# Radar — diversificação em 14/10/2026

Continuar fontes pausadas uma por vez, priorizando bolsas, intercâmbios e pesquisa. Manter auditoria individual, backup com recuperação isolada antes de cada aplicação, CI aprovado, checkout limpo e SHA exato. Sem serviços pagos. A preferência catarinense termina em 18/10 e não vira filtro permanente.

## Base e decisões

Produção em 14/10 às 23:26:54 UTC: **1.023 fichas únicas**, com IDs e campos públicos idênticos no admin. Formação: 929; bolsas: 85; pesquisa: 82; intercâmbios: 3; carreira: 4; competições: 2; eventos: 5. Categorias se sobrepõem. Dos 93 monitores importados, 3 estão habilitados e 90 permanecem pausados.

1. **IFC:** homepage retornou HTTP 200 com desafio de navegador. Rotas de editais e internacionalização ficaram indisponíveis para o transporte seguro. Mantido pausado, sem contornar o desafio. As 41 ofertas técnicas existentes são de outra rota e foram preservadas.
2. **Fulbright Brasil:** a URL importada `/bolsas/` retornou 404. Catálogo correto `/bolsas-para-brasileiros/`, página institucional e anúncio Ruth Cardoso/Georgetown retornaram 200, sem redirecionamento e com robots permitido. A Comissão coorganiza o programa. Ativação limitada à seleção 2026, aberta até 15/11/2026, com candidatura `fvsp2027` indicada oficialmente. Outros programas aparecem como previstos para 2027 e ficam fora.

Uma ficha pertence às categorias bolsas, intercâmbios e pesquisa, independentemente das opções de semestre ou dos valores. Doutorado concluído até 30/07/2016, nacionalidade brasileira sem norte-americana e fluência em inglês são requisitos obrigatórios. País EUA evidenciado; UF e cidade permanecem nulas. O formulário IIE e os PDFs são apenas links na página oficial; não são consultados nem submetidos pelo coletor. O monitor privado genérico fica pausado por cobertura dedicada.

Evidência individual: `radar-academico/references/source-audit-scholarships-20261014.json`.

## Implementação e validação

Arquivos: normalizador Fulbright, despacho direto em `index.ts` e `recheck.ts`, migração 0027, evidências, fixtures e testes, PRD e este relatório. O painel preserva país e evidência geográfica em edições que não alteram localização. A Apogee recebe pela ponte existente; nenhum serviço ou agendamento novo.

A mesma extração é usada na criação e na rechecagem diária. Exige identidade, CTA específico, prazo coerente e válido em 2026, requisitos e benefícios atuais. Aviso terminal, último edital, CTA ausente ou ano diferente retira a ficha; falha de rede ou identidade/estrutura gera nova tentativa preservando evidência. A integração cobre publicação com RLS, paridade, título administrativo, país preservado, rechecagem, indisponibilidade, retirada e tombstone.

204 testes Radar aprovados, incluindo migração e integração. O HTML real auditado passou pelo normalizador e gate centrais sem dublês. Typecheck, lint e CI precisam passar no SHA final antes do merge. A aplicação exige backup protegido dos dois bancos e configurações, restauração isolada e comparação de contagens e impressões digitais por tabela. Somente serviços Radar serão recriados.

## Recuperação e recibos

Rollback desta fonte nova: desativar `fulbright-ruth-cardoso-selection-2026`, preservar registros e histórico e voltar a imagem Radar `6e3037b81042472f21a481f410807e3d7b6555a0`, confirmando saúde e scheduler. Não restaurar dump sobre alterações posteriores; recuperação de dados começa em banco isolado, seguida de reconciliação. Site permanece em `b8731c4e845d4a292b4f0b8ad03b49680506ce9c`.

O resultado em produção e os recibos serão registrados no artefato externo após a aplicação. Este documento não declara deploy nem crescimento antes da medição.
