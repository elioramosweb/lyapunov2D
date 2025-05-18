import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DoubleSide } from 'three'
import { useControls } from 'leva'
import { Line, Html } from '@react-three/drei'
import html2canvas from 'html2canvas'

const vertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  #define NMAX 500
  #define MAX_PATTERN 32
  #define PI 3.14159265359

  uniform float uArray[MAX_PATTERN];
  uniform int uPatternLength;
  uniform int uIterMax;
  uniform float uTime;
  uniform float uDisplaceX;
  uniform float uDisplaceY;
  uniform float uZoom;
  uniform float uWhite;
  uniform float uBlack;
  uniform float uLypMin;
  uniform float uLypMax;
  uniform float uRotation;
  uniform int uPalette;
  uniform bool uNoiseEnabled;

  varying vec2 vUv;

  vec3 rainbowPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    float r = 0.5 + 0.5 * cos(6.2831 * (t + 0.0));
    float g = 0.5 + 0.5 * cos(6.2831 * (t + 0.33));
    float b = 0.5 + 0.5 * cos(6.2831 * (t + 0.66));
    return vec3(r, g, b);
  }

  vec3 hotPalette(float t) {
    float r = smoothstep(0.0, 0.5, t); 
    float g = smoothstep(0.25, 0.75, t); 
    float b = smoothstep(0.5, 1.0, t);
    float intensity = mix(0.5, 1.0, t);
    return vec3(r * intensity, g * intensity, b * intensity);
  }

  vec3 turboPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    return vec3(
      0.5 + 0.5 * sin(6.2831 * (t + 0.0)),
      0.5 + 0.5 * sin(6.2831 * (t + 0.15)),
      0.5 + 0.5 * sin(6.2831 * (t + 0.3))
    );
  }

  vec3 viridisPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    return vec3(
      0.267 + 0.643*t - 0.379*t*t,
      0.004 + 1.370*t - 1.689*t*t,
      0.329 + 0.861*t - 0.897*t*t
    );
  }

  vec3 infernoPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    float r = clamp(1.5 * t + 0.05 * sin(20.0 * t), 0.0, 1.0);
    float g = pow(t, 0.5);
    float b = 1.0 - t;
    return vec3(r * 0.9, g * 0.6, b * 0.8);
  }

  vec3 coolwarmPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    return vec3(
      t,
      0.5 * sin(3.1415 * t),
      1.0 - t
    );
  }

  vec3 pastelPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    return vec3(
      0.8 + 0.2 * sin(6.2831 * (t + 0.1)),
      0.7 + 0.3 * sin(6.2831 * (t + 0.4)),
      0.6 + 0.4 * sin(6.2831 * (t + 0.7))
    );
  }

  vec3 getPaletteColor(float t) {
    if (uPalette == 0) return rainbowPalette(t);
    else if (uPalette == 1) return hotPalette(t);
    else if (uPalette == 2) return turboPalette(t);
    else if (uPalette == 3) return viridisPalette(t);
    else if (uPalette == 4) return infernoPalette(t);
    else if (uPalette == 5) return coolwarmPalette(t);
    else return pastelPalette(t);
  }

  float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);

    float res = mix(
      mix(rand(ip), rand(ip+vec2(1.0,0.0)), u.x),
      mix(rand(ip+vec2(0.0,1.0)), rand(ip+vec2(1.0,1.0)), u.x), u.y);
    return res*res;
  }


  float lyapunov(vec2 coord) {
    float x = 0.5;
    float sum = 0.0;
    for (int i = 0; i < 10000; i++) {
      if (i > uIterMax) break;
      int idx = int(mod(float(i), float(uPatternLength)));
      float r = mix(coord.x, coord.y, uArray[idx]);
      x = r * x * (1.0 - x);
      sum += log(abs(r - 2.0 * r * x));
    }
    return sum / float(uIterMax);
  }

  void main() {
    vec2 uv = (vUv - 0.5) * uZoom + 0.5;
    uv.x += uDisplaceX;
    uv.y += uDisplaceY;

    vec2 centeredUv = uv - 0.5;
    float cosR = cos(uRotation);
    float sinR = sin(uRotation);
    mat2 rot = mat2(cosR, -sinR, sinR, cosR);
    centeredUv = rot * centeredUv;
    uv = centeredUv + 0.5;

    float n = uNoiseEnabled ? 2.0 * noise(uv * 5.0 + 0.5 * uTime) : 0.0;
    float lyap = smoothstep(uLypMin, uLypMax, n + lyapunov(uv));
    vec3 col = getPaletteColor(lyap);

    if (distance(col, vec3(1.0)) < uWhite || distance(col, vec3(0.0)) < uBlack) {
      discard;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`


function downloadSnapshot() {
  const container = document.querySelector('#lyapunov-container')
  if (!container) return

  html2canvas(container, { useCORS: true }).then(canvas => {
    const link = document.createElement('a')
    link.download = 'lyapunov.png'
    link.href = canvas.toDataURL()
    link.click()
  })
}


export default function Lyapunov2D() {
  const shaderRef = useRef()
  const timeRef = useRef(0)

  const {
    uZoom,
    uDisplaceX,
    uDisplaceY,
    uWhite,
    uBlack,
    pattern,
    uLypMin,
    uLypMax,
    uIterMax,
    uRotation,
    palette,
    animateTime,
    uNoiseEnabled
  } = useControls('Uniforms', {
    uIterMax:    { value: 100, min: 50, max: 5000, step: 10 },
    uZoom:       { value: 2.04, min: 0.1, max: 10, step: 0.001 },
    uDisplaceX:  { value: 2.37, min: -10, max: 10, step: 0.001 },
    uDisplaceY:  { value: 3.29, min: -10, max: 10, step: 0.001 },
    uWhite:      { value: 0.0, min: 0.0, max: 0.2, step: 0.001 },
    uBlack:      { value: 0.0, min: 0.0, max: 0.2, step: 0.001 },
    pattern:     { value: 'AAABB' },
    uLypMin:     { value: -1, min: -5, max: 5, step: 0.001 },
    uLypMax:     { value: 1, min: -5, max: 5, step: 0.001 },
    uRotation:   { value: 0, min: 0, max: 360, step: 1 },
    palette:     {
      options: {
        Rainbow: 0,
        Hot: 1,
        Turbo: 2,
        Viridis: 3,
        Inferno: 4,
        CoolWarm: 5,
        Pastel: 6
      },
      value: 2
    },
    animateTime: { value: true },
    uNoiseEnabled: { value: true }
  })

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uZoom:       { value: uZoom },
    uDisplaceX:  { value: uDisplaceX },
    uDisplaceY:  { value: uDisplaceY },
    uWhite:      { value: uWhite },
    uBlack:      { value: uBlack },
    uLypMin:     { value: uLypMin },
    uLypMax:     { value: uLypMax },
    uIterMax:    { value: uIterMax },
    uArray:      { value: new Array(32).fill(0.0) },
    uPatternLength: { value: pattern.length },
    uRotation:   { value: THREE.MathUtils.degToRad(uRotation) },
    uPalette:    { value: palette },
    uNoiseEnabled: { value: uNoiseEnabled }
  }), [])

  const smoothValues = useRef({
    uZoom,
    uDisplaceX,
    uDisplaceY,
    uWhite,
    uBlack,
    uLypMin,
    uLypMax,
    uRotation: THREE.MathUtils.degToRad(uRotation)
  })

  useFrame(({ clock }) => {
    const u = shaderRef.current?.uniforms
    const sv = smoothValues.current

    if (u) {
      if (animateTime) {
        timeRef.current = clock.getElapsedTime()
      }
      u.uTime.value = timeRef.current

      const lerpFactor = 0.1
      sv.uZoom = THREE.MathUtils.lerp(sv.uZoom, uZoom, lerpFactor)
      sv.uDisplaceX = THREE.MathUtils.lerp(sv.uDisplaceX, uDisplaceX, lerpFactor)
      sv.uDisplaceY = THREE.MathUtils.lerp(sv.uDisplaceY, uDisplaceY, lerpFactor)
      sv.uWhite = THREE.MathUtils.lerp(sv.uWhite, uWhite, lerpFactor)
      sv.uBlack = THREE.MathUtils.lerp(sv.uBlack, uBlack, lerpFactor)
      sv.uLypMin = THREE.MathUtils.lerp(sv.uLypMin, uLypMin, lerpFactor)
      sv.uLypMax = THREE.MathUtils.lerp(sv.uLypMax, uLypMax, lerpFactor)
      sv.uRotation = THREE.MathUtils.lerp(sv.uRotation, THREE.MathUtils.degToRad(uRotation), lerpFactor)

      u.uZoom.value = sv.uZoom
      u.uDisplaceX.value = sv.uDisplaceX
      u.uDisplaceY.value = sv.uDisplaceY
      u.uWhite.value = sv.uWhite
      u.uBlack.value = sv.uBlack
      u.uLypMin.value = sv.uLypMin
      u.uLypMax.value = sv.uLypMax
      u.uRotation.value = sv.uRotation

      u.uIterMax.value = uIterMax
      u.uPalette.value = palette
      u.uNoiseEnabled.value = uNoiseEnabled

      const patternArray = pattern.split('').map(c => (c === 'B' ? 1.0 : 0.0))
      for (let i = 0; i < 32; i++) {
        u.uArray.value[i] = patternArray[i] ?? 0.0
      }
      u.uPatternLength.value = patternArray.length
    }
  })

  const framePoints = [
    [-2.5, 2.5, 0],
    [2.5, 2.5, 0],
    [2.5, -2.5, 0],
    [-2.5, -2.5, 0],
    [-2.5, 2.5, 0]
  ]

  const xMin = (0 - 0.5) * smoothValues.current.uZoom + 0.5 + smoothValues.current.uDisplaceX;
  const xMax = (1 - 0.5) * smoothValues.current.uZoom + 0.5 + smoothValues.current.uDisplaceX;
  const yMin = (0 - 0.5) * smoothValues.current.uZoom + 0.5 + smoothValues.current.uDisplaceY;
  const yMax = (1 - 0.5) * smoothValues.current.uZoom + 0.5 + smoothValues.current.uDisplaceY;
  const infoText = `Patrón: ${pattern} | X: [${xMin.toFixed(2)}, ${xMax.toFixed(2)}] | Y: [${yMin.toFixed(2)}, ${yMax.toFixed(2)}]`


  return (
    <>
      <mesh>
        <planeGeometry args={[5, 5, 64, 64]} />
        <shaderMaterial
          ref={shaderRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <Line points={framePoints} color="black" lineWidth={2} />
      <Html position={[-2.45, 2.45, 0]} 
      style={{ fontSize: '12px', color: 'black', whiteSpace: 'nowrap',textAlign:'left',fontFamily: 'monospace' }}>
        {infoText}
      </Html>
    </>
  )
}
