# Auditoria de acesso — etapa 3

Conclusão: `2026-10-31T01:25:55.960Z`. Pacote e código: `584ad11bcc5e55d86c66c691bd0a1ebd3bbe3adb1521ce24f3695b945f48b356`.

Foram realizadas 128 verificações: 13 fontes de edição/evento e 115 alvos de descoberta. As 13 fontes passaram pelo normalizador; produziram 13 fichas com inscrições abertas, uma janela futura geral da OBAPO e um evento encerrado (PlatformCon). Somente as abertas são candidatas à vitrine. Nenhuma foi gravada em produção nesta etapa.

Dos alvos, 104 passaram na leitura pública e 11 ficaram bloqueados. Após conferência de autoria e deduplicação, o instalador pode acrescentar 99 monitores ativos e 13 registros pendentes. OBA e OBAFOG compartilham uma página, sem duplicar consulta. OBI e OBMEP já existem como candidatos nunca verificados; não são recriados nem ativados pelo instalador.

## Pendências de acesso

| Alvo | Motivo |
|---|---|
| [Olimpíada Brasileira de Estatística](https://obe.icmc.usp.br/) | Falha de conexão/leitura |
| [Olimpíada Brasileira de Matemática Aplicada às Ciências Sociais](https://podemos.mat.br/obmacs) | Certificado TLS inválido |
| [Olimpíada Brasileira de Biologia](https://olimpiadasdebiologia.butantan.gov.br/) | Robots indisponível ou consulta impedida |
| [Olimpíada Brasileira de Física](https://www1.fisica.org.br/olimpiada/) | Conteúdo não validável |
| [Olimpíada Brasileira de Raciocínio Lógico](https://www.obrl.com.br/) | Tempo de resposta excedido |
| [Olimpíada Estadual em História de Sergipe](https://seduc.se.gov.br/) | Tempo de resposta excedido |
| [Olimpíada Paulista de Matemática](https://www.opm.mat.br/) | Certificado TLS inválido |
| [Olimpíada Sertaneja de Matemática](https://www.osmsertao.com.br/) | Robots indisponível ou consulta impedida |
| [Olimpíada Nacional em História do Brasil](https://www.olimpiadadehistoria.com.br/) | Resposta/compressão fora dos limites aceitos |
| [Hackathon Wolfram Brasil](https://www.wolfram.com/events/user-conference-brazil/2026/hackathon/) | Servidor recusou a solicitação (HTTP 406) |
| [Hackathon GovTech Cianorte](https://www.cianorte.pr.gov.br/noticiasView/11190_Inscricoes-abertas-para-o-Hackathon-GovTech-2026-.html) | Robots indisponível ou consulta impedida |

## Pendências de autoria/página estável

Além dos bloqueios, OBE Empreendedorismo segue sem entidade organizadora confirmada, e a olimpíada do Instituto Polymathos aponta apenas para formulário, sem página institucional estável de acompanhamento. Esses dois registros ficam inativos mesmo com resposta HTTP válida. A Olimpíada Sertaneja de Matemática também não tem organizador confirmado e está na lista de bloqueios.

## Cadastros existentes para concluir a verificação

OBI (`xlsx-20261014-097-olimpiada-brasileira-de-informatica-obi`) e OBMEP (`xlsx-20261014-096-olimpiada-brasileira-de-matematica-obmep`) estão desativados, sem revisão oficial e sem consulta anterior. As URLs atuais correspondem às verificadas neste pacote, inclusive após normalizar a barra final. O plano de ativação deve usar esses mesmos registros, registrando a nova evidência de autoria/consulta permitida e ativando-os somente se continuarem nunca revisados. Não recriar registros nem sobrepor uma revisão posterior. Com essa conferência, são 101 páginas distintas aptas ao monitoramento, cobrindo 102 alvos; 89 identidades acadêmicas são cobertas por 88 páginas, com OBA/OBAFOG compartilhadas.

A auditoria não prova cobertura nacional exaustiva nem funcionamento futuro de páginas externas. O coletor revalida acesso, evidência, prazo e inscrição a cada ciclo; arquivo vencido ou código diferente exige nova auditoria antes da ativação.
