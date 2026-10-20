# Arrow Fill Button

Substitui o Anti Metal nos três CTAs do topo da homepage, conforme a nova
referência Hyperiux enviada pelo usuário. Os destinos de pagamento, catálogo
do Radar e comunidade permanecem iguais. Make It Fly fica preservado.

O verde escolhido pelo usuário é `#25D366` (WhatsApp). O texto usa o navy da
Apogee; o círculo é branco, com seta verde-escura. No hover ou foco, o branco
preenche o botão e o texto assume o verde-escuro.

O projeto já tem TypeScript, Tailwind 4, shadcn e `lucide-react`; nenhuma
dependência foi instalada. Componentes ficam em `components/ui/`, estilos
globais em `app/globals.css`, e estilos locais em
`components/ui/arrow-fill-button.module.css`.

```tsx
import ArrowFillButton from "@/components/ui/arrow-fill-button";

<ArrowFillButton href="/oportunidades" btnText="Explorar o Radar" />
```

O componente preserva os parâmetros de cores da referência e implementa
`animationDuration` (ms) e `fillOnHover`. Usa Next Link com prefetch desativado,
texto visível desde o HTML inicial, foco por teclado, redução de movimento e
estado de pressão para toque. Textos longos podem quebrar para caber no celular.

## Validação local em 20/10/2026

- Compilação pelo servidor Next/Webpack existente e `git diff --check`: passaram.
- Navegador: 320, 390, 768 e 1440 px sem overflow ou texto cortado.
- Fundo dos três CTAs confirmado como `rgb(37, 211, 102)` (`#25D366`).
- Hover, foco visível, redução de movimento, pressão e cancelamento de toque
  conferidos. Os duplicados visuais do texto são `aria-hidden`.
- Navegação por clique para `/oportunidades` e por Enter para `/#comunidade`
  conferida. O link Stripe foi preservado sem abrir ou submeter o checkout.
- `/makeitfly`: nenhum novo botão e nenhum wrapper do tema Apogee.
- TypeScript/ESLint não foram executados nesta revisão: o preview já ativo na
  porta 3112 ocupa a fila global; ele não foi encerrado sem autorização.

Entrega somente local, sem push ou deploy.
