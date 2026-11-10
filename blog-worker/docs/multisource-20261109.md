# Dossiês multifonte e revisão factual

## Escopo e situação

Implementação local na branch `feat/blog-multisource-20261109`, baseada em `e23fa75`. O PRD de referência é o 0.5, com a atualização do titular em 09/11: **dez matérias diferentes por dia**, incluindo três gerais e sete subcategorias. Produção, migração 004 e a nova política montada na VPS são gates separados. Este documento não comprova implantação.

O pipeline tem quatro etapas distintas: pesquisa de evidências, comparação assistida verificada, redação e revisão humana final antes de publicar/agendar. A assinatura Google usa o cliente oficial já existente. Não há API paga, crédito extra, Codex como motor do blog ou repetição automática após uso incerto.

## Contrato e critério

- Até dez documentos de referências cadastradas por dossiê. Cada documento tem URL permitida, origem dos dados/análise, condição de uso, hash, papel e confirmação do acontecimento/escopo.
- Cinquenta e quatro referências no total: quarenta e quatro fornecidas pelo titular, nove fontes primárias complementares e Via Satellite como jornalismo especializado. Jetson e Coca-Cola foram acrescentadas apenas para conferir documentos oficiais do lote; nenhuma coleta foi ativada. Cadastrar referência não ativa um crawler. Os canais RSS seguem suas próprias aprovações e intervalos.
- URLs/DOIs e dia de publicação auxiliam agrupamento conservador na captação. Documentos captados são preservados por snapshot; o agrupamento não é aprovação factual nem prova de independência.
- Matriz com afirmações atômicas, caráter crítico e uma célula por documento. Estados: sustenta, contradiz, não menciona e não verificável. Trechos de suporte/contradição precisam ocorrer literalmente no texto fornecido.
- Um fato convergente precisa de suporte em pelo menos duas origens e veículos diferentes; ausências não contam como confirmação.
- Convergência = fatos convergentes / fatos relevantes da versão, com comparação inteira `convergentes * 100 >= total * 90`. Zero fatos é incompleto. Ausências/pendências não viram concordância; arredondar a apresentação não muda a decisão.
- Exigir fatos críticos confirmados, primária e análise/apuração independente pertinente. Reproduções do mesmo release não criam novas origens. Um estudo único permanece estudo único.
- A matriz é uma avaliação editorial auditável, não probabilidade de verdade. Verificação semântica e revisão humana continuam necessárias. JSON válido ou citação literal não provam todas as conclusões.

## Telas e ações

Na Central Editorial, a área de referências inicia pesquisas sem chamar IA. Cada pauta abre `/admin/posts/pipeline/dossie/[id]`.

1. Definir categoria, subcategoria e acontecimento. A classificação fica vinculada ao primeiro uso para impedir mudança de tópico como forma de zerar limites.
2. Adicionar documentos autorizados ou importar snapshots captados. Conferir origem, papel e escopo; uma importação não declara independência automaticamente.
3. Comparar em um único lote Google, ou preencher a matriz manualmente. A comparação usa a mesma fila e o mesmo ledger de consumo.
4. Registrar automaticamente uma nova versão com ator `google_assisted`, trechos, cálculo e regras verificados. O worker não atribui aprovação humana a essa comparação.
5. Avançar para redação quando elegível e dentro dos limites; o editor pode corrigir/conferir a matriz a qualquer momento.
6. Revisar o rascunho, fontes e mídia no editor. Salvar ajustes e registrar a revisão final da versão antes de publicar/agendar.

Todas as ações derivam o ator da sessão administrativa antes de acessar dados. Revisões usam controle otimista; fonte/dossiê alterados durante uma geração retêm o resultado sem perder o consumo confirmado. Trocas de evidência limpam a matriz atual, mantendo as versões anteriores.

## Política Google versão 3

