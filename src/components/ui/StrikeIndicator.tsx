import React, { memo, useEffect, useState, useRef } from 'react';

interface StrikeIndicatorProps {
  isVisible: boolean;
  isBowEquipped?: boolean;
  isScytheEquipped?: boolean;
  verticalAim?: number; // -1 (looking up) to 1 (looking down)
  cameraDistance?: number; // 2 (zoomed in) to 12.5 (zoomed out)
}

/**
 * StrikeIndicator - A visual indicator that appears over the aimer when landing a damaging strike.
 * Shows a brief flash synchronized with the hit box sound to provide immediate visual feedback.
 */
const StrikeIndicator = memo(function StrikeIndicator({
  isVisible,
  isBowEquipped = false,
  isScytheEquipped = false,
  verticalAim = 0,
  cameraDistance = 8
}: StrikeIndicatorProps) {
  const [isShowingStrike, setIsShowingStrike] = useState(false);
  const strikeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for strike events from the global audio system
  useEffect(() => {
    const handleStrikeEvent = () => {
      // Only trigger if a weapon is currently equipped
      if (isBowEquipped || isScytheEquipped) {
        // Clear any existing timeout
        if (strikeTimeoutRef.current) {
          clearTimeout(strikeTimeoutRef.current);
        }

        setIsShowingStrike(true);

        // Hide after 400ms
        strikeTimeoutRef.current = setTimeout(() => {
          setIsShowingStrike(false);
          strikeTimeoutRef.current = null;
        }, 400);
      }
    };

    // Listen for the custom strike event that will be dispatched by CombatSystem
    window.addEventListener('strikeIndicator', handleStrikeEvent);

    return () => {
      window.removeEventListener('strikeIndicator', handleStrikeEvent);
      if (strikeTimeoutRef.current) {
        clearTimeout(strikeTimeoutRef.current);
      }
    };
  }, [isBowEquipped, isScytheEquipped]);

  if (!isVisible || !isShowingStrike) {
    return null;
  }

  // Calculate zoom adjustment (same as BowAimer/ScytheAimer)
  const normalizedZoom = (cameraDistance - 8) / 10.5;
  const zoomAdjustment = normalizedZoom * 8;

  // Calculate vertical offset based on camera pitch and zoom
  const compensationOffset = isBowEquipped ? -28.5 : -26.5; // Base offset - negative moves it up from center
  const aimRange = isBowEquipped ? 20 : 16; // How much the aimer moves based on vertical aim (percentage)
  const verticalOffset = compensationOffset + (verticalAim * aimRange) + zoomAdjustment;

  // Fixed scale and opacity for the brief flash
  const scale = 1.0;
  const opacity = 1.0;

  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{
        zIndex: 9998, // Slightly below aimers (9999) so it appears behind them
        transform: `translateY(${verticalOffset}%) scale(${scale})`,
        transition: 'transform 0.05s ease-out',
        background: 'transparent',
        overflow: 'visible'
      }}
    >
      {/* Strike indicator - a bright flash with impact symbols */}
      <div
        className="relative"
        style={{
          width: isBowEquipped ? '56px' : '70px', // Slightly larger than aimers
          height: isBowEquipped ? '56px' : '70px',
          overflow: 'visible',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          isolation: 'isolate'
        }}
      >
        {/* Outer flash ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: '100%',
            height: '100%',
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            border: `3px solid ${isScytheEquipped ? '#00bfff' : '#ff4444'}`,
            boxShadow: `0 0 30px ${isScytheEquipped ? '#00bfff' : '#ff4444'}`,
            opacity: opacity * 0.8,
            transition: 'all 0.05s ease-out'
          }}
        />

        {/* Inner impact symbol */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: '100%',
            height: '100%',
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            opacity: opacity,
            transition: 'all 0.05s ease-out'
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            style={{
              filter: `drop-shadow(0 0 8px ${isScytheEquipped ? '#00bfff' : '#ff4444'})`,
              background: 'transparent',
              overflow: 'visible'
            }}
          >
            {/* Impact starburst symbol */}
            <path
              d="M12 2L13.09 8.26L19.35 7.17L15.17 12L19.35 16.83L13.09 15.74L12 22L10.91 15.74L4.65 16.83L8.83 12L4.65 7.17L10.91 8.26L12 2Z"
              fill={isScytheEquipped ? '#00bfff' : '#ff4444'}
              stroke="none"
            />
          </svg>
        </div>

        {/* Additional flash particles */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const distance = 30;
          const x = Math.cos(rad) * distance;
          const y = Math.sin(rad) * distance;

          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: '5px',
                height: '5px',
                backgroundColor: isScytheEquipped ? '#00bfff' : '#ff4444',
                boxShadow: `0 0 4px ${isScytheEquipped ? '#00bfff' : '#ff4444'}`,
                opacity: opacity * 0.6,
                transform: `translate(${x - 50}%, ${y - 50}%)`,
                left: '50%',
                top: '50%',
                transition: 'all 0.05s ease-out'
              }}
            />
          );
        })}
      </div>
    </div>
  );
});

export default StrikeIndicator;
