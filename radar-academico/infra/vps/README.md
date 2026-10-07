# Radar Acadêmico na VPS

O Radar é um serviço de coleta separado do site Apogee. Ele possui Postgres,
volume e rede internos próprios. A única ligação com a Apogee é a rede externa
`apogee_radar_bridge`, compartilhada exclusivamente pelo `web` do Radar e pelo
`web` da Apogee. Não há porta publicada no host, domínio público ou acesso ao
banco por essa ponte.

```text
fontes oficiais -> scheduler -> Radar web -> Radar Postgres
                                      |
                         apogee_radar_bridge (somente API pública aprovada)
                                      |
                                Apogee web -> navegador
```

O scheduler só aciona a ingestão. Descobertas entram como `pending_review`; a
API que a Apogee consome fica submetida a RLS e só retorna itens aprovados,
verificados, abertos e publicados na revisão humana. Portanto, o mural se
atualiza automaticamente **após** a aprovação editorial, nunca diretamente a
partir de um crawler.

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
   `RADAR_ACADEMICO_API_URL=http://radar-academico:3000/api/public/opportunities`.

Não execute comandos em `/opt/sistema-de-locacao`, não publique a porta 3000 e
não crie exceções no firewall. Antes da primeira migração, faça um backup do
volume `radar_academico_pgdata` assim que ele existir.
