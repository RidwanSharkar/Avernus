import { useRef, useState, useEffect, memo, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Color, Shape, AdditiveBlending } from '@/utils/three-exports';
import { WeaponSubclass } from '@/components/dragon/weapons';
import DeflectShield from './DeflectShield';
import { calculationCache } from '@/utils/CalculationCache';
import { getCachedGeometry, sphereSmall, sphereMedium, sphereLarge, sphereExtraLarge } from '@/utils/sharedGeometries';

// Cleanup utility for Three.js resources
const disposeThreeJSResources = (object: any) => {
  if (!object) return;

  // Dispose geometry
  if (object.geometry) {
    object.geometry.dispose();
  }

  // Dispose material
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material: any) => {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        material.dispose();
      });
    } else {
      if (object.material.map) object.material.map.dispose();
      if (object.material.normalMap) object.material.normalMap.dispose();
      if (object.material.roughnessMap) object.material.roughnessMap.dispose();
      if (object.material.metalnessMap) object.material.metalnessMap.dispose();
      if (object.material.emissiveMap) object.material.emissiveMap.dispose();
      object.material.dispose();
    }
  }

  // Recursively dispose children
  if (object.children) {
    object.children.forEach((child: any) => disposeThreeJSResources(child));
  }
};;

interface SwordProps {
  isSwinging: boolean;
  isSmiting: boolean;
  isOathstriking: boolean;
  isColossusStriking?: boolean;
  isCharging?: boolean;
  isDeflecting?: boolean;
  chargeDirectionProp?: Vector3;
  onSwingComplete?: () => void;
  onSmiteComplete?: () => void;
  onColossusStrikeComplete?: () => void;
  onOathstrikeComplete?: () => void;
  onChargeComplete?: () => void;
  onDeflectComplete?: () => void;
  hasChainLightning?: boolean;
  comboStep?: 1 | 2 | 3;
  currentSubclass?: WeaponSubclass;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  onHit?: (targetId: string, damage: number) => void;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isLightning?: boolean;
    isHealing?: boolean;

  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isLightning?: boolean;
    isHealing?: boolean;
    isBreach?: boolean;
    isAegis?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void;
  playerPosition?: Vector3;
  playerRotation?: Vector3;
  dragonGroupRef?: React.RefObject<Group>; // Reference to dragon's group for real-time positioning
  playerEntityId?: number; // Player's entity ID to prevent self-damage
  realTimePositionRef?: React.RefObject<Vector3>; // Real-time position for charge trail particles
}

