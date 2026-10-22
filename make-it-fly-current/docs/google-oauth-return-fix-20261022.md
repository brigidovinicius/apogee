# Retorno após login Google — correção local, 22/10/2026

As duas falhas reproduzidas anteriormente em produção foram tratadas no código local: o provedor deixa de ocupar o histórico da aba original. A entrada abre em uma janela separada; a aba original só substitui a página de login pelo destino solicitado quando o servidor confirma uma sessão. Categoria, busca e página do Radar permanecem na URL; a Administração continua validando o papel no servidor.

A visualização de `/galeria` permanece pública. `/gerenciar-galeria` continua protegida. Nenhum código de galeria ou Make It Fly foi alterado nesta entrega.

## Causa e comportamento

O cliente Better Auth fazia `window.location.href = context.data.url` no redirecionamento social padrão, levando a aba principal pelo seletor Google. A alteração usa `disableRedirect: true`, abre a janela durante o clique e confirma a sessão pelo endpoint real antes de chamar `window.location.replace(destinoSeguro)` na aba original. A página de conclusão só apresenta sucesso após `getCurrentMember()`.

A implementação não depende de `opener`, `popup.closed` nem de mensagens contendo tokens. O popup não recebe controle sobre a aba original. O cancelamento, bloqueio de janela, erro do provedor, timeout e respostas tardias mantêm a entrada utilizável. Cadastro explícito, onboarding e verificações administrativas existentes permanecem ativos.

O COOP pode separar as referências entre janelas, conforme a [documentação do Window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) e do [Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy). Por isso, a sessão confirmada no servidor determina a conclusão.

## Evidência local e limite

Foram aprovados 23 cenários no navegador, incluindo três novos logins por senha no backend Better Auth com PostgreSQL isolado: membro desktop, administrador desktop e membro em largura móvel. A janela do provedor de teste usa outra origem e COOP; a identidade não é aceita por essa janela, e sim pela autenticação real com contas sintéticas já existentes no banco local.

**O Google externo foi simulado. Esta rodada não valida o OAuth real do Google com o código corrigido.** As credenciais Google e callbacks externos estão desativados no ambiente local isolado. A configuração real do provedor não foi alterada. A validação integral com o Google continua pendente em ambiente com callback autorizado para esta revisão.

Chrome foi usado para os novos logins e histórico desktop/móvel, além das rotas públicas. O navegador integrado complementou a Galeria e a âncora direta móvel da Programação. Ele não expõe a janela OAuth à automação. No Chrome, a captura de acessibilidade apresentou documentos anteriores após mudanças de origem; os testes usaram snapshots DOM e locators atualizados. As tentativas de conferir rolagem sem confirmar a posição inicial foram excluídas das aprovações; o teste final da Programação confirma conteúdo e posição de saída/restauração.

Na primeira compilação, o navegador revelou `Illegal invocation` ao encerrar o temporizador; a referência direta a `clearTimeout` foi substituída por uma função que o chama corretamente. O preview foi recompilado, reaberto e os 23 cenários abaixo pertencem à compilação final. A evidência inicial está separada em `browser-results-initial.json`.

## Verificações de código

- Suíte: 488/488 testes aprovados, incluindo 10 cenários novos do controlador OAuth e das proteções da conclusão/proxy.
- Tipos e lint dos arquivos alterados aprovados. A suíte completa e o lint antecederam a correção pontual do binding de `clearTimeout`; o build final validou os tipos e os fluxos finais no Chrome validaram essa chamada.
- Compilação final aprovada, sem publicar. `git diff --check` aprovado.
- 343 arquivos da aplicação, conteúdo, assets, configuração e executor comparados com o preview: zero divergências.
- Sem migrações, uploads, compras, envio de mensagens ou alteração de conteúdo em produção.

## Cenários finais

1. OAuth cancelado: aba original preservada e Voltar/Avançar públicos — aprovado.
2. Radar desktop: nova sessão, popup fecha, destino/filtros, Voltar/Avançar e recarga — aprovado.
3. Radar: paginação e retorno preservam filtros — aprovado.
4. Administração: membro sem papel administrativo continua bloqueado — aprovado.
5. Administração desktop: nova sessão, destino Blog, Voltar ao início, Avançar e recarga — aprovado.
6. Administração: marca retorna ao Painel — aprovado.
7. Administração móvel: Radar e fechamento do menu — aprovado.
8. Administração móvel: Blog e fechamento do menu — aprovado.
9. Administração móvel: Convites e fechamento do menu — aprovado.
10. Administração móvel: Usuários e fechamento do menu — aprovado.
11. Administração móvel: Cadastros dos drops e fechamento do menu — aprovado.
12. Administração móvel: Painel e fechamento do menu — aprovado.
13. Administração móvel: Voltar/Avançar entre módulos — aprovado.
14. Radar móvel 390x844: nova sessão, destino e Voltar/Avançar com filtros — aprovado.
15. Radar móvel: menu público e retorno preservam destino autenticado — aprovado.
16. Galeria pública móvel: visitante sem sessão e recarga — aprovado.
17. Gestão da galeria permanece protegida; Voltar restaura Galeria pública — aprovado.
18. Galeria móvel: menu Make It Fly e retorno público — aprovado.
19. Make It Fly desktop: Programação, saída, Voltar com conteúdo/posição e Avançar — aprovado.
20. Make It Fly desktop: Experiência, saída pelo rodapé, Voltar com ponto de saída e Avançar — aprovado.
21. Make It Fly móvel: Programação direta, saída, Voltar com conteúdo/posição e Avançar — aprovado.
22. Galeria desktop pública: abertura sem login no navegador integrado — aprovado.
23. Galeria desktop pública: Chrome sem sessão, abertura e recarga — aprovado.

## Preview e evidências

Amostragem do preview final: 77 amostras, PID 9370, de 2026-10-22T19:59:19.881Z a 2026-10-22T20:05:40.025Z, RSS máximo 163.6 MiB. Um único PID e nenhum reinício automático ou OOM observado nessa janela. O preview anterior foi interrompido deliberadamente para recompilar; a estabilidade declarada se limita à execução final observada.

Artefatos locais em `google-oauth-return-fix-20261022/` na pasta de visualizações desta tarefa. Arquivos de evidência: `browser-results.json`, `backend-proof.json`, `runtime-source-proof.json`, `runtime-summary.json`, `runtime-memory-final.jsonl`, `tests.log`, `build-final.log`, `preview-final.log` e as capturas finais. As credenciais privadas ficam fora deste relatório e do Git.

## Estado da entrega

Alteração somente local. Sem push, merge, CI remoto ou novo deploy. Produção ainda utiliza a versão anterior. APG-87 deve permanecer In Review até a publicação autorizada e a validação real do OAuth Google.
