# APG-78 — recuperação do hardening 89dcc

Base verificada por `git fetch origin`: `ee6cbb4c1ebb7ff5f0bd7a52d0a91dad570b3a68`.
Worktree preservado: `e5bad/Apogee - Site Interativo`.
Branch: `fix/89dcc-security-hardening`.
Linear: https://linear.app/vinicusspace/issue/APG-78

## Auditoria e escopo

Relatório original 3436e recuperado no transcript Claude
`6c369cab-7938-4832-9e55-671ed09730fe`, subrelatório
`agent-aa0db8e3799264442.jsonl:94`. O campo finalMessage do Kanban foi sobrescrito;
o transcript contém o relatório concluído. O relatório histórico não executou
npm audit. Seus achados foram reconfirmados no código da base acima.

AGENTS.md da raiz, app ativo e Radar e guias instalados de Next (route handlers,
segurança de dados, headers, Server Actions e standalone) foram lidos.
A [documentação Cloudflare indicada na auditoria](https://developers.cloudflare.com/agents/runtime/execution/agent-skills/)
descreve instruções/scripts para agentes; não exige migrar este app para Workers.
Nenhuma skill externa foi instalada/executada.

| Achado confirmado | Correção / limite |
| --- | --- |
| Consultas dependiam só de RLS | Predicado explícito approved + human verified + open + published + não vencido em todas as consultas externas; rollback da transação pública em erro. |
| Páginas Radar contornavam membros | Redirects fixos para prévia/membros canônicos antes de consultar dados. API completa continua exigindo bearer. DTO público e requireMember no Apogee preservados. |
| Compose local expunha porta em todas interfaces | Bind do Radar a 127.0.0.1. VPS compose já usa apenas expose; não foi alterado nem aplicado. |
| Login síncrono/sem limites e cookie malformado causava erro | Scrypt async com no máximo duas operações simultâneas, limites por cliente/global antes do hash, validação estrita do hash, token v1 com nonce e expiração limitada. |
| Cron comparava string e rotas vazavam erros | Comparação de digests SHA-256 com timingSafeEqual; mensagens genéricas no cron/CSV e relatório de ingestão sanitizado. |
| Download ilimitado antes da validação | Contagem de bytes durante streaming; teto configurável até 15 MiB, robots 128 KiB, timeout total 15 s por request; sem descompressão automática. |
| SSRF/DNS e redirects | HTTPS porta 443, allowlist de host/caminho, até 5 redirects, ciclos rejeitados, todos os endereços DNS devem ser públicos; lookup validado alimenta diretamente o socket TLS, sem segunda resolução. |
| Caches ilimitados | LRU/TTL: respostas até 32 entradas/32 MiB/15 min, hosts 256/60 s; 304 preserva conteúdo e MIME. Ingestões sobrepostas são recusadas por processo. |
| Fontes aceitavam enum/números inválidos | ID/domínios/URLs/tamanhos validados, modo em enum, intervalo inteiro de 2 a 720 h; criação permanece pending/inactive. Decisão editorial desconhecida não vira aprovação. |
| Pré-inscrição legada | Corpo até 4 KiB durante streaming/5 s, campos permitidos/tamanhos, origem configurada, limites por cliente/global, IP não confiável ignorado, webhook HTTPS/5 s/sem redirects e sem devolver corpo remoto. |
| Headers ausentes | nosniff, DENY, CSP frame-ancestors/base-uri/object-src, Referrer/Permissions-Policy e HSTS apenas em produção nos três apps; X-Powered-By removido. |
| Dependências runtime | Next legado alinhado a 16.3.8; sharp 0.35.5 e source-map-js 1.2.2 nos locks; CLI shadcn movida para dev na raiz. cn é usado em runtime e não teve vulnerabilidade confirmada; preservado. |

## Configuração pendente e compatibilidade

- Sessões admin antigas são invalidadas pelo formato v1. ADMIN_SESSION_SECRET deve
  ter pelo menos 32 caracteres. Rotacionar esse segredo revoga todas as sessões;
  não foi implementada revogação individual nem modificada credencial real.
- Pré-inscrição pertence ao app **legado na raiz**, não ao site ativo
  `make-it-fly-current`. Exige `PRE_REGISTRATION_ORIGIN` como origem exata (sem
  path/barra final), além do webhook já existente. Sem configuração falha fechada.
- `TRUST_PROXY_CLIENT_IP` permanece desligado por padrão. Só habilitar com
  autorização de infraestrutura após comprovar proxy que sobrescreve X-Real-IP
  e bloqueia acesso direto. X-Forwarded-For não é confiado; sem proxy validado os
  clientes compartilham bucket. Os limites são por processo e reiniciam com ele;
  múltiplas réplicas exigem armazenamento compartilhado em gate próprio.
- CSP protege enquadramento/base/objetos, sem alegar uma política completa de
  scripts com nonce. Não inclui upgrade-insecure-requests nem includeSubDomains.
- DNS privado/misto, robots inacessível, compressão não solicitada e loops falham
  fechados e requerem revisão da fonte. O fetch seguro não repete automaticamente
  falhas; tentativas futuras ocorrem no próximo ciclo autorizado.
- O plano [runtime-roles](../radar-academico/infra/proposals/README.md) e SQL com
  ROLLBACK ficam fora das migrations. RLS real, ownership/credenciais, pools
  separados e efeitos de infraestrutura **não foram validados nem aplicados**.

## Validação e evidências

Execução local sequencial, sem Docker, banco, fontes, dados ou serviços reais:

- Raiz: `npm test` (4 testes), `npm run typegen`, `npm run typecheck`, `npm run lint`.
- Radar: `npm test` (66 testes + 1 teste editorial focado), `npm run typegen`, `npm run typecheck`, `npm run lint`.
- App ativo: `npm test` (212 testes), `npm run typegen`, `npm run typecheck`,
  `npm run lint` (zero erros, um aviso preexistente de img em gallery-admin.tsx).
- `npm audit --omit=dev --package-lock-only --json` nos três apps: **zero alertas**
  após correção; antes eram 14 na raiz, 2 no Radar e 2 no ativo. Isso não afirma
  ausência de vulnerabilidades desconhecidas nem cobre ferramentas de dev.
- Dependências locais reaproveitadas por symlinks temporários, sem mudar seus
  diretórios. Uma primeira tentativa no ativo encontrou dependências ausentes no
  checkout antigo; repetida com árvore compatível passou. Root lint/typecheck
  agora isolam os subapps, cada qual validado em job próprio, sem desabilitar regras.
- Mac com cerca de 215 MiB livres: builds locais não tentados. CI oficial usa
  Node 22, `npm ci` a partir dos locks e matriz com `max-parallel: 1`. Executa todos
  os testes/checks, audit runtime, build standalone e smoke em cada app.
- Smoke `scripts/security-smoke.mjs`: inicia o server.js standalone em loopback
  com ambiente sintético, valida headers, assets, redirects e rejeições de acesso;
  encerra o processo ao terminar. Nenhuma credencial real é herdada.

O PR e seus checks remotos são a evidência final de publicação do código. Não
houve deploy, migração, crawl real, mudança DNS/Caddy/Vercel nem release público.
Manter card em Review e worktree/branch intactos até revisão humana do PR.
