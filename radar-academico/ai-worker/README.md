# Worker opcional de IA do Radar

Este candidato local inclui transporte Responses, consumidor da fila e cliente
PostgreSQL restrito. Continua desativado por padrão e não instala chave, preço,
crédito, prova financeira ou autorização de envio. A criação de uma chave não
remove a pausa do banco. Não use produção para testar migrações.

O serviço opcional `ai-worker` usa o perfil `ai`, imagem e processo próprios. Web e
scheduler continuam com seus comandos, credenciais e dependências anteriores. A
imagem do worker copia somente esta pasta e usa usuário sem privilégios. Nenhum
arquivo, segredo, volume ou código do blog faz parte da entrega.

## Componentes

- `policy.mjs`: decisão conservadora de modo, limites e descritor imutável de
  requisição textual. Imagens, arquivos, ferramentas e campos desconhecidos são
  recusados porque não há reserva máxima comprovada para eles nesta etapa.
- `store.mjs`: acesso por consultas parametrizadas às funções restritas do ledger.
  O cliente de banco é injetado; não lê variáveis de ambiente nem `.env`.
- `dispatch.mjs`: porta de despacho. Recalcula o descritor, reserva, confere conta
  e tarifa antes de marcar o envio e
  contabiliza ou retém o compromisso. Retorna uma proposta, sem publicação.
- `openai.mjs`: uma chamada ao host oficial, sem retries, redirects ou ferramentas.
  Exige `store:false` e `service_tier:default`; limita tempo e tamanho da resposta.
  Calcula o consumo de entrada normal, cache lido, cache escrito e toda a saída
  com inteiros, arredondando o total para cima. Guarda somente um recibo de tokens.
- `runtime.mjs` e `cli.mjs`: carregam dois arquivos exclusivos, conferem conta,
  usam somente `radar_ai_worker` no host interno `postgres` e processam uma tarefa
  por vez. `check` não pega tarefas nem chama a OpenAI. Saúde e logs omitem texto,
  propostas, URLs, segredos e mensagens recebidas do provedor.
- `db/migrations/0056_ai_response_transport.sql`: snapshot da conta e tarifa por
  operação, revalidação antes do envio e recibo imutável. A tarifa detalhada precisa
  caber na reserva máxima aprovada. Funções internas não podem contornar o orçamento.

## Orçamento e continuidade

Após a migração 0055, valores inteiros em microdólares: US$ 50 por mês civil em
America/Sao_Paulo, divididos em US$ 30 para `radar`, US$ 15 para `jobs` e US$ 5 para
`reserve`. A reserva aceita somente finalidades `recheck` ou `recovery`, registradas
no hash, na tarefa e na operação. O limite conservador adicional de US$ 2/dia permanece.
Extração, descoberta e avaliação são tipos de tarefa, sem carteiras adicionais.

O ciclo deve coincidir exatamente com o início e fim do mês de Brasília. Uma nova
identidade de ciclo não zera o ledger: operações do mês, consumo anterior importado
e compromissos ainda incertos de meses anteriores compartilham o mesmo teto.
`radar_ai.month_opening` registra a conciliação inicial; `radar_ai.prior_usage` recebe
o consumo anterior por finalidade e referência única. Apenas o operador pode escrever
essas tabelas. Sem essa conciliação, novas chamadas ficam bloqueadas. O endpoint
editorial `/api/internal/editorial/budget` e o painel admin apresentam valores reais
e marcam saldo não confirmado quando falta a conciliação.

Organização, projeto, parcela e evidência de impedimento de cobrança paga precisam
ser comprovados por operação futura. Uma declaração no banco não configura uma
barreira de cobrança na OpenAI. Até essa comprovação e a integração revisada,
somente BASE é permitido. Evidências da conta devem ficar privadas e atualizadas.

`free_micro` é o teto da parcela atestada do ciclo; o ledger subtrai compromissos.
Não representa automaticamente o saldo restante da organização. Seu atualizador
futuro precisará reconciliar concessão, consumo externo e atribuições sem duplicar
descontos. A prova vence em até seis horas. Não há renovação ou preenchimento
automático dessa prova neste candidato.

