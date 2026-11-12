# Comunidade gratuita e captura da gravação — prévia local

## Escopo autorizado

Adaptar `/comunidade` e criar `/gravacao`, inspiradas na hierarquia e no clima visual de `black.humanacademy.ai/inscricoes` (a raiz encaminha para esse mesmo destino). Prévia local apenas. Sem push, publicação, alteração de cobrança, envio de contato, convite real ou integração de formulário.

Decisões: grupo gratuito no WhatsApp; turma inicial de IA paga e ainda não gravada; Radar existente com condições próprias; curadoria e conteúdos previstos; benefícios de parceiros planejados, sem acordos ou negociações confirmados. O usuário confirmou o evento oficial Codex Community/OpenAI com organização da Apogee. Não há data revalidada, gravação disponível ou URL do grupo fornecida.

## Base e isolamento

- Worktree existente aprovado: `community-sales-20261112`, branch `feat/community-sales-20261112`, HEAD inicial `4dc178c`.
- `origin/main` local em `f796fa6`; leitura remota de main retornou `6aa8a6c`. Sem rebase ou incorporação de trabalho externo nesta alteração local.
- Alteração preexistente no `make-it-fly-current/AGENTS.md` gerada por Next dev: preservar.
- Servidor desta prévia já ativo em `127.0.0.1:3457`, na fila npm de ordem 1841. Não encerrar nem iniciar outro processo de projeto em paralelo.
- Componentes, estilos, Terra e rota do Make It Fly permanecem fora do escopo.

## Direção de design

Serviço/comunidade de aprendizado de IA; ação principal: conhecer e participar gratuitamente. Captura: solicitar aviso de disponibilidade da gravação, como demonstração local.

Paleta: noite `#07111f`, azul `#123763`, gelo `#c3dce9`, texto `#f2f5f7`, secundário `#a8bdd0`, linha `#29415b`. Inter para títulos e leitura; DM Mono nos pequenos rótulos; Instrument Serif em um detalhe editorial. Tipografia e assets locais já existentes.

Comunidade: navegação → hero centrado, promessa + gratuidade + estrela real da Apogee → frentes em blocos editoriais → Radar com link real → turma futura → participação → FAQ → rodapé. Captura: mesmo cabeçalho → hero em duas colunas com formulário → três etapas reais do percurso → convite à comunidade → FAQ → rodapé.

Assinatura visual: a estrela oficial da Apogee sobre luz azul, sem tomar emprestados assets, números, professores, logotipos de clientes ou textos da Human. Não inserir imagens fictícias do evento nem player sem gravação.

## Tarefas e arquivos

1. Reescrever conteúdo e componente da comunidade, deixando grupo gratuito, curso pago futuro e parcerias pendentes explícitos.
2. Criar elementos compartilhados de cabeçalho/rodapé/convite e usar estilos isolados entre as duas rotas.
3. Criar captura demonstrativa de nome, e-mail e tarefa opcional. Validar campos, mostrar próximo passo de demonstração e permitir reiniciar. Sem request de envio, armazenamento, URL com dados ou mensagem de inscrição real.
4. Guardar ambas as rotas com `APOGEE_LOCAL_PREVIEW=1`, metadados noindex/nofollow e exclusão exata do tema global.
5. Validar no servidor existente: desktop/mobile, navegação entre páginas, convite pendente, campos inválidos/válidos, confirmação e reinício, foco, FAQ, ausência de envio e persistência. Revisar diff e registrar evidência.

Arquivos de produto: `content/community.ts`, componentes em `components/community/`, `app/comunidade/page.tsx`, nova `app/gravacao/page.tsx`, `components/site/design-scope.mjs` e extensão do teste existente de escopo das rotas.

## Cenários

- Sem convite: CTA informa que o link do WhatsApp será disponibilizado depois; não gera link fictício.
- Sem gravação: promete aviso de disponibilidade, não acesso imediato ou prazo inventado.
- Formulário inválido: erros junto aos campos e foco no primeiro inválido.
- Formulário válido: confirmação marcada como demonstração, sem dados retidos.
- Grupo opcional: solicitação da gravação não exige entrada no WhatsApp.
- Fora do modo de prévia: páginas não disponíveis.

## Validação

- Ambas as rotas compiladas/renderizadas pelo servidor Next dev já existente, com `APOGEE_LOCAL_PREVIEW=1` e analytics desabilitado. Nenhum processo de projeto adicional iniciado; servidor e fila preservados.
- Medidas reais por aba em 1440, 1024, 768, 390 e 320 px: dez combinações, sem overflow de texto/controles detectado. Inspeção visual de desktop e celular e chamada de captura acessível no celular.
- Campo nome vazio, e-mail vazio e e-mail inválido rejeitados, com mensagens junto aos campos e foco no primeiro inválido.
- Submissão válida demonstrativa e repetição após a correção da hidratação: confirmação explícita de demonstração, sem requisições de rede no intervalo observado. URL sem valores dos campos; formulário reiniciado vazio; confirmação recebe foco.
- JavaScript desabilitado em uma recarga: campos e submissão desabilitados. JavaScript reabilitado e página recarregada ao fim do teste. Não há `fetch`, Server Action, endpoint de captura ou escrita em armazenamento neste fluxo.
- Modal de convite pendente abre, fecha com Escape e devolve foco ao botão; nenhum link de grupo fictício.
- FAQ abre/fecha e atalho global de pular conteúdo foca `main#experiencia`. Metadados efetivos das duas páginas: `noindex, nofollow`. Tema global ausente nas duas rotas isoladas.
- Nenhum erro de console retornado nas duas abas. `git diff --check` passou.
- Revisão de código somente leitura identificou dois pontos, corrigidos: envio nativo antes da hidratação e texto que afirmava negociação de benefícios ainda não confirmada.
- O diff não toca Make It Fly, Terra, APIs, backend, pagamentos, dependências ou configurações de publicação. A alteração preexistente de AGENTS.md permanece fora do commit desta tarefa.

Limites: lint, typecheck, suíte Node e build de produção não foram executados neste ciclo, pois o servidor contínuo ocupa a fila e o usuário exige preservar processos. O teste existente de isolamento recebeu `/gravacao`, mas não se atribui a ele resultado de execução. As guardas fora de `APOGEE_LOCAL_PREVIEW=1` foram revisadas no código; não foi iniciado um segundo servidor para testar outro ambiente. Não houve push, CI, deploy, publicação, envio de e-mail, cadastro real ou cobrança.

## Revisão local

- Comunidade: `http://127.0.0.1:3457/comunidade`
- Captura: `http://127.0.0.1:3457/gravacao`
- Abas mantidas abertas para revisão e configurações temporárias de viewport/JavaScript restauradas.
- Evidências em `/Users/viniciusbrigido/.cline/worktrees/04981/Apogee - Site Interativo/outputs/community-free-recording-20261112/`: `responsive-checks.json`, `functional-checks.json`, `comunidade-desktop.jpg`, `gravacao-desktop.jpg`, `comunidade-mobile.jpg`, `gravacao-mobile.jpg` e confirmação demonstrativa.

Antes de uma ativação futura: convite real do WhatsApp, disponibilidade da gravação, prazo de aviso e integração de contatos precisam ser definidos. A turma paga continua separada, em preparação, sem preço ou checkout novo.
