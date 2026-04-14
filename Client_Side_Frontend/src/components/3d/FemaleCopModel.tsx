import React from "react";
import { useGLTF } from "@react-three/drei";

export function FemaleCopModel(props: any) {
  const { nodes, materials }: any = useGLTF("/FemaleCop.glb");

  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={
          nodes["tripo_node_d08d45e3-ad2e-4b93-844d-aca0fd046154"].geometry
        }
        material={
          materials["tripo_material_d08d45e3-ad2e-4b93-844d-aca0fd046154"]
        }
      />
    </group>
  );
}

useGLTF.preload("/FemaleCop.glb");
