# Comvest e Fuvest — fontes oficiais alternativas, validação local

A coleta real passou pelas mesmas verificações de robots, domínio, DNS público, TLS, redirecionamento, tamanho e intervalo entre requisições da ingestão existente. Nenhuma proteção de transporte foi alterada. Não há fallback automático para buscadores ou para os hosts bloqueados.

| Fonte de evidência | Registro local | Etapas |
| --- | --- | --- |
| [Portal Unicamp — prorrogação, 31/08/2026](https://www.unicamp.br/noticias/2026/08/31/unicamp-prorroga-inscricoes-para-o-vestibular-2027-ate-8-de-setembro/) | Vestibular Unicamp 2027 | 13 |
| [Jornal da USP — Guia de Jornada, 12/08/2026, Assessoria de Imprensa da Fuvest](https://jornal.usp.br/universidade/guia-de-jornada-orienta-candidatos-sobre-etapas-do-vestibular-para-ingresso-na-usp/) | Vestibular FUVEST 2027 | 8 |

## Extração e limites

- Unicamp: inscrição prorrogada até 08/09/2026 às 17h; Música; primeira e segunda fases às 9h; habilidades de Artes Cênicas, Artes Visuais e Dança entre 02 e 04/12; três chamadas e respectivas matrículas em 2027. O comunicado mais recente supera o de 03/08, que continha divergência entre texto e tabela sobre habilidades específicas. O rótulo isolado “Inscrições Vestibular Unicamp 2026” é um erro editorial da tabela: título, texto, calendário e chamadas identificam expressamente ingresso em 2027; datas de inscrição estão em 2026. O parser exige esse contexto e aceita eventual correção do rótulo para 2027.
- Fuvest: inscrição de 17/08 a 09/10/2026; primeira fase em 01/11; convocação da segunda fase em 23/11; provas em 06 e 07/12; competências específicas de 08 a 11/12; primeira chamada em 26/01/2027. A publicação não informa horários nem datas de matrícula: esses dados não são inventados. Datas de publicação de materiais e locais de prova não são incluídas como provas ou resultados. A notícia antiga indica 21/10 para locais; esse aviso não é usado como etapa.
- O terceiro período de matrícula da Unicamp tem somente data (12/02/2027), pois a fonte alternativa não informa horário. As duas primeiras matrículas têm início às 9h e término às 17h, explicitados pela tabela.
- Etapas e evidências apontam para a publicação efetivamente lida, preservando a procedência. Cada oportunidade continua sendo um único registro do catálogo, com etapas no calendário. Inscrições encerradas não reaparecem na vitrine como abertas.
- Adaptadores vinculados à edição 2027; mudança de estrutura, edição, datas impossíveis, intervalo não contínuo ou evidência ausente gera falha conservadora. Isso não equivale a descobrir automaticamente novas retificações em outras notícias nem edições futuras.

## Persistência e escopo

Migração aditiva `0045_calendar_official_alternatives.sql`: muda somente os descritores originais inativos e pendentes; não ativa fontes nem substitui configurações de escopo já alteradas. Identificadores das fontes permanecem os mesmos. Ativação foi feita separadamente apenas em `127.0.0.1:48763/radar_calendar_editorial_local`, após conferência do marcador e diretório de dados.

Cada nova fonte foi ingerida duas vezes pela rotina real, com nova verificação de acesso. Ambas mantiveram uma única ficha e o mesmo ID; apareceram no calendário e permaneceram fora da lista de inscrições abertas. IDs locais: Unicamp `047b6345-17d9-4a6f-876a-cc056e401847`; Fuvest `d6832cd5-c798-48a4-8963-3afa3c57d7bf`.

Contas, salvos, assinatura ICS e conexão Google existentes foram preservados. Nenhuma oportunidade foi salva automaticamente na conta do usuário nem enviada ao Google nesta rodada.

Uma checagem adicional da OBI apresentou falha de rede; não foi tratada como coleta aprovada. Seus dados validados na rodada anterior foram preservados. OBMEP respondeu normalmente. O resultado desta entrega refere-se às duas alternativas solicitadas.

## Reprodução

Com o preview local pausado conforme autorização existente, executar sequencialmente pela fila global, na pasta `radar-academico`:

```sh
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/audit-calendar-sources.mjs comvest-vestibular-2027 fuvest-vestibular-2027
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/calendar-sources-local-integration.mjs comvest-vestibular-2027 fuvest-vestibular-2027
```

O segundo comando exige banco local identificado, auditoria recente bem-sucedida e URL correspondente ao descritor atual. Migrações locais são preparadas pelo script `make-it-fly-current/scripts/calendar-editorial-database.py`, que verifica ambiente e checksums antes de aplicar mudanças.

Evidência pública sem credenciais: `radar-academico/references/calendar-alternatives-audit-20261030.json`. Fixtures contêm somente o bloco real da notícia e metadados de publicação; substituem os exemplos representativos anteriores. HTML bruto e resultados internos ficam em `.local/radar-calendar/alternative-audit/` e `.local/radar-calendar/source-audit/`.

## Verificação

- **984 testes distintos aprovados**: Apogee 539, Radar 430 e permissões em PostgreSQL real 15. Os 15 testes dependentes de banco aparecem ignorados na suíte padrão e passaram na execução dedicada; não foram contados duas vezes.
- Integrações locais de salvos/ICS e Google aprovadas com PostgreSQL real. A API Google foi simulada nesta bateria, sem novas gravações na agenda externa.
- TypeScript, lint e builds de ambas as aplicações passaram, sequencialmente pela fila. Radar terminou sem avisos; Apogee mantém apenas o aviso preexistente de `<img>` na galeria administrativa.
- Cobertura específica: HTML real, edição e virada de ano, prorrogação, falta de horários, datas inválidas, estrutura alterada, duração incompatível das provas, robots indisponível/proibitivo, redirecionamento fora do escopo, migração idempotente e respeito às configurações do operador. A ingestão/recoleta das duas alternativas verifica identidade estável, preservação de curadoria, falhas sem perda dos dados e exclusões sem recriação.
- A revisão final acrescentou a rejeição de intervalos incompatíveis com as provas de um e dois dias; toda a suíte, tipos, lint e build do backend foram repetidos depois dessa mudança e passaram.
- Preview reaberto em `http://127.0.0.1:4381/calendarios/vestibulares`. Navegador confirmou as duas fontes e as etapas até fevereiro de 2027, com horários apenas onde informados e indicação de acompanhamento. Aba mantida aberta para teste.
- Captura `comvest-fuvest-local-20261030.png` no diretório de visualizações desta tarefa. Resultados de execução em `.local/radar-calendar/alternative-audit/validation-results.json`; logs em `/private/tmp/radar-alternatives-final-*-20261029.log` (sufixo histórico do runner).

Nenhum push, deploy, alteração de produção, túnel público ou migração remota.
