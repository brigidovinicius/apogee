# Limpeza do topo do Radar — 30/10/2026

Removidos de `/oportunidades`, conforme solicitado:

- O aviso “Faça login e escolha uma oportunidade…” com a oferta de R$ 49,00.
- O botão “Compartilhar” e a instrução “Compartilha o link público desta página”.

O topo agora contém o título “Radar de oportunidades” e a descrição do catálogo.
A alteração está restrita ao JSX dessa página e à remoção do import não utilizado.

## Validação local

- `git diff --check`: passou.
- Revisão do diff e comparação com `HEAD` por Python: confirmada a remoção exata
  dos dois blocos e do import, com o restante do arquivo preservado.
- A inspeção pública confirmou os dois blocos em `/oportunidades` antes da alteração.
- Build, lint e testes de execução não foram iniciados: a fila global npm estava
  ocupada (ordem 946). O processo existente foi preservado.

Preparado sobre `17756d7`, em `fix/radar-header-cleanup-20261030`.
Sem push ou deploy. A publicação depende da autorização após revisão exigida
por `make-it-fly-current/AGENTS.md`.
