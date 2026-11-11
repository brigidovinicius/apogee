# Cabeçalho, navegação e Home — direção editorial Apogee

Direção visual aprovada: base branca, marinho e azul Apogee, Inter para interface e manchetes compactas, Instrument Serif em assinatura e temas. Logos e imagens existentes mantêm seus arquivos e geometria originais.

Base inicial: `df302035d978c553a69575a2034bc175219caa00`, merge do PR #137. As seis verificações de CI de `e79bbd5` passaram. Base final consolidada: `70ce7939df0f7ff065a56434dc70fff4faeaf6ab`, após os PRs #138 e #139 do worker. O diff entre essas bases não altera `make-it-fly-current`. O responsável confirmou o encerramento da implantação editorial antes da consolidação visual. O trabalho visual usa checkout próprio; CMS, worker, banco e configuração de produção estão fora do diff visual.

## Etapa 1 — cabeçalho e navegação

O cabeçalho compartilhado apresenta logo oficial marinho, assinatura editorial sobre branco e uma faixa de navegação marinho. No celular, os três primeiros destinos permanecem visíveis e o menu oferece todos os destinos, incluindo membros. O componente de menu existente conserva fechamento por clique fora, Escape e navegação. Os links de acesso preservam seu destino de retorno configurado.

A abertura legada controlada pela rolagem conserva sua variante adaptativa nos arquivos existentes. A Home passa a usar o cabeçalho normal e visível na etapa 2. A área Make It Fly continua isolada.

Foi corrigido também o estado ativo em páginas sem seção definida: o link sem seção não recebe `aria-current` quando `current` está ausente. Um teste de regressão cobre a seleção correta e os destinos configurados de membros nas duas variantes.

Validação antes da etapa 2:

- 21 verificações existentes de navegação, marca e contratos da Home/Radar passaram; após a correção do estado ativo, os seis testes de navegação passaram novamente, incluindo a nova regressão.
- Geração de tipos, TypeScript, lint dos arquivos alterados e build com `APOGEE_LOCAL_PREVIEW=1` passaram. Execução serial pela fila global.
- Navegador interno: 320, 360, 390, 760, 761 e 1440 px, sem rolagem horizontal. Logo oficial correto; nenhum destino selecionado indevidamente na página 404.
- Teclado: menu abre por Enter, fecha por Escape e devolve foco ao resumo. O atalho para conteúdo foca `main#experiencia`.
- O clique no menu navega para o Radar, fecha o menu e preserva `/membros/entrar?next=%2Fmembros%2Foportunidades`. Clique fora fecha o menu. Nenhum erro ou aviso de console na conferência final.
- Prévia limitada a loopback, por até dez minutos, com API pública fictícia e sem credenciais de banco ou provedor. O próprio servidor temporário foi encerrado ao terminar. Evidências ficam fora do repositório da aplicação.

## Etapa 2 — Home

A primeira tela apresenta título compacto, coluna temática em Instrument Serif e três entradas de marca com destinos reais para blog, Radar e loja. A composição usa branco, marinho e detalhes azul Apogee, estrela e imagens existentes. Esses cartões são entradas institucionais; não criam matérias, ofertas ou registros no CMS. No celular, temas e destaques têm rolagem horizontal nativa, com acesso por teclado, dentro dos seus próprios contêineres.

A Home permanece renderizada no servidor, com um único título principal, skip link, metadados e dados estruturados existentes. O rodapé institucional e os links de comunidade/Make It Fly são reutilizados. A abertura da Home não monta vídeo, canvas ou interação obrigatória por rolagem.

O Radar continua usando `HomeRadar`, `listPublicOpportunities`, `homeOpportunitySnapshot`, `EarthRadarList`, sugestões, datas, benefícios e regras de acesso existentes. Um mapa opcional de classes aplica a apresentação clara sem duplicar consultas ou regras e sem alterar a apresentação legada. A busca GET conserva o parâmetro `busca`; as falhas e a ausência de oportunidades têm mensagens explícitas e acesso ao catálogo.

Validação da etapa 2:

- 727 testes passaram, sem falhas, cancelamentos ou testes ignorados. Geração de tipos, TypeScript, lint dos arquivos alterados e build passaram. Após o ajuste final exclusivamente de CSS móvel, o build passou novamente.
- Navegador interno em 320, 360, 390, 760, 761, 1000, 1100, 1101 e 1440 px: largura do documento igual à tela, imagens presentes e texto de introdução em 16 px. Os contêineres horizontais conservam acesso aos demais itens; rolagem por teclado conferida.
- Três oportunidades fictícias isoladas na prévia: filtros retornaram 1 competição, 1 evento e 3 itens ao voltar aos destaques. A busca por pesquisa navegou para `/oportunidades?busca=pesquisa` e exibiu uma ficha correspondente. Nenhum desses dados entra na aplicação ou no catálogo real.
- API fictícia vazia: estado honesto com zero oportunidades, limpeza de filtros e link para catálogo. API fictícia indisponível: mensagem temporária e link para o catálogo. Nenhum aviso ou erro de console na conferência final.
- Prévia privada limitada a dez minutos, sem banco ou credenciais de provedores; encerrada ao terminar. A cópia rápida no mesmo disco interno tinha os cinco arquivos da Home idênticos à árvore de implementação por SHA-256. A execução inicial interrompida por lentidão de leitura não foi usada como aprovação; a suíte completa e o build passaram na cópia conferida, pela fila global.

## Entrega e próxima passagem

Cabeçalho/navegação e Home foram implementados em etapas, validadas antes de avançar. Evidências de tela e logs ficam fora do repositório da aplicação. Não houve alteração de dependências, esquema de dados, worker, CMS, rascunhos, credenciais ou conteúdo editorial. A revisão humana antes de publicar continua no fluxo existente.

A entrega visual permanece local. Envio ao GitHub, CI do novo candidato, merge e deploy visual são passagens separadas; nenhum deles foi executado por esta implementação. A publicação futura deve usar somente o serviço web e uma revisão explicitamente aprovada, com conferência em produção após concluir a implantação.
