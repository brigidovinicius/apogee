/**
 * Fonte única de conteúdo da landing do Make it fly.
 *
 * Formato, agenda e mês preservam o material enviado. A apresentação de vagas
 * segue a orientação atual: vagas limitadas, sem divulgar número ou cidade.
 * A página não inventa data exata ou endereço. A participação começa na
 * aplicação nativa; o ingresso só é liberado após validação no servidor.
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
  titulo: "Make it",
  destaque: "fly",
  subtitulo: "Tire uma ideia do papel em um dia.",
  descricao:
    "Chegue com uma ideia, projeto ou desafio. Trabalhe em profundidade, construa com outras pessoas e termine o dia mostrando um resultado.",
  meta: ["Vagas limitadas"],
  iniciativa: "Uma iniciativa de Rosa Maria",
  apoio: {
    rotulo: "Energizados por Red Bull",
    logo: "/partners/red-bull-can-white.png",
    logoAlt: "Ilustração de uma lata Red Bull",
    mensagem: {
      contexto: "O dia de trabalho será",
      destaque: "energizado",
      marca: "por Red Bull.",
    },
  },
  cta: "Quero participar do evento",
  scroll: "Conheça a experiência",
} as const;

export const EXPERIENCIA = {
  etiqueta: "A experiência",
  titulo: "Mais que coworking.",
  subtitulo: "Um dia inteiro para fazer acontecer.",
  descricao:
    "Make it fly reúne pessoas de tecnologia, ciência, inovação, criatividade e empreendedorismo, com vagas limitadas. Um espaço para focar, criar conexões e levar uma ideia até um resultado que pode ser mostrado.",
} as const;

export const JORNADA = {
  etiqueta: "Da ideia ao resultado",
  titulo: "Você chega com uma ideia.",
  subtitulo: "Sai com algo para mostrar.",
  descricao:
    "Nada de passar o dia apenas falando sobre projetos. A experiência organiza foco, tempo e comunidade em uma sequência com começo, desafio e entrega.",
  etapas: [
    {
      titulo: "Ideia",
      texto: "Leve uma ideia, um projeto ou um desafio que você quer destravar.",
    },
    {
      titulo: "Deep Work",
      texto: "Trabalho concentrado, com outras pessoas construindo ao seu lado.",
    },
    {
      titulo: "Two-Hour Challenge",
      texto: "Duas horas para fazer a ideia avançar e chegar a um resultado.",
    },
    {
      titulo: "Show Your Work",
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
  etiqueta: "Manifesto",
  frase: "Quem está construindo o futuro precisa se encontrar.",
  assinatura: "Give your ideas wings.",
  apoio:
    "Tecnologia, ciência, inovação, criatividade e empreendedorismo dividindo a mesma mesa por um dia, com uma ideia para colocar no mundo.",
} as const;

export const QUEM_CONDUZ = {
  etiqueta: "Quem conduz",
  nome: AUTORA.nomeCurto,
  subtitulo: "Criadora da Make it fly",
  paragrafos: [
    "Rosa Maria cria e conduz a Make it fly. Cientista cidadã da NASA e vencedora da edição brasileira de um hackathon da NASA, ela transforma curiosidade em projetos que saem do papel.",
    "Reúne uma comunidade para trabalhar, criar conexões e mostrar ideias no mundo real.",
  ],
  foto: "/rosa/retrato-nasa.webp",
  fotoAlt: "Retrato de Rosa Maria com macacão azul em frente a bandeiras da NASA",
} as const;

export const PARTICIPAR = {
  etiqueta: "Primeira edição",
  titulo: "Vagas limitadas.",
  subtitulo: "Uma ideia, projeto ou desafio.",
  descricao:
    "Conte um pouco sobre você e sua ideia. Se seu perfil estiver alinhado com esta edição, você segue direto para o ingresso.",
  botao: {
    texto: "Quero participar do evento",
    href: "/participar",
  },
} as const;
