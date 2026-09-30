"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type GLProps } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { ACESFilmicToneMapping, NoColorSpace, PerspectiveCamera, SRGBColorSpace, Texture, TextureLoader, WebGLRenderer } from "three";
import { APOGEE_FOV, APOGEE_SUN, sampleEarthFlight } from "@/lib/apogee-config";
import EarthGlobe, { type EarthTextures } from "./EarthGlobe";
import StarField from "./StarField";

export type EarthCanvasProps = {
  progress: MotionValue<number>;
  compact: boolean;
  active: boolean;
  onReady: () => void;
  onError: () => void;
};

type RendererDefaults = Parameters<Extract<GLProps, (props: never) => unknown>>[0];

function EarthScene({ progress, compact, active, onReady, onError }: EarthCanvasProps) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const setDpr = useThree((state) => state.setDpr);
  const [textures, setTextures] = useState<EarthTextures | null>(null);
  const failed = useRef(false);

  useEffect(() => {
    const contextLost = (event: Event) => {
      event.preventDefault();
      failed.current = true;
      onError();
    };
    gl.domElement.addEventListener("webglcontextlost", contextLost, false);
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", contextLost, false);
    };
  }, [gl, onError]);

  useEffect(() => {
    let cancelled = false;
    const owned: Texture[] = [];
    const device = navigator as Navigator & { deviceMemory?: number };
    const capable = !compact && gl.capabilities.maxTextureSize >= 4096
      && navigator.hardwareConcurrency >= 6 && (device.deviceMemory ?? 8) >= 4;
    setDpr(Math.min(window.devicePixelRatio || 1, capable ? 1.5 : 1));
    const loader = new TextureLoader();
    const anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), capable ? 4 : 2);
    const load = async (name: string, color: boolean) => {
      const texture = await loader.loadAsync(`/earth/${name}.webp`);
      if (cancelled) {
        texture.dispose();
        throw new Error("Earth texture load cancelled");
      }
      texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
      owned.push(texture);
      return texture;
    };
    Promise.all([
      load(capable ? "earth-day-4k" : "earth-day-2k", true),
      load("earth-night-2k", true),
      load("earth-clouds-2k", false),
      load("earth-bump-2k", false),
    ]).then(([day, night, clouds, bump]) => {
      if (cancelled) return;
      setTextures({ day, night, clouds, bump });
    }).catch((cause: unknown) => {
      if (!cancelled) {
        failed.current = true;
        console.error("Could not load the Earth textures.", cause);
        onError();
      }
    });
    return () => {
      cancelled = true;
      for (const texture of owned) texture.dispose();
    };
  }, [compact, gl, onError, setDpr]);

  useEffect(() => {
    if (!active) return;
    invalidate();
    return progress.on("change", () => invalidate());
  }, [active, progress, invalidate, size.width, size.height, textures]);

  useFrame(() => {
    if (!active || !(camera instanceof PerspectiveCamera)) return;
    const aspect = Math.max(size.width, 1) / Math.max(size.height, 1);
    const sample = sampleEarthFlight(progress.get(), compact, aspect);
    camera.position.set(...sample.camera);
    camera.lookAt(0, 0, 0);
    // An off-axis lens positions the globe without scaling or moving its mesh.
    // This also keeps its circular silhouette exact near the viewport edge.
    camera.setViewOffset(
      size.width, size.height,
      (0.5 - sample.center[0]) * size.width,
      (0.5 - sample.center[1]) * size.height,
      size.width, size.height,
    );
    camera.updateMatrixWorld();
    // Inspectable, non-visual diagnostics for scroll/camera regression checks.
    gl.domElement.setAttribute("data-scroll-progress", sample.progress.toFixed(4));
    gl.domElement.setAttribute("data-camera-distance", sample.distance.toFixed(4));
    gl.domElement.setAttribute("data-earth-center", sample.center.map(value => value.toFixed(4)).join(","));
  }, -1);

  const ready = useCallback(() => {
    if (!failed.current) onReady();
  }, [onReady]);

  return (
    <>
      <ambientLight color="#8fabb5" intensity={0.065} />
      <directionalLight position={APOGEE_SUN} color="#fff3d9" intensity={3.35} />
      <StarField progress={progress} compact={compact} />
      {textures && <EarthGlobe progress={progress} compact={compact} textures={textures} onRendered={ready} />}
    </>
  );
}

export default function EarthCanvas({ progress, compact, active, onReady, onError }: EarthCanvasProps) {
  const [initializationFailed, setInitializationFailed] = useState(false);
  const reportedReady = useRef(false);
  const reportedError = useRef(false);
  const ready = useCallback(() => {
    if (reportedReady.current || reportedError.current) return;
    reportedReady.current = true;
    onReady();
  }, [onReady]);
  const error = useCallback(() => {
    if (reportedError.current) return;
    reportedError.current = true;
    setInitializationFailed(true);
    onError();
  }, [onError]);
  const createRenderer = useCallback(async (defaults: RendererDefaults): Promise<WebGLRenderer> => {
    const canvas = defaults.canvas as HTMLCanvasElement;
    let context: WebGL2RenderingContext | null = null;
    try {
      // Three.js requires WebGL2. Check the actual rendering canvas so support
      // detection does not allocate a second temporary GPU context.
      context = canvas.getContext("webgl2", {
        alpha: true, antialias: true, powerPreference: "high-performance", stencil: false,
      });
      if (!context) throw new Error("WebGL2 is unavailable for the Earth scene.");
      return new WebGLRenderer({ ...defaults, canvas, context, alpha: true, antialias: true, stencil: false });
    } catch (cause) {
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      console.warn("The Earth scene is using its static fallback.", cause);
      error();
      // R3F's Canvas does not catch a rejected async configure(). Stop that
      // configuration without rejecting; the failure state unmounts Canvas
      // immediately. No renderer or animation loop exists, and R3F removes
      // its unmounted root. This unreachable promise can then be collected.
      return new Promise<WebGLRenderer>(() => {});
    }
  }, [error]);

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {!initializationFailed && <Canvas
        frameloop={active ? "demand" : "never"}
        dpr={1}
        camera={{ fov: APOGEE_FOV, near: 0.05, far: 300, position: [0, 0, 5] }}
        gl={createRenderer}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.debug.onShaderError = (context, program, vertexShader, fragmentShader) => {
            console.error("Earth shader compilation failed.", {
              program: context.getProgramInfoLog(program),
              vertex: context.getShaderInfoLog(vertexShader),
              fragment: context.getShaderInfoLog(fragmentShader),
            });
            error();
          };
        }}
        fallback={null}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <EarthScene progress={progress} compact={compact} active={active} onReady={ready} onError={error} />
      </Canvas>}
    </div>
  );
}
