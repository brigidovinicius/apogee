# Validação das seis melhorias de calendário

Data: 05/11/2026. Branch: `feat/calendar-usability-20261105`, baseada em `a8e0a74`.

Estado: implementação local concluída. Sem push, publicação, migração de produção ou envio real de e-mail. O passo 6 da lista de produto inclui acompanhamento e resumo semanal, correspondendo a E6/E7 do plano técnico. Curadores e sugestões por URL não fazem parte deste lote.

| Melhoria | Evidência |
| --- | --- |
| Filtros simplificados | Busca, período e localização em primeiro plano; filtro de área continuou aplicado com “Mais filtros” recolhido; próximo mês e histórico do navegador preservaram o recorte. |
| Salvar nos cards | Login de visitante retomou o calendário; salvar/remover atualizou as duas etapas do mesmo evento sem abrir detalhes. Remover da agenda preservou o item na coleção. |
| Calendário móvel | Hoje, mês anterior/próximo e seleção do dia; largura da página igual à viewport em 320/375/390 px; tabelas sem overflow interno. Teclado alcançou Hoje com foco visível. |
| Coleções privadas | Criação com capa, inclusão de evento, edição do nome, arquivamento e restauração privada preservando itens. Integração SQL validou isolamento e limites concorrentes de 20 coleções/200 itens. |
| Compartilhamento | Ativação, rotação e revogação; HTML e RSC anônimos sem requisitos, URL protegida da fonte ou e-mail da conta. `no-store` e `no-referrer` confirmados. |
| Acompanhamento e resumos | Seguir sem e-mail; consentimento obrigatório; ativar/desativar pela interface; suspensão após revogação e remoção do vínculo. Integração verificou deduplicação, concorrência, retentativa, cancelamento e limite diário. |

## Verificações executadas

- Suíte completa: **648 testes aprovados, zero falhas**.
- Integração de coleções: 12 grupos de verificações aprovados com PostgreSQL isolado.
- Integração de acompanhamento/resumos: 18 grupos aprovados, com transporte de e-mail interceptado.
- Typegen e TypeScript passaram; o build final do Next também recompilou e verificou os tipos.
- Lint completo: zero erros; um aviso preexistente de `<img>` em `components/gallery/gallery-admin.tsx`.
- Build otimizado em modo de prévia local: aprovado. Este modo usa os mesmos componentes/rotas, com saída standalone desabilitada para a prévia. Não equivale a validar a imagem Docker ou o deploy de produção.
- `git diff --check`: aprovado.

As execuções pesadas passaram pela fila global do Mac, em série. Foram encerrados somente os servidores criados para esta validação. Nenhum processo de outro projeto foi interrompido.

## Problemas encontrados e corrigidos

- Os carregadores de testes dos cards e da home precisaram reconhecer as novas dependências; o inventário explícito de rotas foi atualizado sem remover suas verificações.
- A grade recebeu correção de especificidade CSS e rótulos singular/plural.
- A validação no navegador revelou que Drizzle altera os serializadores do cliente PostgreSQL. Datas e JSON das novas operações passaram a ser serializados explicitamente, e o helper de integração passou a inicializar o mesmo cliente usado pela aplicação. As suites SQL foram repetidas depois da correção.
- O fundo das novas páginas foi ajustado após inspeção visual para manter contraste dos títulos, textos e navegação.

## Artefatos e limites

Logs locais em `outputs/calendar-validation-20261105/`: `unit-tests.log`, `collections-integration.log`, `following-integration.log`, `lint.log`, `build.log` e `public-http.json`. Esses logs são ignorados pelo Git; esta síntese permanece versionada.

Capturas em `/Users/viniciusbrigido/.codex/visualizations/2026/11/05/01a1ac67-6dd6-7763-898e-016ce0cae4fe/calendar-implementation/`.

O Next pode iniciar streaming antes de resolver `notFound()`: nos links revogados, a resposta HTTP observada foi 200 com a página indisponível/fallback 404, sem nome ou eventos da coleção. A revogação foi verificada pelo conteúdo da resposta, além do teste direto de autorização no banco.

Não houve validação de Google real, pagamento real, entrega na caixa de e-mail, capacidade contratada do provedor, CI remoto, container de produção ou piloto com usuários. Os testes de regressão da integração Google existente passaram; as novas ações de organizar/acompanhar não acionam essa integração.

Para liberar, revisar este candidato e seguir [a operação documentada](calendar-collections.md): migrações aditivas 0014/0015, flags graduais, segredo do executor, agendamento e capacidade de e-mail. As flags de envio continuam desligadas por padrão.
