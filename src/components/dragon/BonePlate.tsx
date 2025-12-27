import { useRef, useMemo, useEffect } from 'react';
import { Group, TorusGeometry, SphereGeometry, CylinderGeometry, BoxGeometry, MeshStandardMaterial } from 'three';
import React from 'react';

const BonePlate: React.FC = React.memo(() => {
  const plateRef = useRef<Group>(null);

  // Create shared geometries once - CRITICAL: prevents memory leak from inline JSX geometries
  const geometries = useMemo(() => ({
    ribTorus: new TorusGeometry(0.2, 0.022, 8, 12, Math.PI * 1.1),
    ribJoint1: new SphereGeometry(0.0375, 8, 8),
    ribJoint2: new SphereGeometry(0.02, 4, 4),
    ribConnection: new CylinderGeometry(0.06, 0.05, 0.075, 6),
    spineColumn: new CylinderGeometry(0.04, 0.04, 0.9, 4),
    vertebraCore: new CylinderGeometry(0.06, 0.06, 0.04, 6),
    vertebraProtrusion: new BoxGeometry(0.0175, 0.06, 0.075)
  }), []);

  // Create shared materials once
  const materials = useMemo(() => ({
    bone1: new MeshStandardMaterial({
      color: "#e8e8e8",
      roughness: 0.4,
      metalness: 0.3
    }),
    bone2: new MeshStandardMaterial({
      color: "#d8d8d8",
      roughness: 0.5,
      metalness: 0.2
    })
  }), []);

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      // Dispose all geometries
      Object.values(geometries).forEach(geo => geo.dispose());
      // Dispose all materials
      Object.values(materials).forEach(mat => mat.dispose());
    };
  }, [geometries, materials]);

  const createRibPiece = useMemo(() => (yOffset: number, scale: number = 1) => (
    <group position={[0, yOffset, 0]} scale={scale}>
      {/* Left rib */}
      <group rotation={[0, 0, -Math.PI / 3]}>
        <mesh 
          position={[0.085, 0.05, 0.08]}
          rotation={[0.3, Math.PI / 2, -0.5]}
          geometry={geometries.ribTorus}
          material={materials.bone1}
        />

        {/* Rib end joint */}
        <mesh 
          position={[0, 0, -0.1]}
          geometry={geometries.ribJoint1}
          material={materials.bone2}
        />
      </group>

      {/* Right rib */}
      <group rotation={[0, 0, Math.PI / 3]}>
        <mesh 
          position={[-0.085, 0.05, 0.08]}
          rotation={[0.3, -Math.PI / 2, 0]}
          geometry={geometries.ribTorus}
          material={materials.bone1}
        />

        {/* Rib end joint */}
        <mesh 
          position={[-0.3, -0.15, 0]}
          geometry={geometries.ribJoint2}
          material={materials.bone2}
        />
      </group>

      {/* Rib connection to spine */}
      <mesh
        geometry={geometries.ribConnection}
        material={materials.bone1}
      />
    </group>
  ), [geometries, materials]);

  const createSpinePiece = useMemo(() => () => (
    <group>
      {/* Vertical spine column */}
      <mesh
        geometry={geometries.spineColumn}
        material={materials.bone1}
      />

      {/* Spine segments/vertebrae */}
      {[-0.3, -0.15, 0, 0.15, 0.3].map((yPos, i) => (
        <group key={i} position={[0, yPos, 0]}>
          {/* Vertebra core */}
          <mesh
            geometry={geometries.vertebraCore}
            material={materials.bone2}
          />
          
          {/* Vertebra protrusions */}
          <mesh 
            position={[0, 0, -0.125]}
            geometry={geometries.vertebraProtrusion}
            material={materials.bone2}
          />
        </group>
      ))}
    </group>
  ), [geometries, materials]);

  return (
    <group 
      ref={plateRef}
      position={[0, 0.04, -0]}
      rotation={[0.25, Math.PI + Math.PI , 0]}
    >
      <group>
        {/* Create spine first */}
        {createSpinePiece()}
        
        {/* Create rib pairs that connect to spine */}
        <group position={[0, 0, 0]}>
          {createRibPiece(0.45, 0.7)} 
          {createRibPiece(0.3, 0.8)}   
          {createRibPiece(0.15, 0.9)}  
          {createRibPiece(0, 1)}    
          {createRibPiece(-0.15, 0.9)}
          {createRibPiece(-0.3, 0.8)}  
          {createRibPiece(-0.45, 0.7)}  
        </group>
      </group>
    </group>
  );
});

BonePlate.displayName = 'BonePlate';

export default BonePlate;
