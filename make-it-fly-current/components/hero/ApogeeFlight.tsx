"use client";

import dynamic from "next/dynamic";
import { motion, useTransform } from "framer-motion";
import { Component, type ReactNode, type RefObject, useCallback, useEffect, useState } from "react";
import { resolveApogeeMotion } from "@/lib/apogee-motion-policy";
import { sampleEarthFlight } from "@/lib/apogee-config";
import { useApogeeTimeline } from "./useApogeeTimeline";
import styles from "./apogee.module.css";

const EarthCanvas = dynamic(() => import("./EarthCanvas"), { ssr: false, loading: () => null });

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** One persistent scene travels behind the content, never taking over scrolling. */
export function ApogeeFlight({ pageRef, onReadyChange }: {
  pageRef: RefObject<HTMLDivElement | null>;
  onReadyChange: (ready: boolean) => void;
}) {
  const timeline = useApogeeTimeline(pageRef);
  const [readyVersion, setReadyVersion] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReadyVersion(timeline.sceneVersion), [timeline.sceneVersion]);
  const onError = useCallback(() => setFailed(true), []);
  const { canAnimate: canRender } = resolveApogeeMotion({
    mounted: timeline.mounted, lowPower: timeline.lowPower, failed,
  });
  const ready = canRender && readyVersion === timeline.sceneVersion;
  const opacity = useTransform(timeline.progress, value => sampleEarthFlight(value, timeline.compact).opacity);
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);

  return (
    <motion.div className={styles.flight} aria-hidden="true" data-apogee-flight
      data-motion-enabled={canRender ? "true" : undefined}
      data-scene={failed ? "fallback" : timeline.lowPower ? "static" : ready ? "ready" : "loading"}
      style={{ opacity: ready ? opacity : 0 }}>
      {canRender && <SceneBoundary key={timeline.sceneVersion} onError={onError}><EarthCanvas
        progress={timeline.progress} compact={timeline.compact} active={timeline.visible}
        onReady={onReady} onError={onError} /></SceneBoundary>}
    </motion.div>
  );
}
