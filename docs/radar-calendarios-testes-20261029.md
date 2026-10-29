# Radar e calendários: testes locais de 29/10/2026

## Resultado

Foram executados 929 testes automatizados distintos com sucesso: 527 da Apogee, 387 do Radar e 15 testes adicionais de permissões em PostgreSQL real. A suíte padrão do Radar ignora estes últimos quando não há banco dedicado; eles foram executados separadamente no banco descartável local `radar_sec05_test`. Reexecuções direcionadas não foram somadas ao total.

TypeScript e lint passaram nas duas aplicações. Permanece um aviso preexistente de `<img>` na galeria administrativa da Apogee. O build da interface foi refeito após as correções. O código de produção do serviço Radar não mudou nesta rodada.

Toda execução pesada ocorreu sequencialmente pela fila do Mac. Somente o preview desta tarefa foi pausado, com autorização expressa, e reaberto. Não houve push, deploy, migração remota, ativação de fontes, pagamento ou alteração de produção.

## Problemas encontrados e corrigidos

1. **Edição de oportunidades encerradas sem prazo legado.** O formulário não oferecia “prazo não informado” para vestibulares encerrados e exigia um início de evento separado mesmo havendo etapas confirmadas. Agora permite conservar a ausência dessas datas nos estados encerrado/resultado publicado. A validação do serviço continua exigindo fonte e futuras etapas confirmadas. Os testes reproduziram duas falhas antes da correção e passaram depois; oportunidades abertas mantêm a regra anterior.
2. **Limpeza visual do filtro de área.** A navegação por “Limpar” restaurava os registros, mas o seletor não controlado conservava a área anterior. O campo passa a ser remontado quando o filtro da URL muda. A regressão foi identificada na inspeção visual mobile. Após recompilar, o teste no navegador confirmou URL sem filtro, seletor em “Todas as áreas”, etapas restauradas e ausência de transbordamento.
3. **Dados fictícios do hackathon.** O prazo do card era diferente do término da inscrição nas etapas. O gerador de exemplos e somente essa ficha sintética local foram alinhados. Nenhuma conta foi redefinida.

## Cobertura

| Área | Validação realizada | Resultado |
| --- | --- | --- |
| Base compartilhada | Catálogo vivo/calendários, persistência, recoleta e preservação de curadoria | Aprovado |
| Tipo, subtipo e área | Valores permitidos, áreas repetidas, inferência conservadora, datas/IDs inválidos e limites | Aprovado |
| Edições e etapas | Inscrição, prova, resultado, matrícula, evento, fontes auditadas, datas sem horário e com fuso | Aprovado |
| Inscrição encerrada | Próximas etapas continuam disponíveis sem reabrir inscrições; fontes inativas/conflitantes/excluídas deixam de aparecer | Aprovado em integração e RLS PostgreSQL real |
| Edição administrativa | Renderização do formulário, autorização da ação, transporte de JSON, tamanho máximo, gravação e recoleta | Aprovado em testes; navegador integrado ao serviço editorial ainda pendente |
| Calendários públicos | Olimpíadas, vestibulares, hackathons, eventos, agrupamento por mês e estado vazio | Aprovado em HTTP/navegador |
| Busca e filtros | Busca textual, combinação com área, ausência de resultados e limpeza | Aprovado em HTTP/navegador |
| Cards e responsividade | Conteúdo reduzido, links, títulos e ausência de transbordamento a 375 e 1440 px | Aprovado em Chromium |
| URLs e SEO | Prévia legível, canônica, URL antiga, sitemap, ausência de conteúdo privado em HTML/RSC | Aprovado nas verificações locais |
| Login e conta gratuita | Login real, escolha explícita da primeira ficha, reabertura, bloqueio da segunda e do calendário pessoal | Aprovado no navegador |
| Vitalício e revogação | Salvar/remover/restaurar, feed privado e bloqueio da página/feed após revogar direito | Aprovado no navegador |
| Isolamento | Dois usuários, repetição do salvamento, remoção e rotação limitadas ao dono, ator obtido da sessão | Aprovado com PostgreSQL real e ações de servidor |
| `.ics` | Cinco eventos reais de teste, fuso UTC, data final exclusiva, UID estável, atualização, cancelamento, restauração e rotação | Aprovado em arquivo/HTTP/navegador |
| Falhas do feed | Token inválido/revogado retorna 404; falha de catálogo/banco retorna 503 sem cancelamentos falsos | Aprovado em testes da rota; token/revogação também por HTTP |
| Privacidade do feed | Hash do token no banco; `private, no-store`; `no-referrer`; sem requisitos/URLs oficiais privadas | Aprovado |
| Novas fontes | Lista de candidatas permanece sem ativação | Extratores e ampliação do catálogo real não foram implementados/ativados nesta fase |

