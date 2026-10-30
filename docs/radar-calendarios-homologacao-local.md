# Homologação local de login, salvos e ICS

Consulte também a [rodada completa de testes](radar-calendarios-testes-20261029.md), com correções, cobertura e limitações atualizadas.

A [validação posterior do painel integrado e do Calendário do Mac](radar-admin-mac-calendar-20261029.md) confirmou criação, edição, exclusão e sincronização de eventos fictícios. A busca textual do Mac não os exibiu durante a sessão; confira as datas indicadas no relatório.

Este ambiente usa a aplicação compilada, Better Auth, sessões, permissões e server actions reais, com PostgreSQL e catálogo fictícios isolados. Não acessa os bancos ou serviços privados de produção.

## Abrir e testar

Endereço: `http://127.0.0.1:4381/membros/entrar?next=%2Fmembros%2Foportunidades`

As credenciais locais ficam em `.local/radar-calendar/CONTAS-DE-TESTE.md` (ignorado no Git). Há três contas:

- `vitalicio@radar.test`: pode abrir detalhes, salvar e assinar a agenda; usa o direito legado existente, sem simular uma cobrança Stripe.
- `gratuito@radar.test`: escolhe uma oportunidade gratuita, pode reabri-la e encontra a oferta de acesso ao tentar outra; não recebe calendário pessoal.
- `revogado@radar.test`: faz login, mas não possui direito vitalício. Permite conferir o bloqueio do calendário pessoal.

Todas são membros comuns, sem papel administrativo. Use e-mail/senha: OAuth Google, entrega de e-mail e checkout externo ficam desabilitados.

1. Entre como vitalício, abra uma oportunidade e use **Salvar no meu calendário**.
2. Abra **Meu calendário**, confira as etapas e gere o link privado `.ics`.
3. Consulte o link; deve responder `text/calendar`, com eventos e datas das oportunidades salvas.
4. Gere outro link: o anterior deve passar a retornar 404.
5. Remova uma oportunidade: a próxima consulta deve conter o cancelamento dos eventos já exportados. A atualização no aplicativo de calendário depende da frequência com que ele consulta o feed.
6. Saia e entre como gratuito para testar a primeira oportunidade e o bloqueio da segunda.

**Assinatura externa:** um aplicativo instalado neste Mac pode consultar `127.0.0.1` (por exemplo, Calendário Apple). Google Agenda e Outlook na nuvem não conseguem buscar um endereço local. Para eles, é possível importar um arquivo exportado, mas isso não testa sincronização. Nenhum túnel público ou deploy foi criado.

## Serviços e persistência

- Proxy da interface: `127.0.0.1:4381`, sobrescreve a identidade de IP conforme o contrato já existente do preview.
- Next compilado: `127.0.0.1:48761` (use o proxy para login).
- Catálogo sintético: `127.0.0.1:48762`, autenticado com token exclusivo local.
- PostgreSQL: `127.0.0.1:48763`, banco `apogee_radar_calendar_local`, com usuário próprio sem privilégios de superusuário.
- Dados e configuração: `.local/radar-calendar/`, com credenciais aleatórias, arquivos privados e diretório ignorado no Git. Não apagar para reiniciar: salvos, sessões e tokens devem persistir.

O inicializador recusa endereços diferentes desse banco, verifica a identificação do ambiente e não aplica migrações sobre um banco já povoado sem a identificação. O servidor recebe apenas variáveis locais explícitas e recusa arquivos `.env` neste checkout. Não copia segredos de produção.

## Reabrir depois

A partir da raiz deste worktree:

```sh
python3 make-it-fly-current/scripts/calendar-local-database.py start
cd make-it-fly-current
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/calendar-local.mjs setup
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/calendar-local.mjs serve
```

`setup` aplica apenas migrações novas e preserva contas, direitos e dados já existentes. `serve` usa o build local disponível; se código mudar, parar apenas este preview e executar `APOGEE_LOCAL_PREVIEW=1 npm run build` pela fila antes de servir novamente. O servidor ocupa a fila enquanto estiver ligado.

