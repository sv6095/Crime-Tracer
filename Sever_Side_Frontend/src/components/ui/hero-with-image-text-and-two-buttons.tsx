import { Suspense, useRef, useEffect } from "react";
import { FileText, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "./shadcn/button";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Model } from "../3d/Model";
import * as THREE from "three";

/* -------------------- */
/* AUTO ROTATE + SCROLL */
/* -------------------- */

function AnimatedModel() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      // 🌀 slow museum-style rotation
      groupRef.current.rotation.y += 0.003;
    }
  });

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      // 🎥 subtle zoom-in on scroll
      camera.position.z = 6 - Math.min(scrollY / 400, 1.2);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [camera]);

  return (
    <group ref={groupRef} position={[0, -0.4, 0]} scale={2.6}>
      <Model />
    </group>
  );
}

function Hero() {
  return (
    <div
      className="w-full py-24 lg:py-48"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div className="container mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* LEFT — CINEMATIC 3D */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-[540px] aspect-square relative bg-black/20 rounded-xl overflow-hidden">
              <Canvas
                shadows
                camera={{ position: [0, 0, 6], fov: 35 }}
                style={{ width: '100%', height: '100%', display: 'block' }}
              >
                {/* Lights */}
                <ambientLight intensity={0.55} />
                <directionalLight
                  position={[6, 8, 6]}
                  intensity={1.3}
                  castShadow
                  shadow-mapSize-width={2048}
                  shadow-mapSize-height={2048}
                />

                <Suspense fallback={null}>
                  <AnimatedModel />
                  <Environment preset="studio" />
                </Suspense>

                {/* 🧱 Shadow catcher */}
                <ContactShadows
                  position={[0, -2.1, 0]}
                  opacity={0.35}
                  scale={8}
                  blur={2.8}
                  far={4}
                />

                {/* Locked camera */}
                <OrbitControls
                  enableZoom={false}
                  enablePan={false}
                  enableRotate={false}
                />
              </Canvas>
            </div>
          </div>

          {/* RIGHT PANEL — TEXT + BUTTONS */}
          <div className="flex flex-col gap-6 lg:pl-10">


            <h1
              className="text-5xl md:text-7xl font-heading tracking-tight max-w-xl"
              style={{ color: "var(--text)" }}
            >
              Crime Tracer
            </h1>

            <p
              className="text-xl leading-relaxed tracking-tight max-w-lg text-white/80 font-sans"
            >
              Crime Tracer is a web-based system that helps law
              enforcement collect crime complaints, classify them
              using AI, map them on live geospatial dashboards,
              and automatically link cases to the right BNS legal
              sections — all running on a secure, scalable AWS cloud backbone.
            </p>

            {/* Buttons */}
            <div className="flex flex-row gap-4 pt-2">
              <Link to="/cop/login">
                <Button
                  size="lg"
                  className="gap-3 flex items-center bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FileText className="w-4 h-4" />
                  Officer Login
                </Button>
              </Link>

              <Link to="/cop/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-3 flex items-center border-white/20 hover:bg-white/10 text-white"
                >
                  <Search className="w-4 h-4" />
                  New Registration
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
