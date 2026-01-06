// Floating damage numbers component to display damage dealt to enemies
'use client';

import React, { useEffect, useState, memo, useRef } from 'react';
import { Vector3, Camera } from '@/utils/three-exports';

export interface DamageNumberData {
  id: string;
  damage: number;
  isCritical: boolean;
  position: Vector3;
  timestamp: number;
  damageType?: string; // Added to distinguish damage types
  isIncomingDamage?: boolean; // Whether this damage was received by the local player
}

interface DamageNumberProps {
  damageData: DamageNumberData;
  onComplete: (id: string) => void;
  camera: Camera | null;
  size: { width: number; height: number };
}

// Simplified interface - each damage number is independent
interface DamageNumberPropsExtended extends DamageNumberProps {
  // Removed stackIndex and horizontalOffset for independent animations
}

const DamageNumber = memo(function DamageNumber({ damageData, onComplete, camera, size }: DamageNumberPropsExtended) {
  const [opacity, setOpacity] = useState(1);
  const [yOffset, setYOffset] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const isIncoming = damageData.isIncomingDamage;
    const duration = isIncoming ? 900 : 3000; // Longer duration for better visibility
    const startTime = Date.now();
    let animationId: number | null = null;
    let isCancelled = false;

    const animate = () => {
      if (isCancelled) return;

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Simple ease out animation
      const easeOut = 1 - Math.pow(1 - progress, 3);

      if (isIncoming) {
        // For incoming damage, float downward from under the character
        const baseFloatDistance = -2; // Float downward
        setYOffset(easeOut * baseFloatDistance);

        // Simple scale animation - start slightly big, settle smaller
        const initialScale = 1.1;
        const finalScale = 0.7;
        const scaleProgress = Math.min(progress * 4, 1);
        setScale(initialScale + (finalScale - initialScale) * scaleProgress);

        // Keep fully visible for 2.67 seconds, then fade out over the remaining 1.33 seconds
        if (progress > 0.667) { // 2.67 seconds out of 4 seconds
          const fadeProgress = (progress - 0.667) / 0.333; // Fade over last 1/3
          setOpacity(1 - fadeProgress);
        } else {
          setOpacity(1);
        }
      } else {
        // Outgoing damage animation - simple float up and fade
        const baseFloatDistance = 4; // Float upward
        setYOffset(easeOut * baseFloatDistance);

        // Simple scale animation - start big, settle smaller
        const initialScale = 1.2;
        const finalScale = 0.8;
        const scaleProgress = Math.min(progress * 3, 1);
        setScale(initialScale + (finalScale - initialScale) * scaleProgress);

        // Keep fully visible for 3.6 seconds, then fade out over the remaining 2.4 seconds
        if (progress > 0.6) { // 3.6 seconds out of 6 seconds
          const fadeProgress = (progress - 0.6) / 0.4; // Fade over last 2.4 seconds
          setOpacity(1 - fadeProgress);
        } else {
          setOpacity(1);
        }
      }

      if (progress < 1 && !isCancelled) {
        animationId = requestAnimationFrame(animate);
      } else if (!isCancelled) {
        onComplete(damageData.id);
      }
    };

    animationId = requestAnimationFrame(animate);

    // Cleanup function to cancel animation and prevent state updates
    return () => {
      isCancelled = true;
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [damageData.id, onComplete, damageData.isIncomingDamage]);

  // Proper 3D to 2D projection using the camera
  let x = 0;
  let y = 0;
  
  if (camera && size.width > 0 && size.height > 0 && damageData.position && damageData.position.clone) {
    // Create a world position with the floating animation offset
    const worldPosition = damageData.position.clone();
    worldPosition.y += yOffset; // Apply the floating animation offset
    
    // Project the 3D world position to normalized device coordinates
    const screenPosition = worldPosition.clone().project(camera);
    
    // Convert normalized device coordinates (-1 to 1) to screen coordinates
    x = (screenPosition.x * 0.5 + 0.5) * size.width;
    y = (screenPosition.y * -0.5 + 0.5) * size.height;
    

  } else {
    // Fallback to simple projection if camera not available
    const projectionScale = 50;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    x = centerX + (damageData.position.x * projectionScale);
    y = centerY - (damageData.position.z * projectionScale) - (yOffset * 20);
  }

  return (
    <div
      className="absolute pointer-events-none select-none font-bold text-lg"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
        zIndex: 1000, // Fixed z-index since no stacking
      }}
    >
      <span
        className={`${
          damageData.isIncomingDamage
            ? // Incoming damage: red for all damage
              'text-red-400 text-lg font-bold'
            : // Outgoing damage: original logic
              damageData.isCritical
                ? 'text-yellow-300 text-xl animate-pulse'
                : damageData.damageType === 'crossentropy'
                ? 'text-orange-400'
                : damageData.damageType === 'healing' ||
                  damageData.damageType === 'reanimate_healing' ||
                  damageData.damageType === 'smite_healing' ||
                  damageData.damageType === 'viper_sting_healing' ||
                  damageData.damageType === 'summon_totem_healing'
                ? 'text-green-400 text-lg font-extrabold'
                : damageData.damageType === 'colossus_strike'
                ? 'text-yellow-400 text-lg'
                : damageData.damageType === 'barrage'
                ? 'text-blue-400 text-lg'
                : damageData.damageType === 'cobra_shot'
                ? 'text-green-400 text-lg'
                : damageData.damageType === 'viper_sting'
                ? 'text-purple-300 text-lg'
                : damageData.damageType === 'cloudkill'
                ? 'text-teal-400 text-lg'
                : damageData.damageType === 'frost_nova'
                ? 'text-blue-300 text-lg'
                : damageData.damageType === 'entropic_cryoflame'
                ? 'text-cyan-400 text-lg'
                : 'text-red-400'
        }`}
      >
        {damageData.isIncomingDamage && '-'}
        {(damageData.damageType === 'healing' ||
          damageData.damageType === 'reanimate_healing' ||
          damageData.damageType === 'smite_healing' ||
          damageData.damageType === 'viper_sting_healing' ||
          damageData.damageType === 'summon_totem_healing') && '+'}
        {damageData.damageType === 'healing' ||
         damageData.damageType === 'reanimate_healing' ||
         damageData.damageType === 'smite_healing' ||
         damageData.damageType === 'viper_sting_healing' ||
         damageData.damageType === 'summon_totem_healing'
           ? Math.round(damageData.damage)
           : damageData.damage}
        {damageData.isCritical && '!'}
      </span>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  return (
    prevProps.damageData.id === nextProps.damageData.id &&
    prevProps.damageData.damage === nextProps.damageData.damage &&
    prevProps.damageData.isCritical === nextProps.damageData.isCritical &&
    prevProps.damageData.damageType === nextProps.damageData.damageType &&
    prevProps.damageData.isIncomingDamage === nextProps.damageData.isIncomingDamage &&
    prevProps.damageData.timestamp === nextProps.damageData.timestamp &&
    prevProps.damageData.position.equals(nextProps.damageData.position) &&
    prevProps.camera === nextProps.camera &&
    prevProps.size.width === nextProps.size.width &&
    prevProps.size.height === nextProps.size.height
  );
});

interface DamageNumbersProps {
  damageNumbers: DamageNumberData[];
  onDamageNumberComplete: (id: string) => void;
  camera: Camera | null;
  size: { width: number; height: number };
}

function DamageNumbers({ damageNumbers, onDamageNumberComplete, camera, size }: DamageNumbersProps) {
  // Simply render each damage number independently - no grouping or stacking
  return (
    <div className="fixed inset-0 pointer-events-none">
      {damageNumbers.map((damageData) => (
        <DamageNumber
          key={damageData.id}
          damageData={damageData}
          onComplete={onDamageNumberComplete}
          camera={camera}
          size={size}
        />
      ))}
    </div>
  );
}

export default DamageNumbers;