As 18 verificações HTTP cobrem rotas públicas, filtros, horários, prévias, sitemap, acesso anônimo e tokens/caminhos inválidos. A página dinâmica de oportunidade inexistente segue o streaming do Next: responde HTTP 200 com estado de erro 404 e `noindex` no conteúdo. Isso não foi apresentado como um HTTP 404; o calendário inexistente e o token inválido retornam 404 real.

## Evidências e reprodução

- `make-it-fly-current/tests/radar-calendar-editor.test.mjs`: regressão do formulário de oportunidades encerradas.
- `make-it-fly-current/tests/radar-calendar-lifecycle.test.mjs`: atualização/cancelamento, fuso, indisponibilidade, autorização e resposta HTTP do feed.
- `make-it-fly-current/tests/radar-management.test.mjs`: JSON de etapas e ator administrativo obtido da sessão.
- `radar-academico/src/__tests__/calendar-discovery.test.ts`: fronteiras de classificação, datas, IDs e fontes.
- `radar-academico/src/__tests__/live-catalogue.integration.test.ts`: calendário e edição administrativa com RLS e migrações.
- `make-it-fly-current/scripts/calendar-local-integration.mjs`: cliente compartilhado Drizzle/Postgres real, duas contas temporárias e ciclo completo dos salvos/tokens.
- `.local/radar-calendar/qa-http.py` e `qa-http-results.json`: verificações HTTP locais, ignoradas no Git.
- Logs desta rodada: `/private/tmp/radar-qa-*-20261029.log`. Credenciais e tokens não foram incluídos no relatório.

Comandos principais, sempre pela fila local:

```sh
npm test --prefix make-it-fly-current
npm test --prefix radar-academico
npm run typecheck --prefix make-it-fly-current
npm run lint --prefix make-it-fly-current
npm run typecheck --prefix radar-academico
npm run lint --prefix radar-academico
APOGEE_LOCAL_PREVIEW=1 npm run build --prefix make-it-fly-current
```

O teste de permissões exige `RADAR_ROLES_TEST_ADMIN_URL` apontando exclusivamente para o banco descartável permitido pelo próprio teste. Nunca usar credenciais de produção. O script de persistência usa apenas o banco local identificado em sua configuração e remove somente as duas contas que ele próprio cria.

## Limites da validação

- A edição completa no navegador, da tela administrativa até o serviço editorial, ainda precisa de ambiente integrado. O preview atual usa um catálogo sintético; formulário, ação e persistência foram testados por camadas.
- A assinatura e a atualização dentro de Google Agenda, Apple Calendar ou Outlook não foram executadas. Foi validado o feed entregue. Google/Outlook na nuvem não acessam `127.0.0.1`; nenhum túnel público foi criado.
- OAuth Google, entrega de e-mail e checkout estão desabilitados intencionalmente neste ambiente. Foram testados login com senha e direitos existentes, sem transação financeira.
- Layout foi verificado em Chromium com duas larguras; dispositivo físico e outros navegadores não foram homologados.
- Novas fontes exigem validação de extração, retificações e duplicidades antes de ativação. Fontes reais e composição do catálogo de produção permaneceram intactas.

O endereço para revisão continua `http://127.0.0.1:4381`. As contas de demonstração e seus dados foram preservados; as duas contas descartáveis desta rodada foram removidas. A aba do usuário foi recarregada e permaneceu autenticada como `local_vitalicio`, com o botão de salvar disponível. A publicação continua dependendo da validação e autorização explícita do usuário.
