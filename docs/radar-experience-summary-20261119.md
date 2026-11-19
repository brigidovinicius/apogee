# Resumo de experiência das vagas — 19/11/2026

A ficha da Truelogic tinha a faixa explícita de cinco a dez anos nos requisitos, mas o resumo mostrava experiência não informada. O campo estruturado existente representa apenas um mínimo; não representa o limite superior de uma faixa.

O resumo detalhado agora preserva o mínimo estruturado, quando presente, e consulta uma faixa explícita dos requisitos quando esse mínimo está ausente. Mostra `5 a 10 anos`, mantendo os dois limites. Datas, idade, salário, histórico da empresa, faixas inválidas e faixas conflitantes não se tornam experiência exigida. As prévias públicas continuam sem requisitos ou resumo protegido.

## Escopo

- Base: `4256cdea59f196e1c92685aebb51ded8330d8ce2`, versão do site publicada antes desta correção. Preserva navegação, benefícios e a integração do workshop da Luma já implantados.
- Alteração limitada ao formatador, ao card detalhado e aos testes relacionados.
- Sem migração ou alteração de registros, contratos da API, coletores, fontes, autenticação, credenciais ou serviços financeiros.
- O orçamento permanece US$ 50 por mês: Radar US$ 30, empregos US$ 15, rechecagens/recuperação US$ 5. Não há chamada de modelo no formatador ou nos testes.

## Validação local

Node 22.23.2, dependências do lockfile e Next.js 16.4.6 na worktree isolada:

- 25 testes direcionados: faixa real de requisitos, mínimo da Whippy, renderização do card, privacidade e acesso.
- 852 testes do site aprovados, após incluir os arquivos de referência necessários à suíte integrada e atualizar o carregador manual do teste de agrupamento para a nova dependência.
- Geração de tipos, tipagem e lint aprovados.

A publicação exige CI aprovada e imagem construída do commit exato. Atualizar somente o web do site, com inventário, configuração preservada e rollback para a imagem anterior. O Radar independente, o blog e os demais workers não precisam de atualização.

Validar depois do deploy: saúde, revisão, redirecionamento de rotas protegidas, filtro público FDE remoto/Brasil, dados reais da Truelogic, quadro financeiro e preservação dos outros containers. O usuário escolheu continuar com validação técnica quando o navegador interno ficou indisponível nesta sessão.
