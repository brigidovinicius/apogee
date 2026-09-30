// The glass stays transparent to the DOM. Optical detail comes from a studio
// environment sampled with reflected/refracted rays, not from an opaque backdrop.
const surfaceFlowShader = /* glsl */ `
  // One slow material-space current carries both the silhouette and the finer
  // normal field. Their waves travel instead of expanding the whole sphere.
  mat3 surfaceFlow() {
    float a = uTime * .105;
    float b = sin(uTime * .17) * .21;
    float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
    mat3 aroundY = mat3(ca, 0., -sa, 0., 1., 0., sa, 0., ca);
    mat3 aroundZ = mat3(cb, sb, 0., -sb, cb, 0., 0., 0., 1.);
    return aroundZ * aroundY;
  }
`;

export const glassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  // Damped interaction velocity, object-plane direction and magnitude <= 1.
  uniform vec2 uVelocity;
  uniform float uImpulse;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectPosition;
  varying vec3 vObjectNormal;

  ${surfaceFlowShader}

  vec3 deform(vec3 n) {
    float t = uTime;
    vec3 q = surfaceFlow() * n;
    // Broad zero-mean modes exchange curvature across the volume, with no
    // uniform radius/scale oscillator (which reads as breathing rubber).
    float swell = q.x * q.y * cos(t * .46)
      + (q.z * q.z - 1. / 3.) * sin(t * .35);
    float tide = sin(dot(q, vec3(6.2, 2.8, 3.1)) - t * .82)
      * cos(dot(q, vec3(-1.8, 5.6, 2.4)) + t * .61);
    float crossing = sin(dot(q, vec3(-4.6, 3.2, 5.1)) + t * .67);
    float ripple = sin(dot(q, vec3(11., 6., -4.)) - t * 1.1)
      * cos(dot(q, vec3(-3., 8., 10.)) + t * .74);
    vec3 touch = normalize(vec3(uPointer * .75, 1.));
    float proximity = exp(-7.5 * dot(n - touch, n - touch));
    float radius = 1. + swell * .042 + tide * .018 + crossing * .009 + ripple * .0035;
    radius += proximity * uImpulse * .02;
    vec3 p = n * radius;

    // A moving drop stretches along its momentum, then relaxes with the input
    // spring. The two perpendicular axes compress so this transform has det=1.
    float speed = min(length(uVelocity), 1.);
    vec3 direction = vec3(uVelocity / max(length(uVelocity), .0001), 0.);
    float stretch = 1. + speed * .055;
    float transverse = inversesqrt(stretch);
    p = p * transverse + direction * dot(p, direction) * (stretch - transverse);
    return p;
  }

  void main() {
    vec3 n = normalize(position);
    vec3 tangent = normalize(cross(abs(n.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.), n));
    vec3 bitangent = cross(n, tangent);
    float e = .004;
    vec3 dt = deform(normalize(n + tangent * e)) - deform(normalize(n - tangent * e));
    vec3 db = deform(normalize(n + bitangent * e)) - deform(normalize(n - bitangent * e));
    vec3 p = deform(n);
    vec4 world = modelMatrix * vec4(p, 1.);
    vObjectNormal = normalize(cross(dt, db));
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * vObjectNormal);
    vObjectPosition = p;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const glassFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform mat4 modelMatrix;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vObjectPosition;
  varying vec3 vObjectNormal;

  ${surfaceFlowShader}

  // Palette values below are authored in sRGB. Lighting uses linear RGB;
  // colorspace_fragment performs the single conversion back to display sRGB.
  vec3 palette(vec3 srgb) {
    vec3 low = srgb / 12.92;
    vec3 high = pow((srgb + .055) / 1.055, vec3(2.4));
    return mix(high, low, lessThanEqual(srgb, vec3(.04045)));
  }

  // An analytic gradient gives smooth detail below the mesh resolution without
  // deriving flat triangle normals or taking several costly noise samples.
  vec3 surfaceGradient(vec3 p) {
    mat3 flow = surfaceFlow();
    vec3 q = flow * p;
    vec3 a = vec3(19., 13., 9.);
    vec3 b = vec3(-17., 27., 15.);
    vec3 c = vec3(31., -11., 23.);
    vec3 warpDirection = vec3(7., 5., 9.);
    float warpPhase = dot(q, warpDirection) + uTime * .38;
    float warp = sin(warpPhase) * .65;
    vec3 warpGradient = cos(warpPhase) * warpDirection * .65;
    float wa = dot(q, a) + uTime * .65 + warp;
    float wb = dot(q, b) - uTime * .52 - warp * .7;
    float wc = dot(q, c) + uTime * .38;
    vec3 gradient = (cos(wa) * sin(wb) * (a + warpGradient)
      + sin(wa) * cos(wb) * (b - warpGradient * .7)
      + cos(wc) * c * .35) * .0022;
    // Pull the gradient back through the rotation: transpose(flow) * gradient.
    return vec3(dot(flow[0], gradient), dot(flow[1], gradient), dot(flow[2], gradient));
  }

  // Tall softboxes and dark studio flags produce thin moving reflections.
  float softbox(vec3 ray, vec3 axis, vec3 up, vec2 size) {
    vec3 side = normalize(cross(axis, up));
    vec3 vertical = cross(side, axis);
    float facing = dot(ray, axis);
    vec2 uv = vec2(dot(ray, side), dot(ray, vertical)) / max(.1, facing);
    vec2 box = smoothstep(size, size * 1.4, abs(uv));
    return (1. - box.x) * (1. - box.y) * smoothstep(.0, .3, facing);
  }

  vec3 studio(vec3 ray) {
    vec3 color = mix(palette(vec3(.52, .64, .68)), palette(vec3(.94, .97, .98)), smoothstep(-.65, .75, ray.y));
    float leftFlag = softbox(ray, normalize(vec3(-.85, .2, -.55)), vec3(0., 1., 0.), vec2(.14, .9));
    float rightFlag = softbox(ray, normalize(vec3(.8, -.15, -.6)), vec3(0., 1., 0.), vec2(.1, .7));
    color = mix(color, palette(vec3(.2, .28, .31)), leftFlag * .7);
    color = mix(color, palette(vec3(.38, .47, .5)), rightFlag * .65);
    float key = softbox(ray, normalize(vec3(-.55, .75, .65)), vec3(0., 1., 0.), vec2(.12, .68));
    float strip = softbox(ray, normalize(vec3(.72, .18, .7)), vec3(0., 1., 0.), vec2(.035, .75));
    return color + vec3(key * .9 + strip * 1.2);
  }

  // The DOM is visible through alpha, not sampled by this shader. Keep the
  // transmitted environment close to white paper; studio flags are reflections.
  vec3 transmittedPaper(vec3 ray) {
    // A stationary environment: highlights slide because the water normals
    // change, not because a texture is independently animated behind the glass.
    float warp = sin(ray.x * 9. + ray.z * 6.);
    float rippleA = sin(dot(ray, vec3(24., 17., 13.)) + warp * .8);
    float rippleB = sin(dot(ray, vec3(-13., 29., 19.)) - warp * .6);
    float veil = smoothstep(-.65, .8, rippleA * rippleB);
    // Pale optical folds, not dark environmental flags. Refraction bends these
    // short waves into irregular streaks while the centre stays nearly white.
    vec3 folds = mix(palette(vec3(.925, .952, .964)), palette(vec3(1.)), veil);
    vec3 paper = mix(palette(vec3(.963, .975, .98)), palette(vec3(1.)), smoothstep(-.8, .8, ray.y));
    return mix(paper, folds, .72);
  }

  void main() {
    vec3 objectNormal = normalize(vObjectNormal);
    vec3 gradient = surfaceGradient(vObjectPosition);
    gradient -= objectNormal * dot(gradient, objectNormal);
    // The orb has a rigid (rotation/translation) model transform. Move its
    // object-space tangent gradient into the same world space as the base normal.
    vec3 N = normalize(vWorldNormal - mat3(modelMatrix) * gradient);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float facing = clamp(dot(N, V), .0, 1.);
    float fresnel = .0204 + .9796 * pow(1. - facing, 5.);
    vec3 reflected = reflect(-V, N);

    // Approximate both interfaces of a water volume (IOR 1.333), not a flat film.
    vec3 entryRay = refract(-V, N, 1. / 1.333);
    float chord = max(.05, -2. * dot(N, entryRay));
    vec3 exitNormal = normalize(N + entryRay * chord);
    vec3 exitRay = refract(entryRay, -exitNormal, 1.333);
    if (dot(exitRay, exitRay) < .001) exitRay = reflected;
    vec3 transmission = transmittedPaper(normalize(exitRay));
    vec3 reflection = studio(reflected);

    float rim = pow(1. - facing, 2.7);
    float lowerEdge = 1. - smoothstep(-.9, .25, vObjectPosition.y);
    float flowing = sin(facing * 44. + dot(reflected, vec3(4., 7., 3.)));
    float caustic = pow(max(0., flowing), 8.) * rim * .08;

    // The framebuffer will multiply RGB by alpha once more. Separate the
    // reflected and hazy transmitted contributions before unpremultiplying, so
    // that reflection reaches the page with weight F rather than F * alpha.
    // The remaining (1 - alpha) is the untouched DOM behind the clear water.
    float haze = .12 + rim * (.1 + lowerEdge * .06);
    float transmittedWeight = haze * (1. - fresnel);
    float alpha = fresnel + transmittedWeight;
    vec3 color = (reflection * fresnel + transmission * transmittedWeight) / max(alpha, .001);
    color += caustic;
    // Small dispersion only at the rim; the water core remains colourless.
    color += vec3(.015, .006, -.008) * sin(reflected.y * 17.) * rim;
    gl_FragColor = vec4(max(color, vec3(0.)), alpha);
    #include <colorspace_fragment>
  }
`;
