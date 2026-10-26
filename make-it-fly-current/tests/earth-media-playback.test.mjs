import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../components/home/earth-radar/media-playback.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function setup() {
  let now = 0, nextId = 1, progressValue = 0, notifyProgress;
  const timers = new Map(), frames = new Map(), states = [];
  const browser = new EventTarget(), page = new EventTarget();
  page.hidden = false;
  Object.assign(browser, {
    setTimeout(fn, delay) { const id = nextId++; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { const id = nextId++; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  let observe;
  class Observer { constructor(callback) { observe = callback; } observe() {} disconnect() {} }
  const loadedModule = { exports: {} };
  new Function("module", "exports", "window", "document", "performance", "IntersectionObserver", code)(loadedModule, loadedModule.exports, browser, page, { now: () => now }, Observer);
  const media = new EventTarget();
  Object.assign(media, { currentTime: 0, duration: 8, readyState: 4, seeking: false, plays: 0, paused: true, rejectPlay: false,
    play() { this.plays++; if (this.rejectPlay) return Promise.reject(new DOMException("gesture required", "NotAllowedError")); this.paused = false; this.dispatchEvent(new Event("playing")); return Promise.resolve(); },
    pause() { this.paused = true; },
  });
  return { ...loadedModule.exports, media, states, browser, page, timers,
    progress: { get: () => progressValue, on: (_, fn) => { notifyProgress = fn; return () => { notifyProgress = undefined; }; } },
    progressTo(value) { progressValue = value; notifyProgress?.(); },
    frame() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
    advance(ms) { now += ms; for (const [id, entry] of timers) if (entry.at <= now) { timers.delete(id); entry.fn(); } },
    inView(value) { observe([{ isIntersecting: value }]); },
  };
}

test("touch devices and data saving use a signature animation independent of video autoplay", () => {
  const { resolveSignatureMode } = setup();
  assert.equal(resolveSignatureMode({ reducedMotion: false, touch: true, saveData: false }), "lightweight");
  assert.equal(resolveSignatureMode({ reducedMotion: false, touch: false, saveData: true }), "lightweight");
  assert.equal(resolveSignatureMode({ reducedMotion: false, touch: false, saveData: false }), "video");
  for (const touch of [true, false]) for (const saveData of [true, false]) {
    assert.equal(resolveSignatureMode({ reducedMotion: true, touch, saveData }), "static");
  }
});

test("signature starts at 0, 10 and 20 seconds with an 8-second pass and no overlapping plays", async () => {
  const f = setup(); const dispose = f.startSignatureLoop(f.media, state => f.states.push(state));
  await settle(); assert.equal(f.media.plays, 1);
  for (const expected of [2, 3]) {
    f.advance(8000); f.media.currentTime = 8; f.media.dispatchEvent(new Event("ended"));
    assert.equal(f.states.at(-1), "waiting");
    f.advance(1999); assert.equal(f.media.plays, expected - 1);
    f.advance(1); await settle(); assert.equal(f.media.plays, expected); assert.equal(f.media.currentTime, 0);
  }
  dispose(); assert.equal(f.timers.size, 0); assert.equal(f.media.paused, true);
});

test("signature suspends hidden/offscreen cycles and recovers on return without a backlog", async () => {
  const f = setup(); const dispose = f.startSignatureLoop(f.media, () => {}); await settle();
  f.advance(8000); f.media.dispatchEvent(new Event("ended"));
  f.page.hidden = true; f.page.dispatchEvent(new Event("visibilitychange"));
  f.advance(30000); assert.equal(f.media.plays, 1); assert.equal(f.timers.size, 0);
  f.page.hidden = false; f.page.dispatchEvent(new Event("visibilitychange")); await settle();
  assert.equal(f.media.plays, 2);
  f.inView(false); assert.equal(f.media.paused, true);
  f.advance(30000); assert.equal(f.media.plays, 2);
  f.inView(true); await settle(); assert.equal(f.media.plays, 3);
  dispose();
});

test("signature retries a Safari autoplay denial on a real touch event", async () => {
  const f = setup(); f.media.rejectPlay = true;
  const dispose = f.startSignatureLoop(f.media, state => f.states.push(state)); await settle();
  assert.equal(f.states.at(-1), "blocked");
  f.media.rejectPlay = false; f.browser.dispatchEvent(new Event("touchend")); await settle();
  assert.equal(f.states.at(-1), "playing"); assert.equal(f.media.plays, 2);
  dispose(); f.browser.dispatchEvent(new Event("touchend")); assert.equal(f.media.plays, 2);
});

test("Earth primes silent inline playback then pauses, and metadata-only loading does not block scrolling", async () => {
  const f = setup(); f.media.readyState = 1; let ready = 0;
  const playback = f.startEarthScrubbing(f.media, f.progress, () => ready++, () => {});
  await settle(); assert.equal(f.media.plays, 1); assert.equal(f.media.paused, true);
  assert.equal(f.media.muted, true); assert.equal(f.media.defaultMuted, true); assert.equal(f.media.playsInline, true);
  f.progressTo(.5); f.frame(); assert.ok(f.media.currentTime > 3.9); assert.equal(ready, 0);
  f.media.readyState = 2; f.media.dispatchEvent(new Event("seeked")); assert.equal(ready, 1);
  playback.dispose();
});

test("Earth coalesces scrolling during decoding and seeks to the most recent position", async () => {
  const f = setup(); const playback = f.startEarthScrubbing(f.media, f.progress, () => {}, () => {}); await settle();
  f.media.seeking = true; f.progressTo(.2); f.progressTo(.9); f.frame(); assert.equal(f.media.currentTime, 0);
  f.media.seeking = false; f.media.dispatchEvent(new Event("seeked")); f.frame(); assert.ok(f.media.currentTime > 7);
  const previous = f.media.currentTime; playback.dispose(); f.progressTo(0); f.frame(); assert.equal(f.media.currentTime, previous);
});

test("Earth can recover after Safari denies autoplay instead of permanently discarding the video", async () => {
  const f = setup(); f.media.rejectPlay = true;
  const playback = f.startEarthScrubbing(f.media, f.progress, () => {}, state => f.states.push(state)); await settle();
  assert.equal(f.states.at(-1), true);
  f.media.rejectPlay = false; f.browser.dispatchEvent(new Event("touchend")); await settle();
  assert.equal(f.states.at(-1), false); assert.equal(f.media.plays, 2); assert.equal(f.media.paused, true);
  f.progressTo(.75); f.frame(); assert.ok(f.media.currentTime > 5.9);
  playback.dispose();
});
