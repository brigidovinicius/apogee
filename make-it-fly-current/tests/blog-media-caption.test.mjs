import assert from "node:assert/strict";
import { test } from "node:test";
import { articleMediaCaption } from "../lib/blog/media-caption.mjs";

const boilerplate = "Imagem ilustrativa fotorrealista criada com inteligência artificial pela Apogee; não é fotografia do acontecimento.";

test("omite a legenda padrão mesmo com espaços de formatação", () => {
  for (const caption of [boilerplate, `  ${boilerplate}\n`, boilerplate.replaceAll(" ", "\u00a0")]) {
    assert.equal(articleMediaCaption(caption), null);
  }
});

test("preserva créditos e legendas editoriais de outras imagens", () => {
  for (const caption of ["Foto: NASA/JPL-Caltech.", "Crédito: ESA — imagem oficial.", `Legenda da fonte: ${boilerplate} Crédito: NASA.`]) {
    assert.equal(articleMediaCaption(caption), caption);
  }
});

test("não cria legenda para imagens sem texto", () => {
  for (const caption of [null, undefined, "", " \n\t"]) assert.equal(articleMediaCaption(caption), null);
});