As funções serializam admissão no registro de controle, revalidam antes de enviar
e admitem um envio de provedor por vez. Sem preço aprovado/vigente, prova ou limite,
não enviam. Duplicatas usam chave global e hash do conteúdo. `confirmed` substitui
a reserva; `unknown` mantém o teto comprometido, inclusive em ciclos seguintes.
Crash e expiração de lease nunca devolvem dinheiro incerto. Só uma reserva ainda
não enviada pode ser liberada pelo worker. Reconciliação de incertos é reservada
ao operador e ainda não tem interface implementada.

Falhas de controle, crédito e provedor acionam a função base injetada nos testes.
O Radar atual não importa este módulo: coleta, editor, catálogo, calendário e busca
textual não aguardam worker ou saldo. Não existe fallback para outra API paga.
O worker só consome tarefas explicitamente enfileiradas por contexto administrativo;
não cria tarefas nem aplica propostas automaticamente ao catálogo. Respostas
incompletas contabilizam o custo, mas ficam retidas sem proposta publicável.

## Configuração isolada

O perfil `ai` recebe apenas `RADAR_AI_ENABLED` (padrão `false`),
`RADAR_AI_ORGANIZATION_ID`, `RADAR_AI_PROJECT_ID` e os caminhos internos de dois
segredos. O arquivo `radar_ai_openai_env` contém somente `OPENAI_API_KEY=...`.
O arquivo `radar_ai_database_url` contém o login exclusivo `radar_ai_worker`.
Arquivos ausentes, links simbólicos, conteúdo inválido e contas diferentes bloqueiam
o envio. Não há leitura automática de `.env` do site, do blog ou do processo.

O Compose usa os caminhos de operador `RADAR_AI_KEY_PATH` e
`RADAR_AI_DATABASE_URL_PATH`, fora da imagem e do repositório. Arquivos montados
precisam ser legíveis pelo usuário 1001 do worker e protegidos no host. O serviço
tem rede de saída própria e a rede do banco; não participa da ponte do site/blog.
Web e scheduler não recebem a chave ou esses segredos. Não há dependência deles
no worker, publicação de porta ou acesso do worker às tabelas de oportunidades.

Modelo e tarifa não são escolhidos pelo executável. Precisam de aprovação no
ledger. Para cache de 30 minutos, a reserva de entrada deve cobrir o maior preço
entre entrada normal, leitura e escrita de cache; o limite de saída inclui tokens
de raciocínio. Tarifas e comprovações vencidas interrompem somente a IA.
Referências: [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create),
[cache](https://developers.openai.com/api/docs/guides/prompt-caching) e
[preços](https://developers.openai.com/api/docs/pricing).

## Verificação local

Use a FIFO global e uma tarefa por vez; confira seu estado antes de executar.
Use Node 22. O worker tem seu próprio lock de 14 dependências transitivas do `pg`;
não instala Next, SDK de IA ou dependências do blog. Testes usam dados sintéticos
e HTTP simulado; não consomem API nem herdam segredos de aplicação.

```sh
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py status
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node --test --test-concurrency=1 ai-worker/test/*.test.mjs
RADAR_POSTGRES_BIN=/caminho/postgresql/bin python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node ai-worker/test/postgres-runner.mjs
```

A primeira suíte usa PostgreSQL em memória. O runner adicional cria um cluster
PostgreSQL vazio, em porta local efêmera, usa logins separados e duas conexões de
worker, encerra apenas seu próprio cluster e preserva dados/logs para inspeção.
Não herda URLs, chaves ou `.env` de aplicação. Não inicia Docker ou acessa produção.

## Etapas ainda pendentes

Antes de ativar esta nova versão: confirmar conta/projeto no fluxo seguro, salvar
a chave exclusiva no destino confirmado, preparar a credencial restrita do banco,
validar o candidato e a migração, conferir evidência financeira recente e testar
o isolamento dos containers. A conciliação mensal já existente não renova a prova
de seis horas. Não há renovação automática nem supressão desse bloqueio.

A coleta gratuita de vagas permanece independente. Geração e aproveitamento de
propostas por consumidores do catálogo, além das fases R4–R6 do plano, seguem como
escopo posterior. Não declarar essas integrações prontas por iniciar este processo.
