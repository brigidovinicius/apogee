# Curadoria concorrente e datas dos Benefícios

Lacunas comprovadas no candidato `73b90ff`: Benefícios/Trilha usavam upsert sem versão; duas abas poderiam sobrescrever o trabalho uma da outra. O cliente SQL compartilhado com Drizzle também serializa datas como texto, incompatível com os objetos Date usados para gravar e exibir vigência.

- Cada ficha administrativa recebe uma revisão opaca calculada pelo PostgreSQL sobre a linha atual. Alterações exigem a mesma revisão sob trava da linha; uma edição desatualizada falha antes de escrita ou auditoria. A revisão não é enviada aos membros.
- Campos locais e sua revisão permanecem pareados. Revalidação de outro cadastro não troca silenciosamente a revisão de um formulário ainda não salvo. Sucesso devolve a nova revisão; falha preserva os campos e orienta copiar/recarregar/revisar.
- Datas são enviadas ao SQL em ISO e normalizadas para Date ao sair da camada de dados. Não há mudança de timezone comercial nem de vigência (fim exclusivo).
- Sem nova migração ou alteração nos hashes de 0019/0020. Autorização é repetida no servidor; direitos, conteúdo e evidência privada seguem separados.
- A fixture de risco permanece marcada. Os checks seguintes usam outra conta paga, em vez de limpar o marcador para continuar o teste.

Validação: **12/12 integrações de entregas aprovadas**, PostgreSQL sintético novo, pela fila (ordem 2130). Inclui disputa simultânea nos quatro tipos de ficha, exatamente uma edição vencedora/entrada de auditoria, rejeição de versão ausente/antiga, edição posterior com revisão nova e renderização real de benefício após inicializar o driver Drizzle. Primeiro ensaio detectou a falha de serialização de datas; corrigida antes desta rodada. Tipos/lint/CI integrado e revisão visual final devem usar o commit incorporado ao candidato.
