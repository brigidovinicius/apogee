export const products = [
  {
    slug: "moletom-building-the-future",
    name: "Moletom Building the Future",
    detail: "Azul-marinho",
    description: "Gola alta com meio zíper, brasão Apogee e a mensagem Building the Future no peito.",
    photos: [
      { src: "/images/loja/moletom-frente.jpg", alt: "Moletom Apogee azul-marinho visto de frente", width: 1254, height: 1254 },
      { src: "/images/loja/moletom-detalhe.jpg", alt: "Detalhe da gola, do zíper e dos bordados do moletom Apogee", width: 1254, height: 1254 },
    ],
  },
  {
    slug: "bone-made-to-create",
    name: "Boné Apogee",
    detail: "Bege",
    description: "Estrela azul-marinho na frente, assinatura Apogee na lateral e ajuste na parte de trás.",
    photos: [
      { src: "/images/loja/bone-apogee-tres-quartos-20261101.png", alt: "Boné Apogee bege em três quartos com estrela azul-marinho na frente e assinatura na lateral", width: 1254, height: 1254 },
      { src: "/images/loja/bone-apogee-frente-20261101.png", alt: "Boné Apogee bege visto de frente com estrela azul-marinho bordada", width: 1254, height: 1254 },
      { src: "/images/loja/bone-apogee-costas-20261101.png", alt: "Parte de trás do boné Apogee bege com tira de ajuste e fivela metálica", width: 1254, height: 1254 },
    ],
  },
  {
    slug: "camiseta-apogee",
    name: "Camiseta Apogee",
    detail: "Azul-marinho",
    description: "Camiseta de manga curta e gola redonda, com estrela no peito e assinatura Apogee nas costas.",
    photos: [
      { src: "/images/loja/camiseta-frente.jpg", alt: "Camiseta Apogee azul-marinho vista de frente com estrela no peito", width: 1254, height: 1254 },
      { src: "/images/loja/camiseta-costas.jpg", alt: "Costas da camiseta azul-marinho com a assinatura Apogee abaixo da gola", width: 1254, height: 1254 },
    ],
  },
] as const;

export type StoreProduct = (typeof products)[number];
