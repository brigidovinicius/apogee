# Pendências da auditoria de segurança

Conferência: 20/10/2026. Base das correções anteriores: `736465f`; tarefa atual: branch `fix/brace-expansion-dep04`.

Os seis achados de aplicação/configuração têm correções e evidências locais na cadeia de commits abaixo. **Continuam abertos quanto à adoção e verificação em produção.** A conferência atual reconciliou código, commits e evidências; não acessou VPS, banco, contas reais ou configurações hospedadas. Não houve push, CI remoto, merge ou deploy nesta tarefa.

## Aplicação e configuração

| Achado | Commit local | Correção local / evidência | Pendência externa |
|---|---|---|---|
| SEC-05 | `e4e365a` | [Privilégio mínimo no banco Radar](radar-security-sec05.md), validado localmente | Preparar corte autorizado dos papéis/credenciais, migração e backup/rollback; conferir privilégios efetivos do runtime em produção |
| SEC-02 | `316ac36` | [IP confiável e limites do login](members-security-sec02.md), validado localmente | Publicar imagem e Caddyfile em conjunto, confirmar backend privado e testar borda real |
| SEC-06 | `85ba1d3` | [Bootstrap administrativo verificado](members-security-sec06.md), validado localmente | Adotar os comandos corrigidos e revisar concessões históricas com autorização própria |
| SEC-01 | `0546494` | [Receptor Google Sheets autenticado](sheets-security-sec01.md), validado localmente | Inspecionar versões/propriedades e deployments antigos do Apps Script; publicar correção com autorização. A integração estava desativada na auditoria original; esse estado não foi reconferido ao vivo |
| SEC-03 | `ab8af45` | [Prazo e cancelamento de corpos HTTP](request-body-security-sec03.md), validado localmente | Publicar e conferir comportamento na infraestrutura real, incluindo borda |
| SEC-04 | `40eaa3e` | [Validação e cotas dos alertas](radar-alerts-security-sec04.md), validado localmente | Publicar e conferir cotas, identidade de IP e encaminhamento reais |

Os arquivos `docs/evidence/security-sec01/validation.json` até `security-sec06/validation.json` registram `validated_locally_not_deployed`. Isso não equivale a produção corrigida. O SEC-05 continua sendo uma pendência crítica operacional; sua execução exige autorização específica para banco/credenciais/produção e não foi iniciada.

## Dependências

Esta tarefa trata somente o **DEP-04, alto**, com patches das séries 1 e 5 de brace-expansion. DEP-01 (`847f1c8`), DEP-02 (`5f9f9f4`) e a proteção local DEP-03 (`736465f`) foram preservados. A presença de uma dependência não demonstra acesso pelo usuário público do sistema.

| Achado | Gravidade | Aplicações | Estado / próxima ação |
|---|---|---|---|
| DEP-01: `proxy-addr` 2.0.7 | Crítica | Raiz e site | [Corrigido localmente para 2.0.8 e validado](proxy-addr-security-dep01.md); adoção nos ambientes de ferramentas/build ainda depende da revisão publicada |
| DEP-02: `@modelcontextprotocol/sdk` 1.30.0 | Alta | Raiz e site | [Corrigido localmente para 1.31.0 e validado](mcp-sdk-security-dep02.md); adoção nos ambientes de ferramentas/build ainda depende da revisão publicada. Clientes OAuth legados precisam dos cuidados descritos no relatório |
| DEP-03: `braces` e cadeia de glob | Alta | Três aplicações | [Proteção local validada com limite de profundidade](braces-security-dep03.md); permanece em 3.0.3 e o aviso npm/upstream continua aberto. Substituir o vendor quando existir correção upstream adequada |
| DEP-04: `brace-expansion` | Alta | Raiz e site | [Corrigido e validado localmente](brace-expansion-security-dep04.md): 1.1.21 e 5.0.12 nas seis instâncias, incluindo aninhadas. Avisos alvo ausentes do npm; adoção nos ambientes publicados pendente |
| DEP-05: `esbuild` legado do `drizzle-kit` | Média | Site | Pendente; avaliar atualização da cadeia e condição de uso do servidor de desenvolvimento |
| DEP-06: `fast-uri` / `ip-address` | Média | Raiz e site | Pendente; atualizar e testar parsing/normalização e comparação de famílias IP |
| DEP-07: SDK MCP, novos IDs | Alta / média | Raiz e site | Pendente; avaliar patch 1.32.0 e alcance dos fluxos descritos abaixo. A correção do ID original do DEP-02 continua preservada |
| DEP-08: Hono `serveStatic` | Média | Raiz e site | Pendente; avaliar patch 4.13.11 e uso da função na cadeia de ferramentas |
| DEP-09: Vite / `launch-editor` | Média | Radar | Pendente; aviso associado a `node_modules/vite` pelo npm. Avaliar patch Vite 8.3.3 e condição específica de Windows |

Nova consulta ao registro oficial npm por lockfile das três aplicações. O scanner conserva o alerta de braces, pois o vendor mantém a versão 3.0.3; ele não reconhece o patch local. Os avisos DEP-07 a DEP-09, incluídos no inventário na etapa DEP-03, permanecem pendentes:

| Aplicação | Críticas | Altas | Médias | Total completo | Total com `--omit=dev` |
|---|---:|---:|---:|---:|---:|
| Raiz | 0 | 9 | 3 | 12 | 0 |
| Site | 0 | 9 | 7 | 16 | 0 |
| Radar | 0 | 5 | 1 | 6 | 0 |

As contagens representam pacotes sinalizados, incluindo ancestrais, e se repetem entre árvores. Não são o número de falhas independentes. As consultas completas seguem com código 1 pelos achados restantes; zero em produção representa apenas os avisos conhecidos no lockfile com dependências de desenvolvimento omitidas.

## Novos avisos no inventário

Estes IDs não constavam das respostas registradas na tarefa DEP-02. Foram conferidos nas fontes dos mantenedores e mantidos para tarefas separadas; a exposição efetiva dos fluxos não foi reproduzida nesta tarefa.

- **DEP-07:** SDK 1.31.0 sinalizado por [tarefas experimentais sem vínculo de sessão, alto](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-22jm-h49p-29qw) e [redirecionamentos HTTP entre origens, médio](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw). Ambos indicam patch 1.32.0 na série 1.x. São distintos do GHSA-6qxp-vccf-f47h corrigido no DEP-02, que continua ausente.
- **DEP-08:** [Hono / decodificação adicional em serveStatic](https://github.com/honojs/hono/security/advisories/GHSA-5r4p-p66f-jhc7), patch 4.13.11.
- **DEP-09:** [launch-editor / escape de argumentos no Windows](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv), também associado pelo mantenedor ao Vite 8.3.0–8.3.2, com patch 8.3.3. O teste não foi executado em Windows.

Na tarefa DEP-03, a base da raiz retornou nove altas e a consulta posterior dez, incluindo os novos IDs do SDK. As consultas ao registro não são atômicas. Na tarefa DEP-04, somente os três registros de brace-expansion mudaram em cada lockfile afetado. Após a correção local DEP-04, o DEP-07 é o próximo achado alto ainda sem correção local; a pendência upstream do DEP-03 permanece separada.

Evidências: [DEP-01](evidence/security-dep01/validation.json), [DEP-02](evidence/security-dep02/validation.json), [DEP-03](evidence/security-dep03/validation.json) e [DEP-04](evidence/security-dep04/validation.json), incluindo auditorias e regressões. O relatório inicial em `../auditoria-seguranca-20261020/` permanece histórico. As lacunas de acesso/cobertura da auditoria inicial não são encerradas por esta correção de dependência.
