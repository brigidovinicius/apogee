# Empregos remotos no Radar — candidato local

Escopo autorizado: empregos, com prioridade para FDE remotos que aceitem residentes
no Brasil, e um teto mensal único de US$ 50 dividido em 30/15/5. Esta entrega não
ativa fontes, credenciais, preços, chamadas pagas ou serviços na produção.

## Coleta e publicação

O agendador existente aceita quatro fontes `api`: Whippy e n8n (Ashby), Nortal e
GitLab (Greenhouse). A migração 0054 cadastra as fontes inativas e pendentes,
preservando qualquer cadastro anterior. A ativação usa a auditoria editorial
existente, após confirmar o vínculo do empregador com o quadro e as condições de
acesso. Não existe uma segunda automação do Codex ou outro serviço contratado.

Cada consulta lê um snapshot JSON completo e limitado a 8 MiB/2.000 anúncios.
Ashby exige versão e visibilidade explícitas; Greenhouse exige que o total informado
coincida com os registros recebidos. Endpoints e links de candidatura ficam presos
ao tenant cadastrado. Não há descoberta irrestrita de domínios ou execução de texto
remoto como instruções. Campos salariais vazios continuam desconhecidos.

A API pública documentada da Ashby responde sem autenticação, enquanto o recurso
`https://api.ashbyhq.com/robots.txt` respondeu 401 na auditoria. O adaptador de API
tem uma política restrita a esse GET documentado e aos tenants cadastrados. Um 401
somente desse recurso separado não concede acesso a endpoints privados. Robots
válido com proibição explícita, 403, falhas e indisponibilidade continuam bloqueando.
As regras do coletor de HTML não foram relaxadas. Referência de publicação:
https://developers.ashbyhq.com/docs/public-job-posting-api

O tipo `Emprego` usa Carreira. Modalidade de emprego e elegibilidade brasileira são
campos separados de formato de cursos/eventos e de abrangência nacional. Publicação
automática exige remoto e Brasil confirmados; LATAM, sede, fuso e menções a clientes
brasileiros não bastam. Cargos próximos exigem responsabilidades de implantação e
contato com cliente. FDE recebe prioridade no recorte de empregos/Carreira.

Uma requisição mantém identidade quando título, idioma, URL ou localidade mudam.
Variantes Greenhouse usam o ID interno da vaga. Exclusões administrativas e edições
continuam preservadas. Anúncios explicitamente ocultos saem imediatamente; ausências
precisam de duas consultas completas separadas por seis horas. Erros não provam
encerramento. Após 48 horas sem verificação, PostgreSQL e a ponte pública escondem
a ficha. O prazo desconhecido não é convertido em fluxo contínuo ou data inventada.

## Orçamento

As migrações 0050/0051 reaproveitam a fundação local de ledger e tarefas. A 0055
evolui para parcelas `radar=30.000.000`, `jobs=15.000.000`, `reserve=5.000.000` micros
de USD, totalizando US$ 50. A reserva só admite rechecagem/recuperação. Não há
transferência automática para contornar o limite de uma parcela.

Reserva e envio usam a mesma trava transacional. Antes do envio, são revalidados
limites, preço, crédito, conta, mês e tarefa. Gasto confirmado e compromissos
pendentes/ambíguos contam; cobranças incertas de meses anteriores continuam retidas.
Preços ausentes, conciliação inicial ausente e ciclo diferente do mês civil bloqueiam.
As funções antigas foram tornadas privadas para não contornar as novas regras.

A conciliação inicial exige referência verificável do consumo já realizado por
todos os consumidores desse orçamento. Registrar esse consumo em `prior_usage`
antes de liberar o mês; não declarar automaticamente gasto anterior zero. O
operador escreve essas tabelas; o worker e a aplicação não podem fazê-lo.
Registrar a abertura e os valores das três parcelas na mesma transação, com a linha
de `radar_ai.control` travada (`FOR UPDATE`) e a IA pausada. Só liberar chamadas
após conferir a importação contra a referência de consumo e os limites do mês.

O painel administrativo apresenta as parcelas, gasto, reservas e saldo, com avisos
em 80% e 90%. Saldo sem conciliação aparece como não confirmado. A coleta direta é
gratuita em consumo de modelos. O runtime de IA permanece sem transporte real:
não há chave, chamada paga, recarga ou fallback de cobrança introduzidos nesta versão.

## Validação e publicação

Testes: normalização/escopo/robots; transações de ingestão, RLS, retirada, edição e
tombstone; contrato Radar/Apogee, filtros, ranking e proteção de prévias; limites
financeiros com concorrência em PostgreSQL descartável. A CI executa esses checks.
Todos os comandos locais de projeto passam pela fila global, um por vez.

Para publicar: revisão do diff, autorização de publicação, CI/build aprovados,
inventário remoto, backup e restauração isolada, checkout limpo e SHA exato.
Aplicar as migrações aditivas ordenadas, atualizar Radar e Apogee, verificar saúde e
paridade público/admin/MCP e então homologar/ativar as fontes individualmente.
Preservar a imagem anterior e, em caso de rollback, pausar somente as novas fontes.
Nenhuma migração de produção ou ativação foi executada para testar esta entrega.
