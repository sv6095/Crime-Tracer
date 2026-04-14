import React from "react";
import { useGLTF } from "@react-three/drei";

export function MaleCopModel(props: any) {
  const { nodes, materials }: any = useGLTF("/MaleCop.glb");

  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={
          nodes["tripo_node_c7f14f5a-4768-4105-9909-0f1614303ff8"].geometry
        }
        material={
          materials["tripo_material_c7f14f5a-4768-4105-9909-0f1614303ff8"]
        }
      />
    </group>
  );
}

useGLTF.preload("/MaleCop.glb");
