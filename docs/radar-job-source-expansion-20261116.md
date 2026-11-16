# Ampliação de fontes FDE — 16/11/2026

Escopo: ampliar os quadros oficiais de empregos para descobrir FDE remotos com Brasil confirmado, preservando o teto mensal de US$ 50 e as parcelas 30/15/5. A coleta usa somente os GETs públicos já suportados de Ashby e Greenhouse; não usa IA paga.

## Auditoria atual

| Fonte | Anúncios no quadro | Candidatas FDE/implantação | Aptas no recorte remoto/Brasil |
| --- | ---: | ---: | ---: |
| jobs-latamcent | 13 | 1 | 0 |
| jobs-truelogic | 65 | 9 | 1 |
| jobs-oscilar | 20 | 0 | 0 |
| jobs-telnyx | 56 | 15 | 0 |
| jobs-elevenlabs | 125 | 5 | 0 |

Uma vaga adicional da Truelogic está apta nesta consulta: [Forward Deployed Engineer (AI & Business Transformation)](https://jobs.ashbyhq.com/truelogic/88f763c0-d0e2-4181-bd21-9377983bbc69). As demais candidatas permanecem sob as regras existentes: localidade, trabalho remoto e residência no Brasil precisam de evidência por vaga. LATAM, idioma português e histórico da empresa não bastam. Quadros sem vaga apta seguem úteis para monitorar novas publicações, sem exibir candidatas inelegíveis no catálogo.

Vínculos com os quadros conferidos nas páginas institucionais: [LatamCent](https://latamcent.com/careers/), [Truelogic](https://www.truelogic.io/careers), [Oscilar](https://oscilar.com/careers), [ElevenLabs](https://elevenlabs.io/careers/positions) e [Telnyx](https://telnyx.com/careers). O identificador canônico da ElevenLabs é `ElevenLabs`, sensível a maiúsculas no caminho dos links; permanece limitado ao seu próprio quadro.

NextLink Labs não foi incluída: o quadro atual estava vazio. Anúncios antigos encontrados por buscadores não foram tratados como disponibilidade atual. Firecrawl, Taktile e Breakmark apresentaram condições presenciais ou híbridas nas fichas examinadas, portanto não foram usados para aumentar artificialmente o catálogo remoto.

## Implementação e limites

- A migração 0057 apenas cadastra as cinco novas fontes como inativas e pendentes, com intervalo de seis horas. `ON CONFLICT DO NOTHING` preserva cadastros anteriores. Homologação e ativação usam o fluxo editorial existente depois da revisão.
- A lista de fontes da auditoria gratuita vem do mesmo registro de quadros; IDs opcionais permitem auditar somente as fontes necessárias. A ferramenta informa razões de retenção e evidências por vaga. Erros e snapshots inválidos continuam falhando antes de qualquer persistência.
- As URLs de ficha e candidatura continuam limitadas ao tenant e ao ID exatos, com rejeição a outros tenants, parâmetros de redirecionamento e HTTP.
- Nenhuma alteração nos algoritmos de elegibilidade, na API pública da Apogee, no site, no blog, em chaves, em preços ou nas funções/tabelas de orçamento.
- O orçamento continua US$ 30 para o Radar, US$ 15 para empregos e US$ 5 para rechecagens/recuperação. Não há transferência de parcela nem novo serviço contratado.

## Publicação operacional

Após CI completo e revisão: conferir main, checkout limpo, capacidade, inventário e backup restaurável do Radar; construir a imagem exata; aplicar somente a 0057; atualizar somente o web do Radar, preservando o scheduler que usa o mesmo endpoint. Preservar o site/blog, o worker de IA e as configurações montadas. Verificar e ativar individualmente as cinco fontes homologadas, iniciar uma coleta limitada e conferir catálogo público, filtros e ledger antes/depois.

Rollback: desativar somente as fontes novas e restaurar a imagem anterior do web; manter dados, migração aditiva, tombstones e edições do administrador. O registro operacional e os SHAs efetivamente publicados serão guardados na pasta privada de evidências desta tarefa.

## Seleção automática e empacotamento

A seleção agendada de fontes API usa o registro `jobSourceIds()` parametrizado no SQL, evitando uma segunda lista fixa que deixaria novas fontes apenas na coleta manual. Continua exigindo fonte ativa e verificada, intervalo vencido e lease transacional; fontes API não registradas não são aceitas. O teste de integração cobre as cinco novas fontes, ausência de duplicação durante o lease e reagendamento em seis horas.

Os arquivos públicos do container pertencem ao usuário restrito do runtime e o certificado público adicional é copiado explicitamente em modo 644. Isso evita que uma umask restritiva no checkout retire acesso de leitura. O conteúdo do certificado e os segredos existentes permanecem preservados.
