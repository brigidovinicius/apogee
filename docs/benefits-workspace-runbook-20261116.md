# Benefícios — revisão local antes de publicar

Esta versão é local. Não houve deploy, aplicação de migração em banco real, ativação de parceria ou chamada de API externa.

## Funcionalidades

- `/membros/beneficios`: catálogo com busca por nome, ferramenta, fornecedor ou descrição; comparação sem diferenciar acentos; filtro de categoria.
- `/membros/beneficios/[id]`: descrição da oferta, requisitos, disponibilidade, vigência e início explícito do resgate.
- `/membros/beneficios/salvos`: ofertas salvas do titular, com busca e filtro.
- `/membros/beneficios/resgates`: histórico do titular, separando início, confirmação administrativa e não aprovação.
- `/admin/beneficios`: curadoria de ofertas/categorias e conferência dos últimos 100 resgates. Confirmação exige referência privada e revisão atual.

As três ofertas sintéticas publicadas existem apenas na prévia. As seis candidatas reais da pesquisa ficam exclusivamente em rascunho, quando o manifesto privado é fornecido ao runner. Os fixtures de integração também são sintéticos. O repositório não inclui o catálogo comercial privado.

## Iniciar a prévia

No diretório `make-it-fly-current` do worktree `member-benefits-20261116`, use a fila global:

```sh
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py status
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/local-benefits-review.mjs
```

O runner usa PostgreSQL nativo exclusivo, identidade `apogee_local`, diretório temporário com marcador de propriedade e estado em `/private/tmp/apogee-benefits-workspace-review-state.json`. A aplicação escuta somente em `127.0.0.1:3486`. Não copie arquivos dotenv para esse worktree. O runner recusa sua presença.

Para incluir a pesquisa como rascunho local, defina `APOGEE_BENEFIT_DRAFT_MANIFEST` com o caminho do arquivo privado `ofertas-candidatas.json` antes de iniciar. O importador só aceita o formato de pesquisa da etapa anterior, exige parceria não confirmada e sempre grava `draft`, sem evidência de acordo ou vigência inventada. Repetir o runner não sobrescreve edições existentes.

Página inicial de revisão: http://127.0.0.1:3486/previa/validacao.

Contas fictícias:

| Conta | Cenário |
| --- | --- |
| revisaoanual@example.test | Anual vigente; testar catálogo, busca, salvos e resgate. |
| revisaocancelada@example.test | Renovação cancelada, período pago preservado; histórico independente. |
| revisaolivre@example.test | Sem assinatura: apresentação borrada e bloqueada. |
| revisaolegado@example.test | Direito antigo do Radar não concede Benefícios. |
| revisaoexpirado@example.test | Assinatura expirada: bloqueio. |
| revisaoadmin@example.test | Administração e acesso de membro às ofertas publicadas. |

Senha comum somente dessas contas locais: `RevisaoLocal2026!`.

Email, cobrança, credenciais Google, MCP e integrações externas ficam desligados. Os resgates sintéticos não têm destino externo: registram somente o início e permitem testar a conferência administrativa.

## Roteiro de teste

1. Entre com a conta gratuita e confira as quatro rotas, inclusive um ID conhecido de oferta. Nenhum controle privado deve ser liberado.
2. Saia e entre com a conta anual. Busque `video`, filtre Criar com IA e limpe a busca.
3. Salve uma oferta, atualize, abra Salvos, remova e salve novamente.
4. Abra as condições e inicie um resgate. Confira o histórico como Iniciado. Reabra as instruções; o pedido não deve ser duplicado.
5. Entre com a conta de renovação cancelada e confira que seus salvos/histórico não contêm os dados da outra conta.
6. Na administração, confira as candidatas reais como rascunhos e a ausência de evidência contratual. Uma tentativa de publicação incompleta deve ser recusada.
7. Para o pedido sintético, registre uma referência explicitamente de teste e confira o resultado no histórico da conta anual.
8. Teste navegação por teclado e celular. Saia da conta e confirme o retorno à entrada ao acessar uma rota protegida.

## Dados e migração

Migração 0021 adiciona `member_benefit_category`, `member_benefit_organization`, `member_benefit_saved` e `member_benefit_redemption`. Não altera as colunas das entregas existentes, tabelas de cobrança ou cota do Radar. O runner operacional faz apenas preflight por padrão e verifica papel, histórico, ownership, tipos, restrições e ausência de privilégios públicos.

O resgate usa transação, bloqueio da conta, leitura atual do direito anual/administrativo, proteção da conta e disponibilidade da oferta. Há um registro por titular/oferta. A confirmação nunca vem de campos fornecidos por um membro. Referências de conferência e evidências contratuais não entram nos DTOs dos membros.

A validação de destinos continua restrita a HTTPS público sem parâmetros, fragmentos ou credenciais. Links de indicação/SSO exigem uma integração específica com destinos e parâmetros aprovados após formalização; esta versão não libera URLs arbitrárias.

## Publicação futura

Depende de revisão do candidato pelo proprietário e autorização explícita de publicação. Conferir main, CI e eventuais migrações concorrentes; ensaiar backup/restauração e a migração no candidato exato antes de aplicar em produção. Migração real, credenciais e ofertas comerciais continuam pendentes de autorização e comprovação próprias.

Rollback de aplicação pode preservar as tabelas aditivas. Não remover salvos/histórico ou reverter banco destrutivamente para voltar a versão do web.
