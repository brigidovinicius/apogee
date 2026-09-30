import HyperdriveHero from "@/components/ui/hyperdrive-hero";
import StarfieldBackground from "@/components/ui/starfield-background";
import { ScrollLanding } from "@/components/landing/scroll-landing";
import { ABERTURA } from "@/content/site";

export default function Home() {
  return (
    <>
      <StarfieldBackground />
      <HyperdriveHero
        editionLabel={ABERTURA.localData}
        title={ABERTURA.titulo}
        titleEmphasis={ABERTURA.destaque}
        subtitle={ABERTURA.subtitulo}
        description={ABERTURA.descricao}
        meta={ABERTURA.meta}
        creatorLabel={ABERTURA.iniciativa}
        supportLabel={ABERTURA.apoio.rotulo}
        supportLogoSrc={ABERTURA.apoio.logo}
        supportLogoAlt={ABERTURA.apoio.logoAlt}
        supportHighlights={ABERTURA.apoio.highlights}
        ctaLabel={ABERTURA.cta}
        scrollHint={ABERTURA.scroll}
        scrollTargetId="experiencia"
      />
      <ScrollLanding />
    </>
  );
}
