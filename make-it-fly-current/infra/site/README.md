# Aplicação Apogee na VPS

Este stack executa o Next.js na mesma VPS dos serviços privados Apogee, sem fundir os projetos Compose nem renomear recursos existentes. Ele é separado do sistema de locação e entra **somente** nas redes externas `apogee_membros_edge` e `apogee_radar_bridge`, exclusivas da Apogee. A topologia é:

```text
Internet -> Caddy (80/443) -> web (sem porta publicada) -> PgBouncer (rede apogee_membros_edge) -> Postgres (rede interna)
                                                 |
                                      Radar API (apogee_radar_bridge)
```

- `caddy` permanece atrás do profile opcional `public`; ativá-lo é um gate operacional separado e não faz parte da preparação local.
- `web` não publica porta: recebe tráfego só do Caddy e alcança apenas o PgBouncer pela rede de borda.
- Postgres continua somente na rede `apogee_membros_internal`; PgBouncer continua limitado a `127.0.0.1:6543` no host como acesso administrativo local.
- Volumes deste stack usam o prefixo `apogee_site_`; não compartilham volumes com outros projetos.
- Quando o Radar Acadêmico estiver autorizado, o `web` também entra na rede externa exclusiva `apogee_radar_bridge`. Essa ponte alcança apenas a API de resultados aprovados do Radar; ela não dá acesso ao banco ou ao scheduler.

## Preparação na VPS

Faça esta etapa somente depois de revisar o commit e autorizar o deploy:

```sh
sudo install -d -m 0750 /opt/apogee-site
# coloque o checkout Git aprovado em /opt/apogee-site/repo
# A aplicação é aninhada e o Compose deve permanecer em make-it-fly-current/infra/site.
cd /opt/apogee-site/repo/make-it-fly-current/infra/site
cp .env.example .env
chmod 600 .env
# preencha exclusivamente os valores privados já existentes e gere BETTER_AUTH_SECRET se ainda não houver um.
APOGEE_RELEASE_SHA="$(git -C ../../ rev-parse HEAD)"
export APOGEE_RELEASE_SHA
docker compose --env-file .env config -q
docker compose --env-file .env build web
docker compose --env-file .env up -d web
docker compose --env-file .env ps
```

Depois do deploy isolado do Radar, acrescente ao `.env` do site, sem usar um valor público:

```sh
RADAR_ACADEMICO_API_URL=http://radar-academico:3000/api/public/opportunities
```

O mural mantém o catálogo curado local como contingência e agrega apenas resultados aprovados do Radar. Se o Radar ficar indisponível, a página pública não cai.

O Compose espera encontrar as redes `apogee_membros_edge` e `apogee_radar_bridge`, além do certificado público existente em `/opt/apogee-membros/certs/server.crt`. Não monte `server.key` no site e não abra a porta 6543 no firewall. `APPLICATION_ORIGIN` e `BETTER_AUTH_URL` devem ser exatamente `https://www.apogee.community`; `DATABASE_URL` deve resolver `pgbouncer:5432` pela rede privada e `RADAR_ACADEMICO_API_URL` deve resolver `radar-academico:3000` pela ponte privada.

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
