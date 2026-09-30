# Make It Fly: publicação no domínio principal

Data: 12 de setembro de 2026.

## Correção de acesso público: verificação anônima concluída

O usuário relatou que uma pessoa externa recebia pedido de autorização, apesar das confirmações anteriores de publicação. A verificação anterior de READY/promoção/alias não era suficiente para afirmar acesso público.

- Reproduzido com uma requisição nova sem cookies, Authorization ou bypass: `https://makeitfly.vercel.app/` retornava 302 para `https://vercel.com/sso-api`.
- O deployment ativo era o correto e já estava promovido. A causa foi o cadastro do domínio: `makeitfly.vercel.app` existia somente como alias manual; a lista de domínios de produção do projeto continha apenas `rosa-maria-livro.vercel.app`, que respondia 200 anonimamente. O SSO estava em `all_except_custom_domains`.
- Correção restrita: `POST /v10/projects/prj_W1Y8q75sdzZILpBbKNGVnMCJMn0v/domains`, no time existente, com somente `{"name":"makeitfly.vercel.app"}`. Resposta 200, domínio verificado, sem branch e sem redirect. O CLI 50.5.2 rejeitou o argumento de projeto indicado em seu próprio help; a API oficial foi usada no lugar.
- Não houve novo build, mudança de código, criação de bypass, liberação de usuários, alteração global do SSO ou exclusão de históricos.
- Validação anônima após a correção: raiz 200 com HTML da Terra e faixa Red Bull, sem redirecionamento; `/partners/red-bull-can-white.png` 200; `/teste-terra` 404; hostname imutável do deployment continua 302 para SSO. A configuração SSO foi preservada.
- Para próximos deploys, manter `makeitfly.vercel.app` cadastrado nos domínios de produção do projeto. READY e alias por si só não comprovam acesso público: quando houver relato de bloqueio, reproduzir sem cookies/autenticação e verificar a classificação do domínio.

## Atualização vigente: página principal única e pública

Solicitação: publicar a versão aprovada na página principal, excluir outras páginas e deixar o acesso público.

- A landing aprovada com Terra contínua e faixa Red Bull agora está em `app/page.tsx`, servindo `/`. Nenhum componente visual, conteúdo, asset ou parâmetro da animação foi modificado nesta promoção.
- Layout e CSS aprovados foram consolidados em `app/layout.tsx` e `app/globals.css`, com fontes locais e caminhos relativos corrigidos. A raiz permite indexação e tem canonical `https://makeitfly.vercel.app/`.
- A página `/teste-terra` foi removida, sem redirecionamento ou outra versão pública dentro deste domínio. Rotas internas padrão de erro e arquivos estáticos continuam necessários ao framework e à apresentação.
- Build local e build Vercel confirmaram apenas `/` como página de conteúdo. O manifesto de rotas contém `/page`, os fallbacks internos e favicon.
- Conferência no navegador com build de produção local: raiz carregou a Terra automaticamente (`ready`), movimento acompanhou a rolagem, faixa Red Bull presente, robots `index, follow`, canonical correto; `/teste-terra` mostrou 404.
- Deployment: `dpl_5LDpg3HNayiSKhMJ74JNhB7pJDjw`, READY; URL imutável `https://rosa-maria-livro-juyjo0is9-brigidovinicius-projects.vercel.app`.
- Promoção de produção e associação explícita de `makeitfly.vercel.app` concluídas com sucesso. A API do domínio resolve esse deployment. Nenhuma proteção de segurança global foi desabilitada.
- Verificação final: 61/61 testes, lint, geração de tipos, tipagem e builds local/remoto aprovados.
- Backup anterior à promoção: deployment `dpl_DqNonMRqiCeD98rQEdGuWxMDTpm2`. Nenhum histórico de deployment foi excluído; arquivos legados não roteáveis continuam guardados para reversão.

Os links para `/teste-terra` nas seções históricas abaixo registram versões anteriores e não estão mais ativos no domínio principal.

## Histórico: destaque “Energizados por Red Bull”

Solicitação: dar destaque à lata e ao termo “Energizados por Red Bull” em uma seção, sem mudar muito a apresentação aprovada.

