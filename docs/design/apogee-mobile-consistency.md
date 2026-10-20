# Revisão mobile do Apogee

## Escopo

Continuação da auditoria de 20/10/2026, com deploy autorizado nesta conversa. Manter marinho `#07182d`, azul-claro `#b9d3ee`, branco, Inter e Instrument Serif. Preservar os estilos próprios do Make It Fly.

## Achados no site público

Em 390 px, não havia overflow horizontal nas sete rotas verificadas. Contudo:

- A galeria usava título de 80 px, com 64 px de espaço por seção, enquanto outras páginas tinham aberturas menores.
- O cabeçalho da loja ocupava duas linhas, com uma faixa extra para a ação de lançamento.
- Os títulos de detalhes e lançamento da loja ainda declaravam Didot antes da fonte da marca.
- Avisos do cadastro tinham 11,52 px; rótulos de filtros e consentimento ficavam entre 11,68 e 13,12 px.
- Metadados do upload ainda usavam uma fonte monoespaçada e azuis fora dos tokens compartilhados.

## Ajustes

- Tokens compartilhados para títulos mobile, subtítulos e intervalo de seção de 48 px.
- Galeria e Radar com abertura proporcional em telas de até 700 px.
- Cabeçalho da loja em uma linha, com controles de pelo menos 44 px.
- Instrument Serif nos títulos internos da loja, inclusive o painel de lançamento.
- Rótulos, orientações, consentimento, filtros e mensagens revisados com 14 px; campos continuam em 16 px.
- Texto auxiliar do upload e contagem do Radar usam cores da paleta para melhorar a leitura.

Os ajustes são CSS, com escopo `data-apogee-design`; não mudam dados, autenticação, formulários, destinos de compra ou compartilhamento.

## Validação anterior ao deploy

- Build de produção e TypeScript aprovados.
- 11 testes existentes de escopo visual, apresentação textual e compartilhamento aprovados.
- `git diff --check` aprovado.
- Não houve envio de formulário, cadastro, compra, upload ou mensagem externa.

A tentativa de prévia por injeção do CSS local foi bloqueada pela revisão automática. A inspeção visual da revisão publicada será registrada após o deploy, usando somente os estilos servidos pelo próprio site.
