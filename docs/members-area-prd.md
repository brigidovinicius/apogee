# Apogee — PRD da área interna de membros

- **Versão:** 0.1 · 15 de novembro de 2026.
- **Estado:** planejamento para revisão; a caixa de ferramentas ainda não foi implementada.
- **Decisor de produto:** Vinicius.
- **Relação com o produto:** detalha a experiência interna do [PRD geral](apogee-prd.md), preservando a oferta anual e os direitos existentes do Radar.

## 1. Problema e objetivo

O membro precisa encontrar recursos úteis sem procurar links em conversas dispersas. A área interna deve orientar o próximo passo e reunir os acessos da comunidade. A caixa de ferramentas será um catálogo curado de links externos organizado por finalidade.

Esta especificação detalha a nova caixa de ferramentas e sua integração à área existente. Learn, Perks e novas atividades continuam sujeitos à confirmação de suas próprias entregas; este documento não os declara implementados.

## 2. Decisões confirmadas e estado atual

| Tema | Decisão ou fato verificado |
| --- | --- |
| Localização | Dentro da área de membros, com um acesso chamado **Caixa de ferramentas**. |
| Conteúdo | Links de ferramentas úteis agrupados por categorias. Exemplo solicitado: **Vídeo > Google Flow**. |
| Recursos da assinatura | **Radar, Caixa de ferramentas, Benefícios e Trilha**, informados pelo proprietário em 15/11/2026. A trilha estará parcial no início. |
| Elegibilidade | **Somente assinantes anuais com direito vigente**, confirmado pelo proprietário em 15/11/2026. |
| Cancelamento da renovação | Mantém a caixa de ferramentas até o fim do período pago elegível. |
| Conta gratuita ou acesso antigo apenas ao Radar | Mantém seus direitos atuais; não recebe automaticamente acesso à caixa de ferramentas. |
| Acesso administrativo | Administração e pré-visualização protegidas pelas permissões existentes; assinatura não concede administração. |
| Regra do Radar | Abrir categorias ou links não consome as 10 consultas de eventos. |
| Revisão | Apresentar este planejamento antes de implementar. A autorização de deploy das alterações anteriores é independente desta funcionalidade nova. |
| Base atual examinada | `/membros` possui visão dos pilares e fórum; `/membros/assinatura` administra o plano. Não há catálogo da caixa de ferramentas nesta revisão. |

## 3. Organização proposta

```text
Área de membros
├── Início / próximos passos
├── Radar
├── Caixa de ferramentas
│   ├── Vídeo
│   │   └── Google Flow → site oficial
│   ├── Imagem e design
│   ├── Áudio
│   ├── Texto e pesquisa
│   ├── Produtividade e automação
│   └── Programação
├── Conversas da comunidade
├── Meu calendário e coleções
└── Assinatura e conta
```

Os nomes adicionais são uma proposta inicial editável. Só categorias com ferramentas publicadas aparecem para o assinante. A caixa de ferramentas é uma seção de utilidade da comunidade e pode apoiar Learn; permanece distinta dos benefícios comerciais formalizados em Perks.

Os quatro acessos de produto propostos para o início da área interna serão **Radar**, **Caixa de ferramentas**, **Benefícios** (Perks) e **Trilha** (Learn). A trilha deve indicar os módulos efetivamente disponíveis e seu estado de desenvolvimento, sem apresentar módulos futuros como acessíveis. O proprietário ainda não forneceu a lista concreta de benefícios nem os primeiros módulos; esses conteúdos permanecem pendentes de cadastro e conferência. Esta especificação não amplia a implementação autorizada para além do planejamento da caixa de ferramentas.

**Rota proposta:** `/membros/ferramentas`. A página terá título, explicação breve, navegação por categoria e uma lista de ferramentas. O atalho também aparecerá na página inicial e na navegação interna.

## 4. Conteúdo de cada ferramenta

| Campo | Regra proposta |
| --- | --- |
| Nome | Obrigatório, texto simples. Exemplo: Google Flow. |
| Categoria | Obrigatória; uma categoria principal no MVP. |
| Descrição | Uma frase curta explicando para que serve. |
| Link oficial | URL HTTPS validada, sem credenciais, scripts ou dados pessoais. |
| Condições de uso | Informação opcional, publicada apenas quando verificada; custo desconhecido fica sem rótulo de preço/gratuidade. |
| Ordenação e estado | Ordem editorial; rascunho, publicado ou arquivado. |
| Revisão editorial | Data da última conferência e responsável, disponíveis à administração. |