- Incluída uma faixa compacta no final de “A experiência”, antes do ticker, sem criar mais uma seção de tela inteira nem modificar a navegação. A lata ilustrada fornecida aparece maior, acompanhada do nome em Instrument Serif e do rótulo em Inter. Paleta azul-marinho, branco e azul claro mantida.
- Texto de apoio referencia o Energy Bar já previsto no conteúdo do evento. Não adiciona alegações de patrocínio oficial, certificação, exclusividade nem uma logo independente.
- `EnergySupport.tsx` e `energy-support.module.css` isolam a adição; a landing recebe apenas o import e a chamada do componente. Hero, rodapé, câmera, materiais e timeline da Terra não foram alterados. Os sete marcos continuam iguais; a geometria já se recalcula com a altura do conteúdo.
- QA local: 1280×720, 390×844 e 320×740. Lata carregada e proporcional, sem overflow horizontal. Espaço livre entre a faixa e o ticker: cerca de 62 px em desktop e 125 px no celular. Canvas único permanece `ready`.
- Geração de tipos, tipagem, lint e os 51 testes preexistentes passaram. Oito testes novos também passaram (59 no total), verificando o HTML, arte, posição, sete seções, 14 hashes da cena/hero/arte e a alteração mínima da landing. Build remoto aprovado. A página principal `/` continua preservada.
- Deployment: `dpl_DqNonMRqiCeD98rQEdGuWxMDTpm2`; URL imutável `https://rosa-maria-livro-qb0s9ld7a-brigidovinicius-projects.vercel.app`.
- Promoção e alias `makeitfly.vercel.app` concluídos com sucesso. Destaque em `https://makeitfly.vercel.app/teste-terra#energia`. Nenhuma proteção da Vercel foi alterada.

## Histórico: Terra por todas as seções

Solicitação: fazer a Terra percorrer todas as seções, de modo fluido, como a Lua na primeira versão.

- A cena 3D agora é única e persistente, em uma camada fixa acima dos fundos e abaixo do conteúdo. A página continua no fluxo normal, sem interceptar roda/toque e sem travar o topo.
- O percurso acompanha os offsets reais de Início, Experiência, Jornada, Programação, Manifesto, Quem conduz e Participar, mais o final do documento. Os marcos são recalculados quando o layout ou a janela mudam.
- Posição, distância da câmera, rotação e transparência mudam continuamente. O progresso é direto, sem spring atrasando a câmera em relação à rolagem; rolar de volta refaz o mesmo percurso.
- Mantidos o recorte inicial da Terra, tipografia, paleta, lata e “Energizados por Red Bull”. O planeta fica mais discreto nas seções claras. Nenhuma linha orbital ou botão novo foi acrescentado.
- O carregamento continua automático. O poster permanece somente no hero em caso de falha de WebGL ou modo de poucos recursos. A cena não pausa mais ao sair do topo; apenas com a aba oculta. Não foram alteradas preferências do sistema.
- QA local no navegador: desktop 1280×720 e celular 390×844, início automático confirmado, um canvas nas sete seções, rolagem normal e reversa, retorno ao topo em progresso zero, ausência de overflow horizontal no celular e ausência de erros de execução. Avisos preexistentes: preferência de movimento reduzido e depreciação de Three.Clock na dependência.
- Exemplos registrados no celular: Experiência 0.1666, Jornada 0.3015, Programação 0.4432, Manifesto 0.5962, Quem conduz 0.7332, Participar 0.8897. A cena permaneceu `ready` em todos.
- Validação: 51/51 testes, lint, geração de tipos e tipagem aprovados. Build Vercel concluído com `/` e `/teste-terra` estáticas; integridade da página principal preservada.
- Deployment: `dpl_FEu5nPQN6rMBEGYstZ9PDvEKatJN`, READY. URL imutável: `https://rosa-maria-livro-nfq8er5le-brigidovinicius-projects.vercel.app`.
- Promoção e associação explícita de `makeitfly.vercel.app` concluídas; teste disponível em `https://makeitfly.vercel.app/teste-terra`. Proteções de acesso não foram alteradas.
- Fonte e entrega sincronizadas em 14 arquivos, com SHA-256 idêntico. Nenhuma publicação anterior foi excluída.

## Histórico: início automático e remoção da data

Solicitação: após confirmar que o botão ativava corretamente a Terra, o usuário pediu ativação automática e retirada do botão e de “Setembro 2026”.

- A Terra agora monta automaticamente no cliente; não existe opt-in, controle de ativação/pausa nem bloqueio dessa cena pela preferência de movimento reduzido. Essa mudança é local à cena e foi solicitada explicitamente. Nenhuma configuração do navegador ou do sistema foi alterada.
- O efeito continua vinculado à rolagem, sem rotação infinita e sem prender a página. Poster e proteções para falha de WebGL/aparelhos com poucos recursos permanecem.
- Data removida da abertura, rodapé, chamada final e metadados de `/teste-terra`; a assinatura com lata, lettering e CTA foram mantidos. A tipografia e a paleta existentes foram preservadas, com ajuste pontual do alinhamento após remover os controles.
- Página `/` preservada; testes de integridade dos arquivos publicados continuam aprovados.
- Validação: 32/32 testes, lint e tipagem aprovados. A prévia local respondeu HTTP 200 e inicializou Three.js sem clique; a conferência visual não pôde ser concluída porque a conexão do navegador de teste ficou indisponível. O build no Vercel confirmou `/` e `/teste-terra` estáticas.
- Deployment desta etapa: `dpl_9RpcHWVJfp9ZUDhh9hcLc5UdRtmx`, READY; URL imutável `https://rosa-maria-livro-8kcbn2wii-brigidovinicius-projects.vercel.app`.
- Promoção de produção e associação de `makeitfly.vercel.app` concluídas com sucesso. Proteções do Vercel não foram alteradas.