const SwordComponent = memo(function Sword({
  isSwinging,
  isSmiting,
  isOathstriking,
  isColossusStriking = false,
  isCharging = false,
  isDeflecting = false,
  chargeDirectionProp,
  onSwingComplete,
  onSmiteComplete,
  onColossusStrikeComplete,
  onOathstrikeComplete,
  onChargeComplete,
  onDeflectComplete,
  hasChainLightning = false,
  comboStep = 1,
  currentSubclass,
  enemyData = [],
  onHit,
  setDamageNumbers,
  nextDamageNumberId,
  setActiveEffects,
  playerPosition,
  playerRotation,
  dragonGroupRef,
  playerEntityId,
  realTimePositionRef
}: SwordProps) {
  const swordRef = useRef<Group>(null);
  const swingProgress = useRef(0);
  const smiteProgress = useRef(0);
  const colossusStrikeProgress = useRef(0);
  const chargeProgress = useRef(0);
  const chargeStartPosition = useRef<Vector3 | null>(null);
  const chargeDirection = useRef<Vector3>(new Vector3());
  const chargeStartTime = useRef<number | null>(null);
  const chargeHitEnemies = useRef<Set<string>>(new Set());
  const chargeTrail = useRef<Array<{id: number, position: Vector3, life: number}>>([]);
  const nextChargeParticleId = useRef(1);

  const chargeSpinRotation = useRef(0);
  const chargeSpinStartTime = useRef<number | null>(null);
  const isChargeSpinning = useRef(false);
  const shouldStartSpin = useRef(false);
  const basePosition = [-1.18, 0.225, 0.3] as const; // POSITIONING
  
  
  // Chain Lightning Sparks
  const sparkParticles = useRef<Array<{
    position: Vector3;
    velocity: Vector3;
    life: number;
    scale: number;
  }>>([]);


  // Swing collision tracking
  const lastSwingHitTime = useRef<Record<string, number>>({});
  const swingHasDealtDamage = useRef(false);
  const currentComboStep = useRef(comboStep);
  
  // Combo flow state for smooth transitions
  const isInCombo = useRef(false);
  const comboTransitionProgress = useRef(0);
  const lastComboStep = useRef<1 | 2 | 3>(comboStep); // Initialize to match initial comboStep prop
  const targetPosition = useRef<[number, number, number]>([...basePosition]);
  const targetRotation = useRef<[number, number, number]>([0, 0, 0]);

  // Monitor comboStep prop changes for debugging
  useEffect(() => {
    if (currentComboStep.current !== comboStep) {
      currentComboStep.current = comboStep;
    }
  }, [comboStep]);

  useFrame((_, delta) => {
    if (!swordRef.current) return;

    const now = Date.now();

    // Handle smooth combo transitions when not actively swinging
    if (!isSwinging && !isSmiting && !isOathstriking && !isCharging && !isDeflecting && isInCombo.current) {
      if (comboTransitionProgress.current === 0) {
      }
      comboTransitionProgress.current += delta * 7; // Fast transition speed
      
      if (comboTransitionProgress.current >= 1) {
        // Transition complete
        isInCombo.current = false;
        comboTransitionProgress.current = 0;
        
        // Determine final position based on whether we're continuing combo or resetting
        if (comboStep !== lastComboStep.current) {
          // We're continuing the combo - set up ready position for next swing
          const readyPositions = getComboReadyPosition(comboStep);
          targetPosition.current = readyPositions.position;
          targetRotation.current = readyPositions.rotation;
        } else {
          // Combo ended - return to base position
          targetPosition.current = [...basePosition];
          targetRotation.current = [0, 0, 0];
        }
        
        swordRef.current.position.set(...targetPosition.current);
        swordRef.current.rotation.set(...targetRotation.current);
      } else {
        // Smooth interpolation during transition with curved backswing path
        const easeOut = calculationCache.getEasingCalculation('easeOut', comboTransitionProgress.current, 0, 1);
        
        // Get current position and rotation
        const currentPos = swordRef.current.position;
        const currentRot = swordRef.current.rotation;
        
        // Determine target based on next combo step
        let nextTarget;
        if (comboStep !== lastComboStep.current) {
          // Continuing combo - transition to ready position for next swing
          nextTarget = getComboReadyPosition(comboStep);
        } else {
          // Combo ended - return to base
          nextTarget = {
            position: [...basePosition] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number]
          };
        }
        
        // Create a curved backswing path by adding a slight arc
        // This makes the sword follow a more natural motion instead of straight lines
        const arcHeight = 0.15; // Height of the arc during backswing
        const arcProgress = calculationCache.getTrigCalculation('sin', comboTransitionProgress.current * Math.PI); // Creates a bell curve
        

        // Interpolate position with arc
        const lerpedX = currentPos.x + (nextTarget.position[0] - currentPos.x) * easeOut;
        const lerpedY = currentPos.y + (nextTarget.position[1] - currentPos.y) * easeOut + (arcHeight * arcProgress);
        const lerpedZ = currentPos.z + (nextTarget.position[2] - currentPos.z) * easeOut;
        swordRef.current.position.set(lerpedX, lerpedY, lerpedZ);
        
        // Interpolate rotation
        const lerpedRotX = currentRot.x + (nextTarget.rotation[0] - currentRot.x) * easeOut;
        const lerpedRotY = currentRot.y + (nextTarget.rotation[1] - currentRot.y) * easeOut;
        const lerpedRotZ = currentRot.z + (nextTarget.rotation[2] - currentRot.z) * easeOut;
        swordRef.current.rotation.set(lerpedRotX, lerpedRotY, lerpedRotZ);
      }
      
      return; // Don't process other animations during transition
    }



    // Handle charge spin animation (separate from main charge logic)
    if (isChargeSpinning.current) {      
      const TARGET_ROTATIONS = 1.5; // 1 full rotation 
      const MAX_ROTATION = TARGET_ROTATIONS * Math.PI * 2; // 2π radians for one full rotation
      
      // Use fast rotation speed for dramatic effect
      const SPIN_ROTATION_SPEED = 26.5; 
      
      // Update rotation based on constant speed
      chargeSpinRotation.current += delta * SPIN_ROTATION_SPEED;
      
      // Check if we've completed the target rotation
      if (chargeSpinRotation.current >= MAX_ROTATION) {
        
        // Reset everything and complete charge
        chargeSpinRotation.current = 0;
        chargeSpinStartTime.current = null;
        isChargeSpinning.current = false;
        
        // Reset position and rotation to base values
        swordRef.current.position.set(...basePosition);
        swordRef.current.rotation.set(0, 0, 0);
        
        // Call completion callback
        onChargeComplete?.();
        return;
      }
      
      // Orbital spin animation
      const angle = chargeSpinRotation.current;
      
      // Orbit parameters
      const orbitRadius = 1.125; 

      // Calculate orbital position
      const orbitalX = calculationCache.getTrigCalculation('cos', angle) * orbitRadius;
      const orbitalZ = calculationCache.getTrigCalculation('sin', angle) * orbitRadius;
      
      // Constant height above ground plane
      const fixedHeight = 0.65; 
      
      // Set position to orbit around player
      swordRef.current.position.set(orbitalX, fixedHeight, orbitalZ);
      
      // Set rotation to make sword lay flat and point outward from center 
      swordRef.current.rotation.set(
        Math.PI/4,      // X rotation: lay flat on ground (60 degrees)
        -angle + Math.PI,              // Y rotation: point outward
        1               // Z rotation: no roll
      );
      
      // Additional rotation to make it follow the orbital path
      swordRef.current.rotateY(-angle + Math.PI);
      
      return;
    }

    if (isCharging) {
      const CHARGE_DISTANCE = 9.5; // Distance to dash forward
      const CHARGE_WINDUP_DURATION = 0.1; // Windup duration in seconds
      const CHARGE_DURATION = 0.45; // Dash duration in seconds
      const CHARGE_DAMAGE = 40; // Base damage for charge collision
      const CHARGE_COLLISION_RADIUS = 2.5; // Collision radius - increased for better hit detection
      const MAX_CHARGE_BOUNDS = 25; // Maximum distance from origin
      const CHARGE_FAILSAFE_TIMEOUT = 0.6; // Total expected duration + buffer

      // Initialize charge on first active frame
      if (!chargeStartTime.current) {
        chargeStartTime.current = Date.now();
        chargeStartPosition.current = playerPosition?.clone() || new Vector3(0, 0, 0);
        chargeHitEnemies.current.clear();

        // Use the charge direction passed from the ControlSystem
        if (chargeDirectionProp) {
          chargeDirection.current = chargeDirectionProp.clone().normalize();
        } else {
          // Fallback to forward direction
          chargeDirection.current = new Vector3(0, 0, -1).normalize();
        }


        // Gain rage for performing a charge attack (5 rage per charge)
        const gameUI = (window as any).gameUI;
        if (gameUI) {
          const rageBefore = gameUI.getCurrentRage ? gameUI.getCurrentRage() : 'unknown';
          gameUI.gainRage(0);
          const rageAfter = gameUI.getCurrentRage ? gameUI.getCurrentRage() : 'unknown';
        }
      }

      const elapsed = (Date.now() - chargeStartTime.current) / 1000;

      // Failsafe: If charge has been running too long, reset to prevent getting stuck
      if (elapsed > CHARGE_FAILSAFE_TIMEOUT) {
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        chargeHitEnemies.current.clear();
        chargeTrail.current = [];
        swordRef.current.rotation.set(0, 0, 0);
        swordRef.current.position.set(...basePosition);
        onChargeComplete?.();
        return;
      }

      // Windup phase - rotate sword to forward position
      if (elapsed < CHARGE_WINDUP_DURATION) {
        const windupProgress = elapsed / CHARGE_WINDUP_DURATION;
        const easeInOut = windupProgress < 0.5 
          ? 2 * windupProgress * windupProgress 
          : calculationCache.getEasingCalculation('easeInOut', windupProgress, 0, 1);
        
        // Smoothly rotate sword to forward position
        const targetRotationX = Math.PI/2;
        const currentRotationX = easeInOut * targetRotationX;
        swordRef.current.rotation.set(currentRotationX, 0, 0);
        
        // Smoothly move sword forward
        const targetZ = basePosition[2] + 1.5;
        const currentZ = basePosition[2] + (easeInOut * 1.5);
        swordRef.current.position.set(basePosition[0], basePosition[1] + 0.2, currentZ);
        
        return; // Stay in windup phase
      }

      // Dash phase - start after windup is complete
      const dashElapsed = elapsed - CHARGE_WINDUP_DURATION;
      const progress = Math.min(dashElapsed / CHARGE_DURATION, 1);

      // Calculate movement using easing function
      const easeOutQuad = calculationCache.getEasingCalculation('easeOutQuad', progress, 0, 1);
      
      // Safety checks
      if (!chargeStartPosition.current || !chargeDirection.current || !playerPosition) {
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        onChargeComplete?.();
        return;
      }
      
      // Calculate new position
      const displacement = chargeDirection.current.clone().multiplyScalar(CHARGE_DISTANCE * easeOutQuad);
      const newPosition = chargeStartPosition.current.clone().add(displacement);

      // Bounds checking
      const distanceFromOrigin = newPosition.length();
      if (distanceFromOrigin > MAX_CHARGE_BOUNDS) {
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        onChargeComplete?.();
        return;
      }



      // Check for collisions with enemies during dash phase
      const currentPosition = realTimePositionRef?.current || playerPosition;
      if (enemyData && enemyData.length > 0 && onHit && progress > 0 && currentPosition) {

        for (const enemy of enemyData) {
          // Skip already hit enemies
          if (chargeHitEnemies.current.has(enemy.id)) continue;

          // Skip if enemy health is 0 or below
          if (enemy.health <= 0) continue;

          // Calculate distance from real-time player position to enemy
          const distance = currentPosition.distanceTo(enemy.position);
          
          if (distance <= CHARGE_COLLISION_RADIUS) {
            // We hit this enemy
            chargeHitEnemies.current.add(enemy.id);
            
            // Apply damage
            onHit(enemy.id, CHARGE_DAMAGE);
            
            // Show damage number if function is provided
            if (setDamageNumbers && nextDamageNumberId) {
              setDamageNumbers(prev => [...prev, {
                id: nextDamageNumberId.current++,
                damage: CHARGE_DAMAGE,
                position: enemy.position.clone(),
                isCritical: false,
                isBreach: true // Reuse breach damage type for charge
              }]);
            }
          }
        }
      }


      // Maintain sword pointing forward during charge
      swordRef.current.rotation.set(Math.PI/2, 0, -0.175); // Keep sword pointing forward like a spear
      swordRef.current.position.set(basePosition[0], basePosition[1] + 0.2, basePosition[2] + 1.5); // Keep forward position

      // Note: Charge completion is now handled by detecting isCharging transition from true to false
      // This is because ControlSystem completes the charge before progress reaches 100%
      
      return;
    }

    // Detect charge completion and trigger spin
    if (!isCharging && chargeStartTime.current !== null && !isChargeSpinning.current && !shouldStartSpin.current) {
      shouldStartSpin.current = true;
      
   
      
    }

    // Enhanced failsafe: Reset all charge states if isCharging becomes false but we still have active charge state
    if (!isCharging && chargeStartTime.current !== null && !isChargeSpinning.current && !shouldStartSpin.current) {
      // If we've been in this state for too long without starting the spin, force reset
      const timeSinceChargeEnd = (Date.now() - chargeStartTime.current) / 1000;
      if (timeSinceChargeEnd > 2.0) { // 2 seconds is definitely too long to wait for spin
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        chargeHitEnemies.current.clear();
        chargeTrail.current = [];
        shouldStartSpin.current = false;
        swordRef.current.rotation.set(0, 0, 0);
        swordRef.current.position.set(...basePosition);
        return;
      }
    }
    
    // Start spin if flagged to do so
    if (shouldStartSpin.current && !isChargeSpinning.current) {
      // Reset charge state
      chargeStartTime.current = null;
      chargeStartPosition.current = null;
      chargeHitEnemies.current.clear();
      chargeTrail.current = [];
      shouldStartSpin.current = false;
      
      // Initialize spin phase
      isChargeSpinning.current = true;
      chargeSpinRotation.current = 0;
      chargeSpinStartTime.current = Date.now();
    }
    
    
    // Reset everything if charge is cancelled early (before completion)
    if (!isCharging && chargeStartTime.current !== null && !shouldStartSpin.current && !isChargeSpinning.current) {
      chargeStartTime.current = null;
      chargeStartPosition.current = null;
      chargeHitEnemies.current.clear();
      chargeTrail.current = [];
      shouldStartSpin.current = false;
      swordRef.current.rotation.set(0, 0, 0);
      swordRef.current.position.set(...basePosition);
    }
    
    // Reset spin flags if charge is restarted
    if (isCharging && !chargeStartTime.current) {
      shouldStartSpin.current = false;
      isChargeSpinning.current = false;
      chargeSpinRotation.current = 0;
    }

    if (isSmiting) {
      smiteProgress.current += delta * (smiteProgress.current < Math.PI/2 ? 3 : 6);
      const smitePhase = Math.min(smiteProgress.current / Math.PI, 1);
      
      let rotationX, rotationY, positionX, positionY, positionZ;
      
      if (smitePhase < 0.5) {
        // Wind-up phase: pull back and up, with more movement towards center
        const windupPhase = smitePhase * 0.45;
        rotationX = -Math.PI/3 - (windupPhase * Math.PI/3);
        rotationY = windupPhase * Math.PI/4;
        
        // Move towards center during windup
        positionX = basePosition[0] + (windupPhase * 1.5);
        positionY = basePosition[1] + windupPhase * 1.5;
        positionZ = basePosition[2] - windupPhase * 1.5;
      } else {
        // Strike phase: swing down towards center point
        const strikePhase = (smitePhase - 0.5) * 2;
        rotationX = -2*Math.PI/3 + (strikePhase * 3*Math.PI/2);
        rotationY = (Math.PI/4) * (1 - strikePhase);
      
        // Strike  towards center
        positionX = basePosition[0] + (1.5 * (1 - strikePhase));
        positionY = basePosition[1] + (1.5 - strikePhase * 2.0);
        positionZ = basePosition[2] - (1.5 - strikePhase * 3.0);
      }
      
      swordRef.current.position.set(
        positionX,
        positionY,
        positionZ
      );
      
      swordRef.current.rotation.set(rotationX, rotationY, 0);
      
      if (smiteProgress.current >= Math.PI) {
        smiteProgress.current = 0;
        swordRef.current.rotation.set(0, 0, 0);
        swordRef.current.position.set(...basePosition);
        onSmiteComplete?.();
      }
      return;
    }

    if (isColossusStriking) {
      colossusStrikeProgress.current += delta * (colossusStrikeProgress.current < Math.PI/2 ? 3 : 6);
      const colossusStrikePhase = Math.min(colossusStrikeProgress.current / Math.PI, 1);

      let rotationX, rotationY, positionX, positionY, positionZ;

      if (colossusStrikePhase < 0.5) {
        // Wind-up phase: pull back and up, with more movement towards center
        const windupPhase = colossusStrikePhase * 0.35;
        rotationX = -Math.PI/3 - (windupPhase * Math.PI/3);
        rotationY = windupPhase * Math.PI/4;

        // Move towards center during windup
        positionX = basePosition[0] + (windupPhase * 1.5);
        positionY = basePosition[1] + windupPhase * 1.5;
        positionZ = basePosition[2] - windupPhase * 1.5;
      } else {
        // Strike phase: swing down towards center point
        const strikePhase = (colossusStrikePhase - 0.5) * 2;
        rotationX = -2*Math.PI/3 + (strikePhase * 3*Math.PI/2);
        rotationY = (Math.PI/4) * (1 - strikePhase);

        // Strike towards center
        positionX = basePosition[0] + (1.5 * (1 - strikePhase));
        positionY = basePosition[1] + (1.5 - strikePhase * 2.0);
        positionZ = basePosition[2] - (1.5 - strikePhase * 3.0);
      }

      swordRef.current.position.set(
        positionX,
        positionY,
        positionZ
      );

      swordRef.current.rotation.set(rotationX, rotationY, 0);

      if (colossusStrikeProgress.current >= Math.PI) {
        colossusStrikeProgress.current = 0;
        swordRef.current.rotation.set(0, 0, 0);
        swordRef.current.position.set(...basePosition);
        onColossusStrikeComplete?.();
      }
      return;
    }

    if (isSwinging) {
      // Always keep currentComboStep synchronized with the prop
      if (currentComboStep.current !== comboStep) {
        currentComboStep.current = comboStep;
      }
      
      // Update current combo step when swing starts
      if (swingProgress.current === 0) {
        swingHasDealtDamage.current = false;
      }
      
      swingProgress.current += delta * 8;
      const swingPhase = Math.min(swingProgress.current / Math.PI/1.5, 1);
      
      // Use the stored combo step for this swing animation
      const effectiveComboStep = currentComboStep.current;
      
      // Different completion timing for 3rd swing (takes longer to show full downstrike)
      const completionThreshold = effectiveComboStep === 3 ? Math.PI * 0.9 : Math.PI * 0.55;
      
      // Check for damage during the active part of the swing - widened damage windows
      const damageWindow = effectiveComboStep === 3 ? 
        (swingPhase >= 0.25 && swingPhase <= 0.75) : // 3rd hit has wider timing window
        (swingPhase >= 0.15 && swingPhase <= 0.65);   // 1st and 2nd hits have wider windows
      
      if (damageWindow && !swingHasDealtDamage.current) {
        performSwingDamage(effectiveComboStep);
        swingHasDealtDamage.current = true;
      }
      
      if (swingProgress.current >= completionThreshold) {
        swingProgress.current = 0;
        swingHasDealtDamage.current = false;
        lastSwingHitTime.current = {}; // Reset hit tracking
        
        // Store the current combo step as the last one
        lastComboStep.current = effectiveComboStep;
        
        // Set up for smooth transition to next combo position
        // Skip transition animation for 2nd → 3rd swing (overhead strike should start immediately)
        if (effectiveComboStep === 2) {
          isInCombo.current = false; // No transition needed
          
          // For 2nd → 3rd swing, maintain current position without any interpolation
          // The 3rd swing animation will handle its own positioning from the start
          // Don't reset to base position or apply any ready position
        } else {
          // This allows natural flow between combo steps (1→2 only)
          isInCombo.current = true;
          comboTransitionProgress.current = 0;
        }
        
        // Call completion callback
        onSwingComplete?.();
        return;
      }
      
      if (effectiveComboStep === 1) {
        // 1st Hit: Original swing (top-right to bottom-left)
        const forwardPhase = swingPhase <= 0.25
          ? swingPhase * 2
          : (0.725 - (swingPhase - 0.115) * 1.1);
        
        const pivotX = basePosition[0] + Math.sin(forwardPhase * Math.PI) * 2;
        const pivotY = basePosition[1] + Math.sin(forwardPhase * Math.PI) * -2;
        const pivotZ = basePosition[2] + Math.cos(forwardPhase * Math.PI) * 1;
        
        swordRef.current.position.set(pivotX, pivotY, pivotZ);
        
        const rotationX = Math.sin(forwardPhase * Math.PI) * (-0.75) + 1.25;
        const rotationY = Math.sin(forwardPhase * Math.PI) * Math.PI/1.125;
        const rotationZ = Math.sin(forwardPhase * Math.PI) * (Math.PI / 3);
        
        swordRef.current.rotation.set(rotationX, rotationY, rotationZ);
      } else if (effectiveComboStep === 2) {
        // 2nd Hit: Mirrored swing (top-left to bottom-right)
        const forwardPhase = swingPhase <= 0.275
          ? swingPhase * 2
          : (0.625 - (swingPhase - 0.075) * 1.20);
        
        // Shift origin point further to the left for better left-side swing appearance
        const leftOffset = 2.5; // Additional left offset
        const pivotX = basePosition[0] + leftOffset - Math.sin(forwardPhase * Math.PI) * 2.5; // Mirrored X with left shift
        const pivotY = basePosition[1] + Math.sin(forwardPhase * Math.PI) * -0.2;
        const pivotZ = basePosition[2] + Math.cos(forwardPhase * Math.PI) * 1.1;
        
        swordRef.current.position.set(pivotX, pivotY, pivotZ);
        
        const rotationX = Math.sin(forwardPhase * Math.PI) * (-0.75) +1.5;
        const rotationY = -Math.sin(forwardPhase * Math.PI) * Math.PI; // Mirrored Y rotation
        const rotationZ = -Math.sin(forwardPhase * Math.PI) * (Math.PI/1.75); // Mirrored Z rotation
        
        swordRef.current.rotation.set(rotationX, rotationY, rotationZ);
      } else if (effectiveComboStep === 3) {
        // 3rd Hit: Smite-like animation (top to center down)
        let rotationX, rotationY, positionX, positionY, positionZ;
        
        // Store initial position when swing starts to create smooth transition
        if (swingProgress.current <= delta * 3) { // First frame of swing
          // Store current position as starting point for smooth transition
          const currentPos = swordRef.current.position;
          const currentRot = swordRef.current.rotation;
          
          // Use current position as base for this swing instead of basePosition
          swordRef.current.userData = {
            startPos: [currentPos.x, currentPos.y, currentPos.z],
            startRot: [currentRot.x, currentRot.y, currentRot.z]
          };
        }
        
        // Get stored starting position or fallback to base position
        const startPos = swordRef.current.userData?.startPos || basePosition;
        const startRot = swordRef.current.userData?.startRot || [0, 0, 0];
        
        if (swingPhase < 0.2) {
          // Quick wind-up phase: smoothly transition from current position to windup position
          const windupPhase = swingPhase * 5; // Multiply by 5 since we're using 0-0.2 range
          
          // Target windup position
          const targetWindupX = basePosition[0] + 1.5;
          const targetWindupY = basePosition[1] + 1.5;
          const targetWindupZ = basePosition[2] - 1.5;
          
          // Smoothly interpolate from start position to windup position
          positionX = startPos[0] + (targetWindupX - startPos[0]) * windupPhase;
          positionY = startPos[1] + (targetWindupY - startPos[1]) * windupPhase;
          positionZ = startPos[2] + (targetWindupZ - startPos[2]) * windupPhase;
          
          // Rotation interpolation
          const targetRotX = -Math.PI/3 - Math.PI/3;
          const targetRotY = Math.PI/4;
          rotationX = startRot[0] + (targetRotX - startRot[0]) * windupPhase;
          rotationY = startRot[1] + (targetRotY - startRot[1]) * windupPhase;
        } else {
          // Strike phase: powerful downward swing to ground
          const strikePhase = (swingPhase - 0.2) * 2; // Normalize from 0.2-1.0 range
          rotationX = -2*Math.PI/3 + (strikePhase * 3*Math.PI/2);
          rotationY = (Math.PI/4) * (1 - strikePhase);
        
          // Deep strike towards ground - much deeper Y movement
          positionX = basePosition[0] + (1.5 * (1 - strikePhase));
          positionY = basePosition[1] + (2 - strikePhase * 5); // Increased from 3.5 to 5.0 for full ground impact
          positionZ = basePosition[2] - (1.5 - strikePhase * 3.5); // Keep the forward reach
        }
        
        swordRef.current.position.set(positionX, positionY, positionZ);
        swordRef.current.rotation.set(rotationX, rotationY, 0);
      }
      

    } else if (!isSwinging && !isSmiting && !isOathstriking && !isCharging && !isDeflecting && !isInCombo.current) {
      // Only apply idle animation when not in combo transition and not immediately after 2nd swing
      // Check if we just completed 2nd swing and are about to start 3rd swing
      const justCompleted2ndSwing = lastComboStep.current === 2 && comboStep === 3;
      
      if (!justCompleted2ndSwing) {
        swordRef.current.rotation.x *= 0.85;
        swordRef.current.rotation.y *= 0.85;
        swordRef.current.rotation.z *= 0.85;
        
        swordRef.current.position.x += (basePosition[0] - swordRef.current.position.x) * 0.14;
        swordRef.current.position.y += (basePosition[1] - swordRef.current.position.y) * 0.14;
        swordRef.current.position.z += (basePosition[2] - swordRef.current.position.z) * 0.14;
      }
      // If we just completed 2nd swing, maintain current position for smooth 3rd swing start
    }

    // Handle electrical effects when Chain Lightning is unlocked
    if (hasChainLightning && swordRef.current) {
      // Spawn new sparks more frequently and along the blade
      if (Math.random() < 0.8) { // Increased spawn rate even more
        // Spawn multiple particles per frame
        for (let i = 0; i < 3; i++) { // Spawn 3 particles at once
          const randomLength = Math.random() * 2.2;
          const randomOffset = new Vector3(
            (Math.random() - 0.5) * 0.4,
            randomLength,
            (Math.random() - 0.5) * 0.4
          );
          
          sparkParticles.current.push({
            position: randomOffset,
            velocity: new Vector3(
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.2) * 4,
              (Math.random() - 0.5) * 4
            ).multiplyScalar(0.8),
            life: 1.0,
            scale: Math.random() * 0.02 + 0.005  // Much smaller scale range
          });
        }
      }

      // Update existing sparks with dynamic movement
      sparkParticles.current.forEach(spark => {
        spark.velocity.x += Math.sin(Date.now() * 0.01) * delta * 0.5;
        spark.velocity.z += Math.cos(Date.now() * 0.01) * delta * 0.5;
        spark.position.add(spark.velocity.clone().multiplyScalar(delta));
        spark.life -= delta * 1.5;
        spark.velocity.y += delta * 0.5;
      });

      // Limit total particles
      if (sparkParticles.current.length > 120) { // Increased maximum particles
        sparkParticles.current = sparkParticles.current.slice(-120);
      }

      // Remove dead sparks
      sparkParticles.current = sparkParticles.current.filter(spark => spark.life > 0);
    }
  });

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Dispose of all Three.js resources in the sword group
      if (swordRef.current) {
        disposeThreeJSResources(swordRef.current);
      }

      // Clear particle arrays to prevent memory leaks
      sparkParticles.current = [];
      chargeTrail.current = [];
      chargeHitEnemies.current.clear();
    };
  }, []);

  // Helper function to get ready positions for each combo step
  const getComboReadyPosition = (step: 1 | 2 | 3): {
    position: [number, number, number];
    rotation: [number, number, number];
  } => {
    switch (step) {
      case 1:
        // Ready position for first swing (slightly raised and to the right)
        return {
          position: [basePosition[0] + 0.3, basePosition[1] + 0.2, basePosition[2] + 0.1],
          rotation: [0.2, 0.3, 0.1]
        };
      case 2:
        // Ready position for second swing (slightly lowered and to the left for natural backswing)
        return {
          position: [basePosition[0] - 0.3, basePosition[1] - 0.1, basePosition[2] + 0.1],
          rotation: [0.2, -0.3, -0.1]
        };
      case 3:
        // Ready position for third swing (lowered for natural backswing, then raised for overhead)
        return {
          position: [basePosition[0], basePosition[1] - 0.15, basePosition[2] - 0.2],
          rotation: [-0.5, 0, 0]
        };
      default:
        return {
          position: [...basePosition],
          rotation: [0, 0, 0]
        };
    }
  };

  // Function to perform swing damage based on combo step
  const performSwingDamage = (comboStep: 1 | 2 | 3) => {
    if (!playerPosition || !enemyData.length) return;
    
    const now = Date.now();
    
    // Damage values for each combo step
    const damageValues = {
      1: 25, // 1st hit
      2: 30, // 2nd hit  
      3: 40  // 3rd hit
    };
    
    const baseDamage = damageValues[comboStep];
    
    // Attack range - increased for better hit detection
    const attackRange = 5; // Increased from 3.0
    
    let enemiesHitThisSwing = 0;
    let rageGainedThisSwing = 0;
    
    enemyData.forEach(enemy => {
      if (!enemy.health || enemy.health <= 0) return;
      
      // Prevent hitting the same enemy multiple times in one swing
      const lastHitTime = lastSwingHitTime.current[enemy.id] || 0;
      if (now - lastHitTime < 100) return; // 100ms cooldown per swing
      
      // Calculate distance from player
      const distance = playerPosition.distanceTo(enemy.position);
      
      
      if (distance <= attackRange) {
        // Simplified hit detection - use spherical range instead of cone
        // This ensures enemies close to the player will always be hit
        
        // For combo steps 1 and 2, use a wider frontal arc
        // For combo step 3 (overhead strike), hit all around
        let shouldHit = false;
        
        if (comboStep === 3) {
          // Overhead strike hits in all directions around player
          shouldHit = true;
        } else {
          // Side swings use a frontal hemisphere
          const toEnemy = enemy.position.clone().sub(playerPosition).normalize();
          // Check if enemy is roughly in front (very generous arc - 180 degrees)
          const dotProduct = toEnemy.dot(new Vector3(0, 0, -1));
          shouldHit = dotProduct > -0.5; // Allows hits from front and sides
        }
        
        if (shouldHit) {
          // Enemy is within attack range - deal damage
          lastSwingHitTime.current[enemy.id] = now;
          
          // Deal damage
          onHit?.(enemy.id, baseDamage);
          
          enemiesHitThisSwing++;
          
          // Add damage number
          if (setDamageNumbers && nextDamageNumberId) {
            setDamageNumbers(prev => [...prev, {
              id: nextDamageNumberId.current++,
              damage: baseDamage,
              position: enemy.position.clone(),
              isCritical: false, // Could add crit logic here later
              // Add combo-specific damage type flags if needed
            }]);
          }
        }
      }
    });
    
    // Gain rage only if we hit enemies (5 rage per enemy hit, up to 5 rage per swing)
    if (enemiesHitThisSwing > 0) {
      const gameUI = (window as any).gameUI;
      if (gameUI) {
        const rageBefore = gameUI.getCurrentRage ? gameUI.getCurrentRage() : 'unknown';
        const rageToGain = Math.min(enemiesHitThisSwing * 5, 5); // 5 rage per hit, max 5 per swing
        gameUI.gainRage(rageToGain);
        const rageAfter = gameUI.getCurrentRage ? gameUI.getCurrentRage() : 'unknown';
        rageGainedThisSwing = rageToGain;
      }
    }
  };


  // Memoized blade shapes to prevent recreation on every render
  const bladeShape = useMemo(() => {
    const shape = new Shape();

    // Start at center
    shape.moveTo(0, 0);

    // Left side guard (fixed symmetry)
    shape.lineTo(-0.25, 0.25);
    shape.lineTo(-0.15, -0.15);
    shape.lineTo(0, 0);

    // Right side guard (matches left exactly)
    shape.lineTo(0.175, 0.175);
    shape.lineTo(0.15, -0.15);
    shape.lineTo(0, 0);

    // Blade shape with symmetry
    shape.lineTo(0, 0.08);    // Reduced from 0.12
    shape.lineTo(0.2, 0.2);   // Reduced from 0.25
    shape.quadraticCurveTo(0.8, 0.15, 1.875, 0.18); // Reduced y values
    shape.quadraticCurveTo(2.0, 0.15, 2.375, 0);     // Reduced y value

    shape.quadraticCurveTo(2.0, -0.15, 1.825, -0.18); // Mirror of upper curve
    shape.quadraticCurveTo(0.8, -0.15, 0.15, -0.3);
    shape.lineTo(0, -0.08);   // Reduced from -0.12
    shape.lineTo(0, 0);

    return shape;
  }, []);

  const innerBladeShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);

    shape.lineTo(0, 0.06);
    shape.lineTo(0.15, 0.15);
    shape.quadraticCurveTo(1.2, 0.12, 1.75, 0.15);
    shape.quadraticCurveTo(2.0, 0.08, 2.15, 0);
    shape.quadraticCurveTo(2.0, -0.08, 1.75, -0.15);
    shape.quadraticCurveTo(1.2, -0.12, 0.15, -0.275);
    shape.lineTo(0, -0.05);
    shape.lineTo(0, 0);

    return shape;
  }, []);

  const bladeExtrudeSettings = useMemo(() => ({
    steps: 2,
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.02,
    bevelOffset: 0.04,
    bevelSegments: 2
  }), []);

  const innerBladeExtrudeSettings = useMemo(() => ({
    ...bladeExtrudeSettings,
    depth: 0.06,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelOffset: 0,
    bevelSegments: 6
  }), [bladeExtrudeSettings]);

  // Consolidated electrical effects
  const createElectricalEffects = () => {
    return (
      <group>
        {(
          <>
            {/* Electrical aura around blade */}
            <group position={[0.25, 0.55, 0.35]} rotation={[0, -Math.PI / 2, Math.PI / 2]} scale={[0.95, 1.10, 0.95]}>
              <mesh>
                <extrudeGeometry args={[bladeShape, { ...bladeExtrudeSettings, depth: 0.07 }]} />
                <meshStandardMaterial
                  color={new Color(0x87CEEB)}
                  emissive={new Color(0x4682B4)}
                  emissiveIntensity={1}
                  transparent
                  opacity={0.1}
                  blending={AdditiveBlending}
                />
              </mesh>
            </group>

            {/* Enhanced spark particles */}
            {sparkParticles.current.map((spark, index) => (
              <mesh 
                key={index} 
                position={spark.position.toArray()}
                scale={[spark.scale, spark.scale, spark.scale]}
              >
                <primitive object={sphereExtraLarge} />
                <meshStandardMaterial
                  color={new Color(0x87CEEB)}
                  emissive={new Color(0x4682B4)}
                  emissiveIntensity={3 * spark.life}
                  transparent
                  opacity={spark.life * 0.6}
                  blending={AdditiveBlending}
                />
              </mesh>
            ))}


          </>
        )}
      </group>
    );
  };

  return (
    <>
   <group rotation={[-0.65, 0, 0.2]} scale={[0.8, 0.9, 0.65]}>
      <group 
        ref={swordRef} 
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[0, 0, Math.PI/3]}
        scale={[0.75, 0.8, 0.65]}
      >
        {/* Handle */}
        <group position={[0.25, -0.55, 0.35]} rotation={[0, 0, -Math.PI]}>
          <mesh>
            <primitive object={getCachedGeometry('cylinder', 0.03, 0.04, 0.9, 12)} />
            <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
          </mesh>
          
          {/* Handle wrappings */}
          {[...Array(8)].map((_, i) => (
            <mesh key={i} position={[0, +0.35 - i * 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <primitive object={getCachedGeometry('torus', 0.045, 0.016, 8, 16)} />
              <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
        
        {/* CIRCLE CONNECTION POINT */}
        <group position={[0.25, 0.225, 0.35]} rotation={[Math.PI, 1.5, Math.PI]}>
          {/* Large torus */}
          <mesh>
            <primitive object={getCachedGeometry('torus', 0.26, 0.07, 16, 32)} />
            <meshStandardMaterial 
              color="#4a5b6c" 
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          
          {/* Decorative spikes around torus */}
          {[...Array(8)].map((_, i) => (
            <mesh 
              key={`spike-${i}`} 
              position={[
                0.25 * Math.cos(i * Math.PI / 4),
                0.25 * Math.sin(i * Math.PI / 4),
                0
              ]}
              rotation={[0, 0, i * Math.PI / 4 - Math.PI / 2]}
            >
            <primitive object={getCachedGeometry('cone', 0.070, 0.55, 3)} />
            <meshStandardMaterial
                color="#4a5b6c"
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          ))}
          
          {/* REAL Core orb -   yellow */}
          <mesh>
            <primitive object={getCachedGeometry('sphere', 0.155, 16, 16)} />
            <meshStandardMaterial
              color={new Color(0xB5B010)}         // Pure yellow
              emissive={new Color(0xB5B010)}      // Yellow emission
              emissiveIntensity={3}                    // Orange 
              transparent
              opacity={1}
            />
          </mesh>
          
          {/* Multiple glow layers for depth */}
          <mesh>
            <primitive object={getCachedGeometry('sphere', 0.1, 16, 16)} />
            <meshStandardMaterial
              color={new Color(0x1097B5)}
              emissive={new Color(0x1097B5)}
              emissiveIntensity={40}
              transparent
              opacity={0.8}
            />
          </mesh>

          
          
          <mesh>
            <primitive object={getCachedGeometry('sphere', 0.145, 16, 16)} />
            <meshStandardMaterial
              color={new Color(0x1097B5)}
              emissive={new Color(0x1097B5)}
              emissiveIntensity={35}
              transparent
              opacity={0.6}
            />
          </mesh>
          
          <mesh>
            <primitive object={getCachedGeometry('sphere', 0.175, 16, 16)} />
            <meshStandardMaterial
              color={new Color(0x1097B5)}
              emissive={new Color(0x1097B5)}
              emissiveIntensity={30}
              transparent
              opacity={0.4}
            />
          </mesh>

 
        </group>
        
        {/* Blade*/}
        <group position={[0.25, 0.5, 0.35]} rotation={[0, -Math.PI / 2, Math.PI / 2]}>
          {/* Base blade */}
          <mesh>
            <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
            <meshStandardMaterial 
              color={new Color(0x1097B5)}  
              emissive={new Color(0x1097B5)}
              emissiveIntensity={1.5}
              metalness={0.3}
              roughness={0.1}
            />
          </mesh>
          
          {/* BLADE Glowing core */}
          <mesh>
            <extrudeGeometry args={[innerBladeShape, innerBladeExtrudeSettings]} />
            <meshStandardMaterial 
              color={new Color(0x1097B5)}  
              emissive={new Color(0x1097B5)}
              emissiveIntensity={3}
              metalness={0.2}
              roughness={0.1}
              opacity={0.8}
              transparent
            />
          </mesh>

        </group>

        {createElectricalEffects()}

      </group>
      
      {/* Charge Trail Effects - Rendered outside sword group for proper world positioning */}
      {isCharging && chargeTrail.current.map(particle => (
        <mesh
          key={particle.id}
          position={[particle.position.x, particle.position.y, particle.position.z]}
          scale={[particle.life * 0.2, particle.life * 0.2, particle.life * 0.2]}
        >
          <primitive object={getCachedGeometry('sphere', 0.5, 6, 6)} />
          <meshStandardMaterial
            color={new Color(0xB5B010)}
            emissive={new Color(0xB5B010)}
            emissiveIntensity={particle.life * 3}
            transparent
            opacity={particle.life * 0.9}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}



    </group>
    
    {/* Deflect Shield - Rendered outside sword group to avoid inheriting transformations */}
    <DeflectShield
      isActive={isDeflecting}
      duration={3.0}
      onComplete={onDeflectComplete}
      playerPosition={playerPosition}
      playerRotation={playerRotation}
      dragonGroupRef={dragonGroupRef}
    />

  </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  return (
    prevProps.isSwinging === nextProps.isSwinging &&
    prevProps.isSmiting === nextProps.isSmiting &&
    prevProps.isColossusStriking === nextProps.isColossusStriking &&
    prevProps.isOathstriking === nextProps.isOathstriking &&
    prevProps.isCharging === nextProps.isCharging &&
    prevProps.isDeflecting === nextProps.isDeflecting &&
    prevProps.comboStep === nextProps.comboStep &&
    prevProps.currentSubclass === nextProps.currentSubclass &&
    prevProps.hasChainLightning === nextProps.hasChainLightning &&
    (prevProps.enemyData?.length ?? 0) === (nextProps.enemyData?.length ?? 0) &&
    (!prevProps.chargeDirectionProp || !nextProps.chargeDirectionProp ||
     prevProps.chargeDirectionProp.equals(nextProps.chargeDirectionProp)) &&
    (!prevProps.playerPosition || !nextProps.playerPosition ||
     prevProps.playerPosition.equals(nextProps.playerPosition))
  );
});


export default SwordComponent;
