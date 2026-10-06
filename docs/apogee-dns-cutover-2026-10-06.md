# Corte DNS Apogee — 2026-10-06

## Alteração autorizada

No painel DNS autorizado da Hostinger, foram aplicados somente estes registros:

| Nome | Tipo | Destino | TTL |
|---|---|---:|---:|
| `@` | `A` | `76.13.124.225` | 300 |
| `www` | `A` | `76.13.124.225` | 300 |

O CNAME legado de `www` foi removido antes de criar o novo registro A, pois DNS não permite CNAME e A para o mesmo nome.

Não foi aberta nem alterada qualquer configuração da Vercel. Nenhuma ação foi feita em `/opt/sistema-de-locacao` ou em qualquer outra aplicação da VPS.

## Rollback DNS

Se for necessário retornar ao estado anterior, no mesmo painel DNS:

1. altere `@ A` de `76.13.124.225` para `216.198.79.1` (TTL 300);
2. remova `www A 76.13.124.225` (TTL 300);
3. crie `www CNAME 9b622a17d191337b.vercel-dns-017.com` (TTL 300).

Não execute o rollback parcialmente: o registro `www` deve permanecer com apenas um tipo de destino por vez.

## Evidências sanitizadas

- O painel confirmou os dois registros A acima após a gravação.
- Consultas públicas a `1.1.1.1` e `8.8.8.8` resolveram tanto `apogee.community` quanto `www.apogee.community` para `76.13.124.225`.
- A primeira tentativa HTTPS recebeu `alert internal error` no handshake TLS, enquanto o Caddy ainda estava emitindo certificados após a mudança DNS.
- A leitura dos logs do Caddy confirmou emissão Let’s Encrypt bem-sucedida para `apogee.community` e `www.apogee.community`; nenhuma alteração de configuração, serviço ou aplicação foi necessária na VPS.
- Nova validação pública: `https://apogee.community/` redireciona para `https://www.apogee.community/` e responde 200 com TLS verificado; `https://www.apogee.community/` responde 200 com TLS verificado.
- `https://www.apogee.community/login` responde 200; deixou de retornar 404.
- `https://www.apogee.community/membros/entrar?next=%2Fmembros` redireciona para o login e a resposta final é 200, sem erro de servidor.

O corte DNS e a terminação TLS estão confirmados publicamente. Nenhuma correção remota foi iniciada neste corte DNS.
