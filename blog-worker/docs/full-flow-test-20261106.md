# Teste completo do fluxo implementado — 06/11/2026

**Resultado: 21 testes unitários e 25 verificações de integração aprovados, mais nove feeds reais lidos e parseados.** O código de produção permanece igual ao commit `38d4f86`; esta revisão amplia os testes e registra a evidência. Geração automática continua desligada. Nenhuma chamada real de IA ou contagem de tokens foi feita.

## Como foi testado

Execução serial pela fila global do Mac, Node 22.23.2 e PostgreSQL nativo 16.14. A integração iniciou um cluster novo em loopback, aplicou o DDL real de `0000_init.sql` e `0002_rapid_queen_noir.sql`, migrou o schema do worker e usou um papel sem escrita nas tabelas públicas do CMS. Ao terminar, encerrou apenas o PostgreSQL que ela própria criou.

O fluxo contínuo usa RSS sintético, parser e normalização reais, PostgreSQL real, adaptador de IA real com transporte injetado e resposta sintética. Confirma que a reserva já existe no banco antes da contagem e geração simuladas. Executa as funções deste checkout em `lib/blog/data.ts`, substituindo apenas a conexão pelo banco temporário. As bibliotecas TypeScript 5.9.3 e Drizzle 0.45.3 foram reaproveitadas de uma instalação local com versões iguais ao lockfile; nenhum pacote foi instalado.

Na primeira execução ampliada, o teste compartilhou a conexão administrativa com o Drizzle, que modifica os parsers de tipos do cliente PostgreSQL. Isso fez a validação do benefício falhar no harness. A conexão do CMS foi separada, reproduzindo a separação real entre aplicação e worker; a repetição passou nos 25 cenários. Não foi necessário alterar o código de produção.

## Cobertura confirmada

| Etapa | Evidência obtida |
|---|---|
| Coleta real | Os nove RSS foram lidos novamente no Mac às 14:43 de Brasília; limites e proteção de rede do worker usados |
| Normalização e deduplicação | Remoção de tracking, URL canônica, GUID/título, duplicata no mesmo feed e preservação do dossiê |
| Seleção editorial | Cinco editorias atendidas em cenários sintéticos; recência, aprovação e palavras-chave verificadas |
| Evidências | Hash, versão, referência inexistente, número não suportado, cópia de passagem e marcação ativa |
| Solicitação de IA | Endpoint fixo, organização/projeto explícitos, JSON estruturado, ferramentas desativadas e limite de saída incluindo raciocínio |
| Orçamento | Benefício/scope/preço inválidos bloqueiam; tetos por artigo, dia e ciclo; uma reserva concorrente; classes de cache liquidadas corretamente |
| Fluxo contínuo | RSS → dossiê → reserva persistida → contagem simulada → resposta simulada → validação → rascunho e evento no CMS |
| Privacidade do rascunho | Visível nas consultas administrativas; ausente em listagem pública, detalhe por slug e consulta do sitemap; noindex e datas públicas nulas |
| Revisão no CMS | Edição incrementa revisão; edição com versão antiga retorna conflito; evento administrativo preservado |
| Mídia existente | Binário sintético salvo no CMS: privado antes de publicar, acessível após publicação de teste e privado novamente após retirada |
| Publicação humana | Agendamento futuro fica privado; publicação, retirada e arquivamento funcionam pelas funções reais, apenas no banco temporário |
| Bloqueio do worker | Papel de runtime não publica diretamente nem altera comprovação de benefício |
| Recuperação | Timeout mantém reserva e pausa; próximo ciclo não reenvia; queda do processo, resposta tardia e reconciliação cobertos |
| Falha de importação | Conflito de slug provoca rollback da liquidação e importação; recuperação segura mantém a cobrança pendente |
| Repetição controlada | Uma correção de JSON usa o mesmo orçamento do artigo; sem terceira tentativa; rascunho concluído não é gerado de novo |
| Operação | ETag/304, backoff, retenção, limite de armazenamento, CLI once/status/healthcheck e recusa de migração sem --execute |

Os dados sintéticos publicados durante o teste só existiram no PostgreSQL temporário. Nenhum artigo, imagem ou vídeo foi publicado no site.

## Comandos executados

Diretório de execução: `blog-worker`. Todos os processos de projeto passaram pela fila `/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command`.

```sh
node --test --test-reporter=spec --test-concurrency=1 test/worker.test.mjs
BLOG_TEST_PG_BIN=/caminho/postgresql/bin \
BLOG_TEST_CMS_DEPENDENCIES_FROM=/caminho/site-com-dependencias \
node test/postgres-integration.mjs
node scripts/validate-readiness.mjs --out ../.local/blog-flow-test-20261106/sources.json
```

O segundo comando usa caminho explícito dos binários locais e dependências existentes; não aceita banco externo. `git diff --check` também passou. Hashes dos arquivos testados e metadados das nove fontes: [full-flow-validation.json](full-flow-validation.json).

## O que este resultado não comprova

- A qualidade do texto do GPT-6 Luna, formato real da resposta e cobrança real continuam pendentes de piloto autorizado após resposta do suporte. Contagem e geração foram simuladas.
- A aprovação de direitos/editorial de cada fonte continua pendente. RSS acessível não equivale a autorização para reescrita. OpenAI/Google Research/DeepMind continuam com textos curtos demais para o dossiê atual; Oportunidades ainda não tem fonte real homologada.
- A privacidade e o fluxo editorial foram verificados na camada real de dados; não foi executado navegador autenticado contra o CMS local, nem novo teste de OAuth, renderização ou upload HTTP.
- Não houve geração/busca automática de mídia, publicação autônoma, teste do container Docker, conexão de banco/TLS na VPS, migração de produção ou deploy.
- O benefício, a organização isolada e a gratuidade da contagem aguardam resposta humana do suporte. O worker continua com geração false, zero fontes habilitadas e zero preços aprovados.

Os testes locais aprovam o fluxo implementado até os limites acima; não liberam ativação em produção.
