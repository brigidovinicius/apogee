# Navegação do usuário logado — revisão de 16/11/2026

## Escopo e base

Pedido do proprietário: facilitar a saída para trocar de conta, testar a experiência autenticada e permitir que a conta gratuita conheça a plataforma, com as áreas exclusivas borradas e sem interação. Implementação isolada em `fix/member-experience-20261116`, partindo da main `90aeece` (PR #184 incorporado). Nenhuma mudança deste lote foi publicada, enviada ao GitHub, aplicada ao banco real ou à configuração Stripe.

Os outros chats seguem responsáveis pela ativação comercial e pela release. O checkout e a imagem em execução da VPS estavam mudando durante a consulta somente leitura; nenhum snapshot deles é tratado como publicação deste lote.

## Correções

- Conta/saída no cabeçalho público e interno, com estado de envio, Escape, foco e aviso entre abas sem dados de identidade.
- Saída revoga a sessão pelo auth existente, invalida os layouts e substitui a entrada no histórico pela tela de login.
- Identidade e saída antes da lista de navegação; atalhos de calendário e coleções quando os recursos estão ativos; indicação da seção atual.
- Início autenticado acessível antes da conferência adulta, sem consultar categorias/conversas privadas enquanto o cadastro está pendente.
- Ferramentas, Benefícios e Trilha com prévia estática borrada, sem catálogo privado carregado ou serializado e sem interação na ilustração.
- Fórum, perfil, calendário e coleções apresentam a restrição na própria área antes do uso privado. Guards e mutações existentes continuam exigindo os direitos/verificações correspondentes.
- Preservados: cota do Radar, contas bloqueadas, acessos legados, período pago após cancelamento, isolamento entre contas, curadoria administrativa e publicação de conteúdo real.
- Nenhum novo schema, migração, dependência ou benefício fictício. A prévia local usa uma instância própria, contas sintéticas e bloqueio de email/Stripe.

## Matriz de rotas

| Superfície | Gratuito com cadastro pendente | Gratuito conferido | Anual/legado elegível |
| --- | --- | --- | --- |
| `/membros` | Início e quatro recursos; fórum como prévia | Início e fórum | Início e recursos conforme direito |
| `/membros/oportunidades` | Catálogo e cota existente | Catálogo e cota existente | Completo conforme direito |
| `/membros/ferramentas` | Prévia borrada | Prévia borrada | Anual vigente ou prévia administrativa; legado isolado não libera |
| `/membros/beneficios` | Prévia borrada, benefícios em preparação | Mesma restrição | Apenas ofertas confirmadas/publicadas; vazio honesto se não houver |
| `/membros/trilha` | Prévia borrada | Prévia borrada | Conteúdo publicado e progresso do titular |
| `/membros/meu-calendario`, `/membros/colecoes` | Prévia e verificação necessária | Prévia se não houver direito ao Radar completo | Funcionais para anual/legado com cadastro elegível |
| Fórum e perfis | Prévia sem ler conteúdo privado | Funcionais conforme regras atuais | Funcionais conforme regras atuais |
| Assinatura e suporte | Disponíveis; suporte também anônimo | Disponíveis | Gestão durante período pago, sem depender da venda aberta |
| `/admin/*` | Sem acesso | Sem acesso | Assinatura não concede papel administrativo |
| Cabeçalho e saída | Conta identificada, saída disponível | Mesma navegação | Administração apenas para papel conferido no servidor |

## Validação e limites

Suíte geral: **808/808 aprovados**, sem ignorados. Integrações PostgreSQL de cota/ciclo anual, Caixa, Benefícios/Trilha e autenticação: **43/43 aprovados**. Typegen, tipos e build aprovados. Lint sem erros; permanece somente o aviso anterior de imagem em `components/gallery/gallery-admin.tsx:87`.

Logs persistentes deste lote ficam no diretório `outputs/member-experience-20261116` do workspace que contém os clones: `unit.log`, `lint.log`, `build-final.log`, `http.log` e `http-final.log`. A primeira bateria HTTP foi interrompida pelo reinício automático de memória do Next dev de 2 GB; a retomada usa a mesma instância/banco com marcador de propriedade, sem iniciar outro compilador ou servidor. GET pode repetir após reinício; mutações não são repetidas automaticamente.

Resultado HTTP final: **62 verificações aprovadas**, com relatório em `.local/member-experience-http-final.json` deste clone. Contas: anônimo, gratuita pendente, gratuita conferida, limite atingido, anual vigente, cancelamento com período pago, legado, expirado e reembolsado. Os formulários nativos executaram as Server Actions reais de saída, liberação de evento, progresso, criação de coleção e salvamento no calendário. Reabertura permaneceu em uma consulta; progresso não apareceu na outra conta; coleção de outro titular não retornou seu nome ou conteúdo. As respostas transmitidas de redirect/not-found foram conferidas pelos sinais do Next e pela ausência de dados privados, pois podem começar com HTTP 200.

O checkpoint final reaproveitou apenas resultados anteriores da mesma instância e refez os cenários restantes. Nenhuma resposta HTTP de sucesso isolada foi usada como prova de mutação ou autorização: cada ação teve sua leitura posterior e os casos negados conferiram o estado/ausência de conteúdo.

O controle do navegador interno deixou de estar disponível durante a execução; a inspeção inicial da conta real não é uma validação visual do candidato local. Não afirmar teste visual em celular, teclado, foco entre abas ou console limpo sem executar essa etapa. A conta real permaneceu conectada e seus direitos/cota não foram alterados.

Os testes de HTTP/banco usam dados sintéticos. Eles não comprovam entrega externa de email, audiência/callback do Google, resgate de parceiros ou configuração de cobrança live. O trabalho comercial simultâneo possui sua própria autorização e evidência.

## Revisão e publicação

Prévia funcional: `http://127.0.0.1:3474/previa/validacao`, somente durante a janela local. Conta gratuita com verificações pendentes: `revisaopendente@example.test`; senha exclusivamente sintética `RevisaoLocal2026!`. O guia lista também gratuito conferido, limite atingido, legado, anual vigente, cancelado dentro do período pago, expirado e reembolsado. Esses perfis não existem em produção.

Para reabrir após o encerramento normal da janela, neste clone e com a fila livre:

```sh
cd '/Users/viniciusbrigido/.cline/worktrees/04981/Apogee - Site Interativo/member-experience-20261116/make-it-fly-current'
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py status
APOGEE_REVIEW_INSTANCE=member-experience-20261116 APOGEE_REVIEW_PORT=3474 APOGEE_REVIEW_DURATION_SECONDS=900 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/local-offer-review.mjs
```

O banco é preservado e só é retomado com marcador do próprio worktree. Nenhum servidor de outro chat deve ser encerrado para abrir esta prévia.

Após revisão visual e aceite do proprietário: conferir a main atual e a release em execução, integrar somente este lote, executar CI do SHA final e usar o runbook Git/SSH existente para reconstruir somente web. O lote não exige migração, seed ou alteração de direitos/configuração comercial. Publicação da navegação não autoriza ativação de vendas, mudanças de proteção ou envio de mensagens. Preservar a revisão anterior e os serviços vizinhos para rollback de código.