Para encerrar, interrompa o processo `serve` desta tarefa. O banco pode ser parado separadamente com `python3 make-it-fly-current/scripts/calendar-local-database.py stop`; esse comando só atua no diretório PostgreSQL criado para esta homologação.

## Validação técnica

O teste com PostgreSQL real local revelou que o Drizzle altera os serializadores JSON do cliente compartilhado. A gravação do snapshot e do histórico passou a serializar explicitamente o parâmetro com cast `jsonb`. O teste `scripts/calendar-local-integration.mjs` reproduz o cliente compartilhado real e confirma salvar, ler, guardar histórico, remover, rotacionar token e bloquear o token após revogação. Ele cria e remove apenas sua própria conta temporária no banco identificado de homologação.

Os links dos eventos no `.ics` usam a origem confiável configurada da aplicação: no teste ficam em localhost, sem levar as fichas fictícias para o domínio de produção.

Resultados em 29/10/2026:

- 513 testes aprovados; lint sem erros (um aviso preexistente na galeria); build compilado com sucesso, em sequência na fila.
- Login pelo formulário de todas as três contas aprovado.
- Vitalício: salvar e remover pela server action funcionaram. Feed HTTP 200, `text/calendar`, `private, no-store`, três eventos e links para localhost.
- Rotação pela interface: link anterior retornou 404 e novo link retornou 200. Remoção pela interface: os três eventos retornaram `STATUS:CANCELLED`.
- Gratuito: primeira oportunidade aberta; botão de salvar ausente; segunda oportunidade direcionou à oferta, com pagamento externo indisponível. A escolha gratuita usada no teste foi zerada somente nessa conta fictícia para a revisão do usuário.
- Gratuito e revogado: tentativa de abrir o calendário pessoal direcionou ao acesso vitalício.
- Os testes automatizados de persistência confirmaram revogação do token ao perder o direito. A sincronização em um aplicativo externo depende da validação do usuário; nenhum calendário pessoal real foi alterado.

O ambiente permanece ligado para a validação, com os dados persistidos apenas nesta instância local.

## Painel Radar integrado ao serviço real, somente local

Além das três contas de membro, o preparo editorial adiciona `admin@radar.test` (papel admin) e `assinatura@radar.test` (membro com acesso legado). Ambas usam a senha de demonstração documentada no arquivo privado de contas. O teste no Calendário do Mac usou a agenda da conta administrativa, separada da conta vitalícia do usuário.

O modo integrado preserva os três exemplos originais e inclui os registros que forem criados pelo painel. Usa outro banco local, `radar_calendar_editorial_local`, e o servidor Radar na porta 3000. Antes de iniciar, essa porta deve estar livre; não encerre serviços de outros projetos. As fontes reais da cópia são desativadas; somente a fonte fictícia fica ativa, sem coleta automática. Não acione fontes reais durante a homologação.

Com o preview pausado mediante autorização, prepare o banco e compile os dois projetos em sequência:

```sh
python3 make-it-fly-current/scripts/calendar-editorial-database.py
npm run build --prefix radar-academico
APOGEE_LOCAL_PREVIEW=1 npm run build --prefix make-it-fly-current
cd make-it-fly-current
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/calendar-local.mjs serve --editorial
```

O script confere o diretório do cluster, banco e marcadores locais antes das migrações. Não substitui senhas de roles existentes. Os dois servidores compilados pertencem ao mesmo processo de homologação na fila; não inicie builds ou testes pesados enquanto estiverem ativos. Use `http://127.0.0.1:4381/admin/radar` e login de administrador para criar/editar oportunidades fictícias.

A assinatura `Apogee QA local 29-10` foi adicionada **Em Meu Mac**, com atualização configurada a cada 5 minutos. Após remoção no painel, o Apple Calendar exibe os eventos como cancelados. O teste terminou com a ficha QA excluída e seus dois eventos cancelados; os exemplos anteriores continuam disponíveis. Não houve integração com a API do Google nem gravação em calendários Google/iCloud.
