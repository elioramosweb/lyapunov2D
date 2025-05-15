import './style.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import Scene from './Scene'
import { OrbitControls } from '@react-three/drei'
import { Leva } from 'leva'  


const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(
  <React.StrictMode>
    <Canvas camera={{ position: [0, 0, 4] }}>
      <ambientLight />
      {/* <axesHelper args={[5]} /> */}
      <Scene />
      {/* <OrbitControls /> */}
    </Canvas>
  <Leva collapsed={false} />
  </React.StrictMode>
)
