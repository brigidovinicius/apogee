# Eventos e mídias na Apogee

A área **Eventos** fica em `/membros/eventos`. A agenda usa o catálogo em `make-it-fly-current/lib/eventos/catalogo.ts`. A primeira mídia é do **Codex Community Workshop de Florianópolis**, realizado em 21/11/2026. A agenda tem um estado vazio até existir uma oportunidade com inscrição oficial. A página do workshop tem acesso à gravação já publicada no fluxo do evento e oferece download de MP4 quando o operador importa um arquivo autorizado.

## VPS Hostinger em 26/11/2026

O diagnóstico foi feito por SSH em `apogee-vps`, hostname `srv1439756`, por volta de 12h23 de Brasília. O Docker Compose estava na versão 5.5.1. O checkout do site em `/opt/apogee-site/repo` estava limpo no SHA `fa1f16c8af5af903a52ecee0df01a8067a3e557b`, a imagem do site estava saudável nesse SHA, e essa é a base da branch do piloto.

| Recurso | Medição |
| --- | --- |
| CPU | 2 vCPUs x86-64, carga de 1,49 / 1,18 / 1,13 em 1, 5 e 15 min |
| CPU e pressão | Nas três amostras recentes de 1 s, 33–44% de CPU ociosa, 3–7% de steal e 0% de iowait. PSI CPU some de 10,70% em 10 s. |
| Memória | 7,8 GiB totais, 4,2 GiB disponíveis. PSI de memória em 0 na janela. |
| Swap | 1,1 GiB em uso de 4,0 GiB. Nenhuma troca nas três amostras recentes de 1 s. |
| Disco | 39 GiB livres de 96 GiB, ext4 em `/`. Docker e `/opt` compartilham esse volume. |
| Site | Contêiner web com 1.003 MiB. Worker do Blog com 429 MiB. PostgreSQL dos membros com 154,5 MiB e 98,88% de uma CPU no instantâneo do Docker. |
| Histórico sysstat | 20–25/11, 47,4–65,7% de CPU ociosa nos agregados diários. Parcial de 26/11 até 12h20 com 61,7% ociosa e steal de 4,0%. |

A VPS também executava Caddy, PgBouncer, backup dos membros, sincronização de Google Calendar, monitoramento e descoberta de benefícios, previews do Blog, Radar com PostgreSQL 17 e workers, e o sistema de locação com PostgreSQL 16, Redis e Uptime Kuma. A área de membros da Apogee usa Next.js 16.4.6, React 19, Better Auth, Drizzle, Postgres.js e PostgreSQL 17. A galeria pública atual usa `bytea` para imagens de até 3 MiB. O contêiner web usa volume de cache Next.js e mounts para o certificado do PgBouncer e GeoIP. O deploy rotineiro usa Git, SSH e Compose. [Runbook do site](../docs/apogee-routine-vps-deploy.md)

**Estimativa de capacidade.** Cabe um piloto pequeno e isolado. Começar com **0,5 vCPU, 768 MiB, 64 processos e até 2 GiB** de espaço para imagens de contêiner e amostra. A CPU é o primeiro gargalo. Fazer a indexação em janela de baixa carga e parar o piloto se a aplicação acusar degradação ou se houver pressão de memória, troca sustentada ou OOM. Validar a margem de memória e a latência no Linux x86-64 antes de importar o álbum todo. O disco comporta a estimativa de **8–10 GiB adicionais** para o álbum de fotos, miniaturas, runtime e até 1 GiB de vídeo, com cópia no próprio volume e sem duplicar o staging. Se a origem também estiver nesse volume, contabilizar os 5,97 GB extras antes do lote.

