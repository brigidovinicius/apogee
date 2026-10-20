# Botões verdes com fonte Inter — 20/10/2026

O usuário aprovou a publicação dos três CTAs da homepage com verde `#25D366`,
preenchimento branco animado e a mesma fonte dos textos do site, Inter.

- PR integrada: [#78](https://github.com/brigidovinicius/apogee/pull/78).
- CI aprovado: [39499414025](https://github.com/brigidovinicius/apogee/actions/runs/39499414025).
- Head validado: `5e42172d364559fc0b53f7974db7ce80b2d337a9`.
- SHA publicado: `16fa18b1da8c944cf8babfa6b02ca8a06b5757e3`.
- Head e merge têm árvore idêntica: `193fd32950ec87ff095ada013eb7bb153e9ba086`.
- Rollback preservado: `1363f0d50cccab13679bbc87d784095cb0efbf21`, imagem
  `sha256:f4b219365a5aa79cf1a80a21efa535a8a461c08cae09231a6083033226bf56c4`.

A alteração foi integrada sobre a revisão de segurança recém-publicada. O
preflight confirmou checkout limpo, revisão e imagem anteriores, `.env` modo
600 e capacidade da VPS. A troca ocorreu por fetch Git e SHA explícito; foram
executados Compose `config -q`, `build web` e
`up -d --no-deps --no-build --force-recreate web`.

Somente `apogee-site-web-1` foi recriado. Os 12 containers vizinhos mantiveram
nomes, IDs e imagens, incluindo Radar, scheduler, Caddy e bancos. Checkout,
label OCI e imagem do web confirmaram o SHA publicado; estado `healthy`, zero
reinícios, em duas conferências. Não houve migração, mudança de dados, segredos,
DNS, Caddy, redes ou volumes nesta release.

## Verificação em produção

- HTTPS público: três botões com `rgb(37, 211, 102)` e fonte Inter carregada.
- 320, 390 e 1440 px: sem overflow horizontal ou texto cortado.
- Hover: preenchimento completo e recorte do texto `inset(0px)`.
- Clique no Radar e Enter na comunidade chegaram aos destinos preservados.
- Link Stripe preservado; nenhum checkout ou pagamento foi submetido.
- `/makeitfly`: nenhum novo botão e nenhum wrapper do tema Apogee.
- HTTP 200 em `/`, `/oportunidades`, `/makeitfly`, `/membros/entrar`.
- HTTP 307 em `/membros` e `/admin` sem sessão.
- O navegador também registrou respostas 503 de `/api/journey` e avisos de
  preload/Three.js; esse endpoint e o código do Make It Fly não foram alterados
  pela PR. Não se afirma console inteiramente limpo nem validação autenticada.

Script e log sanitizados permanecem no ambiente local em
`/private/tmp/apogee-arrow-fill-deploy-20261020.sh` e
`/private/tmp/apogee-arrow-fill-deploy-20261020.log`. Este registro é posterior
à publicação e não implica novo deploy por causa da documentação.
