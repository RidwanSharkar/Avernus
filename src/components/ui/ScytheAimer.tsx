import React, { memo, useEffect, useState, useRef } from 'react';

interface ScytheAimerProps {
  isVisible: boolean;
  isFiring?: boolean; // Trigger animation when projectile fires
  hasCryoflame?: boolean; // Changes color from red to blue
  verticalAim?: number; // -1 (looking up) to 1 (looking down)
  cameraDistance?: number; // 2 (zoomed in) to 12.5 (zoomed out)
}

/**
 * ScytheAimer - A crosshair that shows the scythe's Entropic bolt firing direction.
 * Like the bow, the scythe fires with a fixed downward compensation angle (Math.PI / 7 ≈ 26°),
 * and the crosshair moves vertically based on camera pitch and zoom level to show where bolts will land.
 * Unlike the bow, the scythe doesn't charge - it pulses and fades for 2 seconds after firing.
 */
const ScytheAimer = memo(function ScytheAimer({ 
  isVisible, 
  isFiring = false,
  hasCryoflame = false,
  verticalAim = 0,
  cameraDistance = 8
}: ScytheAimerProps) {
  const [animationProgress, setAnimationProgress] = useState(0); // 0 = no animation, 1 = full animation at start
  const [rotation, setRotation] = useState(0);
  const lastFiringState = useRef(false);
  const animationStartTime = useRef(0);

  // Detect when a shot is fired (transition from not firing to firing)
  useEffect(() => {
    if (isFiring && !lastFiringState.current) {
      // Shot just fired! Start the 2-second animation
      animationStartTime.current = Date.now();
      setAnimationProgress(1);
    }
    lastFiringState.current = isFiring;
  }, [isFiring]);

  // Animate the pulse and fade over 2 seconds
  useEffect(() => {
    if (animationProgress <= 0) return;

    const animationDuration = 2000; // 2 seconds
    let animationFrame: number;

    const animate = () => {
      const elapsed = Date.now() - animationStartTime.current;
      const progress = 1 - (elapsed / animationDuration); // 1 at start, 0 at end
      
      if (progress <= 0) {
        setAnimationProgress(0);
      } else {
        setAnimationProgress(progress);
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [animationProgress]);

  // Continuous rotation animation for the spell circles
  useEffect(() => {
    if (!isVisible) return;

    let rotationFrame: number;
    const rotationSpeed = 0.5; // degrees per frame

    const rotateCircles = () => {
      setRotation(prev => (prev + rotationSpeed) % 360);
      rotationFrame = requestAnimationFrame(rotateCircles);
    };

    rotationFrame = requestAnimationFrame(rotateCircles);
    return () => cancelAnimationFrame(rotationFrame);
  }, [isVisible]);

  if (!isVisible) return null;

  // Calculate animation intensity with pulsing effect
  const pulseFrequency = 2; // Pulses per second
  const pulsePhase = (Date.now() * 0.001 * pulseFrequency) % 1;
  const pulseIntensity = Math.sin(pulsePhase * Math.PI * 2) * 0.5 + 0.5; // 0 to 1
  
  // Combine animation progress with pulse for the glow effect
  const isAnimating = animationProgress > 0;
  const effectIntensity = isAnimating ? animationProgress * (0.7 + pulseIntensity * 0.3) : 0;

  // Color based on Cryoflame upgrade
  const baseColor = hasCryoflame ? '#00bfff' : '#ff4444'; // Deep Sky Blue or Red
  const glowColor = hasCryoflame ? '#4df7ff' : '#ff8888'; // Lighter variants for glow
  
  // Calculate opacity and glow based on animation state
  const baseOpacity = 0.75 + (effectIntensity * 0.25); // 0.75 at rest, up to 1.0 when animating
  const glowIntensity = 0.4 + (effectIntensity * 3.0); // 0.4 at rest, up to 3.4 when animating
  
  // Interpolate color from base to glow based on effect intensity
  const currentColor = isAnimating 
    ? (effectIntensity > 0.3 ? glowColor : baseColor)
    : baseColor;
  
  // Calculate zoom adjustment (same as BowAimer)
  // When zoomed in (distance = 2), we need to move the aimer UP (closer perspective)
  // When zoomed out (distance = 12.5), we need to move the aimer DOWN (farther perspective)
  const normalizedZoom = (cameraDistance - 8) / 10.5;
  const zoomAdjustment = normalizedZoom * 8; // Range: ~-6% UP (zoomed in) to +4% DOWN (zoomed out)
  
  // Calculate vertical offset based on camera pitch and zoom (same as BowAimer)
  // verticalAim: -1 (looking up) to 1 (looking down)
  const compensationOffset = -27.25; // Base offset - negative moves it up from center
  const aimRange = 16; // How much the aimer moves based on vertical aim (percentage)
  const verticalOffset = compensationOffset + (verticalAim * aimRange) + zoomAdjustment;
  
  return (
    <div 
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{
        zIndex: 9999,
        transform: `translateY(${verticalOffset}%)`,
        transition: 'transform 0.05s ease-out',
        background: 'transparent',
        overflow: 'visible'
      }}
    >
      {/* Main spell circle container */}
      <div 
        className="relative" 
        style={{ 
          width: '60px', 
          height: '60px', 
          overflow: 'visible',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          isolation: 'isolate'
        }}
      >
        {/* Outer expanding ring - pulses when animating */}
        {isAnimating && (
          <div 
            className="absolute rounded-full"
            style={{
              width: `${22 + effectIntensity * 20}px`,
              height: `${22 + effectIntensity * 20}px`,
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
              border: `1.5px solid ${currentColor}`,
              boxShadow: `0 0 ${effectIntensity * 25}px ${currentColor}`,
              opacity: effectIntensity * 0.6,
              transition: 'all 0.05s ease-out'
            }}
          />
        )}

        {/* Rotating outer spell circle with segments */}
        <svg 
          width="55" 
          height="55"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            opacity: 0.7 + (effectIntensity * 0.3),
            background: 'transparent',
            overflow: 'visible'
          }}
        >
          {/* Segmented outer circle */}
          <circle
            cx="27.5"
            cy="27.5"
            r="22.5"
            fill="none"
            stroke={currentColor}
            strokeWidth={1.5 + effectIntensity * 0.5}
            strokeDasharray="8 6"
            style={{
              filter: `drop-shadow(0 0 ${2 + effectIntensity * 4}px ${currentColor})`
            }}
          />
          {/* Four cardinal direction markers */}
          {[0, 90, 180, 270].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 27.5 + Math.cos(rad) * 18;
            const y1 = 27.5 + Math.sin(rad) * 18;
            const x2 = 27.5 + Math.cos(rad) * 22.5;
            const y2 = 27.5 + Math.sin(rad) * 22.5;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={currentColor}
                strokeWidth={2}
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 ${2 + effectIntensity * 3}px ${currentColor})`
                }}
              />
            );
          })}
        </svg>

        {/* Counter-rotating inner spell circle */}
        <svg 
          width="42" 
          height="42"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) rotate(${-rotation * 1.6}deg)`,
            opacity: 0.65 + (effectIntensity * 0.35),
            background: 'transparent',
            overflow: 'visible'
          }}
        >
          {/* Inner circle with arcane pattern */}
          <circle
            cx="21"
            cy="21"
            r="12.5"
            fill="none"
            stroke={currentColor}
            strokeWidth={1.2 + effectIntensity * 0.8}
            strokeDasharray="4 3"
            style={{
              filter: `drop-shadow(0 0 ${3 + effectIntensity * 5}px ${currentColor})`
            }}
          />
          {/* Six small arcane runes/dots around inner circle */}
          {[0, 60, 120, 180, 240, 300].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = 21 + Math.cos(rad) * 12.5;
            const y = 21 + Math.sin(rad) * 12.5;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={1.5}
                fill={currentColor}
                style={{
                  filter: `drop-shadow(0 0 ${2 + effectIntensity * 4}px ${currentColor})`
                }}
              />
            );
          })}
        </svg>
        
        {/* Center spell focus - pulsing orb */}
        <div 
          className="absolute rounded-full"
          style={{
            width: `${6 + effectIntensity * 4}px`,
            height: `${6 + effectIntensity * 4}px`,
            backgroundColor: currentColor,
            boxShadow: `0 0 ${8 + glowIntensity * 15}px ${currentColor}, 0 0 ${4 + glowIntensity * 8}px ${currentColor}, inset 0 0 ${2 + effectIntensity * 4}px #ffffff`,
            opacity: baseOpacity,
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            transition: 'all 0.05s ease-out'
          }}
        />

        
      </div>
    </div>
  );
});

export default ScytheAimer;


