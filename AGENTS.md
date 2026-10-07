<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Fluxo obrigatório: versionamento, deploy e documentação

1. Trabalhe no worktree e branch aprovados. Antes de editar, execute `git status --short --branch` e preserve qualquer alteração fora do escopo.
2. Faça a menor alteração necessária, execute a validação proporcional e registre os comandos, resultados e limitações sem exibir segredos ou o conteúdo de arquivos `.env`.
3. Antes de versionar, rode `git diff --check`, revise o diff e faça um commit claro e atômico. Só envie a branch com `git push` quando houver autorização.
4. Deploy é um gate separado: use o SSH configurado (`ssh apogee-vps`), confirme checkout remoto limpo, SHA exato e saúde atual antes de trocar a revisão. Não use `git pull`, `git reset --hard`, `git clean` nem cópia manual de arquivos.
5. No deploy rotineiro, atualize o checkout para o SHA aprovado e reconstrua somente o serviço Apogee necessário. Preserve `.env`, certificados, volumes, redes e backups. Banco, DNS, Caddy, Vercel e publicação exigem autorização própria.
6. Valide o serviço e a rota pública após o deploy. Registre no runbook o SHA, comandos, resultado e limitações. O Web Console da Hostinger é somente contingência para recuperar o SSH, não o fluxo normal de deploy.
