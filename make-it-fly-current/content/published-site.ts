/**
 * Fonte única de conteúdo da landing do Make it fly.
 *
 * O deck enviado confirma formato, agenda, cidade, mês e capacidade. Onde o
 * material ainda não informa data exata, endereço ou link de inscrição, a
 * página não inventa esses dados.
 */

export const MARCA = {
  nome: "Make it fly",
  assinatura: "Give your ideas wings.",
} as const;

export const AUTORA = {
  nome: "Rosa Maria Pereira Miranda",
  nomeCurto: "Rosa Maria",
  handle: "@rosamariapmiranda",
  instagram: "https://www.instagram.com/rosamariapmiranda/",
} as const;

export const ABERTURA = {
  localData: "Florianópolis / setembro 2026",
  titulo: "Make it",
  destaque: "fly",
  subtitulo: "Tire uma ideia do papel — em um dia.",
  descricao:
    "Chegue com uma ideia, projeto ou desafio. Trabalhe em profundidade, construa com outras pessoas e termine o dia mostrando um resultado.",
  meta: ["Florianópolis", "Setembro 2026", "40 participantes"],
  iniciativa: "Uma iniciativa de Rosa Maria",
  apoio: {
    rotulo: "Apoio oficial",
    logo: "/partners/red-bull.png",
    logoAlt: "Red Bull",
  },
  cta: "Quero participar do evento",
  scroll: "Conheça a experiência",
} as const;

export const EXPERIENCIA = {
  etiqueta: "A experiência",
  titulo: "Mais que coworking.",
  subtitulo: "Um dia inteiro para fazer acontecer.",
  descricao:
    "Make it fly reúne até 40 participantes de tecnologia, ciência, inovação, criatividade e empreendedorismo. Um espaço para focar, criar conexões e levar uma ideia até um resultado que pode ser mostrado.",
} as const;

export const JORNADA = {
  etiqueta: "Da ideia ao resultado",
  titulo: "Você chega com uma ideia.",
  subtitulo: "Sai com algo para mostrar.",
  descricao:
    "Nada de passar o dia apenas falando sobre projetos. A experiência organiza foco, tempo e comunidade em uma sequência com começo, desafio e entrega.",
  etapas: [
    {
      titulo: "01 / Ideia",
      texto: "Leve uma ideia, um projeto ou um desafio que você quer destravar.",
    },
    {
      titulo: "02 / Deep Work",
      texto: "Trabalho concentrado, com outras pessoas construindo ao seu lado.",
    },
    {
      titulo: "03 / Two-Hour Challenge",
      texto: "Duas horas para fazer a ideia avançar e chegar a um resultado.",
    },
    {
      titulo: "04 / Show Your Work",
      texto: "Apresente o que avançou. O projeto mais votado ganha um dia na Surfland.",
    },
  ],
} as const;

export const PROGRAMACAO = {
  etiqueta: "A programação",
  titulo: "Da chegada ao After Work.",
  subtitulo: "Um dia entre foco, recuperação e comunidade.",
  descricao:
    "No caminho: Energy Bar com Red Bull, Recovery Station com massagem, sauna e ice bath, e a instalação participativa Give Your Ideas Wings.",
  momentos: [
    {
      titulo: "07h / Arrive & Settle In",
      texto: "Chegada e preparação. Community Intro às 09h30.",
    },
    {
      titulo: "10h / Deep Work",
      texto: "Bloco de foco, Recovery Station às 11h30 e Lunch & Connect às 12h30.",
    },
    {
      titulo: "14h / Two-Hour Challenge",
      texto: "Duas horas para fazer a ideia avançar e chegar a um resultado.",
    },
    {
      titulo: "17h / Show Your Work",
      texto: "Apresentação dos projetos. After Work com DJ, comunidade e celebração às 19h.",
    },
  ],
} as const;

export const MANIFESTO = {
  etiqueta: "Florianópolis",
  frase: "Quem está construindo o futuro precisa se encontrar.",
  assinatura: "Give your ideas wings.",
  apoio:
    "Tecnologia, ciência, inovação, criatividade e empreendedorismo dividindo a mesma mesa — por um dia, com uma ideia para colocar no mundo.",
} as const;

export const QUEM_CONDUZ = {
  etiqueta: "Quem conduz",
  nome: AUTORA.nomeCurto,
  subtitulo: "Criadora da Make it fly",
  paragrafos: [
    "Rosa Maria cria e conduz a Make it fly. Cientista cidadã da NASA e vencedora da edição brasileira de um hackathon da NASA, ela transforma curiosidade em projetos que saem do papel.",
    "Em Florianópolis, reúne uma comunidade para trabalhar, criar conexões e mostrar ideias no mundo real.",
  ],
  foto: "/rosa/retrato-nasa.webp",
  fotoAlt: "Retrato de Rosa Maria com macacão azul em frente a bandeiras da NASA",
} as const;

export const PARTICIPAR = {
  etiqueta: "Primeira edição",
  titulo: "40 participantes.",
  subtitulo: "Uma ideia, projeto ou desafio.",
  descricao:
    "Florianópolis, setembro de 2026. Fale com a Rosa para saber mais sobre a primeira edição.",
  botao: {
    texto: "Falar com a Rosa",
    // O material ainda não traz um formulário. Mantemos um destino real até o
    // link oficial de inscrição ser definido.
    href: AUTORA.instagram,
  },
} as const;