As seções abaixo registram a preparação e a correção de acesso anteriores.

## Escopo

Publicar a implementação atual da Terra em `/teste-terra` para comparação fora do localhost, sem substituir a apresentação de `/` pela experiência nova. Esta publicação não é uma nova correção da animação e não comprova que o comportamento relatado pelo usuário foi resolvido.

## Isolamento

- `/`: conteúdo, layout, CSS e assets da versão publicada recuperada de `dpl_7zYo7vXKvP8fo9J7Ei2q2PQnGMUu`.
- `/teste-terra`: versão local com Terra, rolagem natural, tipografia revisada e lata com “Energizados por Red Bull”. Não indexável e sem link novo no menu principal.
- Root layouts separados em `app/(publicado)` e `app/(teste)`, sem root layout compartilhado. Folhas globais separadas; agrupamento automático de CSS desativado no webpack.
- Conteúdo e landing publicados ficam em `content/published-site.ts` e `components/published/`. Os únicos ajustes nesses arquivos e no layout publicado são caminhos de imports/fontes realocados.
- Assets/fontes já existentes foram preservados; as imagens da Terra e a lata usam caminhos adicionais.
- Os comandos de desenvolvimento, build e geração de tipos deste pacote usam webpack para respeitar a separação das folhas CSS.

## Teste pelo usuário

Abra ou recarregue `https://makeitfly.vercel.app/teste-terra` e role a página. A Terra carrega automaticamente, sem botão. O modo estático pode ser selecionado por indisponibilidade de WebGL ou capacidade reduzida do aparelho.

Não foram alteradas preferências globais de movimento ou segurança. O localhost original continua independente deste pacote de publicação.

## Recuperação

A publicação original permanece acessível pelo deployment imutável `https://rosa-maria-livro-ld5j3ewtq-brigidovinicius-projects.vercel.app`. Para remover a subpágina do domínio e retornar integralmente ao deployment anterior, o domínio `makeitfly.vercel.app` pode ser reassociado a esse deployment. Nenhuma publicação anterior foi excluída.

## Registro de publicação

Publicado em `https://makeitfly.vercel.app/teste-terra`.

- Deployment final: `dpl_8uLrXKNCmto7jChXfXF7G4wZjnvb`, estado READY confirmado pela API Vercel.
- URL imutável: `https://rosa-maria-livro-dvjopbtbr-brigidovinicius-projects.vercel.app`.
- O build final gerou estaticamente `/` e `/teste-terra`. Lint, geração de tipos, tipagem e 28/28 testes aprovados, incluindo sete testes de isolamento e integridade da apresentação publicada.
- Associação explícita de `makeitfly.vercel.app` ao deployment final concluída com sucesso pelo Vercel CLI.
- Cópia de entrega: `outputs/make-it-fly-vercel-test/site`, sem dependências nem cache.
- A validação inicial utilizou somente o build e o estado da plataforma. Após o usuário relatar erro no endereço, o acesso foi reproduzido e corrigido conforme o registro abaixo.

O primeiro build de validação, `dpl_ArgWgwzWU5h3fSuk1ZNzpwLMTW6F`, também terminou em READY antes do envio final. Nenhum deployment antigo foi apagado.

## Correção de acesso público após o relato de 404

O navegador sem login foi redirecionado para o login Vercel ao abrir `/teste-terra`. A consulta autenticada da mesma rota retornava HTTP 200 e `x-matched-path: /teste-terra`, provando que a página estava disponível no build.

A API confirmou que o alias `makeitfly.vercel.app` apontava para o deployment novo, mas `project.targets.production.id` ainda apontava para `dpl_7zYo7vXKvP8fo9J7Ei2q2PQnGMUu`. A proteção SSO estava em `all_except_custom_domains`. O build tinha sido enviado com `--prod --skip-domain` e associado manualmente, sem completar a promoção de produção.

Foi executado `vercel promote dpl_8uLrXKNCmto7jChXfXF7G4wZjnvb` no mesmo projeto/time. A promoção terminou com sucesso, sem rebuild e sem alterar ou desabilitar a configuração SSO. Em seguida, o navegador sem login abriu diretamente `https://makeitfly.vercel.app/teste-terra`, exibindo título, conteúdo e CTA corretos. A página `/` também abriu sem login e manteve o conteúdo original. A aba da subpágina foi deixada disponível para teste do usuário.

Esta rodada corrigiu a ativação pública da publicação, não a animação. Nenhuma implementação visual foi modificada.
