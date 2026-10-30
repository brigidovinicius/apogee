import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(await readFile(new URL('../components/site/share-button.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function harness(navigatorValue) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorValue });
  const states = [];
  let index = 0;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(specifier => {
    if (specifier === 'react') return {
      useId: () => 'share-feedback',
      useState: value => { const slot = index++; if (!(slot in states)) states[slot] = value; return [states[slot], next => { states[slot] = next; }]; },
      useRef: value => { const slot = index++; return states[slot] ??= { current: value }; },
    };
    if (specifier.endsWith('.css')) return {};
    return require(specifier);
  }, mod, mod.exports);
  return {
    render(props = {}) { index = 0; return mod.exports.ShareButton({ title: 'Radar | Apogee', path: '/oportunidades', ...props }); },
    restore() { if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator; },
  };
}

test('native sharing receives only the canonical public URL and makes no delivery claim', async () => {
  const calls = [];
  const view = harness({ share: async data => { calls.push(data); } });
  try {
    await view.render().props.children[0].props.onClick();
    assert.deepEqual(calls, [{ title: 'Radar | Apogee', url: 'https://www.apogee.community/oportunidades' }]);
    assert.equal(view.render().props.children[1].props.children, 'Compartilha o link público desta página');
  } finally { view.restore(); }
});

test('cancelling native sharing never copies a link or announces an error', async () => {
  let copies = 0;
  const view = harness({ share: async () => { throw new DOMException('Cancelled', 'AbortError'); }, clipboard: { writeText: async () => { copies++; } } });
  try {
    await view.render().props.children[0].props.onClick();
    assert.equal(copies, 0);
    assert.equal(view.render().props.children[2], null);
    assert.equal(view.render().props.children[0].props.disabled, false);
  } finally { view.restore(); }
});

for (const nativeFailure of [false, true]) test(`clipboard fallback works with native sharing ${nativeFailure ? 'rejected' : 'unavailable'}`, async () => {
  let copied;
  const view = harness({ ...(nativeFailure ? { share: async () => { throw new Error('Unsupported'); } } : {}), clipboard: { writeText: async url => { copied = url; } } });
  try {
    await view.render().props.children[0].props.onClick();
    assert.equal(copied, 'https://www.apogee.community/oportunidades');
    assert.match(view.render().props.children[1].props.children, /Link copiado/);
  } finally { view.restore(); }
});

test('clipboard denial leaves a selectable link and persistent recovery instructions', async () => {
  const view = harness({ clipboard: { writeText: async () => { throw new Error('Denied'); } } });
  try {
    await view.render().props.children[0].props.onClick();
    const output = view.render();
    assert.match(output.props.children[1].props.children, /Selecione e copie/);
    const input = output.props.children[2].props.children[1];
    assert.equal(input.props.readOnly, true);
    assert.equal(input.props.value, 'https://www.apogee.community/oportunidades');
    let selected = false;
    input.props.onFocus({ currentTarget: { select() { selected = true; } } });
    assert.equal(selected, true);
  } finally { view.restore(); }
});

test('repeated activation opens only one pending share sheet', async () => {
  let calls = 0;
  let finish;
  const view = harness({ share: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  try {
    const click = view.render().props.children[0].props.onClick;
    const first = click();
    await click();
    assert.equal(calls, 1);
    assert.equal(view.render().props.children[0].props.disabled, true);
    finish();
    await first;
    assert.equal(view.render().props.children[0].props.disabled, false);
  } finally { view.restore(); }
});

test('a compact opportunity share copies its public detail and announces recovery', async () => {
  let copied;
  const props = { title: 'NASA Space Apps', path: '/oportunidades/nasa-space-apps--radar-pilot', compact: true };
  const view = harness({ clipboard: { writeText: async value => { copied = value; } } });
  try {
    const output = view.render(props);
    assert.equal(output.props.children[0].props['aria-label'], 'Compartilhar NASA Space Apps');
    assert.equal(output.props.children[1].props.children, '');
    await output.props.children[0].props.onClick();
    assert.equal(copied, 'https://www.apogee.community/oportunidades/nasa-space-apps--radar-pilot');
    assert.match(view.render(props).props.children[1].props.children, /Link copiado/);
  } finally { view.restore(); }
});
