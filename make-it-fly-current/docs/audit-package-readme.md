# Pacote de apoio para auditoria da loja — 27/09/2026

Este pacote contém os arquivos atuais necessários para inspecionar o código da loja e documentação selecionada da versão instalada do Next.js. É um recorte para leitura, não um projeto independente pronto para executar.

## Como continuar a auditoria

1. Leia `AGENTS.md` e `docs/liquid-glass-code-audit-prompt.md`.
2. Inspecione os nove arquivos em `app/loja/`, com `app/layout.tsx`, `app/globals.css`, `next.config.ts`, `tsconfig.json` e `package.json` como contexto.
3. Consulte os guias incluídos em `node_modules/next/dist/docs/`. Essa pasta contém somente documentação selecionada, não o runtime nem todas as dependências.
4. Para testar no navegador, abra `http://127.0.0.1:3001/loja` usando um navegador conectado ao mesmo Mac onde o servidor está rodando. Um navegador remoto/de nuvem usa outro localhost e não acessa esse endereço.
5. Se não houver acesso ao navegador do Mac, faça a auditoria estática dos arquivos e separe claramente o que não pôde ser verificado visualmente. Não invente resultados de interação, screenshots, FPS ou comparação com a referência.

O servidor foi iniciado localmente nesta sessão. Ele precisa permanecer em execução durante a auditoria. Caso seja encerrado, no projeto original execute:

```sh
npm run dev -- -p 3001 --hostname 127.0.0.1
```

Versão declarada do Next.js: `16.3.4`. Confira também `package.json` para React, Three.js e demais dependências. Não foram incluídos `.env`, credenciais, configurações da Vercel, banco de dados nem arquivos enviados por usuários.

Não publique versões ou altere o código durante essa auditoria. O objetivo é entregar achados verificáveis com arquivo, linha, causa, impacto e proposta de correção.
