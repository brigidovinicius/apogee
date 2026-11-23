# Aplicação Apogee na VPS

Este stack executa o Next.js na mesma VPS dos serviços privados Apogee, sem fundir os projetos Compose nem renomear recursos existentes. Ele é separado do sistema de locação e entra **somente** nas redes externas `apogee_membros_edge` e `apogee_radar_bridge`, exclusivas da Apogee. A topologia é:

```text
Internet -> Caddy (80/443) -> web (sem porta publicada) -> PgBouncer (rede apogee_membros_edge) -> Postgres (rede interna)
                                                 |
                       Radar API privada (catálogo e auditoria editorial)
```

- `caddy` permanece atrás do profile opcional `public`; ativá-lo é um gate operacional separado e não faz parte da preparação local.
- `web` não publica porta: recebe tráfego só do Caddy e alcança apenas o PgBouncer pela rede de borda.
- Postgres continua somente na rede `apogee_membros_internal`; PgBouncer continua limitado a `127.0.0.1:6543` no host como acesso administrativo local.
- Volumes deste stack usam o prefixo `apogee_site_`; não compartilham volumes com outros projetos.
- Quando o Radar Acadêmico estiver autorizado, o `web` também entra na rede externa exclusiva `apogee_radar_bridge`. Essa ponte alcança as APIs privadas de catálogo e auditoria do Radar; ela não dá acesso ao banco ou ao scheduler.

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
RADAR_ACADEMICO_ADMIN_API_URL=http://radar-academico:3000/api/internal/editorial/sources
```

`RADAR_ACADEMICO_ADMIN_API_TOKEN` deve ter o mesmo valor privado configurado no
Radar. Ele é usado somente pelo servidor em `/admin/radar` e nunca deve ter o
prefixo `NEXT_PUBLIC`.

O mural mantém o catálogo curado local como contingência e agrega apenas resultados aprovados do Radar. Se o Radar ficar indisponível, a página pública não cai.

O Compose espera encontrar as redes `apogee_membros_edge` e `apogee_radar_bridge`, além do certificado público existente em `/opt/apogee-membros/certs/server.crt`. Não monte `server.key` no site e não abra a porta 6543 no firewall. `APPLICATION_ORIGIN` e `BETTER_AUTH_URL` devem ser exatamente `https://www.apogee.community`; `DATABASE_URL` deve resolver `pgbouncer:5432` pela rede privada e as duas URLs `RADAR_ACADEMICO_*_API_URL` devem resolver `radar-academico:3000` pela ponte privada.

## Publicação do domínio (gate final)

Não inicie Caddy antes de `apogee.community` apontar para o IP da VPS e de validar o container `web`. No momento autorizado:

1. confirme que 80 e 443 estão livres e permitidas pela UFW;
2. altere somente o registro **A** de `apogee.community` para o IP da VPS; preserve MX/TXT/CAA e o `www` como CNAME para o domínio raiz. O Caddy redireciona o domínio raiz para `https://www.apogee.community`;
3. execute `docker compose --profile public up -d`;
4. confira o certificado, o redirecionamento do domínio raiz para `www`, as rotas públicas e um login real;
5. só depois mantenha a versão anterior como rollback temporário ou a desative com autorização específica.

O Caddy cuida do certificado TLS e sobrescreve os headers encaminhados; por isso a aplicação usa `APPLICATION_HOSTING_PROVIDER=caddy` para os limites por IP. Nenhum segredo deve ser passado em comando, commit ou log.

SEC-02: o auth/membros aceita apenas `X-Apogee-Client-IP` nesse modo. O Caddy
sobrescreve esse cabeçalho com `{remote_host}`, sobrescreve `X-Forwarded-For` e
remove cabeçalhos alternativos de IP. Em produção, IP ausente/inválido faz a rota
de auth responder 503; não há fallback para outro provedor. As duas mudanças
(imagem e Caddyfile) precisam entrar na mesma janela autorizada, ou o login ficará
indisponível. Não exponha a porta do web nem encaminhe tráfego de CDN/proxy novo
sem revisar a cadeia de confiança. Leia `docs/members-security-sec02.md` na raiz
do repositório antes do corte. Esta implementação local não autoriza ativação.

## Recomendações locais no Radar

O ranking de tecnologia e atividades extracurriculares funciona sem configuração
adicional. Para ativar o destaque geográfico na lista pública e na área de membros,
use a [base IP to City Lite da DB-IP](https://db-ip.com/db/download/ip-to-city-lite)
no formato MMDB. Baixe a edição mensal no host, descompacte e compare o checksum
do arquivo MMDB com o publicado pelo fornecedor. O arquivo não entra no Git nem na
imagem Docker.

No deploy autorizado, defina `RADAR_DBIP_CITY_FILE` no serviço `web` com o caminho
interno de um bind mount somente leitura, por exemplo:

```yaml
services:
  web:
    environment:
      RADAR_DBIP_CITY_FILE: /run/apogee/geoip/city.mmdb
    volumes:
      - type: bind
        source: /opt/apogee-site/geoip/city.mmdb
        target: /run/apogee/geoip/city.mmdb
        read_only: true
        bind:
          create_host_path: false
```

Valide o arquivo e a leitura pelo usuário do container antes de recriar apenas
`web`. O processo mantém a base em memória e a lê novamente ao reiniciar.
A edição de novembro de 2026 ocupa aproximadamente 121 MiB descompactada.
Atualize a base por substituição do arquivo e recriação de `web`. Para desativar
a preferência geográfica, retire a variável e a montagem e recrie `web`.

O Caddy deve continuar autenticando a origem do cabeçalho de IP como descrito acima.
A busca aproximada roda no servidor durante a requisição, sem armazenar IP ou
localização para o ranking e sem enviar esses dados à DB-IP. A lista identifica
a origem dos dados e oferece a navegação sem localização. Filtros manuais de
cidade ou UF, Do Not Track e Global Privacy Control desativam o uso do IP.

## Rollback

Se o site não responder após a mudança de DNS, pare apenas este stack (`docker compose --profile public down`) e restaure o valor anterior do registro A. Não execute comandos em `/opt/sistema-de-locacao` e não remova redes ou volumes compartilhados/existentes.
