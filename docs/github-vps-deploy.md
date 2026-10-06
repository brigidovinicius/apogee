# Deploy do site Apogee pela GitHub Actions

Este fluxo publica exclusivamente `apogee-site/web` na VPS. Não usa Vercel e
não altera `sistema-de-locacao`, `apogee-membros`, Radar, bancos, volumes,
firewall, DNS ou arquivos de ambiente.

## Configuração única

No ambiente GitHub **Production** do repositório, configure somente:

| Tipo | Nome | Finalidade |
| --- | --- | --- |
| Variable | `VPS_HOST` | IP ou hostname da VPS Apogee. |
| Secret | `VPS_SSH_PRIVATE_KEY` | Chave privada ED25519 exclusiva para deploy. |
| Secret | `VPS_SSH_KNOWN_HOSTS` | Entrada `known_hosts` previamente conferida da VPS. |
| Secret | `LINEAR_API_KEY` | Chave pessoal do Linear, limitada à atualização do issue do deploy. |

A chave pública correspondente deve ser instalada na conta `root` da VPS com
permissões restritas ao necessário para o deploy. Nunca versione, imprima ou
cole a chave privada no repositório, nos logs ou em issues.

## Execução

1. Abra **Actions → Deploy Apogee site to VPS → Run workflow**.
2. Informe o SHA completo já existente no GitHub.
3. Opcionalmente informe o issue Linear (o padrão é `APG-6`).
4. Escolha a branch que contém o workflow.

Ao concluir, o job registra automaticamente no issue Linear escolhido o
status, SHA e link da execução. Ele não altera o status do issue: a decisão
de mover um cartão para *Done* continua dependente da validação apropriada.

O job falha antes de qualquer alteração se o SHA, host, chave, identidade da
VPS, checkout, permissão do `.env` ou Compose não forem válidos. Depois do
checkout, uma falha no rebuild restaura automaticamente o SHA anterior e
reconstrói somente `apogee-site/web`.
