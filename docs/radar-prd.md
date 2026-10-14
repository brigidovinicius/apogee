# Radar Apogee — PRD

Revisão: 14/10/2026. Decisões vigentes do proprietário: publicação automática, painel de gerenciamento do catálogo ao vivo, sete categorias principais e meta mínima de mil oportunidades. Substitui a proposta anterior de revisão humana e a divisão em seis categorias da especificação legada. A migração e o deploy da primeira versão foram autorizados e executados; evidências no [registro de produção](radar-production-20261014.md).

O [brief integral](radar-product-brief.md) preserva os requisitos, exemplos e referências recebidos. Este PRD registra as decisões vigentes e o recorte inicial, sem descartar as demais capacidades. O andamento e os limites estão no [registro de execução](radar-live-execution.md).

**Estado verificado em 14/10/2026, após a coleta FAPESP:** as sete categorias, o catálogo comum e o gerenciamento administrativo estão publicados; o fluxo automático e criar/editar/excluir já foram exercitados em produção. A [medição de cobertura](radar-coverage-20261014.md) registra **81 de 1.000** oportunidades únicas, publicadas e vigentes. A expansão de fontes e fichas continua pendente; esta medição não constitui aceite da meta quantitativa.

**Escopo da próxima expansão:** alterar somente o Radar Webscraper. A Apogee continua lendo automaticamente sua API de oportunidades publicadas; fontes observadas, candidatos de descoberta e eventos anuais permanecem privados no Radar e não entram na contagem de mil.

## Resultado esperado

Descobrir oportunidades úteis a brasileiros, no Brasil e no exterior, com prioridade para tecnologia, ciência, empreendedorismo e aeroespacial. Apogee apresenta e gerencia; Radar Acadêmico é o serviço separado de descoberta, extração, persistência e atualização. O banco do Radar é a fonte única do catálogo. Uma oportunidade publicada aparece para o usuário e para o administrador; o administrador ganha criar, editar e excluir. Não existe fila de aprovação de fichas.

## Publicação e confiança

- Novas fichas e mudanças relevantes entram automaticamente após validações determinísticas. A verificação de cadastro de uma fonte continua separada da publicação de cada ficha.
- Fonte ativa e autorizada, URL oficial permitida, evidências, inscrições explicitamente abertas ou abertura futura confirmada, prazo válido ou fluxo contínuo explícito. Suspensa, cancelada, encerrada, contraditória ou incompleta não aparece no catálogo ao vivo. Falhas técnicas são diagnóstico de coleta, não uma fila humana.
- Não inventar localização, apoio, elegibilidade ou datas. Informação ausente permanece ausente. Distinguir verificação automática de intervenção administrativa; nunca preencher auditoria humana com a identidade do robô.
- A verificação operacional de novas fontes oficiais feita por agente autorizado tem método, URL e data próprios no registro da fonte. Os campos de auditoria humana continuam vazios até uma revisão humana real. Uma fonte verificada por esse método só entra em coleta após confirmação de domínio oficial, caminhos permitidos, regras de acesso e limites de consulta.
- Retificações válidas atualizam a mesma ficha e deixam histórico. Leitura sem mudança atualiza a data de consulta. Datas sem hora valem até o fim do dia de São Paulo; horários exatos encerram no instante informado.
- Exclusão é lógica e impede ressurgimento na próxima coleta. Alterações administrativas preservam os campos alterados; fechamento, suspensão ou perda de validade na fonte impedem publicação mesmo com intervenção anterior.
- Migração não publica em lote pendências antigas. Reprocessar a fonte ou cadastrar explicitamente os dados válidos. O catálogo estático legado sai do caminho ativo e pode ser importado posteriormente após conferir suas fontes e prazos.

## Gerenciamento

Catálogo principal idêntico ao publicado, com busca e filtros comuns. Criar, editar e excluir exigem sessão administrativa no servidor e credencial própria na ponte Apogee–Radar. Salvar publica imediatamente quando válido; nenhum botão Aprovar/Rejeitar. Conflitos entre duas edições são rejeitados por versão. Registrar autor, antes/depois e data. Configuração de fontes e diagnóstico operacional ficam separados da lista de oportunidades.

