# Anti Metal Button

Integração local dos três CTAs do topo da página inicial: pagamento do Radar,
catálogo de oportunidades e âncora da comunidade. Os destinos permanecem iguais.
Nenhuma alteração nas páginas `/makeitfly` ou `/makeitfly/*`.

## Estrutura e dependências

O aplicativo web está em `make-it-fly-current/`. Já possui React, TypeScript em
modo estrito, Tailwind CSS 4 e shadcn configurados. Não é necessário executar CLI
de instalação nem adicionar dependências.

- Componentes compartilhados: `components/ui/`, alias `@/components/ui`.
- Estilos globais do Tailwind e tokens: `app/globals.css`.
- Estilos da animação: `components/ui/anti-metal-button.module.css`.
- Utilitário de classes: `lib/utils.ts`, alias `@/lib/utils`.
- Demonstração reutilizável: `components/ui/anti-metal-button-demo.tsx`.

Manter o componente em `components/ui/` segue o alias já definido em
`components.json` e permite reutilização sem acoplar o botão à página inicial.

## Uso

```tsx
import Link from "next/link";
import { AntiMetalButton } from "@/components/ui/anti-metal-button";

<AntiMetalButton label="Continuar" onClick={handleContinue} />
<AntiMetalButton type="submit" disabled={pending}>Salvar</AntiMetalButton>
<AntiMetalButton asChild>
  <Link href="/oportunidades" prefetch={false}>Explorar o Radar</Link>
</AntiMetalButton>
```

`label` tem precedência sobre `children` em botões nativos. Com `asChild`, passe
um único link e coloque o texto dentro dele. Radix `Slot`/`Slottable` preservam
a semântica, os atributos e a navegação do link, inclusive na fronteira entre
Server e Client Components. Botões nativos usam `type="button"` por padrão.

`accentFrom`, `accentTo` e `dotColor` permitem personalizar as cores. Os padrões
verde-lima e os gradientes claro/escuro seguem a referência recebida. A faixa
expande no hover e no foco visível; os pontos respeitam redução de movimento e
o controle de pausa já existente na homepage. O texto pode quebrar em telas
estreitas, mantendo pelo menos 44 px de altura.

## Validação local em 20/10/2026

- `npm run typecheck`: passou na primeira versão da integração.
- `npm run lint -- components/ui/anti-metal-button.tsx components/ui/anti-metal-button-demo.tsx components/home/editorial-home.tsx`: passou na primeira versão.
- `node --test tests/apogee-design-system.test.mjs tests/home-opportunities.test.mjs`: 7 testes passaram.
- Após a conferência em execução, a composição inicial dos links foi substituída
  por `Slot`/`Slottable` para tratar filhos vindos de Server Components. Webpack
  compilou a versão corrigida e ela foi validada no navegador.
- Larguras 320, 390, 768 e 1440 px: sem overflow horizontal e sem texto cortado.
  Em 320 px, o CTA de pagamento ocupa duas linhas e 64 px de altura.
- Hover expande a faixa de 36 px até a largura do botão menos 8 px. Foco visível
  tem contorno e expansão; redução de movimento desliga animação e transição.
- Cliques e teclado preservam `/oportunidades` e `/#comunidade`. O endereço de
  pagamento foi conferido sem abrir ou submeter o checkout.
- `/makeitfly`: sem novos botões e sem wrapper do tema Apogee.
- Capturas de tela falharam por timeout no Playwright. A conferência de layout
  e comportamento usou medidas DOM e estilos computados.

Todos os comandos de projeto usaram a fila global. O preview local na porta
3112 ocupa a fila enquanto estiver ativo; uma nova execução de TypeScript e
ESLint após a correção depende de liberar esse servidor com autorização.
Não houve push nem deploy.
