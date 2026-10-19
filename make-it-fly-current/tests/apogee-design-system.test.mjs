import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { usesApogeeDesign } from '../components/site/design-scope.mjs';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage theme covers public, member and admin routes, excluding the whole event', () => {
  for (const path of ['/', '/oportunidades', '/oportunidades/avisos', '/blog', '/blog/uma-ideia', '/galeria', '/loja', '/gerenciar-galeria', '/login', '/membros', '/membros/entrar', '/membros/cadastro', '/membros/oportunidades', '/membros/perfil/editar', '/membros/forum/tecnologia/novo', '/admin', '/admin/radar', '/admin/posts/123', '/home-robonauta', '/makeitfly-extra']) {
    assert.equal(usesApogeeDesign(path), true, path);
  }
  for (const path of ['/makeitfly', '/makeitfly/', '/makeitfly/participar', '/makeitfly/participar/etapa', null, undefined]) {
    assert.equal(usesApogeeDesign(path), false, String(path));
  }
});

test('route changes preserve server children and render no theme DOM on event routes', async () => {
  const { createRequire } = await import('node:module');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const ts = (await import('typescript')).default;
  const require = createRequire(import.meta.url);
  let pathname = '/membros';
  const compiled = ts.transpileModule(await source('components/site/apogee-design-system.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(specifier => {
    if (specifier === 'next/navigation') return { usePathname: () => pathname };
    if (specifier === './design-scope.mjs') return { usesApogeeDesign };
    if (specifier.endsWith('.css')) return { scope: 'theme' };
    return require(specifier);
  }, mod, mod.exports);
  const child = createElement('main', { id: 'experiencia' }, createElement('form', { action: '/existing-handler' }, createElement('button', { type: 'submit' }, 'Salvar')));
  const original = renderToStaticMarkup(child);
  const render = () => renderToStaticMarkup(createElement(mod.exports.ApogeeDesignSystem, null, child));
  for (pathname of ['/makeitfly', '/makeitfly/participar']) assert.equal(render(), original);
  for (pathname of ['/', '/admin', '/membros', '/galeria', '/blog']) {
    const html = render();
    assert.ok(html.includes('data-apogee-design'));
    assert.ok(html.includes(original), 'existing form and server-rendered children remain intact');
  }
});