## Atualização

Apogee lê a API interna do serviço Radar Acadêmico (Webscraper), sem cache persistente e renova a lista em abas visíveis a cada 60 segundos. Salvar/excluir invalida as páginas afetadas. O agendador verifica trabalho vencido a cada cinco minutos por padrão, em lotes limitados, respeitando robots, domínio, tamanho, tempo e frequência. Cada fonte mantém seu intervalo; a execução não garante que toda a Web foi varrida. Rechecagem de fichas existentes inclui importações assistidas, dentro do limite de páginas, e distingue falhas de consulta de mudanças confirmadas. Importação assistida não implica descoberta automática de novas URLs. Não confundir consulta da API com nova consulta à fonte oficial.

## Navegação: sete categorias aprovadas

Formação e aprendizagem; Bolsas e apoios financeiros; Intercâmbios; Competições e hackathons; Pesquisa e inovação; Carreira e experiência; Eventos e comunidades. Cada categoria usa identificador estável. Uma ficha pode constar em várias, sem ser duplicada. A navegação é igual para usuário e administrador e combina com os filtros atuais. Benefícios genéricos, prêmios e fomento não determinam sozinhos o formato da oportunidade; competições e eventos exigem classificação explícita enquanto a extração não tiver evidência estruturada específica. Itens legados sem classificação comprovada continuam acessíveis em Todas e na busca. Escolaridade, perfil, país, idioma, custo e modalidade permanecem filtros.

## Cobertura mínima: mil oportunidades

A meta é **1.000 fichas únicas publicadas no catálogo ao vivo**, de programas ou vagas com inscrição aberta ou abertura futura confirmada, fonte oficial autorizada e ativa, evidência, prazo vigente ou fluxo contínuo explícito e última verificação registrada. Cursos e trilhas de aprendizagem contínua só contam se houver programa ou turma com inscrição ou vagas confirmadas; módulos avulsos de uma trilha não contam separadamente. Contar IDs únicos, sem somar aparições em várias categorias, quantidade de vagas de um mesmo programa, registros encerrados, pendentes, históricos ou links de agregadores não confirmados. Medir diariamente o total e a distribuição por categoria e fonte. A meta não autoriza fabricar dados, repetir fichas ou enfraquecer critérios de publicação.

Ampliar e auditar fontes em lotes, priorizando páginas oficiais com listagens e detalhes estruturados; desenvolver adaptadores de extração em português e outros idiomas; confirmar a elegibilidade de brasileiros nos programas internacionais; preservar a identidade de programa e edição; medir o rendimento real de cada fonte. O monitoramento não consulta listas nem sites de terceiros. Links externos encontrados em páginas oficiais ficam apenas como candidatos privados; somente páginas oficiais auditadas podem ser monitoradas ou alimentar a publicação. A capacidade atual ainda não sustenta mil fichas; o marco de 1.000 só pode ser declarado após medição do catálogo publicado.

Na busca, medir as sete categorias separadamente e manter fichas multiclasse com um único ID. Para localização, distinguir alcance global, país comprovado, estado e cidade; não converter sede do organizador em elegibilidade geográfica. País usa código ISO de duas letras quando há evidência; alcance global e localização desconhecida não recebem país, UF ou cidade por inferência. O Radar preserva esses campos para a API comum; novos filtros de país na interface da Apogee exigirão mudança própria no site.

Para editais de fluxo contínuo que também fixam data e hora de término, registrar o limite exato, inclusive fuso comprovado, e reconsultar a fonte para detectar suspensão antecipada. O edital MinC de intercâmbio audiovisual é restrito a pessoas físicas brasileiras maiores de 18 anos com experiência comprovada; a página oficial apresenta inscrições até 06/11/2026 às 18h de Brasília ou esgotamento dos recursos. A ficha deve mostrar essa restrição, marcar Brasil sem inventar UF/cidade e sair da publicação se o prazo vencer, a página anunciar suspensão ou o edital deixar a lista oficial de inscrições em andamento. Falha de rede não confirma encerramento e deve manter a última verificação com nova tentativa.

