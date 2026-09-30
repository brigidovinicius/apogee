# Make it fly — V2

Segunda direção visual da landing page do evento Make it fly. Esta cópia é
independente do projeto original e não contém a pasta `.vercel`, portanto não
está vinculada ao deploy de produção.

## Direção

A V2 preserva a estrutura editorial aprovada e agora aplica a identidade oficial
da Apogee: Navy `#07182D`, Sky `#B9D3EE`, branco e preto, Instrument Serif nos
momentos expressivos e Inter na interface. A estrela-pulsar, o wordmark oficial
Make It Fly e a assinatura Apogee foram incorporados a partir dos arquivos de
marca fornecidos. O conteúdo factual aprovado permanece centralizado em
`content/site.ts`.

Foram preservados:

- apoio oficial da Red Bull;
- CTA “Quero participar do evento”;
- retrato único de Rosa Maria;
- animação 3D da lua e revelação do cinturão de asteroides;
- trajetória da lua guiada pela rolagem, inclusive quando o sistema prefere
  movimento reduzido (nesse caso a cena fica mais lenta, mas não congelada);
- informações aprovadas sobre formato, agenda, local e capacidade.

## Desenvolvimento

```sh
npm ci
npm run dev
```

Abra `http://localhost:3000`.

## Validação

```sh
npm run lint
npm run typegen
npm run typecheck
npm run build
```

## Produção

Publicada em 12 de setembro de 2026 no projeto Vercel `rosa-maria-livro`. O
endereço público foi atualizado para:

- https://makeitfly.vercel.app

A URL anterior continua como alias de compatibilidade para não quebrar links já
compartilhados. A versão anterior do site permanece somente no histórico da
Vercel para permitir rollback.

> A revisão de identidade e a correção da lua descritas acima estão nesta entrega
> local e ainda não foram enviadas à produção.
