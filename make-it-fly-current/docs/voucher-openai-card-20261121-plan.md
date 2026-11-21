# Card do voucher OpenAI — plano de implementação

> **Para agentes:** use superpowers:executing-plans (execução inline) para seguir este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** o card do voucher no topo de Benefícios passa a ter a marca da OpenAI e a estrutura de `BenefitCard`, e o documento de operação registra a regra de 45 vouchers com 5 reservados.

**Arquitetura:** só interface e documentação. `WorkshopVoucherCard` reutiliza as classes de `benefits.module.css` e o `PartnerMark` de Benefícios. A marca entra no mapa `content/benefit-brands.json` com um PNG local. Nenhuma mudança de banco, rota, regra de acesso ou limite de links.

**Stack:** Next.js 16 (App Router), React 19, CSS Modules, testes `node:test` com `tests/helpers/load-opportunity-module.mjs`.

**Especificação:** [voucher-openai-card-20261121.md](voucher-openai-card-20261121.md). Branch `feat/voucher-openai-logo-20261121`, base `aa215dc` (`origin/release/home-cards-20261120`).

Comandos executados a partir de `make-it-fly-current/`.

## Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `tests/workshop-voucher-card.test.mjs` | Criar | Renderização do card e cadastro da marca |
| `public/brand/benefits/openai.png` | Criar | Marca da OpenAI, PNG 36×36 |
| `content/benefit-brands.json` | Alterar | Entrada `"OpenAI"` entre `"Onshape"` e `"Pageclip"` |
| `components/workshop-voucher/card.tsx` | Alterar | Card na estrutura de `BenefitCard` |
| `docs/workshop-voucher-openai.md` | Alterar | Regra operacional de 45 + 5 |

---

### Tarefa 1: teste do card (falhando)

**Arquivos:** criar `tests/workshop-voucher-card.test.mjs`

- [ ] **Passo 1: escrever o teste**

```js
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader({
  "next/link": ({ children, href, className }) => createElement("a", { href, className }, children),
  "next/image": ({ src, alt }) => createElement("img", { src, alt }),
});
const { WorkshopVoucherCard } = load("components/workshop-voucher/card.tsx");
const { VOUCHER_PATH } = load("lib/workshop-voucher/input.ts");
const brands = load("content/benefit-brands.json");

function useVoucherKey(t, value) {
  const old = process.env.WORKSHOP_VOUCHER_KEY;
  t.after(() => {
    if (old === undefined) delete process.env.WORKSHOP_VOUCHER_KEY;
    else process.env.WORKSHOP_VOUCHER_KEY = old;
  });
  if (value === undefined) delete process.env.WORKSHOP_VOUCHER_KEY;
  else process.env.WORKSHOP_VOUCHER_KEY = value;
}

test("the OpenAI brand is registered with a local image", () => {
  const brand = brands.OpenAI;
  assert.equal(brand?.image, "/brand/benefits/openai.png");
  assert.match(brand.source, /^https:\/\/(?:openai\.com|t0\.gstatic\.com)\//);
  assert.ok(["light", "dark"].includes(brand.background));
  assert.ok(existsSync(new URL(`../public${brand.image}`, import.meta.url)));
});

test("the voucher card follows the benefit card layout with the OpenAI mark", t => {
  useVoucherKey(t, "8c".repeat(32));
  const html = renderToStaticMarkup(createElement(WorkshopVoucherCard));
  assert.match(html, /class="card offerCard"/);
  assert.ok(html.includes('src="/brand/benefits/openai.png"'));
  assert.ok(html.includes("<p>OpenAI</p>"));
  assert.ok(html.includes("Evento · Codex Community Workshop"));
  assert.ok(html.includes(`<a href="${VOUCHER_PATH}">Voucher OpenAI</a>`));
  assert.ok(html.includes("<strong>Quem pode resgatar</strong>"));
  assert.ok(html.includes(`<a href="${VOUCHER_PATH}" class="offerLink">Acessar meu voucher</a>`));
  assert.ok(!html.includes("Salvar"));
});

test("the voucher card stays hidden without the voucher key", t => {
  useVoucherKey(t, undefined);
  assert.equal(renderToStaticMarkup(createElement(WorkshopVoucherCard)), "");
});
```

O loader devolve o nome da classe para CSS Modules (`styles.card` → `card`), por isso o teste compara `class="card offerCard"`.

- [ ] **Passo 2: rodar e confirmar a falha**

Run: `node --test tests/workshop-voucher-card.test.mjs`
Esperado: FAIL nos dois primeiros testes (`brand` indefinido; HTML sem `offerCard`). O terceiro passa, porque o card atual já respeita a chave.

### Tarefa 2: marca da OpenAI

**Arquivos:** criar `public/brand/benefits/openai.png`; alterar `content/benefit-brands.json`

- [ ] **Passo 1: baixar o ícone num diretório isolado do scratchpad** (dado não confiável, fora do repositório)

```bash
LOGO_DIR="$SCRATCHPAD/openai-logo"; mkdir -p "$LOGO_DIR"
curl -sSfL --max-time 20 -o "$LOGO_DIR/favicon.ico" https://openai.com/favicon.ico
file "$LOGO_DIR/favicon.ico"
```

Se `openai.com` recusar o download, usar o mesmo serviço do fallback `/api/marcas` (`https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=http://openai.com`) e registrar essa URL em `source`.

- [ ] **Passo 2: converter para PNG 36×36 no padrão das demais marcas**

