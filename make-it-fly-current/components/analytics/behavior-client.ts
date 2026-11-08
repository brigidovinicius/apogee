"use client";
import { behaviorPage, validBehaviorEvent, type BehaviorEvent, type BehaviorEventName } from "@/lib/behavior-contract";
export const BEHAVIOR_CHOICE_KEY = "apogee:behavior-choice:v1";
export const BEHAVIOR_CHOICE_EVENT = "apogee:behavior-choice";
let choice: "allow" | "deny" | null = null;
let enabled = false;
let queue: BehaviorEvent[] = [];
let timer: number | undefined;
export function browserRefusesBehavior() {
  return typeof navigator !== "undefined" && (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);
}
export function readBehaviorChoice() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(BEHAVIOR_CHOICE_KEY);
    choice = stored === "allow" || stored === "deny" ? stored : null;
  } catch { /* Choice remains in memory when storage is unavailable. */ }
  return choice;
}
export function configureBehavior(value: boolean) {
  const changed = enabled !== value;
  enabled = value;
  if (!value) clearBehaviorQueue();
  if (changed && typeof window !== "undefined") window.dispatchEvent(new Event(BEHAVIOR_CHOICE_EVENT));
}
export function getBehaviorSnapshot(): "pending" | "refused" | "allow" | "deny" | "ask" {
  if (!enabled) return "pending";
  if (browserRefusesBehavior()) return "refused";
  return readBehaviorChoice() ?? "ask";
}
export function subscribeBehavior(listener: () => void) {
  const notify = () => { if (!behaviorAllowed()) clearBehaviorQueue(); listener(); };
  const storage = (event: StorageEvent) => { if (event.key === BEHAVIOR_CHOICE_KEY || event.key === null) notify(); };
  window.addEventListener(BEHAVIOR_CHOICE_EVENT, notify);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(BEHAVIOR_CHOICE_EVENT, notify); window.removeEventListener("storage", storage); };
}
export function behaviorAllowed() { return enabled && !browserRefusesBehavior() && readBehaviorChoice() === "allow"; }
export function clearBehaviorQueue() {
  queue = [];
  if (timer !== undefined && typeof window !== "undefined") window.clearTimeout(timer);
  timer = undefined;
}
export function setBehaviorChoice(value: "allow" | "deny") {
  choice = value;
  try { localStorage.setItem(BEHAVIOR_CHOICE_KEY, value); } catch { /* No persistent tracking fallback. */ }
  if (value === "deny") clearBehaviorQueue();
  window.dispatchEvent(new Event(BEHAVIOR_CHOICE_EVENT));
}
export function trackBehavior(event: BehaviorEventName, target: string, page = typeof window === "undefined" ? null : behaviorPage(window.location.pathname)) {
  if (!behaviorAllowed() || !page) return;
  const item = { page, event, target, device: window.matchMedia("(max-width: 800px)").matches ? "mobile" as const : "desktop" as const };
  if (!validBehaviorEvent(item) || queue.length >= 40) return;
  queue.push(item);
  if (queue.length >= 20) void flushBehavior();
  else if (timer === undefined) timer = window.setTimeout(() => void flushBehavior(), 1000);
}
export async function flushBehavior() {
  if (!behaviorAllowed()) { clearBehaviorQueue(); return; }
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  try {
    await fetch("/api/behavior", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Apogee-Measurement": "allow-v1" },
      credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: "error", keepalive: true,
      body: JSON.stringify({ events }),
    });
  } catch { /* Best effort: never retry or interrupt a user flow. */ }
  if (queue.length && behaviorAllowed() && timer === undefined) timer = window.setTimeout(() => void flushBehavior(), 1000);
}
