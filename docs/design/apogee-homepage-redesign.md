# Homepage Apogee — implementação local

## Resultado e escopo

Branch `feat/homepage-offfforum-20261016`, baseline `bb82cafc3595c8b8ef8157699cbd354435411762`, repositório `brigidovinicius/apogee`. A aplicação é `make-it-fly-current/`. O checkout legível desta tarefa está em `/private/tmp/apogee-homepage-20261016-01a14716`; o pacote e o patch entregues em outputs permitem preservar/revisar o trabalho.

A nova homepage tem hero editorial com acesso ao Radar, prévia por categorias, comunidade, Make It Fly e convite ao cadastro existente. `/home-robonauta` continua usando a composição anterior. Navegação, área de membros, sessões, APIs, integrações e pagamentos não foram redesenhados. O fragmento existente /#encontros foi preservado no bloco Make It Fly.

## Marca e direção

Manual V2 local consultado; cores oficiais navy #07182D, black #0A0A0A, white #FFFFFF e sky #B9D3EE. Lockups e geometria da estrela foram preservados. A marca Make It Fly é apresentada em branco por filtro cromático uniforme, sem editar o arquivo original. O manual especifica GFS Didot; a base existente já usa Instrument Serif/Inter e foi preservada, sem baixar fontes da referência.

Skill de design: direção `type-only-statement` / Type and nothing else, seed `1596753458`. Ideia: o ponto mais alto expresso pelo nome Apogee vira o convite “Seu próximo salto.” A interação principal é escolher uma categoria da prévia real do Radar.

Adaptações justificadas: a navegação completa e o rodapé existentes foram preservados por requisito do usuário; o showcase passou a ser um catálogo real, em vez do exemplo de input tipográfico do blueprint. Foram usados somente assets próprios e a galeria existente, que retornou uma foto pública; não foram adicionadas imagens de estoque para atingir uma contagem artificial. Títulos reais de oportunidades podem ultrapassar duas linhas no celular para manter o conteúdo legível. O relatório do inspetor distingue essas escolhas de problemas funcionais.

Revisão visual interna: a primeira rodada mostrou hero móvel com espaço excessivo e marca Make It Fly sem contraste; ambos foram corrigidos. A versão final mantém duas linhas no H1 em 320/390/768/1440 px e dá mais área à tipografia. Avaliação interna, subjetiva: design 7,5; usabilidade 8; criatividade 7; conteúdo 8; ponderação 7,6/10. Não é nota de júri independente.

## Componentes e arquivos

| Arquivo | Mudança |
| --- | --- |
| `app/page.tsx` | Nova composição, descrição e renderização dinâmica para não congelar um fallback do Radar durante build. Canonical e JSON-LD preservados. |
| `components/home/editorial-home.tsx` + CSS | Hero, narrativa, seções, CTAs e layout responsivo isolados da área de membros. |
| `components/home/home-motion.tsx` | Revelação progressiva, preferência reduzida, pausa, suspensão com aba oculta e conteúdo visível sem a biblioteca. |
| `components/home/home-radar.tsx` | Leitura servidor do catálogo existente, com Suspense e fallback explícito. |
| `components/home/home-radar-list.tsx` | Categorias interativas; links normais de fallback; revalidação temporal a cada 30 s e ao mudar visibilidade. |
| `lib/home-opportunities.ts` | Seleção exclusiva da homepage; preserva ordem relativa nos grupos e não muda regras do serviço Radar. |
| `components/home/home-gallery.tsx` | Hook e URLs existentes, crédito e estados de carregamento/erro/vazio. |
| `components/site/site-header.tsx` | Prop opcional de prefetch; apenas a nova home a desativa. Demais páginas mantêm o comportamento anterior. |
| `tests/home-opportunities.test.mjs` | Fronteiras de prazo exato, fuso brasileiro, eventos com prazo desconhecido, inscrições futuras e seleção não mutante. |
| `tests/site-shell.test.mjs`, `tests/seo.test.mjs` | Integração e mock ajustados ao novo componente, preservando verificações de navegação/SEO. |

Nenhuma dependência de produção adicionada. Framer Motion é reutilizado; GSAP não foi incluído. Para poupar disco, node_modules foi ligado à instalação existente e as versões centrais foram conferidas contra o lockfile. Não foi declarado sucesso de um npm ci novo.

## Dados, validade e degradação

O catálogo vem de `listPublicOpportunities()`. A seleção destaca categorias competições/eventos e tipos já estruturados; não recategoriza por palavras nem altera o algoritmo do Radar. Datas exatas vencem no instante correto; datas sem horário usam São Paulo; eventos passados com prazo desconhecido e inscrições futuras ficam fora da prévia. Benefícios são apresentados como fornecidos, sem converter custos em dinheiro recebido.

