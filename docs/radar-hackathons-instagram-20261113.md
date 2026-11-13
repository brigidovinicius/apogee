# Eventos do post e descoberta internacional

Solicitação: incluir os eventos do post `DfUPVwmAW1m`, de `shreya.techtalks`,
e ampliar o fluxo automático. Em 13/11/2026 o usuário confirmou publicar
somente eventos elegíveis para residentes no Brasil e permitiu fontes do
mundo todo. Origem internacional não substitui comprovação de elegibilidade.

## Conferência e cadastro editorial

| Evento do post | Resultado da conferência oficial |
| --- | --- |
| Festive Hacks 2026 | Cadastro editorial publicado, ID `7f9a860a-93b9-4ba9-b4a6-8014f58de0a2`. Data oficial 25/11/2026; presencial em Bengaluru, Índia, sujeito à aprovação. Viagem para participar por conta do candidato. Prazo de candidatura não informado; não foi substituído pela data do evento. |
| Microsoft Imagine Cup 2027 | Cadastro editorial publicado, ID `5c9247d7-9f89-470a-9b63-8bd10f1136a8`. Startup formalizada, requisitos de Azure e idade mínima. Prazo oficial 28/02/2027, 23h59 CST, equivalente a 01/03, 02h59 em Brasília. Não é exclusivo para estudantes; a categoria estudantil tem premiação própria. |
| Kiroween 2026 | Não publicar esta edição: regulamento exclui residentes no Brasil. |
| Codegeist 2026 | Não publicar esta edição: regulamento exclui residentes no Brasil; prazo oficial também difere do post. |
| Startup Buildathon India 2026 | Prazo anunciado em 13/11/2026, sem horário/fuso. Na conferência já era 14/11 na Índia. Não publicar como inscrição aberta sem comprovação de prorrogação e elegibilidade geográfica. |

Fontes: [Festive Hacks](https://www.wemakedevs.org/hackathons/festivehacks),
[regras Festive](https://www.wemakedevs.org/hackathons/festivehacks/rules),
[Imagine Cup FAQ](https://imaginecup.microsoft.com/en-US/Support/FAQ),
[regulamento Microsoft](https://aka.ms/ImagineCup2027TCs),
[Kiroween](https://kiroween.devpost.com/rules),
[Codegeist](https://codegeist2026.devpost.com/rules),
[Startup Buildathon](https://startupbuildathon.com/).

Os dois cadastros usam fontes `reference_only` restritas a suas páginas e a API
editorial normal; não habilitam coleta genérica nem ampliam privilégios. A
Microsoft foi usada como referência editorial manual das páginas/regulamento
consultados: seu robots apresenta redirecionamento indisponível para automação,
portanto seu coletor continua desativado. Não houve deploy, migração ou edição
de fichas anteriores para realizar esses dois cadastros.

## Fluxo novo

Listas oficiais selecionadas para consulta diária: WeMakeDevs `/hackathons`,
Google for Developers `/events` e Kiro/AWS `/events/`. HTTPS, robots e conteúdo
conferidos em 13/11.
O script `radar-academico/scripts/global-hackathon-discovery-20261113.sql`
é configuração idempotente e preserva alvos existentes pausados. **Executar
somente depois do deploy do candidato que aplica a política nova.** Não houve
ativação desses três alvos durante a preparação do código.

Cada alvo novo recebe `eligibility-br-required`. Suas fontes derivadas mantêm
essa política nas notas, inclusive na ingestão e reconsulta posteriores:

- Uma exclusão explícita ao Brasil impede publicação.
- Elegibilidade ausente, regra inacessível, múltiplos regulamentos ou link fora
  do host/caminho auditado mantêm o candidato retido.
- Um anúncio “worldwide” não supera o regulamento vinculado.
- No máximo uma página suplementar de regras, ligada pela página oficial,
  recebe política temporária de transporte para **uma URL exata**. O escopo
  da fonte principal não é ampliado. Robots, TLS, DNS e limites continuam ativos.
- A página suplementar consome orçamento. Evidência inclui URL principal,
  regulamento consultado e hash; exclusão constatada em reconsulta retira a ficha.
- Fontes nacionais e referências editoriais já existentes mantêm seu fluxo.

Isso amplia descoberta de eventos, sem autorizar em bloco tudo que estiver em
Devpost, Luma, Instagram ou em listas de parceiros. Os extratores existentes
continuam exigindo edição, datas, estado, candidatura e autoridade verificáveis.

## Validação e release

Testes focados: exclusões reais representadas por regras sintéticas, países não
confirmados, escopo exato, orçamento, falhas de rede, reconsulta, publicação
nativa e idempotência dos alvos. Dependências existentes foram reutilizadas,
sem instalação ou build local; validação completa deve ser feita na CI do SHA.

Validação local em 13/11, pela fila global e com um worker: 71 testes focados
aprovados (`international-discovered-page`, `source-expansion.integration`,
`scheduled-ingestion`) e 63 testes de regressão aprovados (`discovered-page`,
`discovered-events`, `discovery-lead-processing`, `scheduled-ingestion`,
`publication-rules`), com sobreposição do arquivo de agendamento.
`git diff --check` aprovado. Sem teste ou coleta em rede dentro dos testes.

Conferência pública via conector Apogee: os dois IDs acima constam publicados,
com `verificationMethod=admin`. Cadastro inicial às 19h36 e 19h42 de 13/11,
em Brasília; revisão de apresentação às 20h10, com versões anteriores
preservadas no diretório de auditoria da VPS. Não são publicações automáticas
do novo fluxo. Formato presencial da Festive, custos de deslocamento, prazo
não informado e separação entre dinheiro/créditos/viagem estão explícitos.

Publicação de código exige aprovação do SHA exato pelo runbook da VPS. A
configuração global permanece preparada até esse gate. Não modificar o blog,
outros worktrees, credenciais, Compose ou esquema de banco neste escopo.
