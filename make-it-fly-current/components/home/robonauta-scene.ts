import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createHeadMotionState, stepHeadMotion, type HeadPose } from "@/lib/robonauta-motion";

const WIDTH = 6;
const HEIGHT = 5;
const HEAD_WIDTH = 2.32;
const HEAD_HEIGHT = 2.58;

export interface RobonautaScene {
  setTarget(pose: HeadPose, tracking: boolean): void;
  setActive(active: boolean): void;
  dispose(): void;
}

function roundedFace(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ShapeGeometry(shape, 12);
}

/** Sample the approved photograph onto the front mesh; the eyes are not regenerated. */
function mapApprovedFace(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) / HEAD_WIDTH + 0.5;
    const v = positions.getY(i) / HEAD_HEIGHT + 0.5;
    // The photographed face is slightly trapezoidal; map its four corners.
    const left = THREE.MathUtils.lerp(415, 425, v);
    const right = THREE.MathUtils.lerp(944, 943, v);
    const top = THREE.MathUtils.lerp(112, 102, u);
    const bottom = THREE.MathUtils.lerp(675, 695, u);
    uv.setXY(i, THREE.MathUtils.lerp(left, right, u) / 1374,
      1 - THREE.MathUtils.lerp(bottom, top, v) / 1145);
  }
}

type Cable = {
  start: THREE.Vector3;
  end: THREE.Vector3;
  controls: THREE.Vector3[];
  curve: THREE.CatmullRomCurve3;
  geometry: THREE.BufferGeometry;
  points: Float32Array;
  radius: number;
  phase: number;
};

function makeCable(
  scene: THREE.Scene, material: THREE.Material,
  start: number[], end: number[], controls: number[][], radius: number, phase: number,
): Cable {
  const segments = 36;
  const sides = 6;
  const points = new Float32Array((segments + 1) * sides * 3);
  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + (j + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    start: new THREE.Vector3(...start), end: new THREE.Vector3(...end),
    controls: controls.map(p => new THREE.Vector3(...p)),
    curve: new THREE.CatmullRomCurve3(Array.from({ length: controls.length + 2 }, () => new THREE.Vector3())),
    geometry, points, radius, phase,
  };
}

