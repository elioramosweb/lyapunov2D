import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DoubleSide } from 'three'
import { useControls, useCreateStore } from 'leva'
import { Line } from '@react-three/drei'


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
  #define PI   3.14159265359
  uniform float uArray[5];
  uniform float uTime;
  uniform float uDisplaceX;
  uniform float uDisplaceY;
  uniform float uZoom;
  uniform float uWhite;
  uniform float uBlack;
  varying vec2 vUv;

  vec3 hotPalette(float t) {
    float r = smoothstep(0.0, 0.5, t); 
    float g = smoothstep(0.25, 0.75, t); 
    float b = smoothstep(0.5, 1.0, t);
    float intensity = mix(0.5, 1.0, t);
    return vec3(r * intensity, g * intensity, b * intensity);
  }

  

  float tentMap(float x, float r) {
      return r * (1.0 - abs(2.0 * x - 1.0));
  }



  float lyapunov(vec2 coord) {
      float x = 0.5;
      float sum = 0.0;
      for (int i = 0; i < NMAX; i++) {
          int idx = int(mod(float(i), 5.0));  // idx va de 0 a 4 en bucle
          float r = mix(coord.x, coord.y, uArray[idx]);
          x = r * x*(1.0 - x);
          //x = r*cos((PI)*x);
          //x = r - x*x;
         // x = clamp(x,0.0,1.0);
          sum += log(abs(r - 2.0 * r * x));
      }
      return sum / float(NMAX);
  }

  void main() {
    vec2 uv = (vUv - 0.5) * uZoom + 0.5;
    uv.x += uDisplaceX;
    uv.y += uDisplaceY;

    float lyap = smoothstep(-1.0, uTime, lyapunov(uv));
    vec3 col = hotPalette(lyap);

    if (distance(col, vec3(1.0)) < uWhite || distance(col, vec3(0.0)) < uBlack) {
      discard;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function Lyapunov2D() {
  const shaderRef = useRef()

  const {
    uZoom,
    uDisplaceX,
    uDisplaceY,
    uWhite,
    uBlack,
    pattern,
  } = useControls('Uniforms', {
    uZoom:       { value: 2.04, min: 0.1, max: 10, step: 0.001 },
    uDisplaceX:  { value: 2.37,  min: -10, max: 10, step: 0.001 },
    uDisplaceY:  { value: 3.29,  min: -10, max: 10, step: 0.001 },
    uWhite:      { value: 0.0, min: 0.0, max: 0.2, step: 0.001 },
    uBlack:      { value: 0.0, min: 0.0, max: 0.2, step: 0.001 },
    pattern:     { value: 'ABBAB' },

  })

  const current = useRef({
    uZoom,
    uDisplaceX,
    uDisplaceY,
    uWhite,
    uBlack,
  })

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uZoom:       { value: uZoom },
    uDisplaceX:  { value: uDisplaceX },
    uDisplaceY:  { value: uDisplaceY },
    uWhite:      { value: uWhite },
    uBlack:      { value: uBlack },
    uArray:      { value: [0, 0, 0, 0, 0] },
  }), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const u = shaderRef.current?.uniforms
    const speed = 0.1

    current.current.uZoom       = THREE.MathUtils.lerp(current.current.uZoom, uZoom, speed)
    current.current.uDisplaceX  = THREE.MathUtils.lerp(current.current.uDisplaceX, uDisplaceX, speed)
    current.current.uDisplaceY  = THREE.MathUtils.lerp(current.current.uDisplaceY, uDisplaceY, speed)
    current.current.uWhite      = THREE.MathUtils.lerp(current.current.uWhite, uWhite, speed)
    current.current.uBlack      = THREE.MathUtils.lerp(current.current.uBlack, uBlack, speed)

    if (u) {
      u.uTime.value       = t
      u.uZoom.value       = current.current.uZoom
      u.uDisplaceX.value  = current.current.uDisplaceX
      u.uDisplaceY.value  = current.current.uDisplaceY
      u.uWhite.value      = current.current.uWhite
      u.uBlack.value      = current.current.uBlack

      const newArray = pattern.split('').map(c => (c === 'B' ? 1.0 : 0.0))

      while (newArray.length < 5) newArray.push(0.0)
      newArray.length = 5

      for (let i = 0; i < 5; i++) {
        u.uArray.value[i] = newArray[i]
      }


    }
  })

  const framePoints = [
    [-2.5,  2.5, 0],
    [ 2.5,  2.5, 0],
    [ 2.5, -2.5, 0],
    [-2.5, -2.5, 0],
    [-2.5,  2.5, 0],
  ]

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
    </>
  )
}
