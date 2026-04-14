import React from "react";
import { useGLTF } from "@react-three/drei";

export function Model(props: any) {
  const { nodes, materials }: any = useGLTF("/LatheeandTopi.glb");

  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={
          nodes["tripo_node_2a74547f-a477-4eb9-a95f-9096c8bb83c5"].geometry
        }
        material={
          materials["tripo_material_2a74547f-a477-4eb9-a95f-9096c8bb83c5"]
        }
      />
    </group>
  );
}

useGLTF.preload("/LatheeandTopi.glb");