Os testes visuais usaram replay local de 1.095 registros completos do catálogo já público, dentre 1.180 extraídos do HTML. Foram excluídos do replay registros que dependiam de referências Flight ainda não resolvidas; isso não altera o código nem o catálogo de produção. O adapter de teste é temporário, local e não foi incluído na aplicação. A galeria foi respondida no browser com o payload público e a imagem da URL original. Não foram inventadas oportunidades ou pessoas.

O funcionamento da aplicação com o serviço indisponível foi testado separadamente. Autenticação real, cadastro, assinatura e acesso ao banco de produção não foram exercitados nem alterados.

## Validação

- Lint: sem erros, com um aviso preexistente de img em gallery-admin.tsx.
- Typegen e TypeScript: passaram.
- Testes: 263/263, zero falhas ou ignorados.
- Build de produção: passou.
- Chromium: 1440, 768, 390 e 320 px, sem overflow; nenhum canvas na nova home.
- Menu móvel, categorias, skip link por teclado, pausa, reduced motion e fallback de erro: passaram; zero erros JavaScript de página. Uma medição direta separada confirmou 13 elementos com animação real, com reduced-motion=false.
- Sem JavaScript: H1 e CTA de acesso ao Radar legíveis/operáveis; menu usa details nativo. O controle de movimento é ocultado nesse modo.
- Laboratório local mobile: LCP 980 ms, CLS 0; 384.173 bytes de recursos na amostra, TTFB 8,3 ms. Foi solicitado CPU 4× e rede limitada por CDP, mas o TTFB é de loopback. Não extrapolar para uma rede móvel real nem tratar como CWV de campo. INP de campo e experiência em aparelho físico permanecem pendentes.
- Contraste: texto principal navy/white ou navy/sky, com superfícies discretas e foco visível. A validação automatizada de design está registrada no pacote de evidências; não é uma auditoria WCAG completa.

## Limites e publicação

A posição da janela na Mesa 2 não foi confirmada pelas ferramentas disponíveis; capturas reproduzíveis foram feitas em Chromium isolado headless. Safari, aparelhos reais e Core Web Vitals em produção não foram medidos. A versão pública da referência é um teaser 2027, não todas as telas mostradas no Awwwards.

Não houve push, PR, merge, deploy, alterações de banco, DNS, autenticação ou pagamentos. O trabalho está pronto para revisão local; publicação continua sendo um gate separado.

## Resultado do inspetor de design

O gate genérico foi executado, mas **não passou integralmente**. Seus alertas não foram ocultados nem convertidos em aprovação:

- `few-pictures`: contou duas imagens próprias; a galeria local estava sem banco nesse gate. A rodada funcional com payload público exibiu também a foto real. Não foram adicionadas fotos de estoque para preencher uma quota.
- `no-footage`: não há vídeo automático. A página usa movimento em elementos e no retrato durante scroll, mantendo o carregamento leve.
- `still-page`: o inspetor não registrou o movimento nessa captura. O teste direto, com preferência normal explicitada e observação de animações/estilos durante scroll, mediu 13 elementos; a evidência está em motion-check.json. A divergência do instrumento permanece documentada.
- `shadow`/`outlined-box`: estilos do menu nativo compartilhado. O menu é uma superfície flutuante e seus controles conservam os padrões existentes, sem uma alteração transversal na área de membros.
- `eyebrow`: o texto de endosso “Um encontro da Apogee Builders Club.” foi detectado como rótulo antes do heading no mobile. Sua presença mantém a relação entre marca e evento definida no manual.

O resultado bruto do inspetor e as capturas estão no pacote. A aprovação estética final continua dependendo da revisão humana. Não se declara conformidade WCAG integral ou equivalência estética certificada ao Awwwards.

## Revisão mobile complementar

A revisão posterior corrigiu fechamento por Escape/toque externo/foco/seleção, rolagem do menu em paisagem e contraste do hover mobile. A implementação está no componente cliente SiteMobileNavigation, preservando o restante do header no servidor. Veja homepage-mobile-review.md para evidências, validações e limites do preview sem banco.

## Remoção do Robonauta após revisão

A pedido do usuário, o Robonauta foi removido da nova homepage: imagem, legenda e animação específica saíram. A seção de comunidade passou a usar uma única coluna, com a foto ocupando a largura disponível. A rota histórica /home-robonauta e seus assets não foram alterados. Capturas e validação posteriores da homepage sem o mascote substituem as capturas da versão anterior nos arquivos mobile-*.png.
