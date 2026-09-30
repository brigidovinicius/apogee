# Loja — correções da auditoria de 28/09/2026

Alteração local, sem publicação. Referência visual: comparativo enviado pelo usuário, com as duas lojas a 1014 × 708 e movimento reduzido. A direção de frontend-design foi preservar a identidade, os textos e a composição do projeto, concentrando a calibração no vidro e na coerência do movimento.

## Tratamento dos oito itens

| Item | Alteração | Arquivo / ponto principal |
| --- | --- | --- |
| 1. Bordas lavadas | Paleta explicitamente sRGB, decodificação exata para iluminação linear e uma conversão na saída. Ambiente refletido recalibrado para bordas prata azul-pálido. | `app/loja/store-glass-shader.ts:54` |
| 2. Reflexo e mancha central | Removido o piso de 30% do reflexo. Fresnel e transmissão têm pesos separados na composição alpha; flags não aumentam a opacidade do centro. Alpha central aproximado: 0,138. | `app/loja/store-glass-shader.ts:123`, `:140` |
| 3. Corpo e textura | Microgradiente analítico por fragmento com ondas suavemente distorcidas, mais ondulações pálidas no ambiente transmitido. Silhueta ampla preservada. | `app/loja/store-glass-shader.ts:62`, `:101` |
| 4. Transmissão | Ambiente quase branco independente do ambiente de reflexos. O título continua sobre a gota. Não foi implementada captura ou refração do DOM. | `app/loja/store-glass-shader.ts:99` |
| 5. Trabalho invisível no celular | Renderização pausa quando o hero sai da tela no layout até 760px; retoma quando retorna. Pausas por diálogo, aba oculta e indisponibilidade continuam. Scroll durante pausa não acumula impulso para reproduzir na volta. | `app/loja/store-orb-policy.ts:15`, `app/loja/store-orb.tsx:171`, `:199` |
| 6. Escritas globais por frame | Removidos `data-scrolled`, `--scroll-progress` e variáveis globais do deslocamento da gota. Transformação aplicada ao elemento da gota; cache evita estilos idênticos. | `app/loja/use-store-motion.ts` |
| 7. Entrada dos cards | Opacidade e deslocamento dependem do avanço real no viewport. O observador mantém uma margem de preparação, mas essa margem não dispara um temporizador de entrada. Movimento reduzido e foco mantêm conteúdo visível. | `app/loja/use-store-motion.ts`, `app/loja/loja.module.css` |
| 8. Hover dividido | Texto, brilho, inclinação e cursor usam o mesmo estado `data-hovered`; scroll refaz a identificação do card sob o ponteiro. Foco por teclado e fallback sem JS preservados. | `app/loja/use-store-motion.ts`, `app/loja/loja.module.css` |

Constantes de cor lineares não são por si só um erro: a correção torna explícito que esta paleta foi escolhida em sRGB. Referência técnica: [gerenciamento de cores do Three.js](https://threejs.org/manual/pages/color-management.html).

## Evidência no navegador

Testes locais no navegador Chromium integrado, desktop 1014 × 708 e viewport móvel 390 × 844. Movimento normal e reduzido simulados somente na aba, sem alterar as preferências do Mac. Emulação e instrumentação removidas ao concluir.

- WebGL compilou sem erros; nova captura estática salva após recarregar a página.
- Contagem temporária de chamadas `WebGL2RenderingContext.drawElements`, em janelas de 700 ms:
  - Mobile, hero visível: 42 chamadas.
  - Mobile, scroll de 500px e hero fora da tela: 0 chamadas.
  - Retorno ao topo: 42 chamadas.
  - Movimento reduzido, após renderizar o quadro estático: 0 chamadas.
  - Diálogo de produto aberto: 0 chamadas.
  - Desktop, movimento normal: 42 chamadas e 0 mutações do atributo `style` na raiz da loja.
- Mouse mantido em (744, 601): hover do Caderno orbital no topo; nenhum card após scroll de 450px; hover do Pôster de trajetória após scroll de 700px. O estado coincidiu com o elemento sob o ponteiro.
- Entrada do pôster: opacidade 0,1738 em scroll 450px e 1 em 700px; demais cards abaixo da tela continuaram com 0.
- Perda de contexto: SVG de fallback ativado. Restauração: WebGL voltou a `ready=true` e `running`.
- Produto e aviso de lançamento: Esc fechou após a transição e devolveu o foco ao botão de origem. Menu móvel: abriu, fechou com Esc e devolveu o foco a “Abrir menu”.
- Mobile: sem transbordamento horizontal.
- Após recarregar a versão final: nenhum erro de console capturado.
- Preferência nativa verificada ao terminar: `prefers-reduced-motion: reduce` ativo. Por isso a prévia normal neste Mac permanece estática por acessibilidade.

As contagens confirmam suspensão de chamadas de desenho, não uma medição de consumo da GPU, FPS sustentado ou economia de bateria. Não houve teste em celular físico, monitor de 120Hz ou Safari. A auditoria original não havia confirmado visualmente os defeitos 7 e 8; aqui foram ajustados os mecanismos e testado o comportamento resultante, sem converter as hipóteses anteriores em fatos retroativos. Não se afirma equivalência pixel a pixel à referência.

## Verificações do projeto

- `npm run typecheck`: passou.
- `npm run build`: passou; bundle de produção contém a última versão das ondulações ópticas.
- `npm run lint`: 0 erros; 1 aviso em `components/gallery/gallery-admin.tsx:94`, fora dos arquivos alterados.
- `node --test tests/gallery-store.test.mjs tests/store-orb-policy.test.mjs`: 7/7 passaram.
- `npm test`: 106/122 passaram; 16 falhas em testes de outras áreas não alteradas nesta tarefa. Não considerar a suíte geral verde.

Falhas gerais: dois testes de hero automático; confirmação de inscrição; webhook de planilha; três verificações de rotas/hashes/landing; oito verificações de Energy Support; tratamento de indisponibilidade de banco/Sheets. Essas áreas não foram modificadas para fazer a suíte passar.

## Capturas e entrega

- Desktop: `/Users/viniciusbrigido/.codex/visualizations/2026/09/26/01a0dfa2-59d4-7b02-9565-ae360fec7e49/loja-glass-corrigido-28-09.png`
- Mobile: `/Users/viniciusbrigido/.codex/visualizations/2026/09/26/01a0dfa2-59d4-7b02-9565-ae360fec7e49/loja-mobile-28-09.png`
- Prévia local: `http://127.0.0.1:3001/loja`.

O pacote anterior `loja-fontes-para-auditoria.md` foi preservado como retrato dos fontes auditados; ele não representa estas correções posteriores. Nenhum arquivo de credenciais foi copiado, nenhuma preferência do sistema foi alterada e nada foi publicado.
