# SEC-01 — autenticação do receptor Google Sheets

Status: correção local na base `85ba1d3`, branch `fix/sheets-webhook-auth-sec01`.
Sem push, deploy, publicação do Apps Script, alteração de propriedades/segredos,
planilhas ou reativação da integração. O achado continua pendente nos ambientes
publicados até inspeção e adoção autorizadas da versão corrigida.

## Causa e decisão

O site já enviava webhookSecret a partir do servidor. O doPost versionado ignorava
o campo, adquiria lock e gravava mensagens válidas mesmo sem credencial ou com
credencial incorreta. Validação de formato não autentica o remetente.

O receptor passa a buscar `GOOGLE_SHEETS_WEBHOOK_SECRET` em
[Script Properties](https://developers.google.com/apps-script/reference/properties/properties-service#getScriptProperties()).
Configuração ausente, curta/longa demais, falha na leitura ou segredo recebido de
tipo incorreto são recusados. Strings têm de coincidir exatamente, com 32–256
caracteres. A comparação percorre 256 posições sem saída antecipada por caractere;
isso não constitui garantia de tempo constante do runtime JavaScript do Google.

Mantivemos o protocolo existente de segredo compartilhado em corpo JSON sobre
HTTPS, usado pelos dois remetentes. Não há assinatura, timestamp de autenticação
ou nonce antirreplay neste lote. Deduplicação por IDs permite reenvios idempotentes,
mas não autentica conteúdo nem substitui antirreplay criptográfico. Caso o segredo
vaze, deve ser rotacionado em operação própria autorizada.

Nenhum segredo foi criado/configurado no serviço real. Editores do projeto podem
acessar suas propriedades e devem ser autorizados. ID da planilha não é credencial;
permissões do arquivo e do web app publicado não foram auditadas novamente aqui.

## Arquivo por arquivo e trechos

| Arquivo | Linhas/trecho | Resultado |
|---|---|---|
| `make-it-fly-current/integrations/google-sheets/Code.gs` | 7–29, doPost | Limite de 32 KiB UTF-8; parse, autenticação e validação antes de lock/Sheets; falhas retornam received:false |
| Mesmo arquivo | 37–45, authenticateWebhook | Script Property obrigatória, tipos/limites e comparação sem coerção |
| Mesmo arquivo | 47–56 e 116–130 | Campos permitidos, UUID v4, tipos/tamanhos, datas e elegibilidade recalculada |
| Mesmo arquivo | 73–107 | Validação integral do lote antes de Sheets, até 20 eventos, IDs normalizados e deduplicação entre reenvios |
| Mesmo arquivo | 59–70 e 133–136 | Mantém layout e proteção de células contra interpretação de fórmulas; grava elegibilidade calculada |
| `make-it-fly-current/tests/helpers/sheets-receiver.mjs` | Harness de APIs Google | Executa o Code.gs real em VM; simula somente serviços externos com dados sintéticos |
| `make-it-fly-current/tests/sheets-receiver.test.mjs` | Regressão e contrato | Valida recusa, efeitos nas linhas, liberação de lock e mensagens dos handlers reais |
| `make-it-fly-current/integrations/google-sheets/README.md` | Operação | Documenta configuração pendente, formato, layout e limites |

Aplicações só aceitam o kind explícito application; tipos desconhecidos não caem
mais no gravador de candidaturas. O campo eligible tem de corresponder ao cálculo:
18 a 35 anos, ideia, notebook e uso de IA paga. A célula usa o cálculo, não o valor
recebido como autoridade. A regra coincide com o código atual do site.

Jornada aceita somente campos conhecidos e um lote inteiro válido; um item ruim
no final não provoca acesso à planilha. IDs são normalizados em minúsculas para
que diferença de caixa não contorne deduplicação. O layout existente de Jornada
pressupõe cinco linhas de cabeçalho, eventos a partir da sexta e IDs na coluna A.

Autenticação e validação antecedem LockService e SpreadsheetApp. Chamadas anônimas
ainda consomem execução do Apps Script e leitura da propriedade: esta correção não
é uma proteção completa contra esgotamento de cotas do provedor.

A resposta é JSON recebido/recusado, sem segredo, dados pessoais ou erro de serviço.
Não implementamos status HTTP customizados com ContentService. Os remetentes
existentes continuam best effort; salvar no Supabase permanece a fonte de verdade.
O received:true da API do site confirma a persistência primária, não a chegada ao
Sheets. O cenário de segredo divergente prova essa distinção sem gravar planilha.

## Verificação local

- Base: 314 testes passaram.
- Regressão inicial: 11 dos 17 testes falharam antes da correção.
- Regressão após a correção: 17 testes passaram.
- Suíte completa final: 331 testes passaram, sem skips/falhas.
- Typecheck passou; lint sem erros, com um aviso preexistente de img em
  components/gallery/gallery-admin.tsx:81 (arquivo não alterado). Code.gs é analisado
  e executado pela VM; o ESLint padrão do site não inclui a extensão gs.

Casos: ausência/erro/tipo de segredo; configuração inválida e rotação; JSON/corpo
UTF-8 inválido ou grande; campos extras/tipos malformados; elegibilidade adulterada;
32 combinações nas idades 17/18/35/36; células com fórmulas preservadas como texto;
duplicatas dentro de lote e entre retries; lock/Sheets indisponíveis, sem vazar erro
e com liberação do lock adquirido. Duas integrações locais executam os handlers
reais de candidatura/jornada, substituindo somente transporte e persistência externa,
com credencial correspondente e divergente. Nenhuma rede externa é usada nos testes.

Testes usam a semântica documentada de
[Blob UTF-8](https://developers.google.com/apps-script/reference/utilities/utilities#newBlob(String))
e [TextFinder sem distinção de caixa por padrão](https://developers.google.com/apps-script/reference/spreadsheet/text-finder#matchCase(Boolean)).
VM/serviços simulados não certificam permissões, cotas, concorrência distribuída ou
execução no runtime hospedado do Google. Não houve teste remoto de gravação.

Não houve novo build Next/Docker ou smoke do site: o único código de produção
alterado é o Apps Script, que não é implantado pelo build Next. Remetentes, rotas,
UI, banco, dependências, lockfiles e configuração real permaneceram inalterados.
Os testes novos entram no npm test já usado pelo CI. CI remoto não executado.
Evidências resumidas: `docs/evidence/security-sec01/`.

## Implantação futura — autorização separada

1. Inventariar o projeto e todas as implantações do Apps Script. A auditoria anterior
   encontrou o envio pelo site desabilitado, mas isso não prova revogação de web apps
   antigos. Esse estado não foi reinspecionado neste lote.
2. Conferir proprietário, editores, permissões, destinos e layout em cópia isolada.
   Preservar versão anterior/configuração e backup dos dados. Não publicar ou
   sobrescrever uma implantação sem autorização específica.
3. Preparar credencial aleatória própria em canal protegido e configurar a Script
   Property e o servidor com o mesmo valor. Não usar URL, célula, frontend ou Git
   como depósito. Não há fallback para segredo antigo/ausente.
4. Testar cópia isolada no runtime Google com mensagens válidas e negativas e
   conferir resposta e linhas, não somente HTTP 200. Inspecionar/desativar versões
   antigas vulneráveis em operação autorizada antes de reativar o envio.
5. Só encerrar SEC-01 em produção após conferir a versão publicada, credencial,
   permissões e evidência de rejeição sem gravação. Uma falha não autoriza ativar
   a versão antiga ou desabilitar autenticação. Reverter Code.gs reabre o achado.
