# Teste local: Terra e Radar

Data: 23/10/2026. Base: `19e1df9`. Branch: `feat/earth-radar-local-20261023`.

Pedido: experimentar no projeto a direção visual dos arquivos recebidos, apenas no localhost. Não publicar, fazer push ou deploy.

Revisão mais recente: a abertura agora reutiliza a Terra em 3D do Make It Fly. O movimento é da câmera e do globo; a cena ocupa a tela inteira sem redução de moldura. A fotografia recebida fica como imagem de carregamento e reserva. Os testes e as prévias solicitados pelo usuário devem ocorrer somente no navegador integrado do Codex.

## Direção implementada

Os dois HTMLs recebidos são idênticos, assim como as duas imagens. O protótipo foi adaptado para componentes React e CSS Modules na aplicação `make-it-fly-current`, que atende a home Apogee. O prompt de continuidade anexado foi tratado como contexto; prevalece a autorização atual para implementar.

- Abertura somente com a fotografia da Terra; a rolagem reduz a imagem e revela “Seu próximo salto.” e a navegação.
- Paleta: noite `#06162c`, noite suave `#0d2440`, texto `#101b2c`, papel `#f7f9fa`, céu `#dceaf3`, texto secundário `#637083`.
- Tipografia Inter já hospedada no projeto, sem serifa. Conteúdo alinhado à esquerda, largura máxima de 1240 px.
- Radar com busca sem acentos, categorias, estado vazio, contagem e salvas persistidas no navegador. Controles do protótipo têm área mínima de 44 px.
- Superfícies empilhadas de retenção, comunidade e oferta ao final, seguindo o HTML fornecido.
- Links locais existentes para Blog, Galeria, Make It Fly, acesso e catálogo. Nenhum checkout ou formulário é enviado pelo experimento.
- Movimento reduzido transforma a introdução em conteúdo estático e remove o empilhamento fixo. Navegação e link de introdução invisíveis ficam fora da interação por teclado.

A amostra preserva os títulos recebidos, mas identifica prazos, filtros e disponibilidade como demonstração. Não há alegação de 1.070 oportunidades ou contagens de novidades reais. Categorias e condições dos exemplos não foram auditadas novamente; não usar esta amostra para decidir inscrições. O modo de retorno com novidades reais e a conexão ao catálogo aguardam a aprovação visual.

## Ativação

A condição em `app/page.tsx` exige simultaneamente `NODE_ENV=development` e `APOGEE_LOCAL_DESIGN=earth-radar`. A home anterior permanece como padrão e em produção. Nenhum arquivo de ambiente real foi copiado; o teste não precisa de banco ou credenciais.

O servidor está em `http://localhost:3000`, vinculado a `127.0.0.1`. Iniciado em `make-it-fly-current` com:

```sh
APOGEE_LOCAL_DESIGN=earth-radar APOGEE_LOCAL_PREVIEW=1 python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command ./node_modules/.bin/next dev --webpack --hostname 127.0.0.1 --port 3000
```

As dependências foram reutilizadas por um link local para o `node_modules` do checkout `loja-drops-20261020/make-it-fly-current`, sem instalação. Em outro ambiente, instalar as dependências conforme o lockfile, sempre respeitando a fila. O servidor contínuo ocupa a fila até que o usuário autorize encerrá-lo. Não iniciar outro build/teste pesado enquanto ele estiver ativo.

## Verificação realizada

Antes de iniciar o servidor, sequencialmente pela fila:

- ESLint nos dois módulos TypeScript e na página alterada: aprovado.
- `next typegen --webpack`: aprovado.
- `tsc --noEmit --incremental false`: aprovado.
- `git diff --check`: aprovado.

No navegador local:

- Resposta em `localhost:3000`, carregamento da imagem, abertura e revelação no desktop e celular.
- Busca `amazonia` encontra Amazônia; categoria Competições retorna três exemplos; consulta inexistente oferece limpar filtros.
- Salvar, filtrar salvas, recarregar e remover: aprovado; armazenamento bloqueado mantém interação em memória.
- Sem rolagem horizontal nas telas 320×640, 390×844, 768×1024, 844×390 e 1440×900.
- Preferência por movimento reduzido: conteúdo visível sem transformação ou empilhamento fixo.
- Teclado: primeiro Tab exibe o link de pular conteúdo com foco visível, Enter foca `experiencia`.
- Console final sem erros.

As capturas estão na pasta de visualizações deste chat, com nomes `earth-radar-desktop-*` e `earth-radar-mobile-*`. O Next.js atualizou automaticamente o nível do título de seu bloco em `make-it-fly-current/AGENTS.md`.

Não foram executados build de produção, serviços remotos, migrações, envios de formulário, compras, push ou deploy. Responsividade foi verificada por simulação de viewport; aparelho físico ainda não foi testado.

