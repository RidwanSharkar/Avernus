'use client';

import React, { useState } from 'react';

interface TowerSideIndicatorProps {
  side: 'Red' | 'Blue' | null;
  towerHealth: number;
  towerMaxHealth: number;
  towerPosition: { x: number; y: number; z: number } | null;
  playerPosition: { x: number; y: number; z: number } | null;
}

export function TowerSideIndicator({ side, towerHealth, towerMaxHealth, towerPosition, playerPosition }: TowerSideIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!side || !towerPosition || !playerPosition) return null;

  const healthPercentage = (towerHealth / towerMaxHealth) * 100;
  const isLowHealth = healthPercentage < 30;
  const isMediumHealth = healthPercentage < 60 && healthPercentage >= 30;

  // Calculate angle from player to tower (in 2D top-down view)
  const dx = towerPosition.x - playerPosition.x;
  const dz = towerPosition.z - playerPosition.z;
  const angleRadians = Math.atan2(dx, dz);
  const angleDegrees = (angleRadians * 180 / Math.PI);

  // Calculate distance to tower
  const distance = Math.sqrt(dx * dx + dz * dz);

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div 
        className="relative rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-300 hover:scale-105"
        style={{
          background: 'linear-gradient(180deg, rgba(15,15,25,0.65) 0%, rgba(10,10,20,0.90) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.05),
            0 4px 30px rgba(0,0,0,0.5),
            0 0 60px ${
              isLowHealth 
                ? 'rgba(239,68,68,0.2)' 
                : isMediumHealth 
                ? 'rgba(234,179,8,0.2)' 
                : 'rgba(99,102,241,0.1)'
            },
            inset 0 1px 0 rgba(255,255,255,0.05)
          `,
          border: '1px solid rgba(255,255,255,0.08)'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Decorative corner accents */}
        <div 
          className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg pointer-events-none"
          style={{
            borderColor: isLowHealth 
              ? 'rgba(239,68,68,0.3)' 
              : isMediumHealth 
              ? 'rgba(234,179,8,0.3)' 
              : 'rgba(99,102,241,0.3)'
          }}
        />
        <div 
          className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg pointer-events-none"
          style={{
            borderColor: isLowHealth 
              ? 'rgba(239,68,68,0.3)' 
              : isMediumHealth 
              ? 'rgba(234,179,8,0.3)' 
              : 'rgba(99,102,241,0.3)'
          }}
        />
        <div 
          className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg pointer-events-none"
          style={{
            borderColor: isLowHealth 
              ? 'rgba(239,68,68,0.3)' 
              : isMediumHealth 
              ? 'rgba(234,179,8,0.3)' 
              : 'rgba(99,102,241,0.3)'
          }}
        />
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg pointer-events-none"
          style={{
            borderColor: isLowHealth 
              ? 'rgba(239,68,68,0.3)' 
              : isMediumHealth 
              ? 'rgba(234,179,8,0.3)' 
              : 'rgba(99,102,241,0.3)'
          }}
        />
        <div 
          className={`px-3 py-2 transition-all duration-300 ${isExpanded ? 'pb-2' : ''}`}
          style={{
            borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.08)' : 'none'
          }}
        >
          <div className="flex items-center gap-1">
            {/* Tower Info */}
            <div className="flex flex-col">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Your Team</div>
              <div 
                className="text-lg font-bold tracking-wide"
                style={{
                  background: side === 'Red' 
                    ? 'linear-gradient(90deg, #f87171 0%, #ef4444 100%)'
                    : 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}
              >
                {side === 'Red' ? 'Red' : 'Blue'}
              </div>
              <div className="text-[10px] text-gray-500">
                {distance.toFixed(0)}m away
              </div>
            </div>

            {/* Compact Health Indicator */}
            <div className="flex flex-col items-end">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">HP</div>
              <div 
                className="text-lg font-bold"
                style={{
                  color: isLowHealth ? '#f87171' : isMediumHealth ? '#facc15' : '#4ade80',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}
              >
                {Math.ceil(healthPercentage)}%
              </div>
            </div>
          </div>

          {/* Expanded Health Bar */}
          {isExpanded && (
            <div 
              className="px-4 py-3 space-y-2"
              style={{
                animation: 'slideDown 0.3s ease-out'
              }}
            >
              <div className="flex flex-col gap-1.0 min-w-[130px]">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Tower Health</div>
                <div 
                  className="relative h-6 rounded-lg overflow-hidden"
                  style={{
                    background: 'linear-gradient(90deg, rgba(30,30,45,0.4) 0%, rgba(20,20,35,0.3) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  {/* Health bar fill */}
                  <div
                    className="absolute inset-0 transition-all duration-300"
                    style={{
                      width: `${healthPercentage}%`,
                      background: isLowHealth
                        ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'
                        : isMediumHealth
                        ? 'linear-gradient(90deg, #ca8a04 0%, #eab308 100%)'
                        : 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)'
                    }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                  
                  {/* Health text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span 
                      className="text-sm font-semibold"
                      style={{
                        color: '#e5e7eb',
                        textShadow: '0 1px 2px rgba(0,0,0,0.9)'
                      }}
                    >
                      {Math.ceil(towerHealth).toLocaleString()} / {towerMaxHealth.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Warning indicator for low health */}
        {isLowHealth && (
          <div 
            className="px-4 pb-3"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <div className="text-center animate-pulse">
              <span 
                className="text-xs font-bold uppercase tracking-wider"
                style={{
                  color: '#f87171',
                  textShadow: '0 0 10px rgba(239,68,68,0.5)'
                }}
              >
                ⚠️ UNDER ATTACK ⚠️
              </span>
            </div>
          </div>
        )}

        {/* Bottom glow effect when expanded */}
        {isExpanded && (
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-[2px] rounded-full pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent, ${
                isLowHealth 
                  ? 'rgba(239,68,68,0.4)' 
                  : isMediumHealth 
                  ? 'rgba(234,179,8,0.4)' 
                  : 'rgba(99,102,241,0.4)'
              }, transparent)`,
              animation: 'fadeIn 0.3s ease-out'
            }}
          />
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

