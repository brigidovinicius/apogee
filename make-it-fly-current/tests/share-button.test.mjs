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

test('copying uses the canonical public URL even when native sharing would stay pending forever', async () => {
  let nativeCalls = 0, copied;
  const view = harness({ share: () => { nativeCalls++; return new Promise(() => {}); }, clipboard: { writeText: async url => { copied = url; } } });
  try {
    assert.equal(view.render().props.children[1].props.children, '');
    await view.render().props.children[0].props.onClick();
    assert.equal(nativeCalls, 0);
    assert.equal(copied, 'https://www.apogee.community/oportunidades');
    assert.equal(view.render().props.children[1].props.children, 'Link copiado.');
    assert.equal(view.render().props.children[0].props.disabled, false);
  } finally { view.restore(); }
});

for (const available of [true, false]) test(`copying recovers when clipboard is ${available ? 'denied' : 'unavailable'}`, async () => {
  const view = harness(available ? { clipboard: { writeText: async () => { throw Error('Denied'); } } } : {});
  try {
    await view.render().props.children[0].props.onClick();
    assert.match(view.render().props.children[1].props.children, /Selecione e copie/);
    assert.equal(view.render().props.children[2].props.children[1].props.value, 'https://www.apogee.community/oportunidades');
    assert.equal(view.render().props.children[0].props.disabled, false);
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

test('repeated activation starts only one pending clipboard operation', async () => {
  let calls = 0;
  let finish;
  const view = harness({ clipboard: { writeText: () => { calls++; return new Promise(resolve => { finish = resolve; }); } } });
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
    assert.equal(output.props.children[0].props['aria-label'], 'Copiar link de NASA Space Apps');
    assert.equal(output.props.children[1].props.children, '');
    await output.props.children[0].props.onClick();
    assert.equal(copied, 'https://www.apogee.community/oportunidades/nasa-space-apps--radar-pilot');
    assert.match(view.render(props).props.children[1].props.children, /Link copiado/);
  } finally { view.restore(); }
});