## Ajuste de ritmo solicitado em 23/10/2026

- Introdução com altura de três telas (`300svh`), antes `210vh` no desktop e `210svh` no celular. O trecho efetivo de encolhimento passou de aproximadamente 73% para 152% de uma altura de tela, pouco mais do dobro.
- Terra e texto usam uma curva suave com velocidade inicial e final nula. O texto aparece entre 50% e 92% da rolagem da introdução, com deslocamento vertical reduzido de 34 para 20 px.
- Verificação desta iteração no servidor existente, sem reiniciá-lo: amostras de oito posições de rolagem no desktop 1440×900 e celular 390×844 confirmam encolhimento progressivo, opacidade de 0 a 1 e link disponível ao final. Sem rolagem horizontal ou erros de execução. Movimento reduzido preservado; `git diff --check` aprovado.
- Capturas: `earth-radar-slower-1440.png` e `earth-radar-slower-390.png` na pasta de visualizações deste chat. Nenhum push ou deploy.

### Entrada do texto antecipada

A pedido do usuário, o início da entrada foi antecipado de 50% para 42% da rolagem da introdução. A duração da transição continua em 42 pontos percentuais: o texto fica totalmente visível aos 84%, antes de a Terra terminar de encolher aos 88%. O ritmo da Terra e a curva suave do texto foram preservados.

Verificado no localhost em 1440×900 e 390×844: texto invisível no início, opacidade gradual durante o encolhimento, visibilidade completa ao final e modo de movimento reduzido preservado. Nenhum erro de execução. Capturas `earth-radar-earlier-copy-1440.png` e `earth-radar-earlier-copy-390.png`. Sem push ou deploy.

## Movimento do planeta, baseado no Make It Fly

O usuário corrigiu a referência: o planeta deve se mover, em vez de uma moldura contendo sua fotografia. O experimento passou a reutilizar `components/hero/EarthCanvas.tsx`, incluindo esfera, texturas, atmosfera, luz e rotação existentes. Foi adicionada uma trajetória opcional de câmera, mantendo a trajetória padrão do Make It Fly. A prévia utiliza os primeiros 70% de `sampleApogee` para sair do horizonte próximo e terminar com o globo menor acima do texto. A introdução lenta e a entrada antecipada do texto permanecem.

`EarthRadarScene` carrega a cena apenas no cliente, mostra a fotografia até a primeira renderização e mantém essa reserva sem WebGL ou com movimento reduzido. A renderização 3D é sob demanda e fica suspensa quando a introdução está fora da tela ou o documento está oculto. Os estilos não animam dimensões, bordas ou transformações do contêiner.

Verificado antes da orientação de usar exclusivamente o navegador integrado: desktop 1440×900 e celular 390×844, afastamento da câmera, deslocamento do centro do globo, redução do diâmetro e retorno exato ao percorrer o scroll ao contrário. Contêiner fixo em toda a área de 100%×100svh, sem bordas arredondadas. Rota Make It Fly continua carregando a cena com a câmera padrão. Sem erros de execução na home. Foram simulados WebGL indisponível e alternância da preferência de movimento reduzido; ambos mantêm conteúdo visível e recuperam a cena quando aplicável. Avisos preexistentes sobre fontes e depreciação de `THREE.Clock` permanecem.

Capturas `earth-radar-globe-desktop-*` e `earth-radar-globe-mobile-*` na pasta de visualizações deste chat. Nenhum push ou deploy. O Google Flow foi autorizado para novos materiais se necessários; esta correção reutiliza a cena 3D existente e não exigiu gerar imagens ou vídeos. Após a orientação do usuário, qualquer interação de navegador passa a ocorrer somente no navegador integrado do Codex.

Após uma interrupção, foi confirmado que o servidor havia encerrado. Antes de reiniciá-lo, com a fila livre, ESLint nos três módulos TypeScript alterados e `tsc --noEmit --incremental false` passaram, sequencialmente. O servidor foi reaberto com o mesmo comando local.

Na conferência do navegador integrado, a aba sinalizava movimento reduzido e mostrava corretamente a reserva estática. Para permitir o teste solicitado, foi configurada somente nessa aba a simulação `prefers-reduced-motion: no-preference`, via controle de desenvolvimento do navegador. Nenhuma configuração do macOS ou do navegador externo foi alterada. A cena ficou pronta com um único canvas; ao rolar, a câmera afastou de 1,428 para 6,678 e o diâmetro aparente da Terra caiu de 1,75 para 0,2702 da largura, mantendo o contêiner em 1280 px e raio de borda zero. Captura `earth-radar-globe-in-app.png`; aba deixada no início para o usuário testar.
