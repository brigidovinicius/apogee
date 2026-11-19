# Descoberta de benefícios de software

## Catálogo para membros

A Apogee usa a área de [Benefícios](https://www.apogee.community/membros/beneficios) com acesso da assinatura anual, busca por ferramenta ou fornecedor, filtros de categoria e público, salvos e histórico. O [PR #211](https://github.com/brigidovinicius/apogee/pull/211) prepara o catálogo inicial, o filtro por público e a revalidação das fichas cadastradas. O requisito registrado no PRD é manter 100 campanhas distintas disponíveis. O PR registra 101 de 109 candidatas na rodada anterior à publicação.

A referência da Secret é o percurso de encontrar uma oferta por categoria, conferir o valor e as condições na ficha e seguir para o resgate. Na Apogee, o membro precisa ver o tipo da oferta, a elegibilidade, a vigência e o caminho oficial. Um programa externo fica identificado pelo fornecedor. A exclusividade Apogee exige autorização de distribuição. [Catálogo de referência](https://www.joinsecret.com/categories/customer-software)

## Descoberta e revisão

1. **Coleta.** O manifesto `make-it-fly-current/content/benefit-discovery-sources.json` registra oito fontes oficiais. O GitHub Education apresenta cartões novos e mudanças de termos. A consulta filtra recursos gratuitos de uso geral e condições idênticas já encontradas. A Adobe Brasil usa um índice e páginas de termos. Azure Students, Microsoft for Startups, Cloudflare, ElevenLabs, GitHub for Startups e Shopify Brasil usam regras por programa.
2. **Triagem.** A rodada confirma o destino oficial e sinais da própria campanha. O relatório distingue fonte observada, evidência parcial, revisão, indisponibilidade e falha temporária. Na Adobe, redirecionamentos fora do domínio são interrompidos. Termos reconhecidos com prazo vencido ficam de fora das candidatas. O limite é de 12 páginas de termos por rodada e o relatório informa excesso para revisão.
3. **Aceite da ficha.** A curadoria confirma modalidade, plano, público, acesso no Brasil, conta nova ou vínculo exigido, data-limite para contratar, duração da vantagem, preço depois da promoção e destino de inscrição ou resgate. A ficha registra a fonte oficial e a data da checagem. Se a ativação depender de login ou aprovação, essa condição aparece no catálogo. O resgate só é confirmado com evidência do resultado.
4. **Publicação e acompanhamento.** A oferta aprovada entra no manifesto de ofertas com as regras que identificam os termos aceitos. O importador e o monitor do PR #211 fazem a verificação de publicação e de vigência. Uma rodada de descoberta gera candidatas para curadoria. A rotina usa apenas páginas públicas e grava o último relatório em volume próprio. Em falha temporária, a observação anterior fica marcada como desatualizada e a rodada é repetida após seis horas. O intervalo padrão é de 24 horas.

**Antes de publicar**, conferir a composição do catálogo por categoria e perfil, a contagem de ofertas elegíveis e a última checagem. Acompanhar candidatas novas por fonte, tempo até a revisão, motivos de rejeição e ofertas confirmadas por resgate. A Secret, Sebrae Conecta e ACATE podem indicar parcerias para análise. As condições de cada canal valem para o público atendido por ele. [Sebrae Conecta](https://meuatendimento.sebrae.com.br/sites/PortalSebrae/conecta) · [ACATE Startups](https://sc.acate.com.br/acate-startups)

## Operação

No diretório `make-it-fly-current`, a rodada de leitura imprime o relatório JSON. O modo contínuo usa o mesmo relatório para retomar o agendamento após reinício.

```sh
node scripts/member-benefit-discovery.mjs
node --test --test-concurrency=1 tests/member-benefit-discovery.test.mjs
```

Após a revisão e a autorização de publicação da imagem, usar a configuração e o SHA aprovados do Compose da Apogee. A rotina habitual que sobe apenas `web` precisa iniciar também `benefit-discovery`.

```sh
docker compose -f infra/site/docker-compose.yml --profile benefits up -d --no-build benefit-discovery
docker compose -f infra/site/docker-compose.yml --profile benefits logs --tail 30 benefit-discovery
docker compose -f infra/site/docker-compose.yml --profile benefits exec -T benefit-discovery cat /app/worker-state/benefit-discovery.json
```

A triagem pode começar pelo campo `candidates` de cada fonte. `staleCandidates` preserva achados anteriores quando a leitura falhou temporariamente. Se houver mudança de termos ou acesso restrito, conferir a evidência diretamente no fornecedor e registrar o resultado antes de atualizar o manifesto. Para a Adobe, a página pública renderizada mostra os termos, mas a resposta HTML inicial consultada pelo serviço contém apenas referências usadas pela aplicação do fornecedor. Essa limitação aparece como revisão na rodada. [Ofertas Adobe Brasil](https://www.adobe.com/br/products/special-offers.html)

## Verificação em 18/11/2026

A rodada consultou oito fontes. Seis programas diretos passaram na triagem e o GitHub Education apresentou um cartão para conferir. O cartão Dev Essentials ainda cita o Visual Studio para Mac, cujo suporte foi encerrado. A ficha depende de confirmação das vantagens atuais diretamente na Microsoft. A Adobe ficou em revisão. [GitHub Education](https://education.github.com/pack#microsoftvisualstudio) · [Dev Essentials](https://visualstudio.microsoft.com/dev-essentials/) · [Ciclo de vida do Visual Studio](https://learn.microsoft.com/lifecycle/announcements/visual-studio-mac-end-of-servicing)

Cinco testes focados passaram. Cobrem descoberta, mudança de termos, recursos gratuitos de uso geral, condições duplicadas, expiração, encaminhamento fora do domínio e falha temporária. A rodada real do modo contínuo gravou o relatório e o reinício respeitou o intervalo salvo. O Compose reconheceu o serviço no perfil `benefits`. O candidato está em revisão local e a rotina permanece pendente de ativação na VPS.
