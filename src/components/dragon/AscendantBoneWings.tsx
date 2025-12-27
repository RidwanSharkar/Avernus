import { useRef, useMemo, useEffect, useState } from 'react';
import { Group, Vector3, Euler, Shape, ExtrudeGeometry, MeshStandardMaterial, DoubleSide } from 'three';
import { useFrame } from '@react-three/fiber';
import React from 'react';

interface WingSegment {
 pos: Vector3;
 rot: Euler;
 scale: Vector3;
 featherLength: number;
 hasRedMarking: boolean;
}

interface AscendantBoneWingsProps {
  isLeftWing: boolean;
  parentRef: React.RefObject<Group>;
  isDashing: boolean;
}

export default function AscendantBoneWings({ isLeftWing, parentRef, isDashing }: AscendantBoneWingsProps) {
  const wingsRef = useRef<Group>(null);
  const [isFlapping, setIsFlapping] = useState(false);
  const [flapStartTime, setFlapStartTime] = useState(0);
  const flapDuration = 0.45; // Match dash duration

  // Wing feather shape - thinner and more angular
  const featherShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.06, 0.8);  // Reduced from 0.1 to 0.06
    shape.lineTo(0.03, 1.0);  // Reduced from 0.05 to 0.03
    shape.lineTo(0, 0.95);
    shape.lineTo(-0.03, 1.0); // Reduced from -0.05 to -0.03
    shape.lineTo(-0.06, 0.8); // Reduced from -0.1 to -0.06
    shape.lineTo(0, 0);
    return shape;
  }, []);

  // Red marking shape - thinner blade design
  const redMarkingShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.05, 0.6);  // Reduced from 0.08 to 0.05
    shape.lineTo(0.025, 0.8); // Reduced from 0.04 to 0.025
    shape.lineTo(0, 0.75);
    shape.lineTo(-0.025, 0.8); // Reduced from -0.04 to -0.025
    shape.lineTo(-0.05, 0.6);  // Reduced from -0.08 to -0.05
    shape.lineTo(0, 0);
    return shape;
  }, []);

  const extrudeSettings = useMemo(() => ({
    steps: 1,
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 8
  }), []);

  // Materials
  const materials = useMemo(() => ({
    feather: new MeshStandardMaterial({
      color: "#F5F5DC",
      emissive: "#2A2A1A",
      emissiveIntensity: 0.3,
      metalness: 0.1,
      roughness: 0.6,
      side: DoubleSide
    }),
    redMarking: new MeshStandardMaterial({
      color: "#FF0000",
      emissive: "#FF0000",
      emissiveIntensity: 1.5,
      metalness: 0.7,
      roughness: 0.2,
      opacity: 0.9,
      transparent: true,
      side: DoubleSide
    })
  }), []);

  // Geometries
  const featherGeometry = useMemo(() => new ExtrudeGeometry(featherShape, extrudeSettings), [featherShape, extrudeSettings]);
  const redMarkingGeometry = useMemo(() => new ExtrudeGeometry(redMarkingShape, extrudeSettings), [redMarkingShape, extrudeSettings]);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      featherGeometry.dispose();
      redMarkingGeometry.dispose();
      materials.feather.dispose();
      materials.redMarking.dispose();
    };
  }, [featherGeometry, redMarkingGeometry, materials]);

  // Wing segment definitions - creating layered angel wing structure with better spacing
  const wingSegments: WingSegment[] = useMemo(() => [
    // Primary feathers (outermost, longest) - increased spacing
    {
      pos: new Vector3(isLeftWing ? -1.0 : 1.0, 0.3, -0.15),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 4 : Math.PI / 4),
      scale: new Vector3(-1.1, 1.4, -1),
      featherLength: 1.6,
      hasRedMarking: true
    },

    {
      pos: new Vector3(isLeftWing ? -1.4 : 1.4, 0.8, -0.05),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 3 : Math.PI / 3),
      scale: new Vector3(-1.0, 1.3, -1),
      featherLength: 1.5,
      hasRedMarking: true
    },
    {
      pos: new Vector3(isLeftWing ? -1.5 : 1.5, 1.0, 0),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 2.5 : Math.PI / 2.5),
      scale: new Vector3(-0.9, 1.2, -1),
      featherLength: 1.4,
      hasRedMarking: false
    },
    {
      pos: new Vector3(isLeftWing ? -1.6 : 1.6, 1.5, 0.05),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 2 : Math.PI / 2),
      scale: new Vector3(-0.8, 1.3, -1),
      featherLength: 1.3,
      hasRedMarking: true
    },

    // Secondary feathers (middle layer) - better spacing
    {
      pos: new Vector3(isLeftWing ? -0.7 : 0.7, 0.2, -0.1),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 8 : Math.PI / 8),
      scale: new Vector3(-1.0, 1.4, -1),
      featherLength: 1.0,
      hasRedMarking: false
    },
    {
      pos: new Vector3(isLeftWing ? -0.9 : 0.9, 0.4, -0.05),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 5 : Math.PI / 5),
      scale: new Vector3(-0.9, 1.2, -1),
      featherLength: 1.1,
      hasRedMarking: true
    },
    {
      pos: new Vector3(isLeftWing ? -1.1 : 1.1, 0.6, 0),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 3.5 : Math.PI / 3.5),
      scale: new Vector3(-0.8, 1.1, -1),
      featherLength: 1.1,
      hasRedMarking: false
    },

    // Lower wing feathers - increased spacing
    {
      pos: new Vector3(isLeftWing ? -1.8 : 1.8, 1.1, -0.05),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 12 - Math.PI / 3 : Math.PI / 12 + Math.PI / 3),
      scale: new Vector3(0.9, 1.2, 1),
      featherLength: 1.8,
      hasRedMarking: true
    },
    {
      pos: new Vector3(isLeftWing ? -1.6 : 1.6, 0.35, -0.05),
      rot: new Euler(0, 0, isLeftWing ? -Math.PI / 12 - Math.PI / 5 : Math.PI / 12 + Math.PI / 5),
      scale: new Vector3(0.8, 1.0, 1),
      featherLength: 1.5,
      hasRedMarking: false
    },

  ], [isLeftWing]);

  // Trigger flapping when dash starts
  useEffect(() => {
    if (isDashing && !isFlapping) {
      setIsFlapping(true);
      setFlapStartTime(Date.now() / 1000);
    }
  }, [isDashing, isFlapping]);

  // Wing flapping animation
  useFrame(() => {
    if (isFlapping && wingsRef.current) {
      const currentTime = Date.now() / 1000;
      const elapsed = currentTime - flapStartTime;
      const progress = Math.min(elapsed / flapDuration, 1);

      if (progress >= 1) {
        setIsFlapping(false);
      } else {
        // Apply flapping animation
        const flapIntensity = Math.sin(progress * Math.PI * 2) * 0.3;
        const flapOffset = Math.sin(progress * Math.PI) * 0.5;

        if (wingsRef.current) {
          wingsRef.current.rotation.z = isLeftWing ? -flapOffset : flapOffset;
        }
      }
    }
  });

  // Create individual wing feather with optional red marking
  const createWingFeather = (segment: WingSegment, index: number) => (
    <group
      key={`feather-${index}`}
      position={segment.pos}
      rotation={segment.rot}
      scale={segment.scale}
    >
      {/* Base feather */}
      <mesh geometry={featherGeometry} material={materials.feather}>
        <pointLight
          color="#F5F5DC"
          intensity={0.3}
          distance={0.8}
          decay={2}
        />
      </mesh>

      {/* Red marking overlay */}
      {segment.hasRedMarking && (
        <mesh
          geometry={redMarkingGeometry}
          material={materials.redMarking}
          position={[0, 0, 0.01]}
        >
          <pointLight
            color="#FF0000"
            intensity={1.2}
            distance={1.2}
            decay={2}
          />
        </mesh>
      )}
    </group>
  );

  return (
    <group
      ref={wingsRef}
      position={new Vector3(0, -0.2, 0)}
      rotation={new Euler(0, 0, 0)}
    >
      {/* Wing feathers - show all feathers (collected bones logic removed to match BoneWings interface) */}
      {wingSegments.map((segment, i) =>
        createWingFeather(segment, i)
      )}
    </group>
  );
}
