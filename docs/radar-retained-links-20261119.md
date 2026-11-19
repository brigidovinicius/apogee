# Radar: recuperação dos links retidos em 19/11/2026

## Problema e comportamento

A conferência de 19/11 encontrou 21 URLs candidatas retidas: 20 da UFSC e uma da OBQ. Os bloqueios técnicos misturavam título H2 não reconhecido e respostas gzip recusadas com falta real de evidência editorial.

Esta alteração reconhece o corpo delimitado do tema institucional da UFSC, sem usar o H1 do site, datas de publicação ou o calendário lateral. Aceita gzip somente para o índice UFSC auditado e páginas exatas verificadas dos cinco hosts registrados em `ufsc-discovery-policy.ts`; conserva limites dos bytes recebidos e descomprimidos, robots, DNS, HTTPS, redirecionamentos e orçamento de requisições.

A cadeia de autoridade continua exigindo alvo habilitado/verificado e link real revalidado no índice oficial. Apenas os hosts UFSC individualmente auditados podem compartilhar essa autoridade institucional. Drive/Instagram são auxiliares; UFPel e qualquer outro domínio não herdam autoridade da UFSC.

Três formatos com evidência suficiente têm adaptação limitada:

- OBQ: cerimônia com data explícita e formulário de confirmação de presença. Categoria eventos, sem transformar uma premiação já definida em competição aberta. Sem prazo ou fuso inventado.
- PET-Letras: seleção de estudantes de Letras, 20 horas semanais, voluntária e sem bolsa. Lê a edição e o intervalo de inscrição explícitos; publica como formação, sem classificar como emprego FDE ou bolsa remunerada.
- Calendário UFSC: evento único futuro com início explícito e participação gratuita e aberta ao público. Recorrências permanecem retidas para impedir duplicações e reabertura indevida de uma exposição ou congresso a cada ocorrência.

A política de processamento passa à versão 10. Reavalia uma vez os bloqueios afetados dos dois alvos oficiais, inclusive os erros gzip, conservando o máximo de quatro tentativas e as decisões de exclusão, edição administrativa e bloqueio fora deste escopo. Não há reset geral da fila nem migração de banco.

## Ensaio com evidência real

Páginas e índices oficiais foram consultados da VPS em leitura, respeitando robots e limites. O replay dos 21 links usa as respostas registradas e o fluxo nativo de registro de fonte e persistência em PGlite descartável. Resultado do ensaio: três fichas publicadas, 18 retidas, zero falhas de processamento; segunda execução com zero novas fichas/publicações. O ensaio não publica em produção.

As três fichas são a seleção voluntária PET-Letras, a cerimônia OBQ e o concerto dos Tenores di Neoneli. As demais continuam retidas por prazo/rota não comprovados, recorrência, fonte auxiliar ou autoridade não verificada. O ano faltante em uma data não é completado com base no ano de publicação ou em outra data do texto.

## Validação

- Suíte completa Radar: 818 testes passaram; 39 testes condicionais não executados, em 91 arquivos (84 aprovados e sete condicionais).
- Replay opcional dos 21 links: três testes passaram, incluindo publicação transacional isolada, segunda passagem e rechecagem no dia seguinte.
- Regressão final após reduzir as amostras aos trechos necessários: 67 testes passaram, incluindo novo replay dos 21 links reais.
- `npm run typegen`, `npm run typecheck`, `npm run lint` e `npm run build`: aprovados.
- Transporte, limites gzip, fontes, critérios de emprego remoto/Brasil, isolamento financeiro e rechecagens são cobertos pela suíte.
- Comandos npm/Node executados em sequência pela fila global; nenhuma dependência nova, limpeza de projeto ou Docker local.

## Orçamento e operação

Nenhum código, chave, limite ou configuração financeira foi alterado. Preservar US$ 50/mês: Radar US$ 30, empregos US$ 15, reserva US$ 5. Os testes não chamam provedores de IA. A IA permanece sujeita à conciliação e saldo válidos existentes.

As fontes de empregos continuam prioritárias na fila de fontes e com rechecagem de seis horas; os demais detalhes usam o intervalo vigente, normalmente 24 horas. O scheduler continua consultando o web a cada cinco minutos após o fim do ciclo. Não há garantia de novas vagas FDE elegíveis todos os dias: a rotina publica apenas novas ofertas oficiais que atendam a remoto e Brasil confirmado.

## Publicação e recuperação

O candidato altera apenas o código do Radar. Não reconstruir o site/blog, scheduler, workers, banco, proxy ou outros serviços. A publicação do blog/legenda é independente desta composição; o web do site deve ser preservado no inventário imediatamente anterior ao corte.

Antes do corte: autorização do candidato exato, branch/PR e CI aprovadas, revisão do diff, inventário atual e backup restaurável. Construir a imagem do mesmo SHA e verificar health e autorização das rotas em isolamento. Nenhuma migração é necessária.

Após o corte: confirmar saúde e SHA somente do Radar web; preservar arquivos de configuração e credenciais. Observar ciclos nativos e os resultados dos 21 links, conferir IDs e publicações pela API e pelo site, repetir a medição para detectar duplicatas e conferir orçamento/conciliação. Diferenciar publicação nova, atualização e rechecagem. Em falha, restaurar somente a imagem anterior do Radar web; não reverter dados ou aplicar reset do repositório.
