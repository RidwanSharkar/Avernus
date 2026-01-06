import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, AdditiveBlending, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, SphereGeometry } from '@/utils/three-exports';

interface LightningStrike {
  id: number;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface BowLightningStrikeProps {
  position: Vector3;
  onComplete: () => void;
}

const BowLightningStrike: React.FC<BowLightningStrikeProps> = ({
  position,
  onComplete
}) => {
  const startTimeRef = useRef(Date.now());
  const duration = 0.575; // seconds
  const flickerRef = useRef(1);

  // Calculate the sky position (directly above the hit position)
  const skyPosition = useMemo(() => {
    return new Vector3(position.x, position.y + 20, position.z);
  }, [position]);

  // Create more concentrated branching geometry for lightning bolt
  const mainBoltSegments = 96; // Increased for more detail
  const branchCount = 20; // Doubled for more branches

  const branches = useMemo(() => {
    const distance = position.clone().sub(skyPosition).length();
    const mainBolt = {
      points: Array(mainBoltSegments).fill(0).map((_, i) => {
        const t = i / (mainBoltSegments - 1);
        // More complex zigzag pattern for main bolt
        const primaryOffset = Math.sin(t * Math.PI * 8) * (1 - t) * 1.2;
        const secondaryOffset = Math.sin(t * Math.PI * 16) * (1 - t) * 0.6;
        const randomOffset = (Math.random() - 0.5) * 0.8 * (1 - t);

        return new Vector3(
          skyPosition.x + (position.x - skyPosition.x) * t + primaryOffset + randomOffset,
          skyPosition.y + (position.y - skyPosition.y) * (Math.pow(t, 0.7)),
          skyPosition.z + (position.z - skyPosition.z) * t + secondaryOffset + randomOffset
        );
      }),
      thickness: 0.11,
      isCoreStrike: true
    };

    const secondaryBranches = Array(branchCount).fill(0).map(() => {
      const startIdx = Math.floor(Math.random() * (mainBoltSegments * 0.8));
      const startPoint = mainBolt.points[startIdx];
      const branchLength = Math.floor(mainBoltSegments * (0.1 + Math.random() * 0.2));
      const branchAngle = Math.random() * Math.PI * 2;

      return {
        points: Array(branchLength).fill(0).map((_, i) => {
          const t = i / (branchLength - 1);
          const branchTarget = startPoint.clone().add(
            new Vector3(
              Math.cos(branchAngle) * distance * 0.2,
              -distance * (0.05 + Math.random() * 0.05) * t,
              Math.sin(branchAngle) * distance * 0.2
            )
          );

          const randomJitter = new Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.3
          );

          const point = startPoint.clone().lerp(branchTarget, t);
          point.add(randomJitter);
          return point;
        }),
        thickness: 0.03 + Math.random() * 0.06,
        isCoreStrike: false
      };
    });

    // Adjust tertiary branches
    const tertiaryBranches = secondaryBranches.flatMap(branch => {
      if (Math.random() > 0.5) return [];

      const startIdx = Math.floor(Math.random() * branch.points.length * 0.7);
      const startPoint = branch.points[startIdx];
      const miniBranchLength = Math.floor(branch.points.length * 0.4);

      return [{
        points: Array(miniBranchLength).fill(0).map((_, i) => {
          const t = i / (miniBranchLength - 1);
          const randomDir = new Vector3(
            (Math.random() - 0.5),
            -0.25 * t,
            (Math.random() - 0.5)
          ).normalize();

          return startPoint.clone().add(
            randomDir.multiplyScalar(distance * 0.04 * t)
          );
        }),
        thickness: 0.02 + Math.random() * 0.03,
        isCoreStrike: false
      }];
    });

    return [mainBolt, ...secondaryBranches, ...tertiaryBranches];
  }, [position, skyPosition]);

  // Create geometries and materials
  const geometries = useMemo(() => ({
    bolt: new SphereGeometry(1, 8, 8),
    impact: new SphereGeometry(0.8, 16, 16),
    ring1: new RingGeometry(0.5, 0.625, 32),
    ring2: new RingGeometry(0.75, 0.875, 32),
    ring3: new RingGeometry(1.0, 1.125, 32)
  }), []);

