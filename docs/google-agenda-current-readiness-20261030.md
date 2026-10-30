# Google Agenda: revisão atual e próximos ajustes locais

**Atualização local posterior — monitor e capacidade:** o [relatório desta implementação](google-agenda-monitor-capacidade-local-20261030.md) sucede esta fotografia. Monitor independente de leitura, heartbeat persistente, histórico agregado, p95 e projeções foram preparados localmente; migração `0012` aplicada somente no banco de teste. Instalação fora do host, receptor real, medição de quota/capacidade e liberação continuam pendentes. As consultas à produção/console descritas abaixo pertencem à rodada anterior e não foram repetidas na etapa do monitor.

**Situação: candidato local preparado, liberação para usuários reais ainda pendente.** Esta revisão sucede os relatórios de cadastro supervisionado e fila. Base anterior: commit `113feda`; os novos arquivos de termos e preflight são registrados no commit desta etapa. Não houve push, deploy, migração ou alteração de configuração em produção.

## O que foi reconfirmado nesta rodada

- Consulta HTTP pública, sem sessão: `/privacidade`, `/termos` e `/api/internal/google-agenda/sync` continuam com **404** em `https://www.apogee.community`.
- Consulta somente de leitura no console do projeto `apogee-oauth-local`: audiência **Externo / Testando**, um usuário de teste, **Publicar app desabilitado** por branding incompleto.
- Branding: homepage, política de privacidade e termos continuam sem URL; domínio autorizado `apogee.community`. Não foi verificada nesta rodada a propriedade do domínio no Search Console. O e-mail de suporte selecionado no console é distinto do canal de privacidade informado pelo usuário; não foi substituído.
- Callback e escopo mínimo foram confirmados na rodada anterior; nenhum foi alterado agora. Preservar o login existente. Não inferir “Google liberado” da criação de um cliente ou gravação de um escopo.
- A VPS não foi acessada por SSH nesta rodada e seu banco não foi consultado. SHA remoto, flags, worker e presença de credenciais descritos nos relatórios anteriores são fotografias daquela consulta, não uma nova verificação de instalação.

## Ajustes concluídos localmente

1. **Termos de Uso em `/termos`**: minuta com identificação e canal confirmados, limites do catálogo, conta adulta e vínculos privados, acesso pago conforme a oferta, Google opcional, desconexão, atendimento e preservação dos direitos do consumidor. Link no rodapé e ligação entre termos e privacidade. Nenhum preço, nova duração de acesso vitalício, assinatura recorrente, renúncia de direito ou contrato de terceiro foi inventado. Não foi introduzido um aceite contratual em nome de usuários.
2. **Aprovação explícita por versão**: preencher contato e ativar cadastro supervisionado já não basta para publicar a política. `APOGEE_PRIVACY_APPROVED_VERSION` e `APOGEE_TERMS_APPROVED_VERSION` precisam corresponder às versões em `lib/legal-documents.mjs`. Exemplos ficam vazios; o harness local os mantém vazios mesmo se houver valores herdados no shell.
3. **Minutas protegidas**: fora do preview, documentos sem aprovação continuam indisponíveis. No preview local aparecem como minutas e com `noindex`; sitemap omite minutas e documentos locais. Termos exigem também a política aprovada e o controle supervisionado ativo, pois descrevem esse modelo real de acesso. Aprovação editorial não certifica conformidade jurídica nem substitui o procedimento operacional.
4. **Checagem local de liberação**: `make-it-fly-current/scripts/google-calendar-release-check.mjs`. Somente lê arquivos/configuração e consulta Git local. Não faz rede, não conecta a banco, não lê `.env` automaticamente e não executa migração, publicação ou envio. Relatório não contém valores privados de configuração nem referências livres de atendimento.
5. **Modelo de evidências**: `docs/google-calendar-launch-evidence.example.json`, inteiramente pendente. Referências operacionais ficam ligadas ao SHA exato e precisam de data não futura. O script identifica referências declaradas, não valida sua autenticidade. Mesmo com tudo preenchido, `releaseAuthorized` permanece **false**.

