# Galeria da comunidade Apogee e loja

## Rotas

- `/galeria`: fotos reais do evento Make It Fly enviadas pela comunidade Apogee.
- `/loja`: vitrine editorial independente, pronta para receber catálogo e checkout no futuro.
- A página inicial mostra até três fotos recentes da galeria imediatamente antes do rodapé, com um botão para enviar fotos.

## Envio de fotos

1. A pessoa seleciona até 10 fotos JPEG, PNG, WebP, HEIC/HEIF, AVIF ou GIF (máximo de 20 MB por original), escolhe aparecer com nome e Instagram ou anonimamente, e confirma que tem direito de compartilhar as imagens. O campo de Instagram aceita @usuário ou link de perfil.
2. O navegador prepara as fotos antes de marcá-las como prontas, convertendo HEIC/HEIF quando necessário. Ele tenta WebP e usa JPEG quando o navegador não consegue exportar WebP, reduzindo a resolução até caber em 2,5 MB. O servidor verifica formato e dimensões, reprocessa tudo para WebP, remove metadados e limita a saída a 3 MB. Arquivos corrompidos, formatos que o navegador não consegue decodificar e resoluções acima de 120 megapixels continuam sujeitos a rejeição.
3. O servidor grava a foto e os créditos em um bucket público dedicado do Supabase Storage, sem passar pela VPS. No modo anônimo, nome e Instagram digitados não são enviados nem gravados. O segredo do Supabase permanece somente no servidor.
4. A foto entra automaticamente no mural público e na prévia da página inicial. Enquanto não houver envios, ambos mostram um estado vazio honesto, sem fotos de exemplo.

O endpoint de envio exige origem correspondente, limita o tamanho da requisição e aplica uma limitação de frequência por IP na instância ativa. Essa limitação em memória é apenas uma proteção inicial: uma política global de abuso e um fluxo de denúncia/remoção devem ser definidos antes de ampliar o alcance da galeria. Fotos publicadas e créditos são públicos; não devem ser enviados registros sem autorização de imagem.

## Dados de cada foto

- ID e data de publicação;
- URL WebP pública, largura e altura;
- nome e Instagram informados pela pessoa, ou marcação de publicação anônima sem dados de crédito.

## Loja

A rota existe como vitrine em preparação e não apresenta produtos fictícios. Catálogo, estoque, pagamento, frete, política comercial e integrações serão definidos antes de ativar compras.
