import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';
import { interfaceText } from '../lib/presentation-text.mjs';

test('display formatting removes complete emoji graphemes and normalizes both long dashes', () => {
  assert.equal(interfaceText('Olá 👩🏽‍🚀 família 👨‍👩‍👧‍👦 🇧🇷 1️⃣ — próxima etapa – inscrição'), 'Olá família - próxima etapa - inscrição');
  assert.equal(interfaceText('R$ 49,00 · 20/10/2026\nCondições: 50%'), 'R$ 49,00 · 20/10/2026\nCondições: 50%');
  assert.equal(interfaceText('Apogee - comunidade'), 'Apogee - comunidade');
});

test('presentation formatting is idempotent and leaves source records unchanged', () => {
  const original = Object.freeze({ title: 'Universidade — curso 🚀', id: 'radar-123', officialUrl: 'https://example.edu/?code=abc-123' });
  const display = interfaceText(original.title);
  assert.equal(display, 'Universidade - curso');
  assert.equal(interfaceText(display), display);
  assert.equal(original.title, 'Universidade — curso 🚀');
  assert.equal(original.officialUrl, 'https://example.edu/?code=abc-123');
});

test('live UI copy uses vector icons and has no emoji glyphs or long dashes', async () => {
  const root = new URL('../', import.meta.url);
  const forbidden = /[\u2013\u2014]|\p{Emoji_Presentation}|[✳✦]/u;
  const problems = [];
  async function scan(directory) {
    for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (path === 'components/published') continue; // Archived, not rendered by the current app.
      if (entry.isDirectory()) { await scan(path); continue; }
      if (!path.endsWith('.tsx')) continue;
      const source = await readFile(new URL(path, root), 'utf8');
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if ((ts.isJsxText(node) || ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && forbidden.test(node.text)) problems.push(path);
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  }
  await scan('app');
  await scan('components');
  assert.deepEqual([...new Set(problems)], []);
});
