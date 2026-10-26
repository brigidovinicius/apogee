# Brilho no celular e marca oficial fora da capa — 26/10/2026

Base publicada: `861c3b2ea9396b491d29c2d504c0cfeebacf066a`.

## Correção

O brilho dependia exclusivamente do vídeo. Quando `play()` era negado, a assinatura permanecia estática até um gesto permitir reprodução. Em aparelhos com toque e em economia de dados, agora um gradiente SVG/CSS ilumina a mesma arte (letras e estrela), sem carregar o vídeo da assinatura. O ciclo dura 10 segundos: 8 de passagem suave da esquerda para a direita, 2 de repouso.

O desktop conserva o clipe do Flow, com a mesma alternativa SVG em caso de bloqueio de reprodução ou falha do arquivo. O efeito pausa com a aba oculta ou a assinatura fora da tela. Movimento reduzido conserva a versão estática.

Referência consultada sobre rejeição de `play()` no Safari: https://webkit.org/blog/6784/new-video-policies-for-ios/

O cabeçalho deixa de usar uma fonte cursiva do sistema e passa a usar os arquivos oficiais `/brand/apogee-logo-white.svg` e `/brand/apogee-logo-navy.svg`. A arte cursiva fica apenas na capa. Rodapé e páginas internas já usam a marca oficial. Sem alterações na área Make It Fly ou nos arquivos oficiais da marca.

## Validação local

Antes de iniciar o servidor, em sequência pela fila npm:

- `node --test --test-concurrency=1 tests/earth-home.test.mjs tests/earth-media-playback.test.mjs`: 12 aprovados.
- ESLint dos três módulos TypeScript alterados: aprovado.
- `tsc --noEmit --incremental false`: aprovado.
- `git diff --check`: aprovado.

Navegador integrado (Chromium):

- Toque emulado: estado `shimmer`, nenhum vídeo da assinatura, duração 10.000 ms. Intervalo real entre dois eventos `animationiteration`: 10.001,1 ms.
- Comparação de capturas em repouso e no pico: pixels mudam nas letras e na estrela; região de fundo de controle permanece idêntica.
- Bloqueio simulado de `HTMLMediaElement.play()` com `NotAllowedError`: a alternativa animada aparece. Override removido após o teste.
- Movimento reduzido: estado estático, zero vídeos da assinatura, animação CSS desativada.
- Viewports 320x740, 390x844 e 1280x900: sem overflow horizontal. Marca oficial branca na Terra e azul no fundo claro; links de navegação preservados.
- Nenhum erro de console observado.

Limite: sem iPhone físico nem execução no motor WebKit. O usuário não sabe se “Reduzir Movimento” está ativado no aparelho; essa preferência continua respeitada.

Capturas e comprovação da publicação serão registradas no relatório de entrega. A alteração automática de título em `AGENTS.md` feita pelo servidor Next fica fora do commit desta correção. A cópia local do catálogo e `.env.local` também não fazem parte da entrega.