O portal próprio da FAPESP é uma fonte oficial de bolsas de pesquisa com páginas individuais para cada vaga. Importar somente uma página presente na lista de oportunidades abertas que informe prazo, projeto, instituição e contato direto de candidatura. Uma vaga que deixa essa lista deve sair do catálogo na rechecagem; falha ao ler a lista preserva o estado anterior e agenda nova tentativa. Cidade exibida sem UF comprovada permanece em evidência textual, sem preencher país, estado ou cidade estruturados por suposição.

Fontes oficiais de carreira incluem editais publicados pelo órgão contratante e comunicados do próprio organizador do programa. O [edital municipal de estágio](https://servicos.sjc.sp.gov.br/concurso/concurso_detalhe.aspx?codigo=192) informa inscrição até 15/10/2026 às 23h59 de São Paulo. O [Programa de Estágio Braskem 2027](https://www.braskem.com.br/bahia-release/braskem-abre-inscricoes-para-programa-de-estagio-2027-com-mais-de-100-vagas-em-cinco-estados) informa 120 vagas em cinco estados e inscrição até 30/10/2026; conta como uma edição, não como 120 fichas. Sites externos usados para receber candidaturas não são monitorados. Estados mencionados para várias vagas ficam na evidência; sem uma localização única comprovada, a ficha não recebe país, UF ou cidade estruturados por inferência.

## Banco de descoberta e agenda anual

O Radar mantém três camadas distintas: `official_sources` para fontes auditadas que podem alimentar o catálogo; `discovery_targets` para páginas oficiais de sites, programas e séries de eventos a observar; `discovery_leads` para links encontrados que ainda não foram convertidos em fonte ou ficha. `annual_event_editions` registra cada edição com data, situação e URL de evidência, inclusive edições passadas ou canceladas. Uma série anual não autoriza inferir data ou inscrição da próxima edição.

O agendador da VPS consulta até duas páginas oficiais de descoberta vencidas por ciclo, respeita `robots.txt`, DNS público, domínio de origem, limite de 2 MiB por página e até 30 links candidatos por página. Um alvo novo começa pausado; só pode ser ativado após conferência registrada de que a URL pertence ao organizador ou instituição oficial e a consulta é permitida. A restrição vale no banco, no painel e na seleção do agendador; trocar a URL invalida a conferência. Cada alvo bem-sucedido volta a vencer após 24 horas; páginas bloqueadas ou indisponíveis também aguardam 24 horas. Links externos são registrados, não acessados automaticamente. Ao confirmar uma nova fonte, o administrador a cadastra e audita em `official_sources`; apenas fichas com inscrição e evidência válidas podem ser publicadas. A rotina não usa GitHub Actions agendado nem API paga de busca ou IA. Consome apenas capacidade da VPS já existente; tráfego e armazenamento precisam ser monitorados.

A primeira agenda acompanha Startup Summit, The Developer’s Conference, NASA Space Apps Challenge, Startup Day, Semana Nacional de Ciência e Tecnologia, Feira do Empreendedor Sebrae-SP, Web Summit Rio, Rio Innovation Week e Campus Party Brasil. O cadastro também observa chamadas CNPq e Finep, programas Sebrae, eventos Sebrae e o Prêmio Sebrae Startups. Nomes e URLs foram checados em páginas oficiais ou de órgãos participantes em 14/10/2026. O cancelamento da CPBR18 em 2026 está registrado como cancelamento, não como oportunidade. Somente edições com datas explicitamente publicadas entram na agenda; o estado de inscrição de cada edição exige verificação separada. A prioridade editorial é ampliar fontes de alto rendimento e medir diariamente publicação real por fonte, sem transformar metas em fichas fictícias.

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

As sete categorias ficam visíveis e combináveis com busca e filtros nos três catálogos. Criar e editar permite selecionar várias categorias; a seleção persiste no Radar, chega à API comum e sobrevive à próxima coleta. O total exibido no gerenciamento conta fichas únicas, não somas por categoria. A meta quantitativa só é aceita quando houver pelo menos 1.000 fichas publicadas e vigentes medidas na produção, sem duplicações ou relaxamento da validação de fonte.
