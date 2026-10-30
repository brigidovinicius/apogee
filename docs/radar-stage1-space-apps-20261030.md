# Etapa 1 e piloto de monitoramento NASA Space Apps

Base: `8195527`, branch `feat/radar-stage1-space-apps-20261030`, em checkout isolado. Pedido de 30/10/2026: começar pelos ajustes de compartilhamento/texto e seguir com monitoramento, aproveitando o código existente. **Implementação e validação concluídas; candidato para revisão, sem publicação.**

## Alterações implementadas

- A retirada do compartilhar do topo já está integrada na base. Cards do Radar passam a compartilhar a URL pública da oportunidade; opções de curso compartilham sua própria ficha. Reutilização de `ShareButton`, com apresentação compacta, rótulo acessível e alternativas nativa, clipboard e cópia manual.
- Abertura da home: “Encontre o seu próximo salto”. A seção Radar já utiliza a mesma frase.
- Extrator NASA captura início/fim da realização e intervalo de inscrições como etapas distintas, sem inventar horário ou fuso do evento global. Datas inválidas são rejeitadas; se uma realização conhecida desaparecer da página, a atualização automática preserva os dados anteriores.
- O piloto NASA recebe reconsulta nominal de 6 horas, mantida em criação e rechecagem. O agendador da fonte considera a próxima reconsulta de suas fichas. Sem fichas, conserva o intervalo configurado; as demais fichas conservam 24 horas. Falhas de rede conservam a retentativa de uma hora existente. O prazo real inclui a fila e a disponibilidade da origem.
- Conferir uma etapa novamente atualiza sua evidência, sem criar versão de conteúdo por mudança exclusiva de `checkedAt`.
- Acompanhamento por e-mail também aceita oportunidades publicadas com prazo definido. Formulário permanece nos detalhes acessíveis e em fichas vigentes; confirmação, consentimento, limites, cancelamento e retenção continuam no sistema existente.
- Mudanças entre pedido e confirmação deixam de ser descartadas. Avisos mostram valores públicos anteriores/novos e link para a ficha pública. Requisitos, condições financeiras e URL oficial geram aviso de alteração, sem expor seu conteúdo protegido. Datas de snapshots antigos são normalizadas e objetos comparados sem depender da ordem das chaves JSON.
- Mudanças de etapas incluem alteração de término. A simples coleta, rodapé e timestamp de conferência não geram aviso. Extração inconclusiva não comunica cancelamento/retirada ao interessado; encerramento ou cancelamento confirmados mantêm os comportamentos existentes.

## Cenários de validação executados

Teste de compartilhamento compacto com URL individual; extrator NASA com calendário presente/ausente/inválido; hash de conteúdo estável; proteção de data conhecida; normalização de datas de snapshots; fluxo de coleta existente com início NASA; integração PostgreSQL em PGlite para assinatura com prazo, alteração anterior à confirmação, idempotência, falha inconclusiva e mudança de término de etapa. Provedor de e-mail é simulado; não são usados destinatários reais.

## Validação concluída

- Site: `npm test`, **580 aprovados, zero falhas/skips**; `npm run lint`, sem erros e com aviso preexistente de imagem em `gallery-admin.tsx`; `npm run build` e `npm run typecheck` aprovados.
- Radar: `npm test`, **482 aprovados, zero falhas e 30 ignorados**; `npm run lint`, `npm run typegen`, `npm run typecheck` e `npm run build` aprovados. Os ignorados são 9 de auditoria externa e 21 dependentes de PostgreSQL externo; não são apresentados como aprovados.
- A integração do catálogo executa PostgreSQL em memória via PGlite, com migrações, papéis, RLS e fila reais nesse ambiente. A rodada focada passou com 60 casos e está incluída na cobertura da suíte final; não é somada outra vez ao total. E-mail permanece simulado.
- Os carregadores de dois testes do site foram atualizados para renderizar o componente compartilhado real. Integrações detectaram e verificaram as correções de ordem das chaves JSON e do fallback de agendamento sem fichas. Tipos dos novos dados de teste foram corrigidos sem coerções para contornar a checagem.
- Página oficial NASA baixada por leitura pública: formato conferido, inscrição em 26/08–15/11/2026 e realização em 14–15/11/2026. Sondagem de fonte e testes TypeScript são verificações distintas; nenhuma publica dados.
- Revisão independente somente de leitura: exposição de dados protegidos nos avisos e cadência do scheduler corrigidas; revisão final sem novos achados concretos.
- `git diff --check` e conferência dos hashes do código/testes entre Mac e checkout de testes fazem parte do fechamento. Evidências locais em `.local/radar-stage1-space-apps/`.

## Ambiente e autorização dos testes

A fila global npm local estava ocupada pela ordem 946, um servidor existente que foi preservado. Após a revisão automática bloquear a transferência de código, o usuário autorizou expressamente **“Autorizar envio e testes isolados na VPS”** para `/opt/apogee-work/radar-stage1-space-apps-20261030`, em `apogee-vps`.

Foram enviados somente os diffs de código, testes e esta documentação à cópia isolada do mesmo repositório, já verificada pelo commit base e pelo hash do lockfile. O snapshot completo bloqueado não foi enviado. Nenhum `.env` ou credencial foi transferido. Node 22.23.4 foi preparado somente em `.tools` do checkout de testes, a partir da distribuição oficial com SHA-256 conferido. Dependências do site vieram do lockfile; o Radar reutilizou dependências do checkout de testes anterior com lockfile idêntico. Todos os comandos pesados foram executados sequencialmente na área de testes.

Nenhuma dependência de projeto nova ou migração de banco foi preparada. Não houve push, deploy, mudança OAuth, alteração de fonte/dado de produção, envio de avisos reais ou encerramento de processos existentes.

## Limites desta entrega

O piloto acompanha esta edição; diretório permanente de competições, inscrições fechadas e alertas de futuras edições continuam na expansão planejada. A assinatura mantém a finalização existente no início/encerramento/cancelamento/resultado, sem reativar assinaturas concluídas. Google Agenda existente pode consumir as etapas capturadas, mas sua liberação não é parte deste candidato.

Antes de liberar: revisar o candidato e seguir o gate de publicação do projeto. O arquivo `make-it-fly-current/AGENTS.md` exige autorização explícita após revisão antes de publicar uma versão, inclusive preview hospedado. A validação desta tarefa ocorreu no checkout isolado e não demonstra o comportamento de uma versão publicada.
