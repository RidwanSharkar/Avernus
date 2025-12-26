import { useRef, useMemo, memo, useEffect } from 'react';
import { Group, Vector3, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, AdditiveBlending, RingGeometry } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { WeaponType } from '../dragon/weapons';
import { calculateDamage } from '@/core/DamageCalculator';

interface ColossusStrikeProps {
  weaponType: WeaponType;
  position: Vector3;
  damage?: number; // Dynamic damage based on rage consumed
  delayStart?: number;
  onComplete: () => void;
  onHit?: (targetId: string, damage: number, isCritical?: boolean) => void;
  onDamageDealt?: (damageDealt: boolean) => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  targetPlayerData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  playerPosition?: Vector3;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isColossusStrike?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isColossusStrike?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  combatSystem?: any; // CombatSystem for creating damage numbers
}

const ColossusStrikeComponent = memo(function ColossusStrike({
  weaponType,
  position,
  damage = 100, // Default to 100 if not provided
  delayStart = 0,
  onComplete,
  onHit,
  onDamageDealt,
  enemyData = [],
  targetPlayerData = [],
  playerPosition,
  setDamageNumbers,
  nextDamageNumberId,
  combatSystem
}: ColossusStrikeProps) {
  const startTimeRef = useRef<number | null>(null);
  const duration = 1.2; // Match PVP effect duration (1200ms)
  const flickerRef = useRef(1);
  const damageDealtRef = useRef(false);
  const isVisible = useRef(false);
  const isCompleted = useRef(false);

  // Initialize start time only once
  if (startTimeRef.current === null) {
    startTimeRef.current = Date.now() + delayStart;
  }
  
  // Calculate the sky position (directly above the hit position)
  const skyPosition = useMemo(() => {
    return new Vector3(position.x, position.y + 20, position.z);
  }, [position]);
  
  // Create more concentrated branching geometry for lightning bolt
  const mainBoltSegments = 128; // Increased for more detail
  const branchCount = 24; // Doubled for more branches
  
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
      const startIdx = Math.floor(Math.random() * mainBolt.points.length * 0.8);
      const startPoint = mainBolt.points[startIdx];
      const branchLength = Math.floor(mainBolt.points.length * 0.3);
      
      return {
        points: Array(branchLength).fill(0).map((_, i) => {
          const t = i / (branchLength - 1);
          const randomDir = new Vector3(
            (Math.random() - 0.5) * 2,
            -0.3 * t,
            (Math.random() - 0.5) * 2
          ).normalize();
          
          return startPoint.clone().add(
            randomDir.multiplyScalar(distance * 0.08 * t)
          );
        }),
        thickness: 0.03 + Math.random() * 0.04,
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
    impact: new SphereGeometry(0.8, 16, 16)
  }), []);
  
  // Updated materials for yellow lightning
  const materials = useMemo(() => ({
    coreBolt: new MeshStandardMaterial({
      color: new Color('#FFFF00'), // Pure yellow
      emissive: new Color('#FFD700'), // Golden yellow
      emissiveIntensity: 4,
      transparent: true
    }),
    secondaryBolt: new MeshStandardMaterial({
      color: new Color('#FFDD00'), // Bright yellow
      emissive: new Color('#FFD700'), // Golden yellow
      emissiveIntensity: 2,
      transparent: true
    }),
    impact: new MeshStandardMaterial({
      color: new Color('#FFFF00'), // Pure yellow
      emissive: new Color('#FFD700'), // Golden yellow
      emissiveIntensity: 1,
      transparent: true
    })
  }), []);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      geometries.bolt.dispose();
      geometries.impact.dispose();
      materials.coreBolt.dispose();
      materials.secondaryBolt.dispose();
      materials.impact.dispose();
    };
  }, [geometries, materials]);

  // Perform damage detection using dynamic damage based on rage consumed
  const performColossusStrikeDamage = () => {
    if (damageDealtRef.current) {
      return; // Prevent multiple damage applications
    }
    damageDealtRef.current = true;

    const damageRadius = 3.0; // Same radius as Smite (3.0 units)
    let damageDealtFlag = false;

    // Calculate damage using centralized DamageCalculator system
    const damageResult = calculateDamage(damage, weaponType);
    const finalDamage = damageResult.damage;
    const isCritical = damageResult.isCritical;

    // Handle both PVP players and PvE enemies with the same logic as Smite
    const allTargets = [
      ...(targetPlayerData || []).map(player => ({ ...player, isPlayer: true })),
      ...(enemyData || []).map(enemy => ({ ...enemy, isPlayer: false }))
    ];

    // Use caster position for damage calculation if available, otherwise use effect position
    const damageOrigin = playerPosition && playerPosition.x !== 0 ? playerPosition : position;

    allTargets.forEach(target => {
      if (!target.health || target.health <= 0) return;

      const distance = damageOrigin.distanceTo(target.position);

      if (distance <= damageRadius) {
        // Target is within damage radius - deal damage
        if (onHit) {
          onHit(target.id, finalDamage, isCritical);
        }

        // Create damage number using CombatSystem
        if (combatSystem && combatSystem.damageNumberManager) {
          const damagePosition = target.position.clone();
          damagePosition.y += 1.5; // Offset above target
          combatSystem.damageNumberManager.addDamageNumber(
            finalDamage,
            isCritical,
            damagePosition,
            'colossus_strike' // Use distinct damage type for visual styling
          );
        }

        damageDealtFlag = true;
      }
    });

    // Notify parent if any damage was dealt
    if (onDamageDealt) {
      onDamageDealt(damageDealtFlag);
    }
  };

  useFrame(() => {
    if (startTimeRef.current === null) return;

    const currentTime = Date.now();
    const elapsed = (currentTime - startTimeRef.current) / 1000;

    // Check if we should start showing the effect
    if (currentTime < startTimeRef.current) {
      isVisible.current = false;
      return; // Don't render anything until delay is over
    }

    if (!isVisible.current) {
      isVisible.current = true;
    }

    flickerRef.current = Math.random() * 0.3 + 0.7;

    if (elapsed >= duration) {
      if (!isCompleted.current) {
        isCompleted.current = true;
        onComplete();
      }
      return;
    }

    const progress = elapsed / duration;

    // Trigger damage at the same timing as Smite (around 80% progress)
    if (progress >= 0.8 && !damageDealtRef.current) {
      performColossusStrikeDamage();
    }

    const fadeOut = (1.0 * (1 - progress)) * flickerRef.current;
    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.8;
    materials.impact.opacity = fadeOut * 0.9;
  });

  // Don't render anything if not visible yet or if completed
  if (!isVisible.current || isCompleted.current) {
    return null;
  }

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
          scale={[1, 1, 1]}
        />
        
        {/* Impact rings */}
        {[1, 1.4, 1.8].map((size, i) => (
          <mesh 
            key={i} 
            rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          >
            <ringGeometry args={[size, size + 0.2, 32]} />
            <meshBasicMaterial
              color="#FFD700" // Golden yellow
              transparent
              opacity={(0.8 - (i * 0.15)) * (1 - (startTimeRef.current ? (Date.now() - startTimeRef.current) / (duration * 1000) : 0))}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
        
        {/* Enhanced lighting */}
        <pointLight
          color="#FFD700" // Golden yellow
          intensity={25 * (1 - (Date.now() - startTimeRef.current) / (duration * 1000)) * flickerRef.current}
          distance={8}
          decay={2}
        />
      </group>
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  if (prevProps.weaponType !== nextProps.weaponType) return false;
  if (!prevProps.position.equals(nextProps.position)) return false;
  if (prevProps.delayStart !== nextProps.delayStart) return false;
  if ((prevProps.enemyData?.length || 0) !== (nextProps.enemyData?.length || 0)) return false;
  if ((prevProps.targetPlayerData?.length || 0) !== (nextProps.targetPlayerData?.length || 0)) return false;

  if (prevProps.enemyData && nextProps.enemyData) {
    for (let i = 0; i < prevProps.enemyData.length; i++) {
      const prev = prevProps.enemyData[i];
      const next = nextProps.enemyData[i];
      if (!prev || !next) return false;
      if (prev.id !== next.id || prev.health !== next.health || !prev.position.equals(next.position)) {
        return false;
      }
    }
  }

  if (prevProps.targetPlayerData && nextProps.targetPlayerData) {
    for (let i = 0; i < prevProps.targetPlayerData.length; i++) {
      const prev = prevProps.targetPlayerData[i];
      const next = nextProps.targetPlayerData[i];
      if (!prev || !next) return false;
      if (prev.id !== next.id || prev.health !== next.health || !prev.position.equals(next.position)) {
        return false;
      }
    }
  }

  if (prevProps.playerPosition && nextProps.playerPosition) {
    if (!prevProps.playerPosition.equals(nextProps.playerPosition)) return false;
  } else if (prevProps.playerPosition !== nextProps.playerPosition) {
    return false;
  }

  return true;
});

export default ColossusStrikeComponent;
