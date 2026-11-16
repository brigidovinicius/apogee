# Fundação mensal de IA do Radar

Este candidato é uma fundação local, desativada. Não contém transporte OpenAI, SDK,
chave, cliente HTTP, conexão automática ao banco nem consumidor de tarefas. Mesmo
`RADAR_AI_ENABLED=true` retorna `BASE_CONTROLE/transport_disabled` no executável.
Não execute migração ou containers em produção para testar este candidato.

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
- `dispatch.mjs`: única porta experimental de despacho, com provedor injetado
  exclusivamente pelos testes. Recalcula o descritor, reserva, marca envio e
  contabiliza ou retém o compromisso. Retorna uma proposta, sem publicação.
- `cli.mjs`: estado inerte e heartbeat local; não importa o store ou um provedor.
- `db/migrations/0050_ai_monthly_foundation.sql`: candidato aditivo de schema,
  papéis e funções, sem preços, concessão, senha ou ativação predefinidos.

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
somente BASE é permitido. O benefício real da conta não foi consultado.

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

## Verificação local

Use a FIFO global e uma tarefa por vez; confira seu estado antes de executar.
Não há instalação de dependências nem download nesses testes.

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

Não considerar R0–R3 integralmente homologadas: faltam inventário operacional,
barreira financeira real, validação de isolamento de containers em execução,
execução contínua da fila, transporte autorizado, conciliação do consumo real e integração aos
consumidores com timeout. R4 internacional, R5 inclusão e R6 busca seguem o plano
separado. Nenhuma dessas pendências autoriza deploy ou consumo da API.
