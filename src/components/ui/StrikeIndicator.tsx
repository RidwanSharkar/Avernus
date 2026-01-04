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
      {/* Strike indicator - dotted X symbol */}
      <div
        className="relative"
        style={{
          width: isBowEquipped ? '48px' : '60px', // Reduced size, matches aimer containers
          height: isBowEquipped ? '48px' : '60px',
          overflow: 'visible',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          isolation: 'isolate'
        }}
      >
        {/* Dotted X symbol - diagonal lines made of dots */}
        <svg
          width={isBowEquipped ? '48' : '60'}
          height={isBowEquipped ? '48' : '60'}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: opacity,
            background: 'transparent',
            overflow: 'visible'
          }}
        >
          {/* Top-left to bottom-right diagonal dots */}
          {[1, 2, 3, 4].map((i) => {
            const size = isBowEquipped ? 48 : 60;
            const spacing = size / 6;
            const x = (i + 0.5) * spacing;
            const y = (i + 0.5) * spacing;

            return (
              <circle
                key={`diag1-${i}`}
                cx={x}
                cy={y}
                r="2"
                fill="#cccccc"
                style={{
                  filter: 'drop-shadow(0 0 4px #cccccc)'
                }}
              />
            );
          })}

          {/* Top-right to bottom-left diagonal dots */}
          {[1, 2, 3, 4,].map((i) => {
            const size = isBowEquipped ? 48 : 60;
            const spacing = size / 6;
            const x = size - (i + 0.5) * spacing;
            const y = (i + 0.5) * spacing;

            return (
              <circle
                key={`diag2-${i}`}
                cx={x}
                cy={y}
                r="2"
                fill="#cccccc"
                style={{
                  filter: 'drop-shadow(0 0 4px #cccccc)'
                }}
              />
            );
          })}
        </svg>

        {/* Center impact dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: '6px',
            height: '6px',
            backgroundColor: '#cccccc',
            boxShadow: '0 0 8px #cccccc',
            opacity: opacity * 0.9,
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

export default StrikeIndicator;
