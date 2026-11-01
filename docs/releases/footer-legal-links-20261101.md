# Correção do rodapé — 01/11/2026

O usuário autorizou corrigir e publicar a persistência dos links de Privacidade e Termos de Uso, preservando o outro trabalho do Radar.

## Problema e solução

`SiteFooter` era importado também por componentes cliente. Durante a renderização do servidor, as funções de disponibilidade enxergavam as flags privadas e incluíam os links; no navegador essas flags não existiam, removendo os links e provocando React #418 na home.

A disponibilidade passa a ser calculada exclusivamente no servidor, com as mesmas aprovações exatas de versão e proteção de menores. O layout compartilha apenas dois booleanos serializáveis por contexto React. O rodapé usa essa decisão durante renderização, hidratação e navegação. Sem contexto, permanece fechado. Nenhum valor de ambiente privado ou texto de aprovação é enviado ao cliente. Não há alteração dos documentos, suas versões ou condições de acesso.

A leitura ocorre em tempo de requisição: a imagem Docker é construída sem as flags de produção. Isso evita congelar os links como indisponíveis em páginas antes estáticas e manter essa decisão incorreta ao navegar para a home. A consequência é renderização de páginas por requisição; APIs, autorização, serviços e dados do Radar não são modificados.

## Escopo e coordenação

Base de implementação: `origin/main` em `2c660cd5c6f97a672841f1b9a2eb39152767e9c1`, contendo os eventos publicados no PR #110. Branch `fix/footer-legal-links-20261101`. A documentação posterior da publicação anterior (`78a1ea3`) permanece na branch anterior, preservada.

Consulta aos outros chats: atualização de Radar concluída/ociosa; verificação de etapas do Radar ativa em teste real de OAuth/calendário. Nenhuma mensagem ou ação foi enviada ao outro chat. A publicação deve respeitar o lock de deploy, conferir a revisão atual novamente e preservar worker, backend, agendador e ambiente. Se a produção avançar, parar antes do corte e incorporar a revisão nova. Sem migrações, gravações em banco ou alteração de configuração.

## Validação prevista

Teste de regressão: o rodapé renderizado com a decisão do servidor mantém exatamente o mesmo HTML após remover as variáveis privadas; contexto ausente ou documentos não aprovados não publicam links. Regras de aprovação e preview continuam cobertas. A verificação visual deverá confirmar os links depois da hidratação, recarregamento e navegação, com acesso real a ambas as páginas e sem React #418.

Validação local: 613/613 testes antes do ajuste de leitura em tempo de requisição; após esse ajuste, 14/14 testes focados de documentos/isolamento, TypeScript e lint aprovados (zero erros, um aviso anterior de imagem em `gallery-admin.tsx`). O smoke compilado do CI agora injeta aprovações sintéticas apenas no runtime e exige ambos os links no HTML da home e da página Robonauta; isso detecta snapshots incorretos do build. CI, PR, revisão publicada, imagem, rollback e conferência pública serão registrados após execução.