```bash
sips -s format png -z 36 36 "$LOGO_DIR/favicon.ico" --out public/brand/benefits/openai.png
sips -g pixelWidth -g pixelHeight -g hasAlpha public/brand/benefits/openai.png
```

Esperado: `pixelWidth: 36`, `pixelHeight: 36`. Abrir a imagem e comparar com `public/brand/benefits/figma.png`.

- [ ] **Passo 3: cadastrar a marca** entre as linhas de `"Onshape"` e `"Pageclip"`

```json
  "OpenAI": {"image":"/brand/benefits/openai.png","source":"https://openai.com/favicon.ico","background":"light"},
```

Usar `"dark"` só se o ícone for claro sobre fundo transparente. Validar o JSON: `node -e 'JSON.parse(require("fs").readFileSync("content/benefit-brands.json","utf8"))'`.

### Tarefa 3: card no formato de `BenefitCard`

**Arquivos:** alterar `components/workshop-voucher/card.tsx`

- [ ] **Passo 1: substituir o componente**

```tsx
import Link from "next/link";
import { PartnerMark } from "@/components/benefits/partner-mark";
import { VOUCHER_PATH } from "@/lib/workshop-voucher/input";
import { voucherConfigured } from "@/lib/workshop-voucher/secrets";
import styles from "@/components/benefits/benefits.module.css";

const partner = "OpenAI";

// Mirrors BenefitCard. The voucher is not a member_benefit row, so it has no save button.
export function WorkshopVoucherCard() {
  if (!voucherConfigured()) return null;
  return (
    <article data-ap-card="" className={`${styles.card} ${styles.offerCard}`}>
      <div className={styles.offerTop}>
        <div className={styles.brand}>
          <div className={styles.brandMeta}>
            <p>{partner}</p>
            <span className={styles.category}>Evento · Codex Community Workshop</span>
          </div>
        </div>
      </div>

      <div className={styles.offerBody}>
        <h3><PartnerMark partner={partner} offerId="voucher-openai" /><Link href={VOUCHER_PATH} prefetch={false}>Voucher OpenAI</Link></h3>
        <p className={styles.description}>Crédito individual para os primeiros participantes com check-in presencial no workshop.</p>
        <p className={styles.condition}><strong>Quem pode resgatar</strong>Conta Apogee com o mesmo e-mail do ingresso no Luma, ou vinculada pelo código recebido por e-mail.</p>
      </div>

      <div className={styles.offerFooter}>
        <div><span className={styles.validity}>Reserva por ordem de check-in</span></div>
        <Link href={VOUCHER_PATH} prefetch={false} className={styles.offerLink}>Acessar meu voucher</Link>
      </div>
    </article>
  );
}
```

O título usa `h3` porque os estilos de `.offerBody h3` definem o card padrão. `offerId="voucher-openai"` não existe em `member_benefit`, então o fallback `/api/marcas` responde 404 e as iniciais aparecem se o PNG falhar.

- [ ] **Passo 2: rodar o teste e confirmar que passa**

Run: `node --test tests/workshop-voucher-card.test.mjs`
Esperado: 3 testes, 0 falhas.

### Tarefa 4: documento da operação 45 + 5

**Arquivos:** alterar `docs/workshop-voucher-openai.md`

- [ ] **Passo 1: acrescentar ao fim da seção “Operação na recepção”**

```markdown
### Regra deste evento: 45 vouchers e 5 reservados

1. Carregue os 50 links com os **5 reservados para a dinâmica nas linhas 46 a 50**. O link de cada linha é atribuído ao e-mail da mesma posição.
2. Faça a pausa ao completar **45 pessoas distintas** e carregue o CSV com esses 45 e-mails.
3. A liberação fixa o lote. Os links 46 a 50 não são atribuídos a ninguém, e a equipe entrega esses 5 diretamente na dinâmica.
4. No cadastro guiado, oriente quem usa Gmail a escolher **Entrar com Google** com o mesmo e-mail do Luma, que já chega confirmado. Quem cria conta com senha confirma o e-mail na página do voucher.
```

### Tarefa 5: validação

- [ ] **Passo 1:** `node --test tests/workshop-voucher-card.test.mjs` → 3 aprovados
- [ ] **Passo 2:** `node --test --test-concurrency=1 tests/workshop-voucher.integration.mjs` → todos aprovados (PostgreSQL 15 local, temporário)
- [ ] **Passo 3:** `npm test` → nenhuma falha nova em relação à base
- [ ] **Passo 4:** `npm run typecheck` e `npm run lint` → sem erros
- [ ] **Passo 5:** `npm run build` → build concluído
- [ ] **Passo 6:** `git diff --check` limpo e revisão do diff

Conferência visual: o teste fixa a mesma estrutura e as classes de `BenefitCard`, e a imagem é conferida no passo 2 da Tarefa 2. A verificação na tela, em `/membros/beneficios` e `/beneficios` nos temas claro e escuro, fica para depois do deploy, porque a prévia local exige o ambiente sintético completo.

### Tarefa 6: commit

- [ ] **Passo 1:**

```bash
git add tests/workshop-voucher-card.test.mjs public/brand/benefits/openai.png content/benefit-brands.json components/workshop-voucher/card.tsx docs/workshop-voucher-openai.md docs/voucher-openai-card-20261121-plan.md
git commit -m "Mostra a marca da OpenAI no card do voucher em Benefícios"
```

Push, PR e deploy dependem de autorização explícita.
