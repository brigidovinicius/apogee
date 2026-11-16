# Ativação anual — 16/11/2026

## Escopo autorizado

Atualizar a oferta, configurar Stripe live, testar a jornada e abrir novas vendas somente se a validação passar. O proprietário manteve o preço final de R$ 1.438,80/ano sem ativar Stripe Tax. A trilha é parcial; o conteúdo inicial declarado é o exercício original “Um primeiro resultado com IA”, com três atividades. Benefícios não formalizados permanecem em preparação e fora das entregas atuais.

O destinatário autorizado para os testes transacionais é o email público da Apogee. Não há autorização para cobrança real. O início do checkout live e seu retorno podem ser conferidos sem submeter cartão; pagamento, renovação, recusa, reembolso e isolamento são validados no sandbox.

## Candidato

Branch `feat/annual-live-20261116`, base main `6a12ac9`. Atualiza a apresentação da Caixa já publicada, o conteúdo inicial e os limites da oferta em diretório, seção, plano, FAQ e assinatura. Preserva renovação anual, entrada gratuita, dez eventos distintos e acessos antigos. O CTA continua controlado no servidor pela configuração comercial e permanece desativado na prévia.

## Configuração e reversão

Preservar o produto e o preço históricos do Radar. Criar produto/preço anual separado; portal dedicado com faturas, atualização de pagamento e cancelamento ao fim do período, sem troca de plano. Ampliar o webhook existente apenas com os eventos que o handler anual processa, preservando todos os eventos antigos e o segredo.

Manter `COMMUNITY_BILLING_ENABLED=false` até concluir a conferência de conteúdo, configuração, CI e jornada. Configurar IDs sem exportar credenciais. Backup restrito do ambiente e da configuração antes de qualquer atualização. Recriar somente web após confirmar lock, revisão e saúde. Não alterar DNS, Caddy, serviços vizinhos, credenciais, direitos ou cota. Nenhuma migração nova.

Em falha, pausar novas vendas primeiro e manter o processamento de contratos, webhooks e períodos pagos. Restaurar somente web para a imagem validada anterior quando necessário; não restaurar amplamente o banco nem desfazer registros financeiros.

## Evidências

Resultados de testes, IDs live, revisão publicada, mensagens recebidas, configuração efetiva e limitações serão registrados após cada etapa. Não usar disponibilidade de configuração como prova de pagamento ou de entrega de email.

### Conferências já observadas

- 803 testes gerais, 33 integrações de assinatura/conteúdo/autenticação e três checks de renderização/CTA aprovados. Lint dos arquivos alterados, tipos e build passaram pela fila global. CI do commit final e validação live permanecem separados.
- Recuperação solicitada pelo formulário público. Mensagem real “Redefina sua senha na Apogee” recebida na caixa autorizada em 16/11/2026, 07:06:02 de São Paulo; link HTTPS da aplicação conferido sem registrar o token. Nenhuma senha alterada.
- Trilha/módulo e três atividades cadastrados pela sessão administrativa existente, sem conceder direito anual a qualquer conta.
- Preflight remoto: checkout cd6a2e5 limpo, imagem efetivamente em execução na revisão 6a12ac9, saudável, zero reinícios. Essa diferença foi registrada para que a reversão considere a imagem atual, não apenas o checkout.
- Criação live pelo conector repetiu autenticação; confirmação por leitura não encontrou produto anual. Pelo navegador, a revisão automática exigiu handoff para a criação financeira. Formulário do produto/preço preenchido; clique final reservado ao proprietário. Novas vendas continuam pausadas.
