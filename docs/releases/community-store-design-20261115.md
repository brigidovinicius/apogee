# Release web — Comunidade e Loja — 15/11/2026

## Resultado

Publicado somente o visual aprovado de `/comunidade` e `/loja`, com recuperação das informações completas da oferta da Comunidade. Deploy autorizado pelo usuário após revisão das duas páginas. O serviço web ficou `healthy`, com zero reinícios.

- SHA publicado: `b6810ce8b53235923145a88b5859b8b402a8b203`.
- SHA anterior e rollback: `47564aa939af063b5aaaf37bae432ca2899271af`; imagem anterior preservada.
- Branch: `release/community-store-design-20261115`.
- Worktree: `community-store-release-20261115`.
- CI exato: [Security hardening — 43760047265](https://github.com/brigidovinicius/apogee/actions/runs/43760047265), seis jobs concluídos com sucesso.
- Imagem/container: `apogee-site:b6810ce8b53235923145a88b5859b8b402a8b203`, imagem `sha256:85d151333233e18d1159745d22ed4044223f0ac284264f69f12aacfce378ea5e`, container `4dfc3974cde0`.
- Recriação do web: 15/11/2026, aproximadamente 18h01, America/Sao_Paulo.

A base foi o SHA efetivamente publicado, e não a `main` mais recente, que já continha mudanças web de outro trabalho. Esta branch não foi integrada à `main`. O push e o workflow manual usaram a branch da release; não houve merge ou publicação das mudanças alheias. Commits posteriores de documentação não alteram o SHA da imagem publicada.

## Escopo e conteúdo

- Comunidade: visual editorial aprovado, tipografia GFS Didot + Inter e cores oficiais. Página completa com Radar, Caixa de Ferramentas, Benefícios, Trilha, planos, participação e nove perguntas frequentes.
- Radar: dez eventos distintos gratuitos, reabertura sem novo consumo, sem renovação automática da cota e preservação dos direitos antigos.
- Caixa de Ferramentas: incluída nos entregáveis públicos com estado **em preparação**, acesso anual previsto e condições de terceiros claras. Ela já constava nos PRDs; o catálogo/rota não estava implementado na revisão publicada examinada. Este deploy não implementa esse produto.
- Trilha: lançamento inicial parcial, sem apresentar formação completa ou módulos ainda não entregues como disponíveis.
- Benefícios: preservados os conteúdos existentes e as condições de disponibilidade, acordo e elegibilidade.
- Loja: novo visual com os mesmos produtos, fotos, ampliação e captação de interesse nos próximos drops. Sem ativar venda ou inventar estoque/preço.
- PRDs atualizados para explicitar os quatro entregáveis e o estado real da implementação. [Prompt para concluir a oferta e os fluxos](../handoffs/apogee-offer-complete-prompt-20261115.md).

Preservados no diff: Home, layout/global CSS original, captura `/evento-openai`, redirecionamento `/gravacao`, componentes compartilhados do funil, planos, regras de acesso, integrações, dependências e infraestrutura. O novo shell e seus estilos são usados somente nas duas páginas aprovadas.

## Validação

- 30 testes direcionados aprovados: página de vendas e âncoras, contrato de preview/retorno, oferta sem checkout habilitado, hero, design system, galeria/Loja, membros, contatos e cadastro de interesse.
- CI: testes, tipos, lint, auditoria, builds e smoke tests dos três projetos; integrações PostgreSQL descartáveis de direitos anuais/cota, Radar, galeria, captura, autenticação, cobrança e drops; seis jobs aprovados no SHA publicado.
- Build Docker do web na VPS aprovado antes da troca do serviço. Prévia local da mesma revisão executada e conferida pelo navegador interno; processo temporário encerrado ao fim da revisão e fila global liberada.
- Navegador interno: Comunidade e Loja em 390, 768, 1024 e 1440 px, sem rolagem horizontal. Quatro painéis dos entregáveis, links/âncoras, aviso de drops e ampliação de fotos conferidos; nenhum formulário real enviado. Nenhum erro de console observado na prévia.
- Produção: conteúdo restaurado, produtos e Caixa de Ferramentas em preparação observados no navegador interno. Home com título, texto principal, fonte e cabeçalho iguais ao registro anterior. Captura do evento com título, fonte, formulário e campos obrigatórios iguais ao registro anterior.
- HTTP público: `/`, `/comunidade`, `/loja`, `/evento-openai`, `/blog`, `/galeria`, `/oportunidades`, `/membros/entrar` e `/membros/cadastro` responderam 200; `/gravacao`, 308.
- Pós-deploy: checkout remoto limpo no SHA publicado, web `healthy`, zero reinícios e zero linhas com marcadores de erro no log inicial examinado.

O smoke público foi anônimo e somente de leitura. Ele não comprova login, envio de lead, entrega de email ou compra real; os testes de integração correspondentes usaram ambientes descartáveis/sintéticos.

## Publicação e preservação do ambiente

Fluxo Git + SSH (`apogee-vps`) com lock `/opt/apogee-site/.deploy.lock`, checkout remoto limpo, SHA exato, imagem candidata previamente construída e imagem anterior presente. Aplicado somente:

```sh
APOGEE_RELEASE_SHA=b6810ce8b53235923145a88b5859b8b402a8b203 \
APOGEE_SITE_ENV_FILE="$SITE_ENV" \
docker compose --env-file "$SITE_ENV" -f "$SITE_DIR/docker-compose.yml" \
  up -d --no-deps --no-build --force-recreate web
```

`SITE_DIR` corresponde a `/opt/apogee-site/repo/make-it-fly-current/infra/site`; `SITE_ENV`, ao `.env` desse diretório. A configuração foi validada com `config -q`, sem imprimir valores privados.

- `.env` continuou em modo 600; checksum SHA-256 antes/depois idêntico: `81cdfc7294f4233ed90134ca6dc04f296e1952bbe69f27d359cc21cefd8d585c`.
- `COMMUNITY_BILLING_ENABLED` continuou desativado, confirmado no container em execução.
- IDs, imagens e datas de criação dos outros 17 containers idênticos imediatamente antes/depois. Inclui Radar, blog worker, bancos, Caddy, sincronização e sistema de locação.
- Sem migração, alteração de dados reais para teste, DNS, Caddy, certificados, redes, volumes, backups ou configuração de pagamento/email.

Rollback de código: mediante necessidade, usar a imagem anterior preservada, verificar o checkout e recriar somente `web` com o SHA anterior conforme `docs/apogee-routine-vps-deploy.md`. Não modificar dados ou configuração como parte do rollback.

## Pendências para abrir a oferta anual

A publicação visual não habilita a oferta paga. O catálogo da Caixa de Ferramentas, os conteúdos e acordos confirmados, a operação dos entregáveis e a jornada completa devem ser concluídos/validados conforme os PRDs e o prompt de continuidade. A captura do evento gratuito permanece um funil independente. Deploys adicionais, migrações de produção e ativação de cobrança exigem revisão e autorização próprias.
