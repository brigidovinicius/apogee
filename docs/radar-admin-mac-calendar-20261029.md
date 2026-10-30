# Painel integrado e Calendário do Mac — 29/10/2026

## Resultado

Validação local concluída com a interface Apogee, serviço Radar real e PostgreSQL isolado. Criação, edição, validação de fonte, exclusão e autorização foram verificadas. A assinatura foi consultada pelo aplicativo Calendário do Mac e refletiu inclusão, mudança de data/horário e cancelamento.

Uma falha foi corrigida: a lista administrativa reaplicava o filtro de inscrições abertas e escondia fichas encerradas com próximas etapas. Agora o painel mantém esses registros, seus filtros e contagens, sem reabrir inscrições no catálogo público. Teste de regressão incluído.

Não houve push, deploy, migração remota, transação financeira ou alteração de produção. Nenhuma fonte real foi consultada por ingestão. As contas, sessões e exemplos anteriores foram preservados.

## Ambiente

- Interface/proxy: `http://127.0.0.1:4381`.
- Next Apogee compilado: porta 48761; ponte do catálogo: 48762.
- Serviço Radar real: `127.0.0.1:3000`.
- PostgreSQL: `127.0.0.1:48763`, bancos separados `apogee_radar_calendar_local` e `radar_calendar_editorial_local`.
- Fontes reais desativadas somente na cópia local; exatamente uma fonte ativa, `radar-local-calendar-source`, fictícia, sem listagens e sem coleta automática.
- Mapeamento de `radar-academico` para loopback restrito ao processo local. Nenhuma edição de DNS ou hosts do sistema.
- Contas extras de teste: `admin@radar.test` (administrador) e `assinatura@radar.test` (membro com direito legado). Credenciais em arquivo local ignorado.
- Assinatura Mac: **Apogee QA local 29-10**, localização **Em Meu Mac**, atualização configurada a cada 5 minutos. Sem adicionar a iCloud ou Google.

## Cenários executados

| Cenário | Evidência / resultado |
| --- | --- |
| Login administrativo | Login real por senha; fonte fictícia carregada do serviço editorial |
| Criar oportunidade | Ficha `fa4f9a1b-5a4d-437b-b5bd-8f57f0bb0949`, tipo Competições, subtipo Olimpíada, área Matemática, edição QA e duas etapas persistidas |
| Inscrições encerradas | Após a correção, ficha aparece no painel, contagem 1 e link de edição disponível; continua encerrada no detalhe |
| Persistência da edição | Reabertura preservou classificação, área, edição, nomes e datas |
| Fonte inválida | Tentativa com domínio fora da fonte autorizada foi recusada; nenhuma alteração registrada |
| Salvar e assinar | Conta administrativa de teste salvou a ficha e gerou link privado; feed HTTP 200 e duas etapas |
| Prova no Mac | 02/11/2026, 14h–15h BRT, exibida no aplicativo |
| Resultado no Mac | 05/11/2026, dia inteiro, exibido no aplicativo; ICS termina exclusivamente em 06/11 |
| Editar prova | Pelo painel: 03/11/2026, 16h–17h BRT, nome atualizado; UIDs preservados |
| Sincronizar mudança | Mac exibiu a nova data/horário após atualizar calendários; data antiga sem evento QA |
| Remover etapa | Resultado removido no painel: feed com um CONFIRMED e um CANCELLED; Mac mostrou **CANCELADO** em 05/11 |
| Excluir ficha | Exclusão pelo painel: catálogo administrativo vazio, feed com dois CANCELLED; Mac mostrou a prova atualizada como **CANCELADA** em 03/11 |
| Auditoria | Quatro registros: create, update, update, delete, todos atribuídos a `apogee:radar-local-admin` |
| Membro comum | Login da conta assinatura; rota administrativa respondeu redirecionamento Next para `/admin/acesso-negado` |
| API sem credencial | As duas rotas editoriais consultadas responderam HTTP 401 |
| Reinício | Preparo do banco repetido sem perder dados; preview reaberto com sessões preservadas |

## Verificações automatizadas

- 32 testes de catálogo, conteúdo e calendário aprovados após a correção.
- TypeScript aprovado; build final também verificou tipos.
- Lint sem erros; permanece o aviso anterior de imagem na galeria.
- Builds Radar e Apogee aprovados. Build final da Apogee com `APOGEE_LOCAL_PREVIEW=1`.
- `git diff --check` aprovado.
- Trabalho npm/node pesado serializado pela fila global; preview pausado com a autorização já recebida e reaberto ao final.

Comando dos testes adicionais, dentro de `make-it-fly-current`:

```sh
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node --test --test-concurrency=1 tests/radar-catalogue.test.mjs tests/opportunities-content.test.mjs tests/radar-calendar.test.mjs
```

Esta rodada complementa a bateria anterior de 929 testes; ela não representa uma nova execução integral dessa bateria.

## Comportamento e limites

- O Calendário do Mac mantém os itens removidos como **CANCELADOS**, em vez de ocultá-los. Esse comportamento foi observado na interface real.
- A busca textual do Mac não encontrou os novos itens durante a sessão. A inclusão e alterações foram comprovadas navegando às datas exatas; a busca não é evidência de ausência.
- Última atualização e destino local foram conferidos nas informações da assinatura. Alterações e cancelamentos foram validados com atualização manual. A periodicidade automática foi configurada, mas seu prazo não foi cronometrado.
- A assinatura fica no Mac como evidência de teste e contém somente os dois eventos fictícios cancelados. O preview deve continuar acessível para futuras consultas.
- Não existe conexão direta com a API do Google Agenda nem inclusão automática na conta Google. O recurso implementado é assinatura por URL ICS. Google Agenda e Outlook na nuvem não podem consultar o endereço loopback deste teste. Nenhum túnel público foi aberto.
- Esta validação cobre o gerenciamento Radar integrado. Não afirma homologação de todas as áreas administrativas legadas, e-mail, pagamentos ou ingestão de fontes reais.

Capturas privadas desta rodada estão no diretório de visualizações desta tarefa: `mac-calendario-prova-inicial.png`, `mac-calendario-resultado-inicial.png`, `mac-calendario-prova-atualizada.png` e `mac-calendario-prova-cancelada.png`. Não foram adicionadas ao Git, pois a janela também exibe nomes de calendários pessoais.
