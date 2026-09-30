import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("home navigation exposes gallery and store routes", async () => {
  const source = await read("../components/landing/make-it-fly-v2.tsx");

  assert.match(source, /href="\/galeria"/);
  assert.match(source, /href="\/loja"/);
  assert.match(source, /aria-label="Áreas do site"/);
  assert.match(source, /id="galeria-preview"/);
  assert.match(source, /href="\/galeria#enviar-fotos"/);
  assert.match(source, /Incluir fotos/);
  assert.match(source, /GalleryHomepagePreview/);
});

test("gallery publishes real photos with Apogee credits and no fake examples", async () => {
  const source = await read("../components/gallery/gallery-experience.tsx");
  const hero = await read("../components/gallery/gallery-hero.tsx");
  const grid = await read("../components/gallery/photo-grid.tsx");
  const uploadCard = await read("../components/ui/file-upload-card.tsx");
  const homepage = await read("../components/gallery/gallery-homepage-preview.tsx");

  assert.match(source, /Postar anonimamente/i);
  assert.match(source, /normalizeInstagram\(instagram\)/);
  assert.match(source, /MAX_FILE_SIZE = 20 \* 1024 \* 1024/);
  assert.match(source, /name="instagram"/);
  assert.match(source, /fetch\("\/api\/gallery", \{ method: "POST"/);
  assert.match(hero, /Make it <em>Fly<\/em>/);
  assert.match(hero, /Fotos da comunidade Apogee/);
  assert.match(grid, /Quem mostra o que acontece são vocês/);
  assert.match(grid, /photo\.author/);
  assert.match(grid, /@\{photo\.instagram\}/);
  assert.doesNotMatch(grid, /images\.unsplash\.com/);
  assert.match(homepage, /photos\.slice\(0, 3\)/);
  assert.match(homepage, /photo\.author/);
  assert.match(homepage, /!photo\.anonymous/);
  assert.doesNotMatch(source, /O álbum de quem fez acontecer|Memórias ficam|name="event"/i);
  assert.match(uploadCard, /type="file"/);
  assert.match(uploadCard, /Escolha arquivos ou arraste e solte aqui/);
  assert.match(uploadCard, /Pronto para envio/);
  assert.doesNotMatch(uploadCard, /Upload files|Browse File|Uploading|Completed/);
  assert.doesNotMatch(`${source}\n${grid}\n${uploadCard}`, /revisão|curadoria|moderação/i);
});

test("store does not present a fictional live catalog or checkout", async () => {
  const source = await read("../app/loja/store-experience.tsx");

  assert.match(source, /A loja está em preparação/);
  assert.match(source, /seleção em desenvolvimento/i);
  assert.match(source, /Este item não está à venda/);
  assert.doesNotMatch(source, /comprar agora|adicionar ao carrinho|checkout/i);
});
