# Make It Fly: produção Vercel com análise manual

## Status atual

Em 13/09/2026, `https://makeitfly.vercel.app` está público no projeto Vercel `makeitfly`, plano Hobby. O deploy de produção `dpl_8itLjoy652PNxYmcEBCmE3vwBrUy` está READY e a rota `https://makeitfly.vercel.app/participar` funciona sem login.

O formulário usa o projeto Supabase Free exclusivo `oqvartwafnclxuqpkltp`. Todas as aplicações válidas são gravadas, inclusive as que ficam abaixo do lead score. O score é privado e serve apenas como classificação interna; a aprovação e o envio do link da Sympla são manuais.

Não acessar nem alterar a VPS Hostinger. A Netlify não foi usada. Não contratar planos, add-ons, recargas ou serviços pagos.

## Fluxo publicado

1. A pessoa abre `/participar` por qualquer CTA do site.
2. Preenche contato, idade, área profissional, ideia, disponibilidade de computador e uso de IA.
3. O servidor valida e grava a aplicação no Supabase.
4. O banco calcula a compatibilidade: idade entre 18 e 35 anos (inclusive), ideia, computador disponível e uso de IA paga; os demais cenários também permanecem gravados.
5. Todos veem a mesma confirmação, sem score e sem link de ingresso.
6. A equipe revisa os dados e envia manualmente o link restrito da Sympla para quem decidir aprovar.

`SYMPLA_CHECKOUT_URL` foi removida da Vercel. A rota legada `/api/checkout` responde HTTP 410 e não redireciona. O evento está publicado e marcado como privado na Sympla; o link reservado abre o ingresso somente para quem o recebe, mas continua compartilhável.

## Validação concluída

- [x] 89 testes passaram.
- [x] Lint, typecheck e build passaram.
- [x] Landing, Terra no scroll, artes, seção Red Bull e três CTAs foram preservados.
- [x] RLS ativo, sem políticas públicas; leitura com chave pública negada.
- [x] Credenciais somente no servidor, sem variável `NEXT_PUBLIC_*`.
- [x] Página principal e `/participar` retornam HTTP 200.
- [x] `/api/checkout` retorna HTTP 410 e não possui cabeçalho `Location`.
- [x] A variável de checkout da Sympla não aparece mais no ambiente de produção da Vercel.
- [x] Dois registros sintéticos finais foram gravados em produção: um acima e outro abaixo do score.
- [x] Os dois receberam `{ "received": true }`, sem elegibilidade ou checkout no recibo.
- [x] Nenhuma compra foi iniciada ou concluída.

Os registros sintéticos usam o marcador `TESTE INTERNO PRODUCAO` e foram mantidos no banco. Excluí-los exige autorização separada.

## Operação

- Consultar as aplicações somente pelo painel autenticado do Supabase.
- Usar `eligible` e `status` como classificação do score, não como confirmação final de vaga.
- Enviar o link restrito da Sympla manualmente pelo contato fornecido.
- Não publicar o link reservado no site, em redes sociais ou documentação.
- Monitorar limites gratuitos da Vercel e do Supabase.
- Se a gravação falhar, o frontend preserva as respostas e não mostra confirmação falsa.

## Reversão

Para reverter código, promover um deployment anterior validado na Vercel. Não apagar inscrições nem o banco. Reativar checkout automático exigiria uma nova decisão explícita, nova revisão de segurança, reconfiguração da variável e novo deploy.