  const materials = useMemo(() => ({
    coreBolt: new MeshStandardMaterial({
      color: new Color('#FFFFFF'),
      emissive: new Color('#80D9FF'),
      emissiveIntensity: 18,
      transparent: true
    }),
    secondaryBolt: new MeshStandardMaterial({
      color: new Color('#80D9FF'),
      emissive: new Color('#80D9FF'),
      emissiveIntensity: 2,
      transparent: true
    }),
    impact: new MeshStandardMaterial({
      color: new Color('#FFFFFF'),
      emissive: new Color('#B6EAFF'),
      emissiveIntensity: 10,
      transparent: true
    }),
    ring: new MeshBasicMaterial({
      color: '#80D9FF',
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending
    })
  }), []);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(geometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    };
  }, [geometries, materials]);

  useFrame(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    flickerRef.current = Math.random() * 0.3 + 0.7;

    if (elapsed >= duration) {
      onComplete();
      return;
    }

    const progress = elapsed / duration;
    const fadeOut = (1.0 * (1 - progress)) * flickerRef.current;
    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.8;
    materials.impact.opacity = fadeOut * 0.9;
    materials.ring.opacity = 0.8 * (1 - progress);
  });

  return (
    <group>
      {/* Lightning branches */}
      {branches.map((branch, branchIdx) => (
        <group key={branchIdx}>
          {branch.points.map((point, idx) => (
            <mesh
              key={idx}
              position={point.toArray()}
              geometry={geometries.bolt}
              material={branch.isCoreStrike ? materials.coreBolt : materials.secondaryBolt}
              scale={[branch.thickness, branch.thickness, branch.thickness]}
            />
          ))}
        </group>
      ))}

      {/* Impact effect */}
      <group position={position.toArray()}>
        <mesh
          geometry={geometries.impact}
          material={materials.impact}
          scale={[0.3, 0.3, 0.3]}
          position={[0, 0.025, 0]}
        />

        {/* Impact rings - using memoized geometries and shared material */}
        <mesh
          rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          geometry={geometries.ring1}
          material={materials.ring}
        />
        <mesh
          rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          geometry={geometries.ring2}
          material={materials.ring}
        />
        <mesh
          rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          geometry={geometries.ring3}
          material={materials.ring}
        />

        {/* Enhanced lighting */}
        <pointLight
        position={[0, 0.25, 0]}
          color="#80D9FF"
          intensity={50 * (1 - (Date.now() - startTimeRef.current) / (duration * 1000)) * flickerRef.current}
          distance={4}
          decay={2}
        />
      </group>
    </group>
  );
};

interface LightningStrikeSystemProps {
  groundRadius?: number;
}

const LightningStrikeSystem: React.FC<LightningStrikeSystemProps> = ({
  groundRadius = 29
}) => {
  const [activeStrikes, setActiveStrikes] = useState<LightningStrike[]>([]);
  const strikeIdCounterRef = useRef(0);
  const lastStrikeTimeRef = useRef(0);

  // Spawn a new lightning strike at a random position on the ground
  const spawnStrike = useCallback((currentTime: number) => {
    // Random position within the ground radius (slightly inward to avoid edge)
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (groundRadius * 1); // Stay within 90% of radius

    const position = new Vector3(
      Math.cos(angle) * distance,
      0, // Ground level
      Math.sin(angle) * distance
    );

    const newStrike: LightningStrike = {
      id: strikeIdCounterRef.current++,
      position,
      startTime: currentTime,
      duration: 0.575, // 0.5 seconds duration
    };

    setActiveStrikes(prev => [...prev, newStrike]);
  }, [groundRadius]);

  // Handle strike completion
  const handleStrikeComplete = useCallback((strikeId: number) => {
    setActiveStrikes(prev => {
      const strike = prev.find(s => s.id === strikeId);
      if (strike && (window as any).audioSystem) {
        // Play lightning strike sound when the strike hits the map
        (window as any).audioSystem.playLightningStrikeSound(strike.position);
      }
      return prev.filter(s => s.id !== strikeId);
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Spawn new lightning strikes every 12-18 seconds (less frequent than eruptions)
    const timeSinceLastStrike = t - lastStrikeTimeRef.current;
    const nextStrikeInterval = 12 + Math.random() * 30; // 12-38 seconds

    if (timeSinceLastStrike > nextStrikeInterval || lastStrikeTimeRef.current === 0) {
      // Spawn 1 lightning strike at a time (less frequent than eruptions)
      spawnStrike(t);
      lastStrikeTimeRef.current = t;
    }
  });

  return (
    <group name="lightning-strikes">
      {activeStrikes.map(strike => (
        <BowLightningStrike
          key={strike.id}
          position={strike.position}
          onComplete={() => handleStrikeComplete(strike.id)}
        />
      ))}
    </group>
  );
};

export default LightningStrikeSystem;
