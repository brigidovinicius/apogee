# Correções de navegação — validação local em 20/10/2026

Estado: implementado e validado localmente. Sem push, CI remoto, merge ou deploy.
Branch: `fix/navigation-audit-20261020`, criada a partir de `2e5412d`.

## Comportamento corrigido

1. **Radar público → login → Radar de membros:** o cabeçalho, o menu móvel e o
   CTA usam o mesmo destino, com os filtros e a página atual codificados no
   `next`. A rota de membros e a DAL preservam esse destino também ao exigir
   autenticação ou configuração do perfil. O helper reaproveita o parser e o
   serializador existentes, mantém somente parâmetros do Radar e não aceita
   destinos externos. A autorização da rota, da DAL e do acesso ao Radar continua
   sendo executada antes da leitura dos dados.
2. **Menu administrativo móvel:** todos os seis links fecham o `details` em
   `onNavigate`, inclusive por teclado e ao selecionar o destino atual. O controle
   `summary` recebe foco ao fechar; a navegação subsequente pode mover o foco pelo
   comportamento normal do Next.js. Nenhum link oculto reteve o foco nos testes.
3. **Retornos explícitos:** Make It Fly tem retorno à Apogee no cabeçalho de
   desktop, no cabeçalho móvel e no rodapé. A gestão da galeria oferece
   “Voltar ao painel” e “Ver galeria pública”. O CSS, as animações, o conteúdo e os
   assets do evento permaneceram sem alterações. Apenas três links foram
   acrescentados à landing.

## Validação

Todos os comandos de projeto passaram pela fila global npm, sem execução pesada
simultânea. O servidor temporário foi encerrado ao fim da verificação.

| Verificação | Resultado |
| --- | --- |
| `node --test --test-concurrency=1 --test-reporter=spec tests/*.test.mjs` | 453 passaram, 0 falhas |
| `npm run typecheck` | Passou |
| ESLint dos TS/TSX alterados e do teste novo | 0 erros; 1 aviso preexistente de `<img>` em `gallery-admin.tsx` |
| `git diff --check` | Passou |
| Navegador local | 19 verificações passaram |

Os testes novos executam o código real para conferir o round-trip de todos os
filtros e paginação pelo validador de autenticação, a consistência dos dois links
da página pública, os guards da rota/DAL, a recusa de leitura sem autenticação e
o fechamento/foco dos seis links administrativos.

Dois testes existentes preservam a landing por SHA-256. Após revisar que o diff
continha somente os três links autorizados, atualizou-se exclusivamente o hash
desse TSX nesses dois testes. Os hashes de CSS, Terra, hero e demais assets
permaneceram iguais.

### Navegador

| Fluxo | Casos | Resultado |
| --- | ---: | --- |
| Radar com categoria, busca e página 2 → login local → membros | 1 | Categoria, busca, total e página preservados |
| Menu administrativo móvel: seis destinos | 6 | Destino correto; menu fechado; foco visível |
| Menu administrativo por Enter | 1 | Navegou e fechou |
| Dois retornos da gestão da galeria em 390 e 1280 px | 4 | Painel e galeria corretos |
| Cabeçalho Make It Fly em 320, 390, 768 e 1280 px | 4 | Retorno à home; sem overflow ou sobreposição dos links |
| Rodapé Make It Fly → home | 1 | Retorno correto |
| Entrada no Radar pelo menu e pelo CTA móveis | 2 | Filtros, busca e página preservados |

## Isolamento e limites

O navegador usou `http://127.0.0.1:4381`, em um harness temporário separado do
checkout, importando as páginas/componentes corrigidos e os estilos do projeto.
Sessão, autorização, billing e catálogo foram substituídos **somente no harness**
por dados fictícios. Login e páginas administrativas de destino foram simulados;
os componentes do menu e os links eram os componentes reais. As partes visuais
pesadas do hero/Terra foram substituídas no harness; a navegação e o restante da
landing usaram o componente real. Nenhum bypass de autenticação ou fixture faz
parte da aplicação entregue.

Isso valida a correção de navegação sem usar credenciais, banco ou serviços de
produção. Não representa autenticação real em produção, teste de compra,
onboarding completo, build de produção ou validação de um deploy. O site público
continua na versão anterior até uma publicação autorizada separadamente.

Evidências de navegador e logs: artefatos locais na pasta de visualizações deste
chat, em `correcoes-navegacao-apogee.html` e `navigation-fix-evidence/`.

## Reteste adicional — histórico após Programação

O reteste encontrou uma falha em `/makeitfly`: clicar em Programação, sair para
a Apogee e usar Voltar restaurava `/makeitfly#programacao`, mas mantinha o
conteúdo da página inicial. O teste de navegador reproduziu essa divergência
antes da correção, conferindo o conteúdo além da URL.

As quatro âncoras internas da landing (marca/início, Experiência, Programação e
Voltar ao topo) agora usam `next/link`, já importado pelo componente. A navegação
passa pelo roteador, que preserva a árvore da rota no histórico. Na versão
instalada do Next.js, o handler de `popstate` ignora entradas sem estado; a
entrada criada pela âncora nativa não restaurava o conteúdo após a saída por Link.
Não há handler global, recarga forçada ou alteração de CSS, conteúdo, hero ou
Terra. Os dois hashes de preservação do TSX foram atualizados apenas após revisar
essa alteração autorizada.

Validação desta correção:

- `node --test --test-concurrency=1 tests/navigation-return.test.mjs tests/deployment-isolation.test.mjs tests/energy-support.test.mjs`: **22 passaram, 0 falhas**.
- `tests/browser/make-it-fly-history.mjs`, executado pelo `cua_repl` no preview
  ativo: falhou antes da alteração com o h1 da página inicial; **9 cenários
  passaram depois**, em 1280 e 390 px. Conferidos saída pelo cabeçalho/rodapé,
  Voltar e Avançar, conteúdo correto e ponto de saída restaurado. Ao sair pelo
  rodapé, Voltar restaura o rodapé, que era a posição no momento da saída.
- `git diff --check` e verificação de sintaxe do teste de navegador: passaram.

Esta rodada usou o preview persistente local, com o mesmo isolamento descrito
acima. Não repetiu build, typecheck nem a suíte completa. O servidor permaneceu
ativo para testes do usuário. Sem push, CI remoto, merge ou deploy.

Evidências desta rodada: `makeitfly-history-fix/browser-results.json` e
`makeitfly-history-fix/programacao-restaurada.png`, na pasta de visualizações
deste chat.