O critério que depende do cadastro supervisionado foi preservado: os textos não devem prometer um modelo de proteção que esteja desativado. A aprovação dos documentos agora é um requisito adicional e independente. Isso não libera automaticamente as contas existentes nem elimina a necessidade de planejar sua revisão antes da ativação global.

## O que ainda falta

| Frente | Pronto no candidato | Pendência para encerrar |
| --- | --- | --- |
| Sincronização | Salvos, etapas, OAuth separado, criptografia, IDs estáveis e retomada parcial | Nova conexão consentida no ambiente publicado e teste de criar/alterar/cancelar em agenda secundária |
| Fila | Lotes sequenciais, leases, retry progressivo, `Retry-After`, quotas, pausa e alertas persistentes | Instalar worker no SHA aprovado, medir quota/capacidade e validar um ciclo real |
| Documentos | Política e termos preparados, rotas e aprovação por versão | Revisar texto e condições comerciais; aprovar a versão; disponibilizar por HTTPS sem login |
| Menores | Vínculo privado, consentimento versionado, revisão e revogação | Designar e treinar operadores, aprovar método/canal, retenção, registro restrito e avaliação de riscos |
| Contas existentes | Controle de acesso no servidor | Aprovar plano de comunicação/revisão: ativar a proteção bloqueia contas comuns sem aprovação; não aprovar titulares por script |
| Google | Cliente/callback e escopo mínimo preparados anteriormente | Completar branding, comprovar domínio quando exigido, cumprir verificação aplicável e publicar audiência/branding com confirmação própria |
| Atendimento | Código de verificação e canal informado | Demonstrar recebimento de e-mail e resposta pela equipe; aceitação do provedor de envio não prova entrega |
| Alertas | Monitor independente, parada do worker/fila vazia, queda/timeout do alvo e deduplicação/outbox preparados e testados localmente | Escolher e autorizar receptor, validar entrega real e instalar monitor em host independente com supervisão própria |
| Operação | Histórico agregado por tentativa, p95 e projeções com amostra mínima e supressão durante falhas | Medir mistura de trabalho e limites reais de quota, validar teto do piloto e definir responsável de plantão |
| Release | Migrações locais `0008`–`0012` inventariadas no candidato | Conferir journal real, backup/restauração, compatibilidade do Radar, autorização do SHA/push/deploy/migrações e rollback |

Antes de aprovar os termos, revisar especialmente a apresentação da oferta, o significado comercial de acesso vitalício, atendimento de cancelamento/restituição e o modo de apresentar/registrar ciência ou aceite quando aplicável. A minuta não altera o checkout ou compras existentes e não é um contrato aprovado.

Os contratos de operadores, garantias de transferências internacionais, retenção e avaliação de telemetria permanecem sujeitos à revisão operacional indicada no POP. A redação dos documentos e os testes do software não demonstram que essas decisões já foram adotadas.

## Como usar a checagem

No diretório `make-it-fly-current`, sempre pela fila global:

```sh
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/google-calendar-release-check.mjs --evidence ../docs/google-calendar-launch-evidence.example.json
```

O exemplo retorna **exit 2 (pendente)** de propósito. Não preencher evidências fictícias para obter um resultado verde. Para operação real, criar cópia restrita e não versionada, por exemplo em `.local/radar-calendar/launch-evidence.json`; não colocar documentos, nomes de dependentes, e-mails, segredos ou URLs com tokens nesse registro. O SHA deve ser o candidato exato, com árvore limpa, e cada referência deve corresponder a uma verificação real da equipe.

