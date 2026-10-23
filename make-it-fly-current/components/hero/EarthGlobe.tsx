"use client";

import { useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { APOGEE_SUN, sampleEarthFlight } from "@/lib/apogee-config";
import Atmosphere from "./Atmosphere";

export type EarthTextures = { day: Texture; night: Texture; clouds: Texture; bump: Texture };
export type EarthAppearance = "natural" | "horizon";

/** The night map contributes only where the globe faces away from the sun. */
const prepareSurface: MeshStandardMaterial["onBeforeCompile"] = (shader) => {
  shader.uniforms.uApogeeSun = { value: new Vector3(...APOGEE_SUN).normalize() };
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform vec3 uApogeeSun;")
    .replace("#include <map_fragment>", `
      #include <map_fragment>
      float terrainLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(vec3(terrainLuma), diffuseColor.rgb, 0.73);
      float ocean = smoothstep(0.012, 0.075, diffuseColor.b - max(diffuseColor.r, diffuseColor.g));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 0.8, 0.86), ocean * 0.42);
    `)
    .replace("#include <emissivemap_fragment>", `
      #include <emissivemap_fragment>
      vec3 sunInView = normalize(mat3(viewMatrix) * uApogeeSun);
      float nightSide = 1.0 - smoothstep(-0.22, 0.12, dot(normalize(nonPerturbedNormal), sunInView));
      totalEmissiveRadiance *= nightSide;
    `);
};

// Paleta da referência: azul acinzentado, luz difusa e relevo sem verdes fortes.
const prepareHorizonSurface: MeshStandardMaterial["onBeforeCompile"] = (shader) => {
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <map_fragment>", `
      #include <map_fragment>
      float terrainLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float terrainTone = smoothstep(0.006, 0.22, terrainLuma);
      diffuseColor.rgb = mix(vec3(0.055, 0.13, 0.2), vec3(0.46, 0.58, 0.64), terrainTone);
    `)
    .replace("#include <opaque_fragment>", `
      float softHorizon = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 3.0);
      outgoingLight = mix(outgoingLight, vec3(0.13, 0.26, 0.36), 0.2 + softHorizon * 0.25);
      #include <opaque_fragment>
    `);
};

const prepareClouds: MeshStandardMaterial["onBeforeCompile"] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace("#include <alphamap_fragment>", `
    #ifdef USE_ALPHAMAP
      vec3 cloudSample = texture2D(alphaMap, vAlphaMapUv).rgb;
      float cloudLuminance = dot(cloudSample, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.a *= smoothstep(0.15, 0.92, cloudLuminance);
    #endif
  `);
};

export default function EarthGlobe({ progress, compact, textures, onRendered, appearance = "natural" }: {
  progress: MotionValue<number>;
  compact: boolean;
  textures: EarthTextures;
  onRendered: () => void;
  appearance?: EarthAppearance;
}) {
  const soft = appearance === "horizon";
  const surface = useRef<Group>(null);
  const clouds = useRef<Mesh>(null);
  const rendered = useRef(false);
  const afterRender = useCallback(() => {
    if (rendered.current) return;
    rendered.current = true;
    queueMicrotask(onRendered);
  }, [onRendered]);

  useFrame(() => {
    const sample = sampleEarthFlight(progress.get(), compact);
    if (surface.current) surface.current.rotation.y = -1.32 + sample.rotation;
    if (clouds.current) clouds.current.rotation.y = -1.32 + sample.cloudRotation;
  });

  const segments = soft ? compact ? 160 : 192 : compact ? 80 : 128;

  return (
    <group rotation={[0.1, 0, -0.1]}>
      <group ref={surface} rotation={[0, -1.32, 0]}>
        <mesh onAfterRender={afterRender}>
          <sphereGeometry args={[1, segments, segments / 2]} />
          <meshStandardMaterial
            map={textures.day}
            bumpMap={textures.bump}
            bumpScale={soft ? 0.001 : compact ? 0.003 : 0.004}
            emissiveMap={soft ? undefined : textures.night}
            emissive={soft ? "#91aabd" : "#e5bd75"}
            emissiveIntensity={soft ? 0.24 : 1.2}
            roughness={soft ? 1 : 0.88}
            metalness={soft ? 0 : 0.02}
            color={soft ? "#e9f1f5" : "#c6cdd0"}
            onBeforeCompile={soft ? prepareHorizonSurface : prepareSurface}
            customProgramCacheKey={() => soft ? "apogee-earth-horizon-v1" : "apogee-earth-day-night-v1"}
          />
        </mesh>
      </group>
      <mesh ref={clouds} rotation={[0, -1.32, 0]} renderOrder={2}>
        <sphereGeometry args={[1.005, segments, segments / 2]} />
        <meshStandardMaterial
          alphaMap={textures.clouds}
          color={soft ? "#d4e3e6" : "#deded0"}
          emissive={soft ? "#668ba0" : "#000000"}
          emissiveIntensity={soft ? 0.12 : 0}
          opacity={soft ? 0.6 : 0.43}
          transparent
          depthWrite={false}
          alphaTest={0.008}
          roughness={1}
          onBeforeCompile={prepareClouds}
          customProgramCacheKey={() => "apogee-cloud-luminance-v1"}
        />
      </mesh>
      {!soft && <Atmosphere progress={progress} compact={compact} />}
    </group>
  );
}
