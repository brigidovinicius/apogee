# Radar Apogee — PRD

Revisão: 14/10/2026. Decisão vigente do proprietário: publicação automática; painel de gerenciamento do catálogo ao vivo. Substitui a proposta anterior de revisão humana e o fluxo editorial da especificação legada. Migração e deploy autorizados posteriormente pelo proprietário; evidências no [registro de produção](radar-production-20261014.md).

O [brief integral](radar-product-brief.md) preserva os requisitos, exemplos e referências recebidos. Este PRD registra as decisões vigentes e o recorte inicial, sem descartar as demais capacidades. O andamento e os limites estão no [registro de execução](radar-live-execution.md).

## Resultado esperado

Descobrir oportunidades úteis a brasileiros, no Brasil e no exterior, com prioridade para tecnologia, ciência, empreendedorismo e aeroespacial. Apogee apresenta e gerencia; Radar Acadêmico é o serviço separado de descoberta, extração, persistência e atualização. O banco do Radar é a fonte única do catálogo. Uma oportunidade publicada aparece para o usuário e para o administrador; o administrador ganha criar, editar e excluir. Não existe fila de aprovação de fichas.

## Publicação e confiança

- Novas fichas e mudanças relevantes entram automaticamente após validações determinísticas. A verificação de cadastro de uma fonte continua separada da publicação de cada ficha.
- Fonte ativa e autorizada, URL oficial permitida, evidências, inscrições explicitamente abertas ou abertura futura confirmada, prazo válido ou fluxo contínuo explícito. Suspensa, cancelada, encerrada, contraditória ou incompleta não aparece no catálogo ao vivo. Falhas técnicas são diagnóstico de coleta, não uma fila humana.
- Não inventar localização, apoio, elegibilidade ou datas. Informação ausente permanece ausente. Distinguir verificação automática de intervenção administrativa; nunca preencher auditoria humana com a identidade do robô.
- Retificações válidas atualizam a mesma ficha e deixam histórico. Leitura sem mudança atualiza a data de consulta. Datas sem hora valem até o fim do dia de São Paulo; horários exatos encerram no instante informado.
- Exclusão é lógica e impede ressurgimento na próxima coleta. Alterações administrativas preservam os campos alterados; fechamento, suspensão ou perda de validade na fonte impedem publicação mesmo com intervenção anterior.
- Migração não publica em lote pendências antigas. Reprocessar a fonte ou cadastrar explicitamente os dados válidos. O catálogo estático legado sai do caminho ativo e pode ser importado posteriormente após conferir suas fontes e prazos.

## Gerenciamento

Catálogo principal idêntico ao publicado, com busca e filtros comuns. Criar, editar e excluir exigem sessão administrativa no servidor e credencial própria na ponte Apogee–Radar. Salvar publica imediatamente quando válido; nenhum botão Aprovar/Rejeitar. Conflitos entre duas edições são rejeitados por versão. Registrar autor, antes/depois e data. Configuração de fontes e diagnóstico operacional ficam separados da lista de oportunidades.

## Atualização

Apogee lê a API sem cache persistente e renova a lista em abas visíveis a cada 60 segundos. Salvar/excluir invalida as páginas afetadas. O agendador verifica trabalho vencido a cada cinco minutos por padrão, em lotes limitados, respeitando robots, domínio, tamanho, tempo e frequência. Cada fonte mantém seu intervalo; a execução não garante que toda a Web foi varrida. Rechecagem de fichas existentes inclui importações assistidas, dentro do limite de páginas, e distingue falhas de consulta de mudanças confirmadas. Importação assistida não implica descoberta automática de novas URLs. Não confundir consulta da API com nova consulta à fonte oficial.

## Navegação: duas opções em avaliação

| Critério | Seis categorias | Sete categorias |
|---|---|---|
| Estrutura | Formação e aprendizagem; Bolsas e intercâmbios; Competições e hackathons; Pesquisa e inovação; Carreira e experiência; Eventos e comunidades | Mesmas áreas, separando Bolsas e apoios financeiros de Intercâmbios |
| Benefício | Navegação mais curta, útil em telas pequenas | Intenção de busca mais explícita entre financiamento e mobilidade |
| Custo | Mistura objetivos distintos e exige filtros claros | Mais itens e maior necessidade de conteúdo por área |
| Sobreposição | Intercâmbio com bolsa dentro da mesma área | Precisa permitir classificação múltipla sem duplicar ficha |

Decisão pendente conforme pedido do usuário: avaliar ambas antes de escolher. Comparar distribuição real do catálogo e tarefas de busca com usuários; manter filtros atuais durante a primeira execução. Escolaridade, perfil, país, idioma, custo e modalidade são filtros, não categorias principais.

## Evolução de produto

Identidade por programa/edição, deduplicação entre fontes e ligação ao organizador; aberto e próximo confirmado na descoberta, previsão anual só no calendário, encerrados em histórico separado. Busca em linguagem natural traduzida para filtros verificáveis. “Em alta” explica sinais objetivos, sem popularidade inventada. Descoberta gratuita; análise personalizada, checklist e alertas como possíveis recursos pagos, sem preço decidido. Meta editorial de cinco e alvo de dez oportunidades por subcategoria escolhida para lançamento, sem fabricar registros para completar quantidade.

## Execução inicial autorizada

1. Banco: procedência de verificação, versões, exclusão, histórico, políticas de leitura automática.
2. Radar: validação automática, atualização idempotente, proteção de alterações/exclusões e API de gerenciamento.
3. Apogee: catálogo único, CRUD administrativo, retirada da aprovação e atualização de leitura.
4. Verificar regras, autorização, persistência, paridade e ausência de regressões; documentar limites.
5. Executar a migração e a implantação conjunta autorizadas, com backup anterior e restauração de teste; validar publicação automática, paridade e CRUD em produção e registrar limitações.

As demais capacidades de evolução não devem ser apresentadas como implementadas nesta primeira execução.

## Aceite

Uma ficha válida recém-coletada aparece sem aprovação; atualização válida preserva ID e gera histórico; excluída não retorna; uma edição concorrente falha sem perda de dados; usuário e admin recebem os mesmos IDs e informações públicas; credencial de leitura não cria/edita/exclui; falha da ponte exibe indisponibilidade em vez de catálogo estático; campos privados de auditoria não chegam à API pública.