| Controle | Teto |
|---|---|
| Artigos iniciados | 10/dia, 70/semana |
| Por categoria/subcategoria | 1/dia, 7/semana |
| Chamadas Google | 30/dia, 210/semana |
| Contabilização conservadora | 180 mil tokens/dia, 900 mil/semana |
| Reserva por chamada | 60 mil tokens |
| Comparação e redação, incluindo reparos | Até 2 tentativas por pauta, compartilhadas |
| Imagem | Até 1 tentativa por pauta |
| Concorrência e invocação | Uma tarefa e uma invocação por execução |
| Entrada de modelo | Limite local conservador de 8.000, incluindo overhead |
| Cota do provedor | Bloquear abaixo de 20%; sem compra ou fallback |

Os tetos de frequência foram ajustados à escolha explícita do titular; os limites de tokens não aumentaram. Dez por dia é **meta condicionada à cota**, não capacidade garantida pelo Google AI Pro. Comparação + redação + imagem podem usar três chamadas por matéria. Fotos oficiais autorizadas e conferência manual podem poupar chamadas. Nenhuma evidência é truncada silenciosamente para caber no contrato multifonte.

A política distribuída continua com geração e captação desativadas por padrão, sem conta pessoal. Ativação exige configurar a conta autorizada e atestado vigente. O atestado operacional continua limitado a 24 horas. Versão 2 mantém os tetos antigos e não ganha dez documentos implicitamente.

O painel registra uso por área e observações da menor fração disponível na cota Gemini, antes/depois de execuções. `/usage` é aceito apenas com zero turnos de modelo. Falha ao atualizar quota depois de um resultado não repete a geração nem desfaz o consumo confirmado. Frações podem estar defasadas e incluem outros usos da conta; não são saldo em tokens.

Consulta operacional avulsa em 09/11/2026, 14:42:59 de Brasília: duas cotas Gemini, menor fração `0.9988209009170532` (99,88%), zero gerações. O resultado não mede capacidade semanal nem altera os contadores de geração.

## Migração 004 e privilégios

Novas tabelas: `dossier_version`, `captured_document`, `post_review`, `quota_observation`. Comparações têm espécie própria no ledger; tentativas registram a versão/hash do dossiê.

- Runtime: lê versões/revisões, registra comparação assistida e uso, mantém cache de captação e observações de quota. Acrescenta apenas versões assistidas pela função restrita, sem escrita direta nas versões e sem revisão final. Não escreve diretamente em `public.blog_post`.
- Aplicação editorial: após a autorização administrativa existente, insere versões e revisões; sem UPDATE/DELETE em histórico imutável. Mantém seus privilégios CMS já existentes.
- `import_draft` verifica a revisão/hash exatos usados pela tentativa Google e continua criando apenas rascunhos privados. O corpo interno legado deixa de ser executável pelo runtime.
- Trigger de publicação/agendamento exige revisão final vinculada ao conteúdo e à versão do dossiê. A assinatura inclui texto, título, autoria, categoria, SEO, vídeo e mídia/créditos. Publicação posterior de conteúdo alterado exige nova conferência.
- O CMS toma o lock de controle antes do post, na mesma ordem do worker. O fluxo anterior de artigos manuais e o histórico API não recebem permissões novas de geração.

Usar o exemplo atualizado de privilégios em `sql/permissions.example.sql`, substituindo a função do site pelo papel real verificado. Não aplicar por suposição de nome. A migração deve ser ensaiada com backup/restauração e papéis reais antes da ativação. O runtime não recebe credencial de migração.

## Build e validação

