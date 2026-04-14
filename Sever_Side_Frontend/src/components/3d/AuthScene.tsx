import React, { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function ModelContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  // Model rotated to face front (camera)
  // Rotation of Math.PI / 2 (90 degrees) or -Math.PI / 2 depending on model orientation
  // Adjust this value to make the model face the camera properly

  return (
    <group ref={ref} position={[0, -1.2, 0]} scale={5.5} rotation={[0, -Math.PI / 2, 0]}>
      {children}
    </group>
  );
}

export function AuthScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-[500px] rounded-2xl overflow-hidden">
      <Canvas shadows camera={{ position: [0, 0, 7], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.3}
          castShadow
        />
        <directionalLight
          position={[-5, 8, 5]}
          intensity={0.7}
          castShadow
        />

        <Suspense fallback={null}>
          {/* Show single model with realistic size, facing front */}
          <ModelContainer>{children}</ModelContainer>
          <Environment preset="studio" />
        </Suspense>

        <ContactShadows
          position={[0, -2.8, 0]}
          opacity={0.4}
          scale={10}
          blur={2.5}
        />

        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
      </Canvas>
    </div>
  );
}
