# Descoberta de benefícios de software

## Catálogo para membros

A Apogee usa a área de [Benefícios](https://www.apogee.community/membros/beneficios) com acesso da assinatura anual, busca por ferramenta ou fornecedor, filtros de categoria e público, salvos e histórico. O [PR #211](https://github.com/brigidovinicius/apogee/pull/211) prepara o catálogo inicial, o filtro por público e a revalidação das fichas cadastradas. O requisito registrado no PRD é manter 100 campanhas distintas disponíveis. O PR registra 101 de 109 candidatas na rodada anterior à publicação.

A referência da Secret é o percurso de encontrar uma oferta por categoria, conferir o valor e as condições na ficha e seguir para o resgate. Na Apogee, o membro precisa ver o tipo da oferta, a elegibilidade, a vigência e o caminho oficial. Um programa externo fica identificado pelo fornecedor. A exclusividade Apogee exige autorização de distribuição. [Catálogo de referência](https://www.joinsecret.com/categories/customer-software)

## Descoberta e revisão

1. **Coleta.** O manifesto `make-it-fly-current/content/benefit-discovery-sources.json` registra as fontes oficiais. O GitHub Education apresenta cartões novos e mudanças de termos. A consulta filtra recursos gratuitos de uso geral e condições idênticas já encontradas. A Adobe Brasil usa um índice e páginas de termos. As demais fontes são consultadas pelas condições de cada programa.
2. **Triagem.** A rodada confirma o destino oficial e sinais da própria campanha. O relatório distingue fonte observada, evidência parcial, revisão, indisponibilidade e falha temporária. Na Adobe, redirecionamentos fora do domínio são interrompidos. Termos reconhecidos com prazo vencido ficam de fora das candidatas. O limite é de 12 páginas de termos por rodada e o relatório informa excesso para revisão.
3. **Aceite da ficha.** A curadoria confirma modalidade, plano, público, acesso no Brasil, conta nova ou vínculo exigido, data-limite para contratar, duração da vantagem, preço depois da promoção e destino de inscrição ou resgate. A ficha registra a fonte oficial e a data da checagem. Se a ativação depender de login ou aprovação, essa condição aparece no catálogo. A conclusão do resgate depende da elegibilidade do membro.
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

## Publicação automática

O monitor de Benefícios lê o relatório de descoberta das últimas 24 horas. Para publicar, a candidata precisa corresponder a uma regra versionada em `make-it-fly-current/content/benefit-automatic-rules.json`. Essa regra identifica a campanha, a vigência e os termos oficiais que confirmam disponibilidade no Brasil. Para resgate pela web, a oferta oficial deve apontar para a inscrição com o identificador da campanha. Quando o resgate ocorre no aplicativo, a automação exige os passos explícitos no regulamento e um link que chegue à página exata com os termos da mesma campanha. Em caso de falha temporária, tenta novamente após uma hora. Termos alterados ou evidência inconclusiva ficam em revisão.

A publicação usa o identificador da campanha, URLs equivalentes e nomes conhecidos para comparar com as fichas já registradas, inclusive rascunhos e arquivadas. A transação repete a conferência antes de inserir e grava a ficha, a auditoria e o recibo juntos. Uma edição que diverge da regra pede revisão. As fichas anteriores continuam sujeitas ao monitor existente.

A primeira regra elegível é a Conta Gratuita do Azure, com US$ 200 em créditos por até 30 dias. Ela exige cartão de crédito para o Brasil. Azure for Students corresponde à ficha já cadastrada por meio do GitHub Education. Programas sem regra aprovada, como cartões novos do GitHub Education ou páginas da Adobe com conteúdo inconclusivo, seguem para curadoria. [Termos da Conta Gratuita do Azure](https://azure.microsoft.com/pt-br/pricing/offers/ms-azr-0044p/)

Para ativar na VPS após a revisão da versão, usar a mesma imagem nos serviços de descoberta e monitoramento e informar `BENEFIT_AUTO_REVIEW_EDITOR_ID` na configuração privada do Compose com o identificador do administrador responsável. O serviço de descoberta mantém acesso apenas às fontes públicas. O monitor lê o relatório pelo volume compartilhado em modo de leitura e usa a conexão com o banco já configurada. Sem o identificador, somente a revalidação das fichas cadastradas continua ativa. O log `benefit-auto-review` registra a decisão por candidata. O comando `--force` executa somente a revalidação.

## Ampliação de IA, design e produtividade em 19/11/2026

O candidato amplia o manifesto de 9 para 18 fontes. Quando a lista de endereços muda, o serviço gera uma rodada na inicialização com a nova lista. A partir daí, o relatório volta a determinar o agendamento.

| Área | Fontes adicionadas |
| --- | --- |
| IA | Samsung e Google para aparelhos Galaxy, Nubank ChatGPT Go, Google One para estudantes e Vivo Gemini |
| Design | Adobe Firefly, Clip Studio Paint e Framer para estudantes |
| Produtividade | Asana Brasil e monday.com para organizações sem fins lucrativos |

A regra da Samsung cobre seis meses de Google AI Pro para modelos Galaxy indicados tanto pela Samsung quanto pelo Google. A ficha descreve as datas de compra por modelo, o limite de 01/08/2027 para resgate, o fluxo no aplicativo Gemini e a cobrança após o teste. A verificação usa as duas páginas oficiais e vincula as instruções ao endereço exato dos termos da campanha. [Regulamento Samsung Brasil](https://www.samsung.com/br/offer/gemini-regulation/) · [Termos Google](https://one.google.com/offer/terms-and-conditions/SamsungAIPro)

A simulação pela VPS observou sete candidatas novas. Aprovou a campanha Samsung e reconheceu a ficha como duplicada na segunda passagem. A consulta ao catálogo real em modo somente leitura confirmou a ausência de ficha equivalente. Nubank e Google One dependem de condições da conta. Clip Studio Paint, Framer, Asana e monday.com exigem confirmação adicional de elegibilidade ou resgate. Os termos promocionais do Firefly não aparecem no HTML que o worker lê e a resposta da Vivo foi inconclusiva. A simulação consultou páginas públicas sem ativar assinaturas.

Os 29 testes de descoberta, revisão, checagem de fontes e integração PostgreSQL passaram em ambiente temporário. A ativação da versão depende da autorização do SHA.
