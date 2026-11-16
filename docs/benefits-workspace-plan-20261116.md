# Benefícios: implementação local para revisão

Autorização: busca, categorias, salvos e histórico; preservar bloqueio de não assinantes e ofertas reais em rascunho. Sem publicação, envio de branch, APIs de parceiros, banco real ou contratação.

Base conferida: main `419bfbe`; worktree `member-benefits-20261116`, branch `feat/member-benefits-20261116`. Dependências existentes reutilizadas por symlink, sem copiar dotenv. Próxima migração aditiva: 0021.

## Lotes

1. Dados e segurança: tabelas separadas para categorias, organização da oferta, salvos e resgates. Preservar `member_benefit`, seus requisitos de publicação e a auditoria existente. Revalidar acesso e conteúdo em toda mutação, sob transação. Não usar autorização do Radar para conceder Benefícios.
2. Curadoria: estender o editor existente com categoria e origem/modalidade do fornecedor, mantendo rascunho como padrão; administração de categorias. Metadados privados do acordo não são enviados aos membros.
3. Área nativa: catálogo com busca e categoria, fichas por ID, salvos e histórico do titular. Abertura de resgate é POST explícito, idempotente, e registra início sem confirmar vantagem aplicada. Confirmação manual administrativa exige referência privada da conferência.
4. Revisão: dados sintéticos publicados exclusivamente no banco local para exercitar os fluxos. Seis candidatas reais do manifesto privado entram apenas como rascunhos locais. Email, cobrança, Google e parceiros externos ficam desligados.
5. Validação sequencial pela fila: integração PostgreSQL de migração, perfis, privacidade, concorrência, resgates e rascunhos; regressões de entregas; tipos/lint/build conforme resultado. Navegador local com assinatura, admin, gratuito e acesso antigo, incluindo celular e teclado. Deixar prévia local disponível ao proprietário.

## Arquivos previstos

- `drizzle/0021_member_benefits_workspace.sql`, journal e schema de membros.
- `lib/benefits/{store,validation,types}.ts`; extensão mínima de `lib/deliverables/{store,validation}.ts` para metadados editoriais na mesma transação.
- `components/benefits/`: área, formulários, estados e estilos usando tokens existentes.
- `app/membros/beneficios/`: índice, salvos, resgates, detalhe e ações autenticadas.
- `app/admin/beneficios/`: editor, categorias e conferência manual de resgates.
- Runner de migração aditiva, seed privado para revisão e integração do runner local existente.
- Testes de integração e documentação de evidências/PRD.

## Aceite

Gratuito, legado e expirado não recebem registros privados nem executam ações. Administrador e anual vigente têm acesso; cancelamento de renovação mantém período pago. Rascunho/arquivado/fora da vigência não aparecem nem podem ser resgatados por URL direta. Salvos e histórico são privados por titular. Reabertura e concorrência não duplicam resgate. Interface não confunde clique, pedido e benefício confirmado. Acordos, datas, descontos e comprovação não são inventados.
