const pictograph = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
const graphemes = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/** Format display copy without changing stored content, URLs, identifiers or form values.
 * @param {string} value
 * @returns {string}
 */
export function interfaceText(value) {
  const text = pictograph.test(value)
    ? [...graphemes.segment(value)].filter(({ segment }) => !pictograph.test(segment)).map(({ segment }) => segment).join('')
    : value;
  return text.replace(/[\t ]*[\u2013\u2014][\t ]*/g, ' - ').replace(/[\t ]{2,}/g, ' ').trim();
}
