"use client";

import { useSyncExternalStore } from "react";

export type StoreMotionPreference = "system" | "full" | "reduced";

export const STORE_MOTION_STORAGE_KEY = "makeitfly:store-motion";
const preferenceEvent = "makeitfly:store-motion-change";
const mediaQuery = "(prefers-reduced-motion: reduce)";

export function parseStoreMotionPreference(value: string | null): StoreMotionPreference {
  return value === "full" || value === "reduced" ? value : "system";
}

export function resolveStoreMotionEnabled(preference: StoreMotionPreference, systemReduced: boolean) {
  return preference === "full" || (preference === "system" && !systemReduced);
}

type Snapshot = {
  motionEnabled: boolean;
  preference: StoreMotionPreference;
  systemReduced: boolean;
  ready: boolean;
};

// A stable server snapshot avoids reading browser APIs during SSR or hydration.
const serverSnapshot: Snapshot = {
  motionEnabled: false,
  preference: "system",
  systemReduced: true,
  ready: false,
};
let snapshot = serverSnapshot;
let memoryPreference: StoreMotionPreference | null = null;

function getSnapshot(): Snapshot {
  let preference = memoryPreference ?? "system";
  if (memoryPreference === null) {
    try {
      preference = parseStoreMotionPreference(window.sessionStorage.getItem(STORE_MOTION_STORAGE_KEY));
    } catch {
      // Private/restricted contexts still allow a choice for this page lifetime.
    }
  }
  const systemReduced = window.matchMedia(mediaQuery).matches;
  if (snapshot.ready && snapshot.preference === preference && snapshot.systemReduced === systemReduced) return snapshot;
  snapshot = { motionEnabled: resolveStoreMotionEnabled(preference, systemReduced), preference, systemReduced, ready: true };
  return snapshot;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(mediaQuery);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORE_MOTION_STORAGE_KEY || event.key === null) {
      memoryPreference = null;
      onChange();
    }
  };
  media.addEventListener("change", onChange);
  window.addEventListener(preferenceEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(preferenceEvent, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setPreference(preference: StoreMotionPreference) {
  memoryPreference = preference;
  try {
    if (preference === "system") window.sessionStorage.removeItem(STORE_MOTION_STORAGE_KEY);
    else window.sessionStorage.setItem(STORE_MOTION_STORAGE_KEY, preference);
  } catch {
    // No persistent permission is required to enable or pause this experience.
  }
  window.dispatchEvent(new Event(preferenceEvent));
}

export function useStoreMotionPreference() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return { ...current, setPreference };
}
