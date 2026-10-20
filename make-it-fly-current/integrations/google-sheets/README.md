# Receptor Sheets — configuração pendente de autorização

O código local exige a Script Property `GOOGLE_SHEETS_WEBHOOK_SECRET`, com o mesmo
valor da variável de servidor de nome idêntico (32 a 256 caracteres, sem trim).
Use credencial aleatória própria. Nunca coloque o valor em Code.gs, URL, planilha,
frontend, logs ou Git. Editores do projeto Apps Script devem ser pessoas autorizadas.

O formato existente continua sendo JSON no POST text/plain: `kind=application` ou
`kind=journey_events`, com `webhookSecret` no corpo enviado somente pelo servidor.
Sem credencial válida, configuração ou formato correto, responde `received:false`
antes de adquirir lock/abrir planilha. A resposta não implementa status HTTP customizado.

As abas esperadas são Aplicações (20 colunas) e Jornada (oito colunas, cinco linhas
de cabeçalho; eventos a partir da linha 6), com IDs na coluna A. Confira a estrutura
em cópia isolada antes de implantar. Não altere dados/cabeçalhos reais como teste.

A autenticação usa segredo compartilhado via HTTPS. Não há envelope assinado com
timestamp/nonce; deduplicação por ID permite retry e não é anti-replay criptográfico.

Não houve acesso ao editor Google, alteração de Script Properties, publicação ou
reativação. Antes de qualquer implantação autorizada, siga
[o relatório SEC-01](../../../docs/sheets-security-sec01.md), inclusive a inspeção
das implantações antigas que possam continuar públicas.