O script avalia a configuração fornecida no ambiente do processo. Os itens OAuth/e-mail/criptografia são presença/formato, não chamadas ao provedor. As referências de backup, migração, Google, worker e piloto são declarações de evidência, nunca execução ou certificação desses passos. `configurationReady`, `evidenceComplete` e `readyForHumanReview` são campos separados; nenhum autoriza deploy. Antes do release, vários itens posteriores à implantação continuarão pendentes normalmente; a lista é útil durante e após a preparação.

Para futura aprovação editorial, registrar as versões exatas que foram revisadas. Os valores não foram gravados em `.env` real nesta rodada. Se um documento aprovado mudar, criar nova versão e submeter novamente; não reutilizar a aprovação do texto anterior.

## Sequência futura, ainda não executada

1. Revisar as minutas e fechar decisões operacionais, comerciais, de atendimento e de proteção de menores. Definir o plano para contas existentes.
2. Validar o candidato e autorizar explicitamente sua entrega e o escopo de banco/serviços. Inventariar migrações reais e comprovar backup restaurável, com plano de rollback. O comando de checagem não concede essa autorização.
3. Publicar o SHA e os documentos aprovados pelo fluxo Git/SSH autorizado, ativando proteção somente com atendimento pronto. Preservar DNS, Caddy e serviços vizinhos; a política local não foi publicada por esta preparação.
4. Com homepage, política e termos HTTPS válidos, completar branding/verificação Google e publicar a audiência, mantendo o escopo mínimo e callbacks existentes. Essas configurações são próprias e não se tornam autorizadas por um deploy.
5. Ativar calendário e worker com imagem/SHA correspondentes, configurar o receptor/monitor autorizado e fazer o piloto consentido. Não transferir token da conta fictícia para produção. Somente Google Agenda; `.ics`/Mac continuam fora do escopo.

## Validação desta etapa

- **562/562 testes** do site na execução final, incluindo dez testes adicionais de documentos, sitemap e preflight; 17 testes focados de documentos/SEO/checagem passaram.
- Lint sem erros, com o aviso preexistente de imagem em `gallery-admin`; build local e typecheck aprovados.
- O preflight com o modelo vazio mantém pendências e `releaseAuthorized:false`, sem rede ou impressão de credenciais.
- Conferência HTTP/browser local: minutas acessíveis sem sessão, aviso de revisão, `noindex`, links e conta vitalícia preservados no preview reaberto.
- Nenhuma migração nova foi necessária nesta etapa. As integrações PostgreSQL/Google da fila não foram repetidas, pois seu código não mudou; os 29 checks da etapa anterior não são apresentados como nova execução.

As primeiras verificações ajustaram uma expectativa de redação no teste e o carregador isolado do sitemap para os novos imports; não houve relaxamento dos controles de publicação. Logs privados: `.local/radar-calendar/google-launch-next-focused.log`, `google-launch-next-full-tests.log`, `google-launch-next-lint.log`, `google-launch-next-build.log`, `google-launch-next-typecheck.log` e `google-launch-next-http.json`.

Evidência visual da minuta: `/Users/viniciusbrigido/.codex/visualizations/2026/10/29/01a1879e-bea0-7231-902b-c764c7d6e134/termos-minuta-local-3010.png`. Os termos ficaram abertos no preview para revisão. A consulta Google foi encerrada sem alterações.

## Fontes e relatórios

- [Google: requisitos atuais de branding e documentos](https://support.google.com/cloud/answer/15549049?hl=en). URLs e publicação precisam ser confirmadas no console; preencher um rascunho não publica a marca.
- [CDC, texto disponibilizado pela Senacon](https://consumidor.gov.br/pages/conteudo/publico/102). Os termos preservam direitos legais e não criam renúncia de arrependimento ou limite geral de responsabilidade.
- [Conferência de responsáveis](procedimento-conferencia-responsaveis-20261030.md), [fila local](google-agenda-fila-retentativas-local-20261030.md) e [histórico da preparação de produção](radar-google-only-production-readiness-20261030.md).
