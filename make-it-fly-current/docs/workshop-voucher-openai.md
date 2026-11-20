# Vouchers OpenAI do workshop de Florianópolis

21 de novembro de 2026. A recepção registra presença no Luma. A Apogee reserva um dos 50 links individuais pelos e-mails dos contemplados e permite resgate com uma conta gratuita.

## Preparação

1. Após a aprovação da publicação, valide a revisão do serviço web, confira o histórico do banco de membros e aplique a migração `0025_workshop_voucher`. A ferramenta `node scripts/workshop-voucher-migrate.mjs` confere o histórico no container. Depois de um backup verificável, a opção `--apply` aplica somente esta migração. As tabelas começam vazias e o lote fica em preparação.
2. Configure `WORKSHOP_VOUCHER_KEY` no ambiente privado do serviço web com uma chave aleatória de 32 bytes em hexadecimal. Guarde-a com os segredos da aplicação e preserve a mesma chave enquanto houver reservas. A chave ausente mantém a página desabilitada.
3. Confira no painel `/admin/beneficios/voucher-openai` o funcionamento do banco e a configuração do e-mail da Apogee. Use somente dados fictícios em um banco isolado para ensaiar o fluxo.
4. Quando receber a tabela real, carregue os 50 links no painel. Cole uma coluna com um link por linha ou envie um CSV com o cabeçalho `Link`. O painel exige 50 links distintos, com HTTPS da OpenAI ou do ChatGPT, e armazena os destinos criptografados. A carga por si só deixa o lote em preparação.

## Operação na recepção

1. Use o scanner do Luma para registrar o check-in. Conte pessoas distintas, pois a exportação pode ter uma linha por ingresso.
2. Ao completar 50 pessoas, faça a pausa curta combinada. Um gerente do Luma abre **Convidados → Check-in Feito → Baixar como CSV** e escolhe exportar apenas os filtrados. Depois do registro dessa lista, retome o check-in. Se o credenciamento destinado aos vouchers encerrar com menos de 50 pessoas, exporte o grupo completo que chegou dentro da janela.
3. Carregue o CSV no painel da Apogee. Confira os e-mails exibidos e confirme **Liberar vouchers em Benefícios**. A liberação fixa a lista e deixa cada reserva acessível pelo e-mail confirmado do ingresso.
4. Use **Enviar avisos aos contemplados** para enviar um e-mail individual com o endereço da Apogee e um código de vinculação. Um código permite resgatar com outra conta Apogee ou com uma conta de e-mail ainda não confirmado. O painel confirma a aceitação pelo provedor e mantém a mesma solicitação ao repetir um envio que ficou sem confirmação.

## Resgate

O endereço da Apogee para o telão e para o e-mail é `/membros/beneficios/voucher-openai`. O participante entra ou cria uma conta e volta ao cartão. Quem usa outro endereço pode vincular a reserva com o código recebido no e-mail do Luma. O botão abre o link individual da OpenAI e permite reabri-lo pela mesma conta. O painel registra a abertura na Apogee. A ativação é concluída na OpenAI.

## Validação

A integração focal usa um PostgreSQL temporário e intercepta qualquer envio de e-mail. Para executá-la no Mac a partir de `make-it-fly-current` use a fila global.

```sh
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node --test --test-concurrency=1 tests/workshop-voucher.integration.mjs
npm run typecheck
```
