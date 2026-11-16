# Curadoria inicial da Caixa — operação de release

## Conteúdo e limites

O proprietário autorizou em 15/11/2026 ampliar os links e publicar após testes. O lote revisado contém 26 ferramentas em oito categorias: Vídeo, Imagem e design, Áudio, Texto e pesquisa, Produtividade e automação, Programação, Sites e publicação e Infraestrutura. Duas identidades pedidas permanecem pendentes por orientação do proprietário. Não cadastrar automaticamente identidades não confirmadas. Não há parceria, desconto, crédito ou gratuidade presumidos; `conditions` permanece NULL.

O repositório é público. O manifesto editorial real e a relação completa das fontes oficiais permanecem em artefato privado do operador, fora do Git, da imagem e do CI. O CI usa somente fichas sintéticas. O manifesto recebe data real de conferência por agente e método `official-sources-agent-review`; não é uma revisão humana atribuída a um administrador.

## Contrato do importador

- Script: `scripts/member-toolbox-curate.mjs`, incluído no runner Docker.
- Entrada: JSON revisado por stdin, até 128 KiB; nenhuma leitura de dotenv e nenhum caminho arbitrário recebido por HTTP. Não há endpoint novo nem Server Action para importação.
- Preflight é padrão, sem inserções. `--apply` exige o SHA-256 exato do manifesto em `APOGEE_TOOLBOX_CURATION_SHA256`. A impressão digital é `SHA256(JSON.stringify(manifest))`, calculada após parse e validação.
- Exige TLS operacional, credenciais do papel `apogee_app`, esquema/journal da migração 0019 verificados e SHA do release de 40 caracteres em `APOGEE_RELEASE_SHA`. A validação local usa papel e cluster sintéticos explícitos.
- Ator: `release-import`. `reviewed_by` e `updated_by` são NULL, sem escolher um administrador real, criar conta ou conceder papel. `reviewed_at` vem do instante real da conferência do manifesto; não é atualizado pela reexecução.
- Saída JSON: ator operacional, método de conferência, SHA do release, identificador e SHA do manifesto, ferramentas/categorias novas, itens preservados, conflitos e contagens efetivamente inseridas. Sem email, identidade de usuário, token, senha ou dados de cobrança. Guardar a saída em registro privado do release; ela contém a proveniência editorial da operação.
- Operação atômica com trava transacional de importação e limites de espera. Falha em qualquer ficha reverte todo o lote. Não altera direitos anuais, cota de eventos, legado do Radar, papéis ou contatos.
- Categorias existentes preservam nome, ordem e estado. Fichas já cadastradas pelo URL preservam todos os campos, versão e arquivamento. Reexecução/concorrrência não duplicam URLs.
- Nome existente com outro URL ou categoria existente não publicada gera conflito: preflight informa e apply recusa o lote inteiro. Resolver editorialmente; não forçar atualização.

## Aplicação pelo executor único

1. Confirmar o candidato final e CI, backup restaurável, fingerprints dos direitos e migração 0019 pelo runbook da oferta. Não aplicar a partir de um checkout ou imagem divergente.
2. Validar o arquivo privado e seu SHA com o importador do candidato; manter o mesmo conteúdo no preflight e apply. Transmitir o JSON como dados por stdin sobre SSH, sem copiar código ou arquivos para o checkout da VPS.
3. No container/imagem operacional do release, conferir `APOGEE_RELEASE_SHA`, TLS/CA montados e o papel, então executar o preflight com stdin. Não colocar valores privados de conexão ou dotenv nos logs/argumentos.
4. Conferir conflitos, listas e contagens do preflight. Aplicar o mesmo manifesto e SHA aprovado com `node scripts/member-toolbox-curate.mjs --apply`, guardando o JSON de resultado em evidência privada.
5. Reexecutar preflight/apply: zero inserções. Comparar direitos/legado/cota antes e depois. Conferir catálogo pelo acesso anual e bloqueio por visitante/gratuito/legado; não consumir cotas de contas reais para o teste.
6. Registrar as contagens finais e o hash editorial no release. O rollback de código preserva o catálogo e o banco; não apagar as fichas importadas como rollback automático. Curadoria posterior acontece pelo admin autenticado.

Exemplo do contrato dentro do ambiente operacional já autorizado (manifesto fornecido pela entrada padrão):

```sh
node scripts/member-toolbox-curate.mjs < manifesto-privado.json
# Após revisar o preflight e configurar o hash exato:
node scripts/member-toolbox-curate.mjs --apply < manifesto-privado.json
```

O exemplo não autoriza publicação ou banco por si só; a autorização vem do proprietário e do candidato de release revisado. A ativação de vendas live permanece separada.
