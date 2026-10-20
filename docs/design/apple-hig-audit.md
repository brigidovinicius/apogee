# Apogee - auditoria e ajustes pelas Human Interface Guidelines

Data: 20/10/2026. Branch local: `feat/apple-hig-audit-20261020`.

## Objetivo e referência

Aplicar os princípios das [Human Interface Guidelines - Collaboration and sharing](https://developer.apple.com/design/human-interface-guidelines/collaboration-and-sharing), com apoio das orientações de [botões](https://developer.apple.com/design/human-interface-guidelines/buttons) e [acessibilidade](https://developer.apple.com/design/human-interface-guidelines/accessibility). A página indicada descreve um padrão de interação, não um tema visual para copiar.

A tradução para a web mantém a identidade Apogee: marinho `#07182d`, azul-claro `#b9d3ee`, branco, títulos em Instrument Serif, texto em Inter, linguagem editorial e comunidade como tema central. O botão verde de acesso vitalício, seu destino e o preço foram preservados.

## Achados e implementação

| Achado | Ajuste | Evidência |
| --- | --- | --- |
| Três ações com o mesmo preenchimento verde competiam na abertura. | Compra mantém o destaque verde; explorar o Radar recebe contorno; comunidade vira link de apoio com área de toque de 44 px. | Cores, altura e destinos conferidos no navegador. |
| Título consumia quase toda a primeira dobra no desktop. | Escala editorial mais contida, contexto da comunidade antes do título e menor intervalo entre título e ações. | Captura desktop e medições de largura. |
| Estado atual da navegação dependia apenas da cor. | Sublinhado e peso na página atual; estado mobile também sublinhado. | `aria-current` existente preservado; estado visual inspecionado. |
| Faltava um ponto claro para compartilhar conteúdo público. | Componente reutilizável no cabeçalho do Radar, junto à abertura dos artigos e na galeria. Usa a folha nativa quando disponível. | Seis testes comportamentais e testes no navegador. |
| Navegadores sem compartilhamento nativo precisavam de alternativa. | Copiar link com confirmação persistente; se a área de transferência falhar, exibir campo selecionável e instrução de recuperação. | Cópia e negação simuladas, sem envio externo. |
| Compartilhar a URL atual poderia carregar parâmetros desnecessários. | Os chamadores fornecem caminhos públicos canônicos. Não se usa `location.href`, não se copiam convites, filtros ou dados de sessão. | URL de teste com `?convite=never-share-this` produziu somente `https://www.apogee.community/oportunidades`. |
| Ações precisavam preservar previsibilidade durante espera/cancelamento. | Bloqueio de ativação repetida; cancelamento nativo silencioso; nenhuma mensagem afirma entrega a terceiros. | Testes de concorrência, cancelamento e falha nativa. |
| Cartões muito planos e coluna de benefício estreita. | Cantos suaves, borda discreta e maior largura para o benefício na prévia da homepage. | Quatro cartões fictícios renderizados com os componentes reais. |
| Tratamento de controles precisava ser consistente. | Tokens de cantos compartilhados, altura mínima de 44 px para botões e campos aplicáveis, feedback de pressionamento, campos de 16 px em telas pequenas e movimento reduzido no escopo Apogee. | Nenhum botão/summary visível abaixo de 44 px nas telas públicas verificadas; busca com 16 px em 320/390 px. |

Os ajustes usam os componentes e o escopo `data-apogee-design` existentes. Não há nova infraestrutura de colaboração, permissões de edição ou comunicação automática. O texto junto ao botão explica que ele compartilha o link público. Autenticação, pagamento, publicação, dados e autorização continuam no servidor.

## Escopo preservado

`/makeitfly` e todos os descendentes continuam excluídos pelo `design-scope.mjs`. Nenhum arquivo de `app/makeitfly`, `components/hero` ou `app/globals.css` foi alterado. No navegador, o evento e a participação retornaram `theme: false` em todas as quatro larguras verificadas. O link do Make It Fly na homepage permanece disponível.

## Validação local

Todas as tarefas Node de projeto foram executadas em sequência pela fila FIFO global. Nenhuma dependência foi instalada ou atualizada.

- ESLint completo: **zero erros**, um aviso já existente de `<img>` em `components/gallery/gallery-admin.tsx:81`.
- TypeScript: **passou** (`tsc --noEmit --incremental false`).
- Build de produção: **passou** (`next build --webpack`), incluindo as rotas públicas, de membros e administrativas.
- Suíte completa: **422 testes; 379 passaram e 43 falharam**. Os seis testes novos de compartilhamento passaram.
- As 43 falhas pertencem às regressões de dependências: `brace-expansion` (18), `braces` (14), MCP OAuth (8) e `proxy-addr` (3). O `node_modules` deste checkout é um symlink para o worktree `stripe-radar-lifetime-20261020`; os testes, scripts e lockfile dessas dependências não têm alterações nesta entrega. A instalação compartilhada não foi corrigida nesta auditoria. **Não há suíte integral verde.**
- `git diff --check`: **passou**.

No navegador, foram verificadas oito rotas em **320, 390, 768 e 1440 px** (32 combinações): homepage, Radar, galeria, loja, entrada, cadastro, evento e participação. Não houve overflow horizontal. **Entrada e cadastro exibiram a recuperação de erro**, por ausência de autenticação/banco locais operacionais; as medições dessas duas rotas correspondem ao estado de erro, não aos formulários.

As verificações funcionais locais confirmaram:

- menu mobile fecha com Escape e devolve foco ao acionador, cuja altura é 44 px;
- Tab revela “Pular para o conteúdo”; Enter leva o foco a `#experiencia` na homepage;
- filtro “Eventos e comunidades” exibe somente as duas amostras dessa categoria;
- preferência por movimento reduzido deixa as revelações sem transformação nem transição;
- compartilhamento copia apenas a URL pública; negação da área de transferência oferece um campo de 47,59 px, com seleção integral ao receber foco;
- cancelamento da folha nativa não mostra erro nem mantém o campo de recuperação;
- os cenários de folha nativa foram simulados: nenhum contato recebeu conteúdo, e nenhuma entrega externa foi realizada.

## Preview e limitações

Preview: <http://127.0.0.1:3113/>. Radar: <http://127.0.0.1:3113/oportunidades>.

O servidor usa somente loopback. O Radar recebe quatro exemplos explicitamente identificados como **dados fictícios de revisão**, por um serviço auxiliar em `127.0.0.1:3114`. Não são oportunidades reais. A galeria exibe indisponibilidade de fotos, pois não há banco conectado. O preview não serve como evidência de conteúdo de produção ou disponibilidade da autenticação.

Artigos e áreas autenticadas tiveram análise de código e compilação; não houve sessão autenticada, leitura de banco real, publicação, upload, inscrição, compra ou envio. O artigo público recebeu a integração do mesmo componente de compartilhamento testado, mas o fluxo de artigo com dados reais não foi exercitado localmente. Isso não constitui certificação de acessibilidade ou conformidade integral com todas as HIG.

Capturas desktop disponíveis em `/private/tmp/apogee-hig-before-desktop.png` e `/private/tmp/apogee-hig-after-desktop.png`. A captura mobile pelo navegador excedeu o tempo limite; as medições e os testes de interação mobile concluíram separadamente.

O preview iniciado nesta auditoria permanece ativo e ocupa a fila enquanto estiver rodando. Não houve push, PR, merge, deploy ou publicação hospedada.


## Complemento autorizado para publicação em 20/10/2026

O usuário autorizou o deploy e determinou ausência de emojis e travessões e consistência global. A revisão passa a usar os mesmos tokens de cantos, controles, cores e tipografia no Radar, blog, galeria, loja, membros e administração. O verde aprovado continua reservado à ação principal da abertura.

Setas e marcas decorativas dependentes da fonte foram substituídas por vetores. A marca vetorial usa o desenho da estrela Apogee. Textos estáticos de todas as telas ativas, inclusive rótulos acessíveis do evento, foram normalizados. O Make It Fly recebeu apenas ajustes textuais e de ícones; CSS, fontes próprias, Terra e animações permanecem preservados. O arquivo de backup publicado permanece arquivado e inalterado.

Textos de exibição do Radar, artigos, fórum, perfis e créditos da galeria usam `interfaceText`. A função remove sequências completas de emoji e troca os dois tipos de traço longo por hífen simples. IDs, URLs, nomes de usuário, formulários editáveis e registros persistidos continuam originais. A formatação financeira acontece antes da divisão do texto em destaques, preservando espaços e valores.

A revisão incorpora a main que contém a correção de verificação do cadastro e o deploy parte da revisão saudável `34eb8fc82422daa7e79c43efedcb4d4567d2cbf0`. As evidências de validação e publicação finais serão registradas no runbook. Os resultados da seção anterior descrevem a primeira auditoria local, antes deste complemento.


Validação local final do complemento: tipos aprovados, 373 testes da aplicação aprovados, lint sem erros (um aviso já existente de imagem em `gallery-admin.tsx:82`) e build de produção aprovado. As quatro suítes de regressão de dependências usam a instalação limpa do CI como gate separado. Os carregadores de testes foram atualizados para importar a função real de apresentação e a marca vetorial real, preservando as asserções funcionais. As novas referências de hash mudam apenas rótulos, metadados textuais e o ícone vetorial autorizado; os hashes de estilos e cenas do evento continuam intactos.


## Resultado em produção

Publicado o SHA `0fc00e3e7deaf1eeee44bb1e3fd9403dd7d44129`, com PR 80 integrada, CI completo aprovado e 425 testes do site aprovados. Web saudável e sem reinícios; os demais 12 containers foram preservados. As medições públicas, a captura e os limites estão no [registro do deploy](../apogee-routine-vps-deploy.md#publicação-da-interface-e-compartilhamento-em-20102026) e no [JSON de evidências](../evidence/apple-hig/production-validation.json). Este resultado substitui o limite de entrega local da primeira etapa.
