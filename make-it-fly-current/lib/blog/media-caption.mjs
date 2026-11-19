const generatedImageCaption = "Imagem ilustrativa fotorrealista criada com inteligência artificial pela Apogee; não é fotografia do acontecimento.";

/** Keep provenance stored in the CMS; omit only this boilerplate from articles.
 * @param {unknown} caption
 * @returns {string | null}
 */
export function articleMediaCaption(caption) {
  if (typeof caption !== "string") return null;
  const normalized = caption.replace(/\s+/gu, " ").trim();
  return normalized && normalized !== generatedImageCaption ? caption : null;
}
