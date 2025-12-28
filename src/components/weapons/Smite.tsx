import { useRef, useMemo, memo, useEffect } from 'react';
import { Group, Vector3, CylinderGeometry, TorusGeometry, SphereGeometry, MeshStandardMaterial, Euler } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { WeaponType } from '../dragon/weapons';
import { calculateDamage, DamageResult } from '@/core/DamageCalculator';

interface SmiteProps {
  weaponType: WeaponType;
  position: Vector3;
  onComplete: () => void;
  onHit?: (targetId: string, damage: number) => void;
  onDamageDealt?: (totalDamage: number) => void;
  enemyData?: Array<{
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
    isSmite?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSmite?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  combatSystem?: any; // CombatSystem for creating damage numbers
  isCorruptedAuraActive?: boolean; // Whether corrupted aura is active (affects colors and damage)
}

const SmiteComponent = memo(function Smite({
  weaponType,
  position,
  onComplete,
  onHit,
  onDamageDealt,
  enemyData = [],
  setDamageNumbers,
  nextDamageNumberId,
  combatSystem,
  isCorruptedAuraActive = false
}: SmiteProps) {
  const lightningRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const animationDuration = 1.0; // Extended animation duration to ensure full visibility in PVP mode
  const delayTimer = useRef(0);
  const startDelay = 0.05; // Initial delay
  const damageTriggered = useRef(false);

  // useMemo for static geometries - made more narrow and concentrated
  const cylinderGeometries = useMemo(() => ({
    core: new CylinderGeometry(0.08, 0.08, 20, 16),    // Narrower core
    inner: new CylinderGeometry(0.18, 0.18, 20, 16),    // More concentrated
    outer: new CylinderGeometry(0.32, 0.32, 20, 16),    // Tighter outer beam
    glow1: new CylinderGeometry(0.45, 0.45, 20, 16),    // Reduced glow
    glow2: new CylinderGeometry(0.55, 0.45, 20, 16),    // More focused
    outerGlow: new CylinderGeometry(0.6, 0.65, 20, 16),  // Concentrated outer glow
    torus: new TorusGeometry(0.85, 0.08, 8, 32),       // Smaller spiral rings
    skyTorus: new TorusGeometry(0.7, 0.08, 32, 32),     // More compact sky effects
    sphere: new SphereGeometry(0.12, 8, 8)               // Smaller particles
  }), []);

  // Use useMemo for static materials - colors change based on corrupted aura status
  const materials = useMemo(() => {
    const isCorrupted = isCorruptedAuraActive;
    const primaryColor = isCorrupted ? "#FF4444" : "#00FF88";     // Red when corrupted, green normally
    const secondaryColor = isCorrupted ? "#FF8888" : "#00AA44";   // Light red when corrupted, dark green normally

    return {
      core: new MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryColor,
        emissiveIntensity: 50,
        transparent: true,
        opacity: 0.995
      }),
      inner: new MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryColor,
        emissiveIntensity: 30,
        transparent: true,
        opacity: 0.675
      }),
      outer: new MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryColor,
        emissiveIntensity: 20,
        transparent: true,
        opacity: 0.625
      }),
      glow1: new MeshStandardMaterial({
        color: primaryColor,
        emissive: primaryColor,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 0.55
      }),
      glow2: new MeshStandardMaterial({
        color: primaryColor,
        emissive: secondaryColor,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0.425
      }),
      outerGlow: new MeshStandardMaterial({
        color: primaryColor,
        emissive: secondaryColor,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.2
      }),
      spiral: new MeshStandardMaterial({
        color: primaryColor,
        emissive: secondaryColor,
        emissiveIntensity: 10,
        transparent: true,
        opacity: 0.5
      }),
      skySpiral: new MeshStandardMaterial({
        color: primaryColor,
        emissive: secondaryColor,
        emissiveIntensity: 10,
        transparent: true,
        opacity: 0.4
      }),
      particle: new MeshStandardMaterial({
        color: primaryColor,
        emissive: secondaryColor,
        emissiveIntensity: 10,
        transparent: true,
        opacity: 0.665
      })
    };
  }, [isCorruptedAuraActive]);

  // Pre-calculate spiral positions
  const spiralPositions = useMemo(() => (
    Array(3).fill(0).map((_, i) => ({
      rotation: new Euler(Math.PI / 4, (i * Math.PI) / 1.5, Math.PI)
    }))
  ), []);

  // Pre-calculate sky spiral positions - more concentrated
  const skySpiralPositions = useMemo(() => (
    Array(16).fill(0).map((_, i) => ({
      rotation: new Euler(0, (i * Math.PI) / 1.5, 0),
      position: new Vector3(0, 6.0, 0)  // concentration
    }))
  ), []);

  // Pre-calculate particle positions
  const particlePositions = useMemo(() => (
    Array(8).fill(0).map((_, i) => ({
      position: new Vector3(
        Math.cos((i * Math.PI) / 4) * 0.6,  // Reduced from 1.0 to 0.6
        (i - 4) * 1.5,                     // vertical spread 
        Math.sin((i * Math.PI) / 4) * 0.6   // Reduced from 1.0 to 0.6
      )
    }))
  ), []);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Dispose geometries
      cylinderGeometries.core.dispose();
      cylinderGeometries.inner.dispose();
      cylinderGeometries.outer.dispose();
      cylinderGeometries.glow1.dispose();
      cylinderGeometries.glow2.dispose();
      cylinderGeometries.outerGlow.dispose();
      cylinderGeometries.torus.dispose();
      cylinderGeometries.skyTorus.dispose();
      cylinderGeometries.sphere.dispose();
      // Dispose materials
      materials.core.dispose();
      materials.inner.dispose();
      materials.outer.dispose();
      materials.glow1.dispose();
      materials.glow2.dispose();
      materials.outerGlow.dispose();
      materials.spiral.dispose();
      materials.skySpiral.dispose();
      materials.particle.dispose();
    };
  }, [cylinderGeometries, materials]);

  // Function to perform damage in a radius around the impact location
  const performSmiteDamage = () => {
    if (damageTriggered.current) return;

    damageTriggered.current = true;
    const baseSmiteDamage = 100;
    const damageRadius = 3.0; // Small radius around impact location
    let totalDamage = 0;

    enemyData.forEach(enemy => {
      if (!enemy.health || enemy.health <= 0) return;

      const distance = position.distanceTo(enemy.position);
      if (distance <= damageRadius) {
        // Calculate critical hit damage (Corrupted Aura bonuses are already applied via global rune count modifications)
        const damageResult: DamageResult = calculateDamage(baseSmiteDamage, weaponType ?? WeaponType.RUNEBLADE);
        const finalDamage = damageResult.damage;

        // Enemy is within damage radius - deal damage
        if (onHit) {
          onHit(enemy.id, finalDamage); // Pass target ID and damage amount
        }

        // Create damage number for visual feedback using CombatSystem
        if (combatSystem && combatSystem.damageNumberManager) {
          const damagePosition = enemy.position.clone();
          damagePosition.y += 1.5; // Offset above target
          combatSystem.damageNumberManager.addDamageNumber(
            finalDamage,
            damageResult.isCritical,
            damagePosition,
            'smite'
          );
        }

        // Also create damage number using setDamageNumbers if provided
        if (setDamageNumbers && nextDamageNumberId) {
          setDamageNumbers(prev => [...prev, {
            id: nextDamageNumberId.current++,
            damage: finalDamage,
            position: enemy.position.clone(),
            isCritical: damageResult.isCritical,
            isSmite: true
          }]);
        }

        totalDamage += finalDamage;
      }
    });

    // Notify parent with total damage dealt
    if (onDamageDealt) {
      onDamageDealt(totalDamage);
    }
  };

  useFrame((_, delta) => {
    if (!lightningRef.current) return;

    // Handle delay before starting the lightning effect
    if (delayTimer.current < startDelay) {
      delayTimer.current += delta;
      return;
    }

    progressRef.current += delta;
    const progress = Math.min(progressRef.current / animationDuration, 1);

    // Animate the lightning bolt
    if (progress < 1) {
      // Start from high up and strike down to target position
      const startY = position.y + 40;
      const targetY = position.y;
      const currentY = startY + (targetY - startY) * progress;
      lightningRef.current.position.y = currentY;

      // Trigger damage when bolt hits the ground (around 80% progress)
      if (progress >= 0.8 && !damageTriggered.current) {
        performSmiteDamage();
      }

      // Adjust scale effect
      const scale = progress < 0.9 ? 1 : 1 - (progress - 0.9) / 0.1;
      lightningRef.current.scale.set(scale, scale, scale);
    } else {
      onComplete();
    }
  });

  return (
    <group
      ref={lightningRef}
      position={[position.x, position.y + 40, position.z]}
      visible={delayTimer.current >= startDelay}
    >
      {/* Core lightning bolts using shared geometries and materials */}
      <mesh geometry={cylinderGeometries.core} material={materials.core} />
      <mesh geometry={cylinderGeometries.inner} material={materials.inner} />
      <mesh geometry={cylinderGeometries.outer} material={materials.outer} />
      <mesh geometry={cylinderGeometries.glow1} material={materials.glow1} />
      <mesh geometry={cylinderGeometries.glow2} material={materials.glow2} />
      <mesh geometry={cylinderGeometries.outerGlow} material={materials.outerGlow} />

      {/* Spiral effect using pre-calculated positions */}
      {spiralPositions.map((props, i) => (
        <mesh key={i} rotation={props.rotation} geometry={cylinderGeometries.torus} material={materials.spiral} />
      ))}

      {/* Sky spiral effect using pre-calculated positions */}
      {skySpiralPositions.map((props, i) => (
        <mesh key={i} rotation={props.rotation} position={props.position} geometry={cylinderGeometries.skyTorus} material={materials.skySpiral} />
      ))}

      {/* Floating particles using pre-calculated positions */}
      {particlePositions.map((props, i) => (
        <mesh key={i} position={props.position} geometry={cylinderGeometries.sphere} material={materials.particle} />
      ))}

      {/* Lights */}
      <pointLight
        position={[0, -10, 0]}
        color={isCorruptedAuraActive ? "#FF4444" : "#00FF88"}
        intensity={35}
        distance={25}
      />
      <pointLight
        position={[0, 0, 0]}
        color={isCorruptedAuraActive ? "#FF8888" : "#00AA44"}
        intensity={10}
        distance={6}
      />
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  if (prevProps.weaponType !== nextProps.weaponType) return false;
  if (!prevProps.position.equals(nextProps.position)) return false;
  if ((prevProps.enemyData?.length || 0) !== (nextProps.enemyData?.length || 0)) return false;

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

  if (prevProps.playerPosition && nextProps.playerPosition) {
    if (!prevProps.playerPosition.equals(nextProps.playerPosition)) return false;
  } else if (prevProps.playerPosition !== nextProps.playerPosition) {
    return false;
  }

  return true;
});

export default SmiteComponent;