O contrato de validação é único em `make-it-fly-current/lib/blog/corroboration.mjs`, com tipos adjacentes. O worker o importa sem duplicar a regra dos 90%. O Docker do worker recebe somente o contrato e o catálogo pelo contexto nomeado `editorial-contract`; Compose requer 2.17+ com suporte de build contexts. [Documentação oficial](https://docs.docker.com/reference/compose-file/build/#additional_contexts).

Usar a fila global do Mac para npm/node de projeto. Testes de banco criam seu próprio PostgreSQL local, sem ler `.env`/DATABASE_URL de produção, e encerram apenas esse processo no `finally`.

As verificações incluem: 90% exatos e 8/9 abaixo do limiar; conflito crítico; origem compartilhada; referências e trechos inválidos; revisão vinculada a hash; controles por tópico; zero cobrança; comparação Google validada sem publicação automática; resultado obsoleto com uso preservado; papéis restritos; bloqueio de publicação sem revisão final; metadados de data ausentes e interface escapada. A prévia visual usa somente dados sintéticos e não executa suas ações.

## Ativação e rollback

1. Confirmar diff/SHA, validações e CI do candidato; manter o preview de outros trabalhos conforme a decisão do titular.
2. Autorizar a publicação da nova branch/PR e a release exata antes de push/deploy, conforme `AGENTS.md`. Não reutilizar a autorização do SHA da release anterior.
3. Na VPS: conferir checkout, estado, papéis, espaço e backup/restauração atuais. Aplicar 004 com o proprietário separado e ajustar apenas os privilégios necessários.
4. Preparar política 3 montada, identidade/atestado e cotas. Executar migração pelo CLI com `migrate --execute` apenas no contexto explicitamente aprovado.
5. Construir/recriar somente os serviços autorizados; verificar SHA, saúde, painel, privacidade, tentativa controlada e publicação retida para revisão.
6. Em falha: pausar geração e preservar ledger/dossiês. Retorno de imagem antiga não autoriza remover 004 ou ignorar o trigger. Recuperação de banco depende do backup ensaiado, sem downgrade destrutivo automático.

A migração 004 foi executada somente em PostgreSQL isolado de validação. Não houve migração de produção, substituição de serviços de produção, push, deploy, publicação de artigo ou chamada paga nesta implementação. O lote real tem nove novos rascunhos com nove capas Google, preservados no piloto privado, e uma matéria existente reaproveitada conforme a decisão do titular. Os registros sintéticos de testes ficam em outro banco temporário.

O lote consumiu 20 chamadas reais Google e 28.148 tokens conservadores, incluindo uma comparação e um reparo de notação numérica. Somados às duas chamadas anteriores (2.557 tokens), o dia tem 22 chamadas e 30.705 tokens. Há dez pautas iniciadas, nenhuma tentativa pendente/incerta e nenhuma revisão humana final atribuída pelo agente. O teto de tokens permaneceu 180 mil/dia. Todos os valores monetários são zero.

O cliente oficial e o keyring existentes foram usados por invocação transitória; não foram copiados tokens OAuth, chaves ou credenciais para o ambiente isolado. O uso real foi espelhado no ledger legado de produção por eventos identificados, sem alterar tetos ou apagar histórico. A política antiga impede geração adicional em produção. Após uma futura importação dos recibos nativos, worker e painel desconsideram apenas o evento espelhado cujo ator, propósito, ID, espécie, uso e dia coincidam exatamente; diagnósticos independentes continuam contando.

A pauta X-70 preserva a comparação inicial de 75%, as correções editoriais de escopo e a redação vinculada à versão 6; a versão posterior corrige a continuidade literal de um trecho sem nova geração. A pauta de neurociência preserva a primeira redação retida por `unsupported_numbers` e a única tentativa de reparo permitida. Correções pontuais posteriores foram salvas pelo DAL do CMS privado, com o texto anterior preservado, sem representar aprovação humana.

Os rascunhos reais e seu histórico ainda não foram importados no painel de produção. Essa etapa depende da release e da migração 004 aprovadas. Para importar, preservar IDs/horários/consumo reais e a ordem histórica: versões usadas nas reservas, recibos, rascunho/capa, edições e versões posteriores; não fabricar novas execuções nem descartar eventos. O pacote de revisão local contém textos, capas, créditos, fontes e trilhas; não deve ser commitado em repositório público.

### Limite entre comparação assistida e revisão humana

A função restrita `record_assisted_comparison` copia documentos e metadados da reserva exata, confere trechos, matriz, fatos críticos, independência declarada, hash e cálculo, e acrescenta a versão com ator fixo `google_assisted` e `reviewed_by` nulo. Não permite alterações diretas nas versões nem gravação de revisão final pelo worker. A correção semântica das evidências, da independência e do texto é conferida pelo editor antes da publicação. A assinatura da revisão final vincula versão do dossiê, texto e bytes/legenda da capa; mudanças exigem nova revisão.
