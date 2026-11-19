# Recuperação da produção diária do blog — 19/11/2026

Candidato para a base publicada `00251a7`, com o patch de legenda preservado.
O Radar usa um serviço separado e não faz parte desta ativação.

## Problema e comportamento corrigido

Em 19/11, 35 comparações Google consumiram 122.389 tokens sem criar artigos.
A reposição juntava títulos por termos genéricos/sufixos de cursos e selecionava
índices, exercícios ou uma reportagem de perfil como corroboradora de guias.
Os 90% corretamente rejeitavam esses pares. O limite conservador Google então
impedia as comparações e capas, embora a faixa gratuita OpenAI só para texto
continuasse habilitada.

A seleção passa a exigir guias substantivos de autores diferentes, ignora
rótulos genéricos, conserva a identidade da pergunta e limita novas seleções
heurísticas a dois candidatos rejeitados por foco/dia. A biblioteca acrescenta
dez perguntas específicas, com fontes públicas verificadas de Google,
Microsoft, MDN, business.gov.au e BDC. O cadastro reconhece o host oficial
docs.cloud.google.com como o mesmo autor Google.

A configuração opcional de versão 2 permite recuperar comparação e capa pela
OpenAI quando o Google não puder reservar capacidade. Texto conserva seu
complemento API e retorno ao Google. API permanece limitada a créditos gratuitos
atestados, sem saldo pago ou recarga, com os mesmos US$ 5/ciclo, US$ 0,25/dia e
US$ 0,05/artigo. Nenhuma operação usa Codex ou API Gemini.

A migração 019 acrescenta a validação nativa dos recibos API nas três etapas,
preserva independência de autoria, citações literais, fatos críticos e 90%,
e conserva o agendador com dez vagas na divisão 4/3/3. Não concede permissões
novas ao runtime. Apenas rejeição comprovadamente sem geração permite retorno
a outro provedor; uma cobrança incerta retém o artigo e a reserva.

## Validação anterior à ativação

- 169 testes unitários do worker, incluindo os 18 pares problemáticos por URL e título.
- 105 cenários de PostgreSQL em cluster próprio, sem rede e com respostas de IA simuladas.
- Backup atual restaurado em banco isolado; migração e idempotência verificadas.
- Dez artigos sintéticos atravessaram comparação, texto, capa e agendamento
  nativos; 30 recibos válidos, divisão 4/3/3 e nenhum artigo anterior alterado.
- Leitura pública das vinte páginas para as dez perguntas; pedidos cabem nos
  limites dos dois provedores. Isso comprova captura e entrada, sem antecipar
  aprovação factual das futuras comparações reais.
- Consulta somente de disponibilidade: `gpt-6-luna` e
  `gpt-image-2.5-flare-2026-09-08` disponíveis para a chave atual; zero gerações.

Os artigos sintéticos existem somente no ambiente isolado. Produção, CI,
ativação e lote real são etapas separadas. A configuração distribuída mantém
as capacidades OpenAI desligadas; a configuração privada exige ativação explícita.

## Operação e rollback

Antes da ativação, confirmar SHA, checkout limpo, CI, builds, backup restaurável,
cinco locks de deploy e configurações/montagens atuais. Instalar a 019 com o
acesso administrativo existente. Acrescentar o preço Standard do modelo de
imagem, verificado na documentação oficial e válido por no máximo sete dias.
Não alterar a chave, a organização, os tetos, a política de publicação ou o ledger.

Executar a primeira comparação/redação/capa real pelos controles transacionais,
conferir os recibos e a imagem, e somente então liberar o ciclo automático da
versão nova. A publicação segue os horários persistidos e a recuperação já
autorizada com pelo menos quinze minutos de intervalo quando faltarem vagas
horárias. Conferir o lote no painel e as rotas públicas em navegador interno.

Para rollback, restaurar somente as imagens de worker/site e configurações
anteriores preservadas. Manter a migração, artigos, mídia e recibos; a versão
anterior permanece compatível com o caminho Google. Não repetir uma chamada
cujo resultado/cobrança esteja incerto.
