"use client";

import {
  ScrollGlobe,
  type ScrollGlobeSection,
} from "@/components/ui/landing-page";
import {
  AUTORA,
  EXPERIENCIA,
  JORNADA,
  MANIFESTO,
  PARTICIPAR,
  PROGRAMACAO,
  QUEM_CONDUZ,
} from "@/content/site";

const irPara = (id: string) =>
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });

const abrir = (href: string) => {
  if (href.startsWith("#")) return irPara(href.slice(1));
  window.open(href, "_blank", "noopener,noreferrer");
};

/** A lua acompanha a narrativa sem ocupar a coluna principal de leitura. */
const posicoesDaLua = {
  positions: [
    { top: "48%", left: "82%", scale: 0.96, opacity: 0.92 },
    { top: "30%", left: "17%", scale: 0.76, opacity: 0.82 },
    { top: "65%", left: "86%", scale: 0.94, opacity: 0.88 },
    { top: "50%", left: "50%", scale: 1.28, opacity: 0.2 },
    { top: "34%", left: "17%", scale: 0.7, opacity: 0.74 },
    { top: "50%", left: "50%", scale: 1.2, opacity: 0.24 },
  ],
  mobilePositions: [
    { top: "23%", left: "74%", scale: 0.78, opacity: 0.56 },
    { top: "16%", left: "75%", scale: 0.7, opacity: 0.52 },
    { top: "50%", left: "50%", scale: 1.08, opacity: 0.12 },
    { top: "50%", left: "50%", scale: 1.2, opacity: 0.18 },
    { top: "18%", left: "78%", scale: 0.66, opacity: 0.34 },
    { top: "50%", left: "50%", scale: 1.14, opacity: 0.2 },
  ],
};

export function ScrollLanding() {
  const sections: ScrollGlobeSection[] = [
    {
      id: "experiencia",
      badge: EXPERIENCIA.etiqueta,
      title: EXPERIENCIA.titulo,
      subtitle: EXPERIENCIA.subtitulo,
      description: EXPERIENCIA.descricao,
      align: "left",
    },
    {
      id: "jornada",
      badge: JORNADA.etiqueta,
      revealAsteroids: true,
      title: JORNADA.titulo,
      subtitle: JORNADA.subtitulo,
      description: JORNADA.descricao,
      align: "right",
      features: JORNADA.etapas.map((etapa) => ({
        title: etapa.titulo,
        description: etapa.texto,
      })),
    },
    {
      id: "programacao",
      badge: PROGRAMACAO.etiqueta,
      title: PROGRAMACAO.titulo,
      subtitle: PROGRAMACAO.subtitulo,
      description: PROGRAMACAO.descricao,
      align: "left",
      features: PROGRAMACAO.momentos.map((momento) => ({
        title: momento.titulo,
        description: momento.texto,
      })),
    },
    {
      id: "manifesto",
      badge: MANIFESTO.etiqueta,
      title: MANIFESTO.frase,
      subtitle: MANIFESTO.assinatura,
      description: MANIFESTO.apoio,
      align: "center",
    },
    {
      id: "quem-conduz",
      badge: QUEM_CONDUZ.etiqueta,
      title: QUEM_CONDUZ.nome,
      subtitle: QUEM_CONDUZ.subtitulo,
      description: QUEM_CONDUZ.paragrafos.join(" "),
      align: "right",
      image: {
        src: QUEM_CONDUZ.foto,
        alt: QUEM_CONDUZ.fotoAlt,
        width: 1168,
        height: 1301,
      },
      actions: [
        {
          label: AUTORA.handle,
          variant: "secondary",
          onClick: () => abrir(AUTORA.instagram),
        },
      ],
    },
    {
      id: "participar",
      badge: PARTICIPAR.etiqueta,
      title: PARTICIPAR.titulo,
      subtitle: PARTICIPAR.subtitulo,
      description: PARTICIPAR.descricao,
      align: "center",
      actions: [
        {
          label: PARTICIPAR.botao.texto,
          variant: "primary",
          onClick: () => abrir(PARTICIPAR.botao.href),
        },
      ],
    },
  ];

  return <ScrollGlobe sections={sections} globeConfig={posicoesDaLua} />;
}