Primeira ficha de referência: **Vídeo > [Google Flow](https://labs.google/fx/tools/flow)** — ferramenta do Google para criação com IA. Link oficial conferido em 15/11/2026. A ficha é um exemplo de curadoria, ainda não um registro publicado na aplicação. Preço, créditos, disponibilidade e conta de terceiros seguem as condições do fornecedor; não são benefícios concedidos pela Apogee.

## 5. Percursos e regras de acesso

1. Assinante abre **Caixa de ferramentas**, escolhe **Vídeo** e encontra **Google Flow**, sua descrição e a ação **Abrir ferramenta**.
2. O link abre em nova aba no site oficial. A área de membros permanece disponível; a Apogee não transmite sessão ou dados da conta pelo link.
3. Conta sem assinatura elegível vê a apresentação da seção e o convite para conhecer a assinatura anual. O catálogo e seus dados são protegidos no servidor, inclusive por URL direta e eventuais endpoints.
4. Cancelamento da renovação mantém o acesso durante o período pago. Término, reembolso integral ou suspensão que retire o direito anual bloqueiam o catálogo conforme a regra já existente da assinatura.
5. Uma conta com acesso antigo ao Radar continua usando o Radar, inclusive se não puder abrir a caixa de ferramentas. Nenhuma nova cota ou cobrança é aplicada ao direito antigo.
6. Administrador autorizado cria e organiza categorias, cadastra links, confere os destinos, publica e arquiva ferramentas. Usuários comuns não alteram o catálogo.

Aplicam-se as verificações atuais de conta, proteção e participação. A decisão de assinatura reutiliza o direito anual confirmado no servidor, sem deduzir elegibilidade apenas da existência de um customer ou do retorno do checkout.

## 6. Requisitos do MVP e aceite

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| F01 | Acesso integrado | Assinante encontra a seção a partir do início e da navegação interna, em desktop e celular. |
| F02 | Categorias | Selecionar Vídeo apresenta apenas ferramentas publicadas dessa categoria. Categorias vazias ou arquivadas não criam caminhos sem conteúdo. |
| F03 | Ficha objetiva | Cada item apresenta nome, descrição, categoria e link oficial. A informação disponível não promete créditos ou acesso pago do fornecedor. |
| F04 | Saída para o fornecedor | A ação abre o domínio cadastrado em nova aba, com indicação acessível e proteção da aba de origem. URLs inválidas são recusadas ao cadastrar. |
| F05 | Assinatura no servidor | Visitante, conta gratuita e legado apenas do Radar não recebem catálogo privado por navegação direta, HTML/RSC ou API. Assinante elegível recebe. |
| F06 | Ciclo de vida | Cancelamento mantém o período pago; expiração e retirada do direito anual restringem a seção. Acesso antigo ao Radar permanece independente. |
| F07 | Curadoria protegida | Apenas administrador autorizado cria, edita, ordena, publica e arquiva categorias e ferramentas. Rascunhos não aparecem ao membro. |
| F08 | Cota independente | Uso da caixa de ferramentas não altera consultas gratuitas ou concessões do Radar. |
| F09 | Estados e acessibilidade | Há estado vazio, erro com nova tentativa, categoria selecionada compreensível, foco visível e uso por teclado; sem transbordamento em celular e com contraste nos temas existentes. |
| F10 | Publicação revisada | Implementação local, validação e prévia são apresentadas ao proprietário antes da publicação desta funcionalidade. |

## 7. Etapas propostas para implementação após revisão

| Etapa | Entrega revisável | Dependência |
| --- | --- | --- |
| 1. Base editorial | Confirmar categorias iniciais e lista de links; conferir o primeiro conjunto, começando por Vídeo > Google Flow. | Aprovação deste planejamento. |
| 2. Catálogo e curadoria | Modelo mínimo de categorias/ferramentas, migração aditiva e gestão protegida na administração. | Reutilizar autenticação e permissões existentes; não alterar concessões antigas. |
| 3. Experiência do membro | Rota, categorias, fichas e atalhos internos com autorização anual no servidor. | Catálogo e regra de elegibilidade. |
| 4. Validação local | Conferir assinante, cancelamento, conta gratuita, legado, expiração e administração; links, teclado, celular e temas. | Implementação concluída e fila local disponível. |
| 5. Revisão e release próprio | Apresentar prévia local e evidências; depois preparar migração, backup e deploy da versão aprovada. | Revisão da prévia e autorização de publicação dessa nova funcionalidade. |

Não há estimativa de prazo comprometida. Cada etapa será executada sequencialmente, respeitando a fila global do computador.

## 8. Evoluções e limites

Busca por nome, favoritos, múltiplas categorias, sugestões dos membros e acompanhamento agregado de uso podem entrar em uma etapa posterior. A prioridade do MVP é organizar e manter os links.

Integrações com APIs, ferramentas embutidas, compartilhamento de contas, venda ou distribuição de créditos, execução de automações e promessas de descontos não integram este MVP. A Apogee não coleta credenciais de terceiros.

## 9. Indicadores e operação

- Aceite obrigatório: 100% das fichas publicadas têm categoria, descrição e URL oficial conferida; zero acesso indevido e zero alteração de direito antigo do Radar nos cenários de validação.
- Operação proposta: conferir links mensalmente e quando houver relato de erro; responsável editorial a designar antes de publicar.
- Avaliação após 30 dias: acesso à seção, uso de categorias e cliques externos de forma agregada, conforme a escolha de analytics. Visita ou clique não comprova que a ferramenta foi utilizada com sucesso.
- Metas de adoção e retenção serão definidas após uma linha de base; não há resultado atual a declarar.

## 10. Pontos para revisão

- Aprovar a organização e o fluxo propostos; a exclusividade anual já foi confirmada.
- Ajustar a lista inicial de categorias e escolher as primeiras ferramentas além de Google Flow.
- Designar quem mantém a curadoria e atende relatos de links incorretos.

O conteúdo do documento estratégico fornecido é referência de produto. A inclusão da caixa de ferramentas, sua exclusividade anual e a revisão antes de implementar decorrem das instruções diretas do proprietário nesta conversa.
