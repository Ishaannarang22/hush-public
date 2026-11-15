import { Canvas } from '@react-three/fiber'
import { Edges, Grid, OrbitControls } from '@react-three/drei'

// Placeholder scene: a wireframe building on a ground grid. The real building,
// rooms and per-room noise heat map replace this once property.json and
// levels.json exist (see docs/PLAN.md).
export default function Scene() {
  return (
    <div className="scene">
      <Canvas camera={{ position: [14, 10, 14], fov: 45 }}>
        <color attach="background" args={['#0f1115']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 5]} intensity={1} />
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[6, 6, 4]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.25} />
          <Edges color="#93c5fd" />
        </mesh>
        <Grid
          infiniteGrid
          cellSize={1}
          sectionSize={5}
          cellColor="#2a2f3a"
          sectionColor="#4b5563"
          fadeDistance={60}
        />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
