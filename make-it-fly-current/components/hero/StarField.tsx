"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { AdditiveBlending, ShaderMaterial } from "three";
import { sampleEarthFlight } from "@/lib/apogee-config";

function makeStars(count: number) {
  let seed = 92012;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const azimuth = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const radial = Math.sqrt(1 - vertical * vertical);
    positions.set([Math.cos(azimuth) * radial * 130, vertical * 130, Math.sin(azimuth) * radial * 130], i * 3);
    sizes[i] = 0.6 + random() * 1.25;
  }
  return { positions, sizes };
}

const vertexShader = `
  attribute float aSize;
  uniform float uDpr;
  varying float vBrightness;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDpr;
    vBrightness = 0.25 + 0.5 * aSize;
  }
`;
const fragmentShader = `
  uniform float uOpacity;
  varying float vBrightness;
  void main() {
    float edge = 1.0 - smoothstep(0.08, 0.5, distance(gl_PointCoord, vec2(0.5)));
    gl_FragColor = vec4(vec3(0.82, 0.81, 0.74), edge * uOpacity * vBrightness);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function StarField({ progress, compact }: { progress: MotionValue<number>; compact: boolean }) {
  const gl = useThree((state) => state.gl);
  const material = useRef<ShaderMaterial>(null);
  const stars = useMemo(() => makeStars(compact ? 190 : 370), [compact]);
  const uniforms = useMemo(() => ({ uOpacity: { value: 0.25 }, uDpr: { value: 1 } }), []);

  useFrame(() => {
    if (!material.current) return;
    material.current.uniforms.uOpacity.value = sampleEarthFlight(progress.get(), compact).starOpacity;
    material.current.uniforms.uDpr.value = gl.getPixelRatio();
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[stars.sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