A listagem de metadados do Drive confirmou 280 JPEGs, **5.967.030.799 bytes** e arquivo de até 34.450.713 bytes. A dimensão de 4.672 × 6.224 px veio da amostra informada. O lote do fotógrafo entrou apenas no inventário de metadados. [Pasta CODEX Fotos](https://drive.google.com/drive/folders/1X6e-cyyU75rMCGX229JoeaE9r3NaV7p1)

## Como funciona

- A Apogee reutiliza a sessão Better Auth e a proteção da conta. Fotos, miniaturas e downloads exigem conta ativa. Com `APOGEE_WORKSHOP_MEDIA_AUDIENCE=members`, a galeria é aberta a contas Free e Premium. A lista explícita continua disponível para pilotos isolados. A permissão da gravação segue o fluxo já existente da Apogee. Com a galeria manual desativada, somente a conta que tem a foto salva pode visualizar ou baixar aquele original. A checagem da conta acontece em cada requisição.
- O Python roda em rede privada e valida um segredo entre o site e o worker. O importador da galeria faz cópia e miniaturas sem rodar YuNet ou SFace. O limite do piloto é 400 fotos por álbum.
- O diretório privado armazena os JPEGs originais, miniaturas de até 640 px, MP4 opcional e SQLite. A escolha evita colocar as mídias grandes ou o processamento no PostgreSQL de membros. O álbum usa SHA-256 por evento para retomar a importação, grava cada estado no banco, finaliza arquivos por rename e preserva a versão do processamento. O importador opera em sequência. Para a busca opcional, a dimensão de análise começa em 1.600 px com decodificação JPEG reduzida. Se ela mudar, os recortes autorizados precisam ser indexados com a nova versão.
- Quem escolhe a busca autoriza o processamento do próprio rosto. O worker registra o aceite e apenas as coordenadas das regiões autorizadas nas fotos originais. O aceite e as coordenadas expiram após 30 dias e podem ser removidos pelo atendimento de privacidade. A busca fica limitada à conta e ao evento e aguarda pelo menos uma região autorizada. Durante a consulta, a imagem enviada e os recortes são lidos em memória. A cópia da selfie é liberada assim que o vetor de consulta é extraído. Os vetores usados na comparação também são descartados antes de salvar os resultados. A consulta aceita JPEG/PNG até 8 MiB e 16 MP, tem limite de 80 segundos e usa uma busca ativa por vez, com até seis consultas por minuto por conta.
- **Minhas fotos salvas** guarda no banco privado apenas o ID da conta, do evento e da foto original, com a data do vínculo. A busca salva automaticamente os resultados confirmados sem duplicar vínculos. As fotos salvas continuam visíveis ao entrar novamente na conta. A exclusão da foto do álbum ou do álbum remove os vínculos correspondentes.
- Quando houver expiração configurada para a galeria, ela bloqueia visualização e downloads imediatamente. O álbum do Workshop pode ser cadastrado com `--no-expiry`; a expiração do aceite facial continua valendo. Com o serviço ativo, a rotina verifica a expiração a cada minuto e apaga dados e cópias locais. `delete-photo`, `delete-video` e `delete-album` atendem exclusões antecipadas. A interface aponta para o contato de privacidade. O operador precisa localizar todas as fotos aplicáveis e tratar separadamente mídia original no Drive, cópias de segurança e downloads já realizados. Se o serviço ficar suspenso, o expurgo ocorre na retomada ou por comando administrativo.

Antes de ativar o álbum real, registre o público, o prazo e a autorização para distribuir a mídia. O aceite de reconhecimento é separado e vale para o rosto da própria pessoa. A autorização precisa estar vigente no cadastro das regiões e na consulta. [LGPD, arts. 5º, 8º, 11 e 18](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

### Modelos e dependências

Arquivos fixados no commit OpenCV Zoo `48b10fa505aeb51fbd127fc60a5c660040e823b7`. O bootstrap verifica SHA-256 dos ONNX e inclui as licenças verificadas no diretório dos modelos.

- YuNet `face_detection_yunet_2023mar.onnx`, MIT. [Licença YuNet](https://github.com/opencv/opencv_zoo/blob/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_detection_yunet/LICENSE)
- SFace `face_recognition_sface_2021dec.onnx`, Apache 2.0. [Licença SFace](https://github.com/opencv/opencv_zoo/blob/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_recognition_sface/LICENSE)
- OpenCV Python headless 4.13.0.92, Apache 2.0 com componentes licenciados separadamente no wheel. [OpenCV](https://github.com/opencv/opencv-python/blob/4.x/LICENSE.txt) · [Avisos de terceiros](https://github.com/opencv/opencv-python/blob/4.x/LICENSE-3RD-PARTY.txt)
- NumPy 2.4.6, BSD-3-Clause e avisos dos componentes empacotados. Pillow 12.2.0, MIT-CMU. Gunicorn 23.0.0, MIT. Packaging 26.2, Apache-2.0 ou BSD-2-Clause. [NumPy](https://github.com/numpy/numpy/blob/v2.4.6/LICENSE.txt) · [Pillow](https://github.com/python-pillow/Pillow/blob/12.2.0/LICENSE) · [Gunicorn](https://github.com/benoitc/gunicorn/blob/23.0.0/LICENSE) · [Packaging](https://github.com/pypa/packaging/blob/26.2/LICENSE)

## Executar o piloto isolado

Use uma conta de teste na Apogee local e um diretório temporário com JPEGs fictícios ou autorizados. No Compose, a cópia de entrada deve ser legível pelo UID 10001. Execute a partir de `event-photos`. A expiração de exemplo deve ser uma data futura no ambiente de teste.

```sh
export ALBUM_INPUT=/caminho/absoluto/lote-sintetico
export ALBUM_SECRET="$(openssl rand -hex 32)"
export ALBUM_EXPIRY=2026-12-03T18:00:00-03:00
album_event=workshop-codex-community-florianopolis

docker compose -p apogee-event-photos build photos
docker compose -p apogee-event-photos run --rm photos python cli.py init "$album_event" \
  --expires "$ALBUM_EXPIRY" --authorization synthetic-test
docker compose -p apogee-event-photos run --rm photos python cli.py import "$album_event" /input
docker compose -p apogee-event-photos run --rm photos python cli.py status "$album_event"
# Se o lote incluir um MP4 aprovado para download
docker compose -p apogee-event-photos run --rm photos python cli.py import-video "$album_event" /input/workshop.mp4
docker compose -p apogee-event-photos up -d photos
```

Para execução nativa, use Python 3.13 em venv. Os comandos CLI são os mesmos; substitua `/input` pelo caminho de entrada e defina `ALBUM_DATA` e `ALBUM_MODELS` fora do Git.

```sh
python3.13 -m venv /tmp/apogee-event-photos-venv
. /tmp/apogee-event-photos-venv/bin/activate
python -m pip install -r requirements.txt
export ALBUM_DATA=/tmp/apogee-event-photos-data
export ALBUM_MODELS=/tmp/apogee-event-photos-models
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
python cli.py models
python -m unittest -v
# Execute init e import como acima, usando o diretório nativo em vez de /input.
gunicorn --bind 127.0.0.1:8786 --workers 1 --threads 4 'service:create_app()'
```

No macOS, se o Python instalado não localizar suas autoridades TLS, use a cadeia local com `SSL_CERT_FILE=/etc/ssl/cert.pem python cli.py models`.

Para o site local, mantenha a configuração de desenvolvimento do Better Auth e PostgreSQL. Configure `APOGEE_WORKSHOP_MEDIA_ENABLED=true`, `APOGEE_WORKSHOP_MEDIA_URL=http://127.0.0.1:8786`, `APOGEE_WORKSHOP_MEDIA_MEMBER_IDS` com os IDs das contas de teste, e o mesmo `ALBUM_SECRET`. Use `APOGEE_WORKSHOP_MEDIA_BROWSE=true` para a opção de galeria. A busca é controlada separadamente por `APOGEE_WORKSHOP_SELFIE_ENABLED=true` no site e `ALBUM_SELFIE_ENABLED=true` no worker. Entre com uma conta autorizada e acesse `/membros/eventos`. A marcação de captura usa o seletor de arquivo nativo.

### Preparar referências de um participante

1. A pessoa entra em **Encontrar minhas fotos** e dá o aceite. A equipe consulta `python cli.py list-opt-ins "$album_event"` no serviço privado, usa a conta do evento e a galeria para identificar manualmente a foto e delimitar somente o rosto daquela pessoa.
2. Use a posição normalizada de 0 a 1 na imagem orientada, na ordem esquerda, topo, direita e base. Use apenas recortes que contenham exclusivamente o rosto autorizado. O comando verifica o aceite vigente e cadastra apenas as coordenadas. A busca usa somente regiões com um rosto detectável.
3. Repita nas fotos autorizadas. Depois, o participante pode buscar com uma selfie. A remoção de coordenadas e aceite pode ser pedida ao atendimento de privacidade.

```sh
python cli.py index-opt-in "$album_event" ID_OPACO_DA_FOTO   --member-id ID_DA_CONTA --box 0.25 0.17 0.42 0.53
```

A inicialização do worker atualizado mantém álbuns, originais e aceites do volume SQLite, cria as tabelas para coordenadas e fotos salvas e apaga a tabela legada de vetores com `secure_delete`. Regiões anteriormente indexadas como vetores precisam ser cadastradas novamente. Em reversão para o worker anterior, desligue a busca nos dois serviços para evitar retomar a gravação de vetores.

Para exclusões durante o piloto, rode o CLI com as mesmas variáveis e acesso ao volume. Em Docker use `docker compose -p apogee-event-photos run --rm photos python cli.py` seguido dos argumentos. Um registro de exclusão conserva o hash do original até a expiração, para impedir que a reimportação reative a foto.

```sh
python cli.py delete-photo "$album_event" ID_OPACO_DA_FOTO
python cli.py delete-video "$album_event"
python cli.py delete-album "$album_event"
```

## Validação da busca em memória e das fotos salvas

A validação local com imagens fictícias passou em oito testes do worker, TypeScript, ESLint e no fluxo completo pelo navegador. A busca encontrou um original da conta autorizada, salvou seu vínculo, confirmou o download e mostrou o resultado novamente após recarregar a página. O teste também verificou a ausência do botão de revogação, a separação entre contas e a remoção segura da tabela de vetores legados em um banco de teste. A galeria manual e o vídeo permaneceram acessíveis no cenário de membros.

A configuração em produção foi conferida em modo somente leitura. O site e o worker tinham a busca ativa. O álbum tinha 280 fotos, um aceite registrado e zero referências na versão em execução. A ativação com fotos reais depende de registrar regiões correspondentes às pessoas que optarem pela busca.

## Validação da versão anterior da opção individual

O navegador confirmou a galeria com a busca desabilitada. Com a busca habilitada e dados fictícios, o aceite habilitou o cadastro de referência de uma conta, a selfie devolveu somente a foto com o recorte autorizado e a revogação removeu o vetor e o acesso pelos links anteriores quando a galeria manual estava desabilitada. Uma busca de referência levou 127 ms em loopback. A importação da galeria criou zero vetores.

## Resultados da primeira implementação local

As medições abaixo são do piloto sintético anterior à indexação individual. Mac M3, Python 3.13, OpenCV 4.13 e análise de 1.600 px. O lote continha quatro JPEGs sintéticos. Um era retrato, um era grupo, um era retrato de outra pessoa e um era uma cópia ampliada a 29 MP para medir a decodificação. A consulta usou uma imagem sintética produzida em outra composição, sem recorte das fotos indexadas.

| Verificação | Resultado observado |
| --- | --- |
| Indexação | 4 fotos e 7 vetores em 0,88 s de parede, incluindo inicialização. 0,47 s de CPU em modo usuário e 0,11 s em sistema. |
| Foto de 29 MP | 0,199 s no processamento por arquivo após decodificação reduzida, ante 0,482 s na primeira implementação. |
| Pico RSS da CLI | 405 MiB após o ajuste, ante 880 MiB antes. O worker e seu overhead no cgroup Linux ainda precisam de medição. |
| Reimportação | 4 registros reaproveitados e zero novos registros ou vetores. |
| Busca real em loopback | A requisição via navegador, Next e worker levou 112–123 ms em três execuções. Voltaram as três fotos de teste com a personagem, incluindo a cópia de carga. O retrato de outra pessoa ficou fora. |
| Testes HTTP e de interface | Better Auth e PostgreSQL locais, sem sessão, conta fora da lista, prova copiada para outra conta, consentimento, tamanho, ausência de rosto, múltiplos rostos, visualização, download, álbum manual habilitado e desabilitado e MP4 sintético. Chrome em desktop e viewport móvel. |

A amostra verifica o fluxo e a decodificação em alta resolução. Precisão, cobertura em grupos reais, limiar de qualidade, câmera em telefone físico e carga em Docker na VPS ficam pendentes. A configuração do Compose passou em `docker compose config --quiet`. O daemon Docker local estava indisponível, e o HTTP foi exercitado com Gunicorn nativo.

## Publicação e reversão

1. Aprovar separadamente o SHA da área Eventos, o ambiente isolado do piloto na VPS, a base legal, as regras de acesso e a expiração. O material original do Drive permanece na origem e a ingestão usa cópia controlada com o mount de entrada somente leitura.
2. Repetir o preflight do runbook do site por SSH. Disponibilizar o piloto em projeto Compose separado, com os limites iniciais. Começar com a amostra sintética. Testar uso de CPU/RAM, throttling, latência e ausência de falhas no site, Radar e locação antes de aumentar a carga. Ampliar com fotos autorizadas, selfies independentes, retratos, grupos, planos gerais, pouca luz e perfis. Medir correspondências corretas e total de fotografias conhecidas encontradas. A similaridade do SFace não representa probabilidade de identidade.
3. Para o site em contêiner, usar rede Docker interna entre site e piloto com alias `photos` e URL `http://photos:8786`. O Compose local publica só loopback. Na VPS, aplique `event-photos/compose.production.yml` ao worker e `make-it-fly-current/infra/site/event-photos.compose.yml` ao site. Os dois usam a rede Docker interna `apogee-event-media`. O overlay do worker remove as portas publicadas e o do site recebe um arquivo de ambiente separado, mantendo o original. Usar arquivo de ambiente protegido e revisar a omissão de URLs com grants em logs, inclusive na borda. Não publicar o volume de mídia nem incluí-lo em backups sem política de retenção.
4. Validar com uma conta permitida, uma conta negada e sem sessão. Testar a captura em iOS/Android, confirmação de consentimento, exclusões, expiração e vídeo real autorizado. Ativar galeria manual apenas com liberação específica do álbum. Observar o primeiro lote em lotes de teste crescentes antes das 280 fotos.
5. Para reverter o acesso, desligar `APOGEE_WORKSHOP_MEDIA_ENABLED` e reaplicar apenas o serviço web pelo runbook de deploy. Para reverter também o catálogo, voltar ao SHA web registrado no preflight. Para interromper o processamento, parar apenas o projeto Compose do piloto. A remoção definitiva do volume passa pelo procedimento de expiração ou exclusão aprovado. A reversão da interface não requer migração ou rollback do PostgreSQL de membros.
