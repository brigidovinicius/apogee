# Retorno após login da galeria — 21/10/2026

O login por senha podia ser enviado antes da hidratação como POST nativo. O diagnóstico de uma tentativa que falhou registrou ausência do header de Server Action, sem registrar credenciais. O redirecionamento HTTP 303 mantinha o login no histórico, apesar de `RedirectType.replace` na ação.

O submit de `SignInForm` agora aguarda hidratação com `useSyncExternalStore`, garantindo uso da ação do cliente, que substitui a entrada de login. A autenticação, destinos permitidos e guardas existentes não foram alterados. O login por senha requer JavaScript carregado para liberar o submit. Nenhuma alteração de proxy foi mantida.

Validação: teste SSR observado vermelho antes da correção e verde depois; 9 testes direcionados de login passaram. No navegador, 38 verificações finais passaram em desktop/mobile com BetterAuth e PostgreSQL isolados reais, incluindo novos logins da galeria, Radar, Administração e retornos do Make It Fly. Um Voltar restaura a galeria pública e Avançar restaura o gerenciador. `git diff --check` passou.

A suíte completa e typecheck não foram repetidos porque o preview contínuo ocupa a fila global e não houve autorização para interrompê-lo. O preview reiniciou automaticamente por memória; a sequência afetada foi repetida com sucesso. O adaptador local cobre leitura do catálogo, não a API de edição administrativa. Email, OAuth Google e cobrança estavam desativados. Sem deploy, push ou alteração de produção.

Evidências locais: `gallery-login-return-fix-20261021/relatorio.md`, `browser-results.json`, `backend-proof.json`, `source-proof.json` e capturas de tela, no diretório de artefatos desta conversa.
