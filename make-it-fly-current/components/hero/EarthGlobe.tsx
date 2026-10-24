"use client";

import { useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { APOGEE_SUN, sampleEarthFlight } from "@/lib/apogee-config";
import Atmosphere from "./Atmosphere";

export type EarthTextures = { day: Texture; night: Texture; clouds: Texture; bump: Texture };

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

const prepareClouds: MeshStandardMaterial["onBeforeCompile"] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace("#include <alphamap_fragment>", `
    #ifdef USE_ALPHAMAP
      vec3 cloudSample = texture2D(alphaMap, vAlphaMapUv).rgb;
      float cloudLuminance = dot(cloudSample, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.a *= smoothstep(0.15, 0.92, cloudLuminance);
    #endif
  `);
};

export default function EarthGlobe({ progress, compact, textures, onRendered }: {
  progress: MotionValue<number>;
  compact: boolean;
  textures: EarthTextures;
  onRendered: () => void;
}) {
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

  const segments = compact ? 80 : 128;

  return (
    <group rotation={[0.1, 0, -0.1]}>
      <group ref={surface} rotation={[0, -1.32, 0]}>
        <mesh onAfterRender={afterRender}>
          <sphereGeometry args={[1, segments, segments / 2]} />
          <meshStandardMaterial
            map={textures.day}
            bumpMap={textures.bump}
            bumpScale={compact ? 0.003 : 0.004}
            emissiveMap={textures.night}
            emissive="#e5bd75"
            emissiveIntensity={1.2}
            roughness={0.88}
            metalness={0.02}
            color="#c6cdd0"
            onBeforeCompile={prepareSurface}
            customProgramCacheKey={() => "apogee-earth-day-night-v1"}
          />
        </mesh>
      </group>
      <mesh ref={clouds} rotation={[0, -1.32, 0]} renderOrder={2}>
        <sphereGeometry args={[1.005, segments, segments / 2]} />
        <meshStandardMaterial
          alphaMap={textures.clouds}
          color="#deded0"
          opacity={0.43}
          transparent
          depthWrite={false}
          alphaTest={0.008}
          roughness={1}
          onBeforeCompile={prepareClouds}
          customProgramCacheKey={() => "apogee-cloud-luminance-v1"}
        />
      </mesh>
      <Atmosphere progress={progress} compact={compact} />
    </group>
  );
}
