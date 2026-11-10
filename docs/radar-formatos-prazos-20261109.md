# Radar: formatos e prazos retidos em 09/11/2026

## Diagnóstico

Consulta somente de leitura às 17h25 de Brasília: 1.374 links bloqueados,
incluindo 480 por `invalid_deadline` e 216 por `detail_layout_unrecognized`.
São links, não oportunidades comprovadamente aptas a publicar. O agendador
continuava processando; essas retenções não demonstram uma parada do serviço.

Foram selecionadas 55 ocorrências, até duas por motivo e fonte. Treze páginas
oficiais foram consultadas integralmente, com robots.txt, TLS e limites de
resposta preservados. Evidências e hashes estão no diretório local ignorado
`.local/format-deadline-20261109/`, sem credenciais ou escrita na produção.

## Correção

- Leitura delimitada de cinco estruturas: BeTheme/CFBio, Astra/Villa-Lobos,
  Neve/OBBiotec, notícia ABDC com título `h3` e páginas legadas da OBMEP.
  Título e corpo devem ser únicos. Metadados e recomendações não fornecem datas.
- Separação de células e linhas de calendário. A hora após o dia da semana
  é preservada: `26/01/2026 (Segunda-Feira) às 12:00` encerra ao meio-dia,
  sem tomar a prova, o resultado ou a matrícula como prazo de candidatura.
- Reconhecimento de datas completas com pontos, verbos de candidatura e final
  de intervalo com ano explícito. Nunca completar um ano ausente.
- Inscrições explicitamente encerradas recebem diagnóstico de estado
  (`status_unconfirmed`) mesmo quando não há prazo legível.
- Novas fontes continuam exigindo categoria comprovada antes do cadastro.
  Um título de patrocínio não se transforma automaticamente em olimpíada.
  A expansão do alvo CFBio é bloqueada quando o cadastro atribui sua autoria
  ao Instituto Butantan ou a outra instituição; um alvo CFBio devidamente
  verificado deve identificar o Conselho Federal de Biologia.
- Extrator 8 reavalia uma única vez as retenções antigas de formato e prazo.
  Preserva quatro tentativas totais, fontes pausadas, decisões administrativas,
  exclusões, leases, transação atômica e a distribuição de trabalho existente.
  Não há limpeza nem reabertura em massa por SQL.

## Retenções que continuam justificadas

| Página conferida | Evidência e decisão |
| --- | --- |
| ABDC: cerimônia de encerramento da XIII Olimpíada | Relato de cerimônia em 06/11/2026. Publicação em 09/11 não é prazo. |
| CFBio: patrocínio para 2027 | Notícia sem prazo ou inscrição completos no HTML. O alvo da fila está associado ao Instituto Butantan; a autoria do CFBio exige revisão do cadastro antes de ampliar a fonte. |
| OBM: Olimpíada Iraniana de Geometria | Página de programa; a leitura não comprova nova candidatura vigente. |
| OBBiotec: datas e inscrições; curso de pesquisa científica | Calendário/material para participantes existentes não comprova nova inscrição aberta. |
| Villa-Lobos: concurso de bolsas do cursinho 2026 | Encerramento em 26/01/2026 às 12h. Melhorar a leitura não torna esse prazo vigente. |
| OBMEP: bolsas Behring e IDOR | Descrição de programas sem comprovação textual de período de inscrição aberto. |
| SOIF 2027 | Somente estudantes classificados; calendário em imagem, sem data verificável no HTML. |
| ICMC: workshop com universidade belga | Relato de evento realizado em 21/10/2026. |
| ICMC: bolsa PIPD | Texto diz “9 de novembro”, sem ano. Data de publicação não completa o prazo. |
| UFV: regulamento e inscrições da IlustraCiência | Documento vinculado não substitui data comprovada; página de inscrição informa encerramento. |

Nenhuma dessas treze páginas foi liberada manualmente ou usada para forçar
uma publicação. Anexos e imagens sem evidência textual não autorizam inferência.

## Validação e publicação

Regressões cobrem as cinco estruturas, ambiguidade, datas incompletas e
inválidas, horários e calendários, estados encerrados e exclusão de metadados.
Integrações com banco isolado verificam publicação automática atômica,
reavaliação única, ausência de duplicação e preservação de decisões protegidas.

A fila global local está ocupada por outra sessão; nenhum processo foi
encerrado. A aprovação do candidato depende da CI do SHA exato. Esta correção
não modifica a aplicação principal, blog, migrações, credenciais ou Compose.
O deploy é um gate separado, conforme `apogee-routine-vps-deploy.md`.
