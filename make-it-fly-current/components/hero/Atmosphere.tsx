"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { AdditiveBlending, FrontSide, ShaderMaterial, Vector3 } from "three";
import { APOGEE_SUN, sampleEarthFlight } from "@/lib/apogee-config";

const vertexShader = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  uniform vec3 uSun;
  uniform float uOpacity;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 6.0);
    float sunlight = smoothstep(-0.24, 0.64, dot(normal, uSun));
    vec3 color = mix(vec3(0.13, 0.26, 0.43), vec3(0.35, 0.62, 0.94), sunlight);
    gl_FragColor = vec4(color, fresnel * uOpacity * (0.2 + 0.8 * sunlight));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Atmosphere({ progress, compact }: { progress: MotionValue<number>; compact: boolean }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uSun: { value: new Vector3(...APOGEE_SUN).normalize() },
    uOpacity: { value: 0.36 },
  }), []);

  useFrame(() => {
    if (material.current) material.current.uniforms.uOpacity.value = sampleEarthFlight(progress.get(), compact).atmosphereOpacity;
  });

  return (
    <mesh renderOrder={3}>
      <sphereGeometry args={[1.008, compact ? 72 : 112, compact ? 48 : 80]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={FrontSide}
      />
    </mesh>
  );
}
