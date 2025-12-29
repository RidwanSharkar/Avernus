import React, { memo } from 'react';

interface BowAimerProps {
  isVisible: boolean;
  isCharging?: boolean;
  chargeProgress?: number;
  verticalAim?: number; // -1 (looking up) to 1 (looking down)
  cameraDistance?: number; // 2 (zoomed in) to 12.5 (zoomed out)
}

/**
 * BowAimer - A crosshair that shows the bow's firing direction.
 * The bow fires with a fixed downward compensation angle (Math.PI / 7 ≈ 26°),
 * and the crosshair moves vertically based on camera pitch and zoom level to show where arrows will land.
 */
const BowAimer = memo(function BowAimer({ 
  isVisible, 
  isCharging = false,
  chargeProgress = 0,
  verticalAim = 0,
  cameraDistance = 8
}: BowAimerProps) {
  if (!isVisible) return null;

  // Perfect shot timing constants (same as EtherBow)
  const perfectShotMinThreshold = 0.8; // 80% charge
  const perfectShotMaxThreshold = 0.98; // 98% charge
  const isPerfectShotWindow = isCharging && chargeProgress >= perfectShotMinThreshold && chargeProgress <= perfectShotMaxThreshold;

  // Calculate opacity based on charging state - more visible now
  const baseOpacity = isPerfectShotWindow ? 1.0 : (isCharging ? 1.0 : 0.75);
  const glowIntensity = isPerfectShotWindow 
    ? 2.0 + Math.sin(Date.now() * 0.02) * 1.0 // Pulsing effect during perfect shot window
    : (isCharging ? chargeProgress * 1.2 : 0.3);
  
  // Color changes from cyan to gold as charge increases, or flashes white during perfect shot
  const chargeColor = isPerfectShotWindow
    ? '#ffffff' // Flash white during perfect shot window
    : (isCharging 
      ? `rgb(${Math.floor(0 + chargeProgress * 255)}, ${Math.floor(255 - chargeProgress * 55)}, ${Math.floor(255 - chargeProgress * 255)})`
      : '#00ffff');
  
  // Calculate zoom adjustment
  // When zoomed in (distance = 2), we need to move the aimer UP (closer perspective)
  // When zoomed out (distance = 12.5), we need to move the aimer DOWN (farther perspective)
  // Normalize: (distance - 8) / (12.5 - 2) gives us a normalized zoom value
  const normalizedZoom = (cameraDistance - 8) / 10.0;
  const zoomAdjustment = normalizedZoom * 8; // Range: ~-6% UP (zoomed in) to +4% DOWN (zoomed out)
  
  // Calculate vertical offset based on camera pitch and zoom
  // verticalAim: -1 (looking up) to 1 (looking down)
  // We combine: base offset + pitch-based movement + zoom adjustment
  const compensationOffset = -28.5; // Base offset - negative moves it up from center
  const aimRange = 20; // How much the aimer moves based on vertical aim (percentage)
  const verticalOffset = compensationOffset + (verticalAim * aimRange) + zoomAdjustment;
  
  return (
    <div 
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{
        // Higher z-index to ensure visibility above game elements
        zIndex: 9999,
        // Position based on vertical camera aim + compensation angle
        transform: `translateY(${verticalOffset}%)`,
        transition: 'transform 0.05s ease-out',
        background: 'transparent',
        overflow: 'visible'
      }}
    >
      {/* Main crosshair container - scaled down by 20% */}
      <div 
        className="relative" 
        style={{ 
          width: '48px', 
          height: '48px', 
          overflow: 'visible',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          isolation: 'isolate'
        }}
      >
        {/* Outer glow ring - appears when charging */}
        {isCharging && (
          <div 
            className="absolute rounded-full"
            style={{
              width: `${26 + chargeProgress * 16}px`,
              height: `${26 + chargeProgress * 16}px`,
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
              border: `2px solid ${chargeColor}`,
              boxShadow: `0 0 ${10 + chargeProgress * 20}px ${chargeColor}, inset 0 0 ${5 + chargeProgress * 10}px ${chargeColor}40`,
              opacity: 0.7 + chargeProgress * 0.3,
              transition: 'all 0.1s ease-out'
            }}
          />
        )}
        
        {/* Center dot - larger and more visible */}
        <div 
          className="absolute rounded-full"
          style={{
            width: isCharging ? `${5 + chargeProgress * 3}px` : '4px',
            height: isCharging ? `${5 + chargeProgress * 3}px` : '4px',
            backgroundColor: chargeColor,
            boxShadow: `0 0 ${6 + glowIntensity * 10}px ${chargeColor}, 0 0 ${3 + glowIntensity * 5}px ${chargeColor}`,
            opacity: baseOpacity,
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            transition: 'all 0.1s ease-out'
          }}
        />
        
        {/* Horizontal lines - larger gap and size */}
        <div 
          className="absolute"
          style={{
            width: isCharging ? `${10 + chargeProgress * 6}px` : '8px',
            height: '1.6px',
            backgroundColor: chargeColor,
            boxShadow: `0 0 ${5 + glowIntensity * 8}px ${chargeColor}`,
            opacity: baseOpacity,
            left: isCharging ? `${13 + chargeProgress * 5}px` : '11px',
            top: '50%',
            transform: 'translateY(-50%)',
            transition: 'all 0.1s ease-out'
          }}
        />
        <div 
          className="absolute"
          style={{
            width: isCharging ? `${10 + chargeProgress * 6}px` : '8px',
            height: '1.6px',
            backgroundColor: chargeColor,
            boxShadow: `0 0 ${5 + glowIntensity * 8}px ${chargeColor}`,
            opacity: baseOpacity,
            right: isCharging ? `${13 + chargeProgress * 5}px` : '11px',
            top: '50%',
            transform: 'translateY(-50%)',
            transition: 'all 0.1s ease-out'
          }}
        />
        
        {/* Vertical lines - larger gap and size */}
        <div 
          className="absolute"
          style={{
            width: '1.6px',
            height: isCharging ? `${10 + chargeProgress * 6}px` : '8px',
            backgroundColor: chargeColor,
            boxShadow: `0 0 ${5 + glowIntensity * 8}px ${chargeColor}`,
            opacity: baseOpacity,
            top: isCharging ? `${13 + chargeProgress * 5}px` : '11px',
            left: '50%',
            transform: 'translateX(-50%)',
            transition: 'all 0.1s ease-out'
          }}
        />
        <div 
          className="absolute"
          style={{
            width: '1.6px',
            height: isCharging ? `${10 + chargeProgress * 6}px` : '8px',
            backgroundColor: chargeColor,
            boxShadow: `0 0 ${5 + glowIntensity * 8}px ${chargeColor}`,
            opacity: baseOpacity,
            bottom: isCharging ? `${13 + chargeProgress * 5}px` : '11px',
            left: '50%',
            transform: 'translateX(-50%)',
            transition: 'all 0.1s ease-out'
          }}
        />
        
        {/* Downward trajectory indicator - chevron below crosshair */}
        <div 
          className="absolute"
          style={{
            left: '50%',
            top: isCharging ? `${30 + chargeProgress * 8}px` : '27px',
            transform: 'translateX(-50%)',
            opacity: baseOpacity * 0.8,
            transition: 'all 0.1s ease-out'
          }}
        >
          <svg 
            width="11" 
            height="8" 
            viewBox="0 0 14 10"
            style={{
              filter: `drop-shadow(0 0 ${3 + glowIntensity * 5}px ${chargeColor})`,
              background: 'transparent',
              overflow: 'visible'
            }}
          >
            <path 
              d="M1 1L7 7L13 1" 
              stroke={chargeColor}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        
        {/* Charge progress arc - only visible when charging */}
        {isCharging && chargeProgress > 0.05 && (
          <svg 
            width="45" 
            height="45"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              opacity: 0.9,
              background: 'transparent',
              overflow: 'visible',
              border: 'none'
            }}
          >
            <circle
              cx="22.5"
              cy="22.5"
              r="19"
              fill="none"
              stroke={chargeColor}
              strokeWidth="2.4"
              strokeDasharray={`${chargeProgress * 119} 119`}
              style={{
                filter: `drop-shadow(0 0 5px ${chargeColor})`,
                transition: 'stroke-dasharray 0.05s ease-out'
              }}
            />
          </svg>
        )}
      </div>
    </div>
  );
});

export default BowAimer;

