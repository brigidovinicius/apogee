# Sistema visual da Apogee

A interface do site e da plataforma compartilha a folha `public/design-system/apogee.css`, carregada pelo contêiner de interface da rota. Use os atributos abaixo no elemento semântico que já executa a ação. O mesmo botão pode ser um link de navegação ou um botão de formulário.

| Elemento | Contrato |
| --- | --- |
| Ação principal | `data-ap-button="primary"`. Marinho, aresta iluminada e rótulo claro. |
| Ação secundária | `data-ap-button="secondary"`. Superfície translúcida, borda e rótulo do tema. |
| Filtro | `data-ap-chip`. O controle define seu estado com `aria-pressed`. |
| Card e painel | `data-ap-card` para conteúdo. `data-ap-panel` para uma superfície sobreposta, como menu ou filtros. |
| Seção | `data-ap-section` para a superfície principal ou `data-ap-section="tonal"` para a alternada. Preserve o grid, a ordem e os pontos de quebra da página. |
| Título | `data-ap-title` para títulos de interface. Inter local, peso intermediário e espaçamento óptico. Preserve a hierarquia de cabeçalhos. |
| Assinatura | `data-ap-signature` no elemento existente de “Building the future.”. GFS Didot local, azul-claro e um único deslocamento de luz na entrada. A quebra de linha pertence à composição editorial. |
| Ícone de recurso | `data-ap-icon="ferramentas|learn|radar|perks|participar"`. Um objeto por recurso, com o mesmo ângulo, luz e escala. Use em um elemento que já tem rótulo textual. Ações pequenas e navegação usam ícones lineares, traço de 1,5 a 1,75 px. |
| Card de recurso de membros | `data-ap-card="resource"` com `data-ap-icon` seleciona o render do recurso. Título, descrição e link continuam em HTML. A moldura, a iluminação e a linha de ação são as mesmas para todos. |
| Abertura do Radar | `data-ap-radar-hero` usa a antena do card Radar. A arte é decorativa e se ajusta ao espaço disponível para título e descrição. |
| Benefícios | `data-ap-benefits` identifica o catálogo público, a área de membros ou o detalhe da oferta. Os catálogos compartilham o passe 3D no cabeçalho, os controles de busca e as cores de texto do Radar. As marcas dos parceiros mantêm seu fundo de origem. |
| Caixa de Ferramentas | `data-ap-toolbox-studio="editorial"` e `"catalogue"` aplicam o mesmo estojo aberto à seção da Comunidade e ao cabeçalho de membros. A busca, as categorias e os links usam os tokens de foco, texto e ação do Radar. |
| Eventos em destaque da home | Os cards do carrossel usam o papel branco e a paleta editorial original da home nos dois temas. |
| Marca de integração | `data-ap-provider="chatgpt"` ou `data-ap-provider="claude"` no link identificado por texto. O mesmo render 3D acompanha a faixa pública e o guia de membros. |
| Movimento | `data-ap-reveal` no título de uma seção para deslocamento de até 10 px durante a entrada no viewport. O conteúdo já começa legível. |

## Temas, luz e estados

Use os tokens `--ap-canvas`, `--ap-section`, `--ap-surface`, `--ap-text`, `--ap-muted`, `--ap-line` e `--ap-accent` para novas superfícies. As famílias de botão e card usam os preenchimentos, bordas e sombras da mesma folha. No contêiner `data-ap-interface`, `data-ap-theme="sistema"` segue a preferência do dispositivo. Os valores `claro` e `escuro` permitem escolha explícita. Cores funcionais de erro, aprovação, prazos e alertas continuam ligadas a seus estados.

A altura mínima dos controles é 44 px. A ação pressionada, o foco de teclado e o estado de seleção têm tratamentos próprios. O acabamento de vidro pertence aos controles e painéis. Campos de leitura longa usam superfícies contínuas. Movimento reduzido desliga as animações do sistema e transparência reduzida torna os painéis opacos.

Em grupos de cards ilustrados no desktop, reserve duas linhas para o título e alinhe a divisória de acesso entre os cards. Na passagem do ponteiro, a miniatura sobe até 3 px e o card mantém sua posição. O filtro do Radar demonstra o movimento óptico de três segundos. A preferência por movimento reduzido seleciona a imagem estática.

A [prancha do Radar e dos recursos de membros](https://www.figma.com/design/SKTQ8K0Lr0OMGn0YeXcNX6/?node-id=23-220) reúne os dois temas e as peças de referência dos cards.

A [prancha de Benefícios](https://www.figma.com/design/SKTQ8K0Lr0OMGn0YeXcNX6/?node-id=24-2) mostra o catálogo público e o de membros nas duas aparências.

A [prancha da Caixa de Ferramentas](https://www.figma.com/design/SKTQ8K0Lr0OMGn0YeXcNX6/?node-id=26-2) reúne a seção pública e as abas Ferramentas e Skills nos dois temas.

O [arquivo de design no Figma](https://www.figma.com/design/SKTQ8K0Lr0OMGn0YeXcNX6/?node-id=18-47) contém os componentes e as coleções Apogee · Claro e Apogee · Escuro. Os nomes das variáveis seguem os tokens da folha global. A [prancha no Canva](https://www.canva.com/design/DAHbZLP0ovA/vTuoITpHaGPcURylzn46hA/edit) reúne as duas composições para revisão visual.

## Aplicação

```tsx
<section data-ap-section="tonal" aria-labelledby="recursos">
  <h2 id="recursos" data-ap-title data-ap-reveal>{tituloExistente}</h2>
  <a href={destinoExistente} data-ap-card data-ap-icon="radar">{nomeExistente}</a>
  <button type="button" data-ap-button="primary" onClick={acaoExistente}>{rotuloExistente}</button>
</section>
```

O contêiner de interface das páginas públicas e de membros carrega `apogee.css` e `interface.css` antes da primeira pintura. Os componentes públicos e de membros declaram seus papéis no próprio HTML. A folha `interface.css` integra esses papéis às superfícies editoriais existentes. Páginas novas usam os atributos diretamente. A barra de comparação funciona apenas na prévia de oferta em loopback. O site continua responsável pelas permissões, filtros, destinos e estados.

Ao alterar o padrão, revise um controle em claro, escuro, teclado e movimento reduzido, além da tela em largura de celular. Compare textos, links e ordem de leitura com a versão de usabilidade em andamento.
