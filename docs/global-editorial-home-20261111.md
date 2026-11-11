# Cabeçalho, navegação e Home — direção editorial Apogee

Direção visual aprovada: base branca, marinho e azul Apogee, Inter para interface e manchetes compactas, Instrument Serif em assinatura e temas. Logos e imagens existentes mantêm seus arquivos e geometria originais.

Base inicial: `df302035d978c553a69575a2034bc175219caa00`, merge do PR #137. As seis verificações de CI de `e79bbd5` passaram. O trabalho visual usa checkout próprio; CMS, worker, banco e configuração de produção estão fora do diff.

## Etapa 1 — cabeçalho e navegação

O cabeçalho compartilhado apresenta logo oficial marinho, assinatura editorial sobre branco e uma faixa de navegação marinho. No celular, os três primeiros destinos permanecem visíveis e o menu oferece todos os destinos, incluindo membros. O componente de menu existente conserva fechamento por clique fora, Escape e navegação. Os links de acesso preservam seu destino de retorno configurado.

A abertura legada controlada pela rolagem conserva temporariamente sua variante adaptativa; sua substituição na Home é a etapa seguinte. A área Make It Fly continua isolada.

Foi corrigido também o estado ativo em páginas sem seção definida: o link sem seção não recebe `aria-current` quando `current` está ausente. Um teste de regressão cobre a seleção correta e os destinos configurados de membros nas duas variantes.

Validação antes da etapa 2:

- 21 verificações existentes de navegação, marca e contratos da Home/Radar passaram; após a correção do estado ativo, os seis testes de navegação passaram novamente, incluindo a nova regressão.
- Geração de tipos, TypeScript, lint dos arquivos alterados e build com `APOGEE_LOCAL_PREVIEW=1` passaram. Execução serial pela fila global.
- Navegador interno: 320, 360, 390, 760, 761 e 1440 px, sem rolagem horizontal. Logo oficial correto; nenhum destino selecionado indevidamente na página 404.
- Teclado: menu abre por Enter, fecha por Escape e devolve foco ao resumo. O atalho para conteúdo foca `main#experiencia`.
- O clique no menu navega para o Radar, fecha o menu e preserva `/membros/entrar?next=%2Fmembros%2Foportunidades`. Clique fora fecha o menu. Nenhum erro ou aviso de console na conferência final.
- Prévia limitada a loopback, por até dez minutos, com API pública fictícia e sem credenciais de banco ou provedor. O próprio servidor temporário foi encerrado ao terminar. Evidências ficam fora do repositório da aplicação.

## Próxima etapa

Implementar a Home aprovada usando os componentes e regras públicos existentes. Validar essa etapa antes da revisão final. Uma correção operacional adicional do worker, conduzida pelo outro chat, será incorporada à base antes de consolidar a entrega visual. Nenhum push, PR ou deploy visual foi realizado.
