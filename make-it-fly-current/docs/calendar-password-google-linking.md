# Google Agenda para contas de e-mail e senha

A conexão do calendário usa a sessão Apogee existente, com autorização própria do Google. Ela não cria uma credencial de login social nem altera e-mail ou senha. O primeiro vínculo pode usar uma conta Google diferente do endereço do cadastro Apogee.

## Interface e retorno

- Google Agenda aparece no início de Minha agenda, antes dos filtros e eventos.
- A interface explica que a conexão também funciona após cadastro por e-mail e senha e que os salvos anteriores entram na primeira sincronização.
- Depois de salvar um card, a confirmação oferece Ver minha agenda e Configurar Google Agenda. Nenhuma autorização é aberta automaticamente.
- A seção informa conexão, última sincronização, pendências de conferência e erros. As regras de e-mail confirmado, conferência e acesso ao Radar são mantidas.
- Confirmação de e-mail/conferência, login, OAuth e sincronização manual preservam apenas parâmetros permitidos do calendário e retornam à seção Google Agenda. O retorno OAuth usa um cookie temporário próprio, HttpOnly, SameSite=Lax, limitado ao callback e a dez minutos; seu conteúdo é validado novamente antes do redirecionamento.
- O callback apaga os dois cookies temporários, responde sem cache e impede envio do endereço de retorno como referrer.
- Desconectar continua disponível mesmo sem acesso comercial ativo. Isso não exclui o calendário já criado no Google.

O estado de retorno não contém credenciais e não altera a identidade autenticada. A tentativa OAuth permanece protegida por state, PKCE, expiração e vínculo ao ID da sessão.

A intenção de configurar a integração também é carregada pelo parâmetro permitido `integracao=google`: o fragmento da seção sozinho não chega ao servidor durante cadastro/login. Os atalhos dos cards dependem do estado salvo persistido, para continuarem visíveis após uma atualização do servidor.

## Testes automatizados

Pela fila global do Mac, uma tarefa por vez:

```sh
node --test --test-concurrency=1 tests/*.test.mjs
node tests/google-calendar-password.integration.mjs
```

A integração exige o PostgreSQL isolado de coleções em loopback, porta 48941, banco e marcador do helper `calendarTestDatabase`. Cria contas exclusivamente de senha pelo Better Auth real, confirma e-mail por seu link real interceptado, exercita sessões e SQL reais e simula somente o provedor Google. Não envia e-mails externos. As contas criadas pela suíte são removidas ao final com verificação de seu identificador e domínio sintético.

## Piloto de navegador com Google real

1. Preparar o banco com `scripts/calendar-local-database.py start --collections` e `scripts/calendar-local.mjs setup --collections`.
2. Usar somente o cliente OAuth Apogee Local já aprovado e seu callback `http://127.0.0.1:4381/api/integracoes/google-agenda/callback`, em arquivo protegido `.local/radar-collections-calendar/google-calendar.json`. Nunca reutilizar segredos de produção neste preview.
3. Executar `node scripts/calendar-local.mjs serve --collections --password` pela fila. O servidor ocupa a vez até ser encerrado; não executar outro npm/build em paralelo.
4. Cadastrar pela interface uma conta fictícia `calendar-browser-<hex>@radar.test`, sem login Google. O transporte real de e-mail é interceptado pelo preload local e gravado no arquivo privado `password-outbox.json`. O preload recusa banco/origem diferentes e destinatários fora desse padrão.
5. Confirmar o e-mail pelo link da caixa local e solicitar conferência. Aprovação e acesso comercial desse usuário são fixtures exclusivamente locais, sem representar revisão real de uma pessoa ou compra.
6. Salvar uma oportunidade antes de conectar, concluir o consentimento real Google no cliente local e conferir esse evento no calendário de teste do Google. Salvar outro evento, conferir inclusão automática e ausência de duplicação ao sincronizar novamente.
7. Remover os eventos pela Apogee, conferir o cancelamento no Google, desconectar e entrar novamente com e-mail/senha. Não alterar a conexão da conta de produção.

O modo de caixa local só existe no harness explícito; não é uma configuração de produção. Ele intercepta apenas o envio de e-mail. OAuth e chamadas Google continuam reais durante esse piloto.

## Publicação

Esta mudança reutiliza as tabelas e o worker existentes, sem migração. A publicação é uma etapa própria, após revisão e autorização do candidato validado. Não exige mudar os escopos do login, permitir vinculação social entre e-mails diferentes ou alterar a configuração da audiência Google para executar os testes locais.

## Validação em 06/11/2026

- Suíte completa: 657 testes aprovados. Integração SQL/Better Auth: 17 verificações aprovadas, com HTTP Google simulado nessa suíte.
- Navegador: cadastro por e-mail/senha, confirmação pelo link de e-mail interceptado na caixa local, pendência de conferência, retorno correto, recusa de consentimento, vínculo OAuth Google real, inclusão dos salvos anteriores e posteriores, sincronização manual, reconexão sem duplicação e entrada por senha após desconectar.
- Os cinco registros das duas oportunidades foram confirmados pela API e pela interface do Google. Foram removidos pela Apogee, com zero eventos ativos no calendário de QA ao final. O calendário de teste vazio permanece no Google, conforme o comportamento de desconexão.
- Uma credencial de senha e zero credenciais de login social Google antes/depois; e-mail e hash da senha preservados. Layout sem transbordamento em 320 e 390 px e console final sem erros/avisos.
- TypeScript e build aprovados; lint sem erros, com um aviso preexistente sobre imagem na galeria.
- O Console Google foi consultado sem alterações: projeto externo marcado Em produção. Isso não substitui uma análise de capacidade ou de disponibilidade irrestrita para todos os usuários.
- Candidato local, sem publicação nesta etapa; integração e conta de produção preservadas.
