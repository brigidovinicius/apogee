"use client";

/**
 * Cena 3D da lua: esfera texturizada, anel de particulas e cinturao de
 * asteroides que surgem ao clicar. Isolada aqui para ser usada tanto no
 * <LunarGravityCard/> quanto em tela cheia no hero da landing.
 */

import React, { useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";

const RADIUS = 2.0;

// Servida pelo proprio site: sem isso a cena dependia de um CDN de terceiros
// que, se falhar ou demorar, deixa a lua invisivel para sempre.
const MOON_TEXTURE = "/textures/moon.jpg";

const RealisticMoon = ({
  onClick,
  speed = 1,
}: {
  onClick?: () => void;
  speed?: number;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const colorMap = useTexture(MOON_TEXTURE);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.05 * speed;
  });

  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial
        map={colorMap}
        bumpMap={colorMap}
        bumpScale={0.02}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
};

const particlesCount = 60000;
const [ringPositions, ringColors, ringRandoms] = (() => {
  const pos = new Float32Array(particlesCount * 3);
  const col = new Float32Array(particlesCount * 3);
  const rnd = new Float32Array(particlesCount);

  for (let i = 0; i < particlesCount; i++) {
    const angle = Math.random() * Math.PI * 2;

    const rDist = Math.pow(Math.random(), 1.5);
    const radius = 2.2 + rDist * 2.2;

    const thickness = 0.4 - rDist * 0.2;
    const ySpread = Math.random() + Math.random() + Math.random() - 1.5;
    const y = ySpread * thickness;

    pos[i * 3] = Math.cos(angle) * radius;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(angle) * radius;

    const intensity = 1.0 - rDist;

    const paletteType = Math.random();
    let baseR, baseG, baseB;

    if (paletteType < 0.8) {
      baseR = 0.48;
      baseG = 0.61;
      baseB = 0.74;
    } else if (paletteType < 0.94) {
      baseR = 0.73;
      baseG = 0.83;
      baseB = 0.93;
    } else {
      baseR = 0.82;
      baseG = 0.78;
      baseB = 0.68;
    }

    baseR = Math.min(1.0, Math.max(0.0, baseR + (Math.random() - 0.5) * 0.1));
    baseG = Math.min(1.0, Math.max(0.0, baseG + (Math.random() - 0.5) * 0.1));
    baseB = Math.min(1.0, Math.max(0.0, baseB + (Math.random() - 0.5) * 0.1));

    const sparkle = Math.random() > 0.95 ? 2.5 : 1.0;

    col[i * 3] = baseR * intensity * sparkle;
    col[i * 3 + 1] = baseG * intensity * sparkle;
    col[i * 3 + 2] = baseB * intensity * sparkle;
    rnd[i] = Math.random();
  }
  return [pos, col, rnd];
})();

type RingState = "hidden" | "animating" | "visible";