export async function createRobonautaScene(
  canvas: HTMLCanvasElement, onReady: () => void, onError: () => void,
): Promise<RobonautaScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cameraDistance = 8;
  const camera = new THREE.PerspectiveCamera(
    THREE.MathUtils.radToDeg(2 * Math.atan(HEIGHT / (2 * cameraDistance))), WIDTH / HEIGHT, 0.1, 40,
  );
  camera.position.set(0, 0, cameraDistance);
  const textures: THREE.Texture[] = [];
  let environment: THREE.WebGLRenderTarget | undefined;
  let resize: ResizeObserver | undefined;
  let frame = 0;
  let disposed = false;
  let active = false;
  let ready = false;
  let previous = 0;
  let elapsed = 0;
  let target: HeadPose = { yaw: 0, pitch: 0 };
  let tracking = false;
  let motion = createHeadMotionState();
  let cableMotion = createHeadMotionState();

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resize?.disconnect();
    canvas.removeEventListener("webglcontextlost", contextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    environment?.dispose();
    renderer.dispose();
  }

  function contextLost(event: Event) {
    event.preventDefault();
    active = false;
    cancelAnimationFrame(frame);
    onError();
  }
  canvas.addEventListener("webglcontextlost", contextLost);

  try {
    const loader = new THREE.TextureLoader();
    // Register each successful texture even if the other load subsequently fails.
    const load = (url: string) => loader.loadAsync(url).then(texture => {
      if (disposed) { texture.dispose(); throw new Error("Scene disposed"); }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      textures.push(texture);
      return texture;
    });
    const [portrait, bodyTexture] = await Promise.all([
      load("/mascot/robonauta-poster.webp"), load("/mascot/robonauta-body.webp"),
    ]);
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, 0.06);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.75;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4f5964, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-4, 6, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd7e8ff, 0.7);
    fill.position.set(5, 1, -2);
    scene.add(fill);

    // Match the original plate's framing at its distance behind the 3D head.
    const bodyScale = (cameraDistance + 1.4) / cameraDistance;
    const body = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH * bodyScale, HEIGHT * bodyScale),
      new THREE.MeshBasicMaterial({ map: bodyTexture, toneMapped: false }));
    body.position.z = -1.4;
    scene.add(body);

    const head = new THREE.Group();
    head.name = "RobonautaNeckPivot";
    head.position.set(-0.02, -0.53, 0);
    head.rotation.order = "YXZ";
    scene.add(head);

    const shellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x898b8d, roughness: 0.42, metalness: 0.24, clearcoat: 0.18, clearcoatRoughness: 0.45,
    });
    const shellGeometry = new RoundedBoxGeometry(HEAD_WIDTH, HEAD_HEIGHT, 1.50, 4, 0.115);
    const shellPositions = shellGeometry.getAttribute("position");
    for (let i = 0; i < shellPositions.count; i++) {
      const depth = (shellPositions.getZ(i) + 0.75) / 1.50;
      shellPositions.setXY(i, shellPositions.getX(i) * THREE.MathUtils.lerp(0.97, 1, depth),
        shellPositions.getY(i) * THREE.MathUtils.lerp(0.94, 1, depth));
    }
    shellGeometry.computeVertexNormals();
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.position.set(0, HEAD_HEIGHT / 2, -0.59);
    head.add(shell);

    const faceGeometry = roundedFace(HEAD_WIDTH, HEAD_HEIGHT, 0.13);
    mapApprovedFace(faceGeometry);
    const face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ map: portrait, toneMapped: false }));
    face.position.set(0, HEAD_HEIGHT / 2, 0.178);
    head.add(face);

    const dark = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.69, metalness: 0.14 });
    const ventGeometry = new THREE.BoxGeometry(0.012, 0.012, 0.46);
    for (const side of [-1, 1]) {
      for (let row = 0; row < 12; row++) {
        const vent = new THREE.Mesh(ventGeometry, dark);
        vent.position.set(side * 1.15, 1.62 + row * 0.035, -0.40);
        head.add(vent);
      }
      const port = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 24), dark);
      port.rotation.z = Math.PI / 2;
      port.position.set(side * 1.155, 1.15, -0.30);
      head.add(port);
    }
    const neckJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.14, 24), dark);
    neckJoint.position.set(0, -0.01, -0.23);
    head.add(neckJoint);

    const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.48, metalness: 0.08 });
    const cables = [
      makeCable(scene, cableMaterial, [-1.08, 1.16, -0.28], [-0.82, 0.01, 0.02],
        [[-1.39, 0.27, 0.02], [-1.34, -0.57, 0.13], [-1.06, -0.88, 0.23]], 0.015, 0),
      makeCable(scene, cableMaterial, [-1.05, 1.27, -0.36], [-0.55, 0.02, 0.07],
        [[-1.32, 0.64, -0.02], [-1.37, -0.25, 0.04], [-1.0, -0.62, 0.17]], 0.009, 1.7),
      makeCable(scene, cableMaterial, [-0.78, 0.02, 0.10], [-0.41, 0.02, 0.07],
        [[-0.85, -0.97, 0.25], [-0.61, -1.60, 0.29], [-0.50, -1.44, 0.33]], 0.013, 3),
      makeCable(scene, cableMaterial, [1.07, 1.13, -0.30], [0.48, 0.02, 0.06],
        [[1.30, 0.30, -0.05], [1.24, -0.70, 0.14], [0.80, -0.78, 0.22]], 0.013, 4.3),
      makeCable(scene, cableMaterial, [1.02, 1.95, -0.45], [0.61, 0.02, -0.02],
        [[1.30, 1.19, -0.18], [1.31, 0.15, 0.01], [0.83, -0.93, 0.13]], 0.008, 5.2),
    ];
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const binormal = new THREE.Vector3();
    const reference = new THREE.Vector3(0, 0, 1);

    function updateCables() {
      head.updateMatrixWorld(true);
      for (const cable of cables) {
        const curve = cable.curve;
        curve.points[0].copy(cable.start).applyMatrix4(head.matrixWorld);
        curve.points[curve.points.length - 1].copy(cable.end).applyMatrix4(head.matrixWorld);
        for (let i = 0; i < cable.controls.length; i++) {
          curve.points[i + 1].copy(cable.controls[i]);
          curve.points[i + 1].x += cableMotion.yaw * (0.4 + i * 0.08) + Math.sin(elapsed * 1.2 + cable.phase) * 0.008;
          curve.points[i + 1].z += cableMotion.pitch * 0.35;
        }
        for (let i = 0; i <= 36; i++) {
          curve.getPoint(i / 36, point);
          curve.getTangent(i / 36, tangent);
          normal.crossVectors(tangent, reference).normalize();
          binormal.crossVectors(tangent, normal).normalize();
          for (let j = 0; j < 6; j++) {
            const angle = j * Math.PI / 3;
            const index = (i * 6 + j) * 3;
            const a = Math.cos(angle) * cable.radius;
            const b = Math.sin(angle) * cable.radius;
            cable.points[index] = point.x + normal.x * a + binormal.x * b;
            cable.points[index + 1] = point.y + normal.y * a + binormal.y * b;
            cable.points[index + 2] = point.z + normal.z * a + binormal.z * b;
          }
        }
        cable.geometry.getAttribute("position").needsUpdate = true;
        cable.geometry.computeVertexNormals();
      }
    }

    function render(now: number) {
      if (!active || disposed) return;
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
      previous = now;
      elapsed += delta;
      const destination = tracking ? target : {
        yaw: Math.sin(elapsed * 0.63) * 0.012,
        pitch: Math.sin(elapsed * 0.81) * 0.006,
      };
      motion = stepHeadMotion(motion, destination, delta, 14);
      cableMotion = stepHeadMotion(cableMotion, motion, delta, 5);
      head.rotation.set(motion.pitch, motion.yaw, 0);
      updateCables();
      renderer.render(scene, camera);
      canvas.dataset.yaw = motion.yaw.toFixed(5);
      canvas.dataset.pitch = motion.pitch.toFixed(5);
      canvas.dataset.tracking = String(tracking);
      if (!ready) { ready = true; onReady(); }
      frame = requestAnimationFrame(render);
    }

    resize = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) renderer.setSize(bounds.width, bounds.height, false);
    });
    resize.observe(canvas);
    const bounds = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, bounds.width), Math.max(1, bounds.height), false);
    return {
      setTarget(pose, isTracking) { target = { ...pose }; tracking = isTracking; },
      setActive(next) {
        if (disposed || active === next) return;
        active = next;
        cancelAnimationFrame(frame);
        previous = 0;
        if (active) frame = requestAnimationFrame(render);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
