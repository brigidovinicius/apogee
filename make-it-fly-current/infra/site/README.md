# Site Apogee na VPS

Este stack publica o Next.js por trás do Caddy. Ele é separado do sistema de locação e reutiliza **somente** a rede externa `apogee_membros_edge`, já exclusiva da área de membros. A topologia é:

```text
Internet -> Caddy (80/443) -> web (sem porta publicada) -> PgBouncer (rede apogee_membros_edge) -> Postgres (rede interna)
                                                 |
                                      Radar API (apogee_radar_bridge)
```

- `caddy` entra apenas em `apogee_site_public` e é o único serviço com portas do host.
- `web` não publica porta: recebe tráfego só do Caddy e alcança apenas o PgBouncer pela rede de borda.
- Postgres continua somente na rede `apogee_membros_internal`; PgBouncer continua limitado a `127.0.0.1:6543` no host como acesso administrativo local.
- Volumes deste stack usam o prefixo `apogee_site_`; não compartilham volumes com outros projetos.
- Quando o Radar Acadêmico estiver autorizado, o `web` também entra na rede externa exclusiva `apogee_radar_bridge`. Essa ponte alcança apenas a API de resultados aprovados do Radar; ela não dá acesso ao banco ou ao scheduler.

## Preparação na VPS

Faça esta etapa somente depois de revisar o commit e autorizar o deploy:

```sh
sudo install -d -m 0750 /opt/apogee-site
# coloque o checkout Git aprovado em /opt/apogee-site/repo
# (o compose precisa permanecer em repo/infra/site para que ../../ seja a raiz do app).
cd /opt/apogee-site/repo/infra/site
cp .env.example .env
chmod 600 .env
# preencha exclusivamente os valores privados já existentes e gere BETTER_AUTH_SECRET se ainda não houver um.
docker compose config -q
docker compose build web
docker compose up -d web
docker compose ps
```

Depois do deploy isolado do Radar, acrescente ao `.env` do site, sem usar um valor público:

```sh
RADAR_ACADEMICO_API_URL=http://radar-academico:3000/api/public/opportunities
```

O mural mantém o catálogo curado local como contingência e agrega apenas resultados aprovados do Radar. Se o Radar ficar indisponível, a página pública não cai.

O Compose espera encontrar a rede `apogee_membros_edge` e o certificado público existente em `/opt/apogee-membros/certs/server.crt`. Não monte `server.key` no site e não abra a porta 6543 no firewall.

## Publicação do domínio (gate final)

Não inicie Caddy antes de `apogee.community` apontar para o IP da VPS e de validar o container `web`. No momento autorizado:

1. confirme que 80 e 443 estão livres e permitidas pela UFW;
2. altere somente o registro **A** de `apogee.community` para o IP da VPS; preserve MX/TXT/CAA e o `www` como CNAME para o domínio raiz. O Caddy redireciona o domínio raiz para `https://www.apogee.community`;
3. execute `docker compose --profile public up -d`;
4. confira o certificado, o redirecionamento do domínio raiz para `www`, as rotas públicas e um login real;
5. só depois mantenha a versão anterior como rollback temporário ou a desative com autorização específica.

O Caddy cuida do certificado TLS e sobrescreve os headers encaminhados; por isso a aplicação usa `APPLICATION_HOSTING_PROVIDER=caddy` para os limites por IP. Nenhum segredo deve ser passado em comando, commit ou log.

## Rollback

Se o site não responder após a mudança de DNS, pare apenas este stack (`docker compose --profile public down`) e restaure o valor anterior do registro A. Não execute comandos em `/opt/sistema-de-locacao` e não remova redes ou volumes compartilhados/existentes.
