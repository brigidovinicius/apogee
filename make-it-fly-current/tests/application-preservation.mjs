import assert from "node:assert/strict";

// Reverse only the reviewed participation CTA edits before comparing existing
// preservation hashes. All other landing, scene, stylesheet and asset bytes
// must still match their approved baselines.
const replaceOnce = (source, current, previous) => {
  assert.equal(source.split(current).length, 2, `Expected exactly one reviewed change: ${current}`);
  return source.replace(current, previous);
};

export function restorePreApplicationSource(path, source) {
  let result = source.toString();
  if (["components/landing/make-it-fly-v2.tsx", "components/hero/HeroContent.tsx"].includes(path)) {
    result = replaceOnce(result, 'import { ApplicationLink } from "@/components/application/ApplicationLink";\n', "");
  }
  if (path === "components/hero/HeroContent.tsx") {
    result = replaceOnce(result,
      '<ApplicationLink className={styles.cta}>{ABERTURA.cta}<span aria-hidden="true">↗</span></ApplicationLink>',
      '<a className={styles.cta} href="#participar">{ABERTURA.cta}<span aria-hidden="true">↗</span></a>');
  }
  if (path === "components/landing/make-it-fly-v2.tsx") {
    result = replaceOnce(result,
      '<ApplicationLink className={styles.topbarCta}>\n              Participar\n            </ApplicationLink>',
      '<a className={styles.topbarCta} href="#participar">\n            Participar <span aria-hidden>↗</span>\n          </a>');
    result = replaceOnce(result,
      '<ApplicationLink className={styles.finalCta}>\n                    {PARTICIPAR.botao.texto}\n                  </ApplicationLink>',
      '<a\n                    className={styles.finalCta}\n                    href={PARTICIPAR.botao.href}\n                    target="_blank"\n                    rel="noreferrer"\n                  >\n                    {ABERTURA.cta} <span aria-hidden>↗</span>\n                  </a>');
  }
  if (path === "content/site.ts") {
    result = replaceOnce(result,
      ' * A página não inventa data exata ou endereço. A participação começa na\n * aplicação nativa; o ingresso só é liberado após validação no servidor.',
      ' * A página não inventa data exata, endereço ou link de inscrição.');
    result = replaceOnce(result,
      'Conte um pouco sobre você e sua ideia. Se seu perfil estiver alinhado com esta edição, você segue direto para o ingresso.',
      'Fale com a Rosa para saber mais sobre a primeira edição.');
    result = replaceOnce(result,
      'texto: "Quero participar do evento",\n    href: "/makeitfly/participar",',
      'texto: "Falar com a Rosa",\n    // O material ainda não traz um formulário. Mantemos um destino real até o\n    // link oficial de inscrição ser definido.\n    href: AUTORA.instagram,');
  }
  return result;
}
