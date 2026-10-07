# Radar Acadêmico

Este projeto é independente da aplicação imobiliária descrita no AGENTS.md do diretório pessoal.

- Stack: Next.js App Router, TypeScript strict, PostgreSQL e Docker.
- Toda regra editorial e autorização fica no servidor.
- Nenhum segredo com prefixo NEXT_PUBLIC, exceto textos públicos.
- Ingestão nunca publica automaticamente.
- Não inventar oportunidades ou completar dados ausentes.
- Respeitar robots.txt, rate limits e domínios autorizados.
- Não executar migrações ou deploy na VPS sem inventário e backup da aplicação existente.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.

<!-- END:nextjs-agent-rules -->