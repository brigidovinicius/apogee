# Aplicações e análise manual — Make It Fly

O formulário grava **todas** as aplicações válidas no projeto Supabase do Make It Fly, inclusive as que ficam abaixo dos critérios. A classificação é calculada no banco pela regra atual: idade entre 18 e 35 anos (inclusive), `has_idea`, `has_laptop` e `uses_paid_ai`. Ela é interna e não é retornada ao navegador.

O envio não aprova uma pessoa nem libera ingresso. Todos recebem o mesmo recibo `{ "received": true }`; a equipe revisa os dados, decide manualmente e envia o link restrito da Sympla pelo contato informado.

## Configuração de produção

- Site: `https://apogee.community`
- Formulário: `https://apogee.community/participar`
- Supabase: projeto exclusivo `oqvartwafnclxuqpkltp`, plano Free.
- Hospedagem planejada: container Next.js atrás de Caddy na VPS; a Vercel fica apenas como legado/rollback até a migração ser validada.
- Variáveis privadas: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APPLICATION_SIGNING_SECRET` e `APPLICATION_ORIGIN`.
- `APPLICATION_ORIGIN` deve ser exatamente `https://apogee.community` em produção.
- `SYMPLA_CHECKOUT_URL` não é usada.

Nenhuma variável privada pode usar prefixo `NEXT_PUBLIC_*`, entrar em Git, HTML, JavaScript do navegador, logs ou documentação. A configuração local real permanece em `.makeitfly-private/app.env`, fora do artefato publicado, com diretório 0700 e arquivo 0600.

## Contrato HTTP

`POST /api/applications`, mesma origem, `Content-Type: application/json`, corpo máximo de 16 KiB:

```json
{
  "name": "Pessoa de teste",
  "email": "teste@example.com",
  "phone": "+1 202 555 0101",
  "age": 28,
  "profession": "Design de produto",
  "hasIdea": true,
  "ideaDescription": "",
  "hasLaptop": true,
  "usesPaidAI": true,
  "website": "",
  "idempotencyKey": "00000000-0000-4000-8000-000000000001"
}
```

Campos opcionais: `utmSource`, `utmMedium`, `utmCampaign`, `utmContent` e `referrer`. Do referrer, somente a origem é retida. Não colocar dados pessoais nos UTMs.

- Nova aplicação válida: HTTP 201 `{ "received": true }`.
- Repetição do mesmo UUID com os mesmos dados normalizados: HTTP 200, sem nova linha.
- Mesmo UUID com dados diferentes: HTTP 409, sem alterar a linha anterior.
- Erros: 400 validação/honeypot; 403 origem; 409 conflito; 413 tamanho; 415 tipo; 429 excesso de tentativas; 503 indisponibilidade.
- Não existe endpoint público de leitura das aplicações.
- `GET /api/checkout` é legado e responde HTTP 410, sem redirecionamento.

O servidor só confirma o recebimento depois que o Supabase devolve uma linha válida. Em timeout, erro ou configuração ausente, responde 503 e o frontend mantém as respostas para nova tentativa.

## Dados, score e fluxo manual

- Nome, e-mail, telefone, idade, profissão/área, respostas, descrição opcional e atribuição são gravados para todo envio válido.
- `eligible` é uma coluna gerada pelo banco. `true` representa idade entre 18 e 35, ideia, computador disponível e uso de IA paga; `false` representa os demais cenários.
- Profissão/área é informativa e não altera a compatibilidade.
- Por compatibilidade com a tabela já publicada, `status` continua `APPROVED` para score positivo e `NOT_ELIGIBLE` para os demais. Esses rótulos são classificação automática, não decisão final nem confirmação de vaga.
- A equipe pode aprovar manualmente qualquer aplicação e enviar o link restrito da Sympla pelo contato informado.
- O link da Sympla é compartilhável por quem o recebe; não descrevê-lo como pessoal ou intransferível.
- O envio do formulário não reserva vaga e o sistema não registra pagamento.

## Segurança

- RLS habilitada, sem políticas públicas; `public`, `anon` e `authenticated` não possuem privilégios na tabela.
- A chave secreta fica somente no servidor; a chave pública não consegue listar aplicações.
- Validação estrita, honeypot, limite de 16 KiB, verificação de origem, idempotência e proteção de rajada continuam ativos.
- A API retorna `no-store`, `noindex` e `Referrer-Policy: no-referrer`.
- O recibo não contém score, elegibilidade, dados pessoais nem link de ingresso.
- O limite antiabuso é gratuito e por processo; não substitui proteção DDoS nem garante capacidade ilimitada.

## Verificação

Em 13/09/2026, 89 testes, lint, typecheck e build passaram. O teste de produção gravou dois registros sintéticos claramente marcados, um acima e outro abaixo do score. Ambos receberam o mesmo recibo neutro, permaneceram no banco e não iniciaram checkout ou compra.

Use `scripts/verify-live-applications.mjs` para validar os quatro cenários em ambiente controlado. Use `scripts/verify-production-flow.mjs` somente com autorização explícita para manter dois registros sintéticos em produção. Não apagar inscrições sem autorização separada.