const ParticleRing = ({
  ringState,
  massiveAsteroidsRef,
  speed = 1,
  drawCount = particlesCount,
}: {
  ringState: RingState;
  massiveAsteroidsRef: React.RefObject<Float32Array>;
  speed?: number;
  /** Menos particulas no celular: 60k derruba o framerate em GPU movel. */
  drawCount?: number;
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const inverseMatrixRef = useRef(new THREE.Matrix4());
  const asteroidPositionRef = useRef(new THREE.Vector3());

  const uniforms = useRef({
    uProgress: { value: ringState === "visible" ? 1.0 : 0.0 },
    uAsteroids: { value: new Float32Array(75 * 4) },
    time: { value: 0 },
  });

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y -= delta * 0.055 * speed;
      pointsRef.current.updateMatrix();

      const inverseMatrix = inverseMatrixRef.current
        .copy(pointsRef.current.matrix)
        .invert();
      const asteroidPosition = asteroidPositionRef.current;
      const localAsteroids = uniforms.current.uAsteroids.value;
      for (let i = 0; i < 75; i++) {
        const offset = i * 4;
        asteroidPosition.set(
          massiveAsteroidsRef.current[offset],
          massiveAsteroidsRef.current[offset + 1],
          massiveAsteroidsRef.current[offset + 2]
        );
        asteroidPosition.applyMatrix4(inverseMatrix);
        localAsteroids[offset] = asteroidPosition.x;
        localAsteroids[offset + 1] = asteroidPosition.y;
        localAsteroids[offset + 2] = asteroidPosition.z;
        localAsteroids[offset + 3] = massiveAsteroidsRef.current[offset + 3];
      }
    }
    uniforms.current.time.value = state.clock.elapsedTime;

    if (ringState === "animating") {
      uniforms.current.uProgress.value += delta * 0.35;
      if (uniforms.current.uProgress.value > 1.0)
        uniforms.current.uProgress.value = 1.0;
    } else if (ringState === "visible") {
      uniforms.current.uProgress.value = 1.0;
    } else {
      uniforms.current.uProgress.value = 0.0;
    }
  });

  const onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uProgress = uniforms.current.uProgress;
    shader.uniforms.uAsteroids = uniforms.current.uAsteroids;
    shader.uniforms.time = uniforms.current.time;

    shader.vertexShader = `
      uniform float uProgress;
      uniform vec4 uAsteroids[75];
      uniform float time;
      attribute float aRandom;
      varying float vProgress; 
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `
      vec3 transformed = vec3(position);

      float angle = atan(transformed.x, transformed.z);
      float normalizedAngle = abs(angle) / 3.14159265359;
      float spawnThreshold = 1.0 - normalizedAngle; 

      float progressValue = (uProgress * 1.4) - spawnThreshold;
      float particleProgress = smoothstep(0.0, 0.4, progressValue);
      vProgress = particleProgress;

      transformed.y += sin(angle * 10.0 + time) * 0.05 * aRandom;

      if (uProgress > 0.5) {
        for(int i = 0; i < 75; i++) {
          vec4 astData = uAsteroids[i];
          vec3 delta = transformed - astData.xyz;
          float dist = length(delta);

          float rad = astData.w * 2.0 + 0.15;

          if (dist < rad) {
             float force = pow((rad - dist) / rad, 2.0); 
             transformed += normalize(delta) * force * 0.4;
             transformed.y += force * 0.20 * (aRandom - 0.5);
          }
        }
      }

      float swirl = (1.0 - particleProgress) * 4.0; 
      float s = sin(swirl);
      float c = cos(swirl);
      transformed.xz = mat2(c, -s, s, c) * transformed.xz;

      transformed.y += (1.0 - particleProgress) * (transformed.y >= 0.0 ? 1.0 : -1.0);

      vec3 moonSurface = normalize(transformed) * 2.1;
      transformed = mix(moonSurface, transformed, particleProgress);
      `
    );

    shader.fragmentShader = `
      varying float vProgress;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <color_fragment>`,
      `
      #include <color_fragment>

      diffuseColor.a *= vProgress;
      `
    );
  };

  return (
    <points ref={pointsRef} rotation={[-Math.PI / 2, 0, 0]}>
      <bufferGeometry drawRange-start={0} drawRange-count={drawCount}>
        <bufferAttribute
          attach="attributes-position"
          args={[ringPositions, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[ringColors, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[ringRandoms, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.008}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        onBeforeCompile={onBeforeCompile}
      />
    </points>
  );
};

const generateAsteroids = (count: number) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    const baseRadius = 2.8 + Math.random() * 2.0;
    const radialAmplitude = 0.5 + Math.random() * 1.5;
    const radialSpeed = 0.15 + Math.random() * 0.25;
    const phase = Math.random() * Math.PI * 2;

    const angle = Math.random() * Math.PI * 2;
    const zOffset = (Math.random() - 0.5) * 0.8;

    // Velocidade orbital: alta o bastante para a orbita ser visivelmente viva.
    const speed = (0.11 + Math.random() * 0.15) * (Math.random() > 0.5 ? 1 : -1);

    const rotationSpeedX = (Math.random() - 0.5) * 0.05;
    const rotationSpeedY = (Math.random() - 0.5) * 0.05;
    const rotationSpeedZ = (Math.random() - 0.5) * 0.05;

    const scale = 0.02 + Math.pow(Math.random(), 4) * 0.18;

    data.push({
      angle,
      baseRadius,
      radialAmplitude,
      radialSpeed,
      phase,
      zOffset,
      speed,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      rz: Math.random() * Math.PI,
      rsx: rotationSpeedX,
      rsy: rotationSpeedY,
      rsz: rotationSpeedZ,
      scale,
    });
  }
  data.sort((a, b) => b.scale - a.scale);
  return data;
};

const AsteroidBelt = ({
  ringState,
  massiveAsteroidsRef,
  speed = 1,
}: {
  ringState: RingState;
  massiveAsteroidsRef: React.RefObject<Float32Array>;
  speed?: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const [colorMap, bumpMap] = useTexture([MOON_TEXTURE, MOON_TEXTURE]);

  const count = 75;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [asteroids] = useState(() => generateAsteroids(count));

  const scaleRef = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const targetScale = ringState === "hidden" ? 0 : 1;
    const lerpSpeed = ringState === "hidden" ? 5 : 2;
    // Clamp the interpolation factor: on a long frame (backgrounded tab, hitch)
    // delta * lerpSpeed exceeds 1 and lerp extrapolates, blowing up the scale.
    const t = Math.min(1, delta * lerpSpeed);
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, t);

    if (scaleRef.current < 0.01) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    asteroids.forEach((ast, i) => {
      ast.angle += ast.speed * delta * speed;

      ast.phase += ast.radialSpeed * delta * speed;
      let currentRadius =
        ast.baseRadius + Math.sin(ast.phase) * ast.radialAmplitude;

      if (currentRadius < 2.15) {
        const penetration = 2.15 - currentRadius;
        currentRadius = 2.15 + penetration * 0.85;
      }

      const x = Math.cos(ast.angle) * currentRadius;
      const y = Math.sin(ast.angle) * currentRadius;

      massiveAsteroidsRef.current[i * 4] = x;
      massiveAsteroidsRef.current[i * 4 + 1] = y;
      massiveAsteroidsRef.current[i * 4 + 2] = ast.zOffset;
      massiveAsteroidsRef.current[i * 4 + 3] = ast.scale;

      ast.rx += ast.rsx;
      ast.ry += ast.rsy;
      ast.rz += ast.rsz;

      dummy.position.set(x, y, ast.zOffset);
      dummy.rotation.set(ast.rx, ast.ry, ast.rz);
      dummy.scale.setScalar(ast.scale * scaleRef.current);
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        map={colorMap}
        bumpMap={bumpMap}
        bumpScale={0.08}
        color="#ffffff"
        roughness={0.7}
        metalness={0.1}
      />
    </instancedMesh>
  );
};

export interface MoonSceneProps {
  className?: string;
  /**
   * Reduz a velocidade para quem pede menos movimento. A trajetória ligada à
   * rolagem continua ativa por ser comandada diretamente pelo visitante.
   */
  reducedMotion?: boolean;
  /**
   * Dispara o anel de particulas e o cinturao de asteroides sem depender do
   * clique — usado quando a cena fica atras do conteudo (pointer-events: none)
   * e quem comanda a revelacao e o scroll.
   */
  showAsteroids?: boolean;
  /** Modo leve para telas pequenas: menos particulas e dpr menor. */
  compact?: boolean;
}

export function MoonScene({
  className,
  reducedMotion = false,
  showAsteroids = false,
  compact = false,
}: MoonSceneProps) {
  const [clicado, setClicado] = useState(false);
  const massiveAsteroidsRef = useRef<Float32Array>(new Float32Array(75 * 4));

  // Derivado, nao um efeito: o shader ja clampa uProgress em 1.0, entao
  // "animating" cobre tambem o estado final — "visible" nunca precisa ser setado.
  const ringState: RingState =
    clicado || showAsteroids
      ? reducedMotion
        ? "visible"
        : "animating"
      : "hidden";

  const speed = reducedMotion ? 0.38 : 1;

  return (
    <div className={cn("h-full w-full", className)}>
      <Canvas
        camera={{ position: [0, 4, 10], fov: 45 }}
        dpr={compact ? [1, 1.5] : [1, 2]}
        frameloop="always"
      >
        {/* Luz de preenchimento no lugar do <Environment/>, que puxava um
            HDRI de CDN externo so para dar um brilho ambiente sutil. */}
        <ambientLight intensity={0.14} />
        <hemisphereLight args={["#b9d3ee", "#07182d", 0.35]} />
        <directionalLight
          position={[8, 5, 5]}
          intensity={1.5}
          color="#ffffff"
          castShadow={!compact}
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight
          position={[-5, -3, -5]}
          intensity={0.15}
          color="#b9d3ee"
        />

        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />

        {/* Every loader-driven node lives inside this boundary: a component
            that suspends outside one stalls the whole R3F root. */}
        <Suspense fallback={null}>
          <group rotation={[Math.PI / 8, 0, 0]}>
            <RealisticMoon onClick={() => setClicado(true)} speed={speed} />
            <ParticleRing
              ringState={ringState}
              massiveAsteroidsRef={massiveAsteroidsRef}
              speed={speed}
              drawCount={compact ? 18000 : particlesCount}
            />
            <AsteroidBelt
              ringState={ringState}
              massiveAsteroidsRef={massiveAsteroidsRef}
              speed={speed}
            />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
