# Radar Acadêmico na VPS

O Radar é um serviço de coleta separado do site Apogee. Ele possui Postgres,
volume e rede internos próprios. A única ligação com a Apogee é a rede externa
`apogee_radar_bridge`, compartilhada exclusivamente pelo `web` do Radar e pelo
`web` da Apogee. Não há porta publicada no host, domínio público ou acesso ao
banco por essa ponte.

```text
fontes oficiais -> scheduler -> Radar web -> Radar Postgres
                                      |
                  apogee_radar_bridge (APIs privadas do Radar)
                                      |
                                Apogee web -> navegador
```

O scheduler aciona a ingestão. Descobertas e mudanças válidas entram
automaticamente no catálogo quando a fonte, as evidências, o estado das inscrições
e o prazo passam nas validações do servidor. A API que a Apogee consome fica
submetida a RLS e só retorna itens publicados e vigentes; o painel gerencia as
mesmas fichas ao vivo, sem fila de aprovação. A ativação de uma fonte continua
dependendo de auditoria separada.

## Primeiro deploy autorizado

1. Crie `/opt/radar-academico`, coloque nele o checkout aprovado e copie
   `infra/vps/.env.example` para `infra/vps/.env` com modo `0600`.
2. Gere os segredos apenas no arquivo protegido. Não os envie em comandos,
   commits ou logs.
3. Crie uma vez a rede de ponte:

   ```sh
   docker network create apogee_radar_bridge
   ```

4. Execute a migração uma única vez e confira o resultado:

   ```sh
   cd /opt/radar-academico/repo/infra/vps
   APOGEE_RELEASE_SHA="$(git -C ../.. rev-parse HEAD)"
   export APOGEE_RELEASE_SHA
   docker compose config -q
   docker compose up -d postgres
   docker compose --profile migrate run --rm migrate
   docker compose up -d web scheduler
   docker compose ps
   ```

5. Só então conecte o `web` da Apogee à mesma rede e configure
   `RADAR_ACADEMICO_API_URL=http://radar-academico:3000/api/public/opportunities`,
   `RADAR_ACADEMICO_ADMIN_API_URL=http://radar-academico:3000/api/internal/editorial/sources`
   e um `RADAR_ACADEMICO_ADMIN_API_TOKEN` dedicado, igual nos dois serviços.
   Esse token serve apenas à ponte server-to-server de `/admin/radar` e não é
   encaminhado ao navegador. A mesma ponte alcança `/api/internal/editorial/opportunities`
   e `/api/internal/editorial/import` sem criar uma segunda credencial.

## Cursos e publicação automática

As migrações `0005_courses_national_scope.sql`, `0006_crawl_progress.sql`,
`0007_automatic_live_catalogue.sql` e `0008_opportunity_categories.sql` adicionam
cursos, execução da coleta, catálogo ao vivo e as sete categorias de navegação.
`0009_discovery_watchlist.sql` adiciona um banco privado de páginas observadas,
links candidatos e edições anuais. O scheduler existente na VPS os consulta
diariamente sem GitHub Actions agendado, serviço externo pago ou publicação
automática dos candidatos. O painel `/admin/descoberta` permite cadastrar novas
páginas e acompanhar a agenda; novas páginas começam pausadas.
`0010_discovery_official_audit.sql` registra a conferência das páginas oficiais
da curadoria inicial e pausa qualquer alvo sem revisão. O banco rejeita ativar
uma página não verificada ou mudar sua URL mantendo a revisão antiga. No painel,
uma nova página só pode ser ativada após registrar a evidência de autoria oficial
e as condições de consulta. Sites de terceiros não são monitorados.
As novas fontes começam pendentes e inativas. Autorizar uma
fonte exige conferir domínio, localização e condições de consulta; fichas válidas
publicam automaticamente, sem revisão humana intermediária.

Os CSVs históricos não comprovam inscrições atuais. Reconsulte a fonte e o prazo
antes de importar ou cadastrar. Na Apogee, `/admin/radar` gerencia o mesmo catálogo
público com criar, editar e excluir; a configuração de fontes fica na vista
`?vista=fontes`. Veja `docs/radar-prd.md` na raiz do repositório.

Não execute comandos em `/opt/sistema-de-locacao`, não publique a porta 3000 e
não crie exceções no firewall. Antes da primeira migração, faça um backup do
volume `radar_academico_pgdata` assim que ele existir.
