'use client';

import React from 'react';

interface ExperienceBarProps {
  experience: number;
  level: number;
  playerId?: string;
  isLocalPlayer?: boolean;
}

export default function ExperienceBar({ experience, level, playerId, isLocalPlayer = false }: ExperienceBarProps) {
  // Calculate EXP needed for next level
  const getExpForNextLevel = (currentLevel: number): number => {
    switch (currentLevel) {
      case 1: return 50;  // 50 EXP to reach level 2
      case 2: return 100; // 100 EXP to reach level 3
      case 3: return 200; // 200 EXP to reach level 4
      case 4: return 400; // 400 EXP to reach level 5
      case 5: return 0;   // Max level
      default: return 0;
    }
  };

  // Calculate current level progress
  const getLevelProgress = (currentLevel: number, currentExp: number): number => {
    if (currentLevel >= 5) return 100; // Max level

    const expForPrevLevels = currentLevel === 1 ? 0 :
      currentLevel === 2 ? 50 :
      currentLevel === 3 ? 150 :
      currentLevel === 4 ? 350 : 0;

    const expForCurrentLevel = getExpForNextLevel(currentLevel);
    const currentLevelExp = currentExp - expForPrevLevels;

    return Math.min((currentLevelExp / expForCurrentLevel) * 100, 100);
  };

  // Calculate total EXP needed to reach current level
  const getTotalExpForLevel = (targetLevel: number): number => {
    switch (targetLevel) {
      case 1: return 0;
      case 2: return 50;
      case 3: return 150;
      case 4: return 350;
      case 5: return 750;
      default: return 0;
    }
  };

  // Get current level's EXP range for display
  const getCurrentLevelExpRange = (currentLevel: number) => {
    const minExp = getTotalExpForLevel(currentLevel);
    const maxExp = getTotalExpForLevel(currentLevel + 1);
    return { min: minExp, max: maxExp };
  };

  const progress = getLevelProgress(level, experience);
  const { min, max } = getCurrentLevelExpRange(level);
  const currentLevelExp = experience - min;
  const maxLevelExp = max - min;
  const isMaxLevel = level >= 5;

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes levelGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(250,204,21,0.3); }
          50% { box-shadow: 0 0 25px rgba(250,204,21,0.5); }
        }
      `}</style>

      <div 
        className="fixed top-3 left-1/2 z-40"
        style={{
          transform: 'translateX(-50%) scale(0.825)',
          transformOrigin: 'center top'
        }}
      >
        <div 
          className="relative px-2.5 py-2 rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,25,0.65) 0%, rgba(10,10,20,0.90) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.05),
              0 4px 30px rgba(0,0,0,0.5),
              0 0 60px rgba(99,102,241,0.1),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          {/* Decorative corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-500/30 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-500/30 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-500/30 rounded-br-lg" />

          <div className="flex items-center gap-4">
            {/* Level Badge */}
            <div 
              className="relative flex items-center justify-center w-12 h-12 rounded-xl"
              style={{
                background: isMaxLevel 
                  ? 'linear-gradient(135deg, rgba(250,204,21,0.25) 0%, rgba(234,88,12,0.25) 100%)'
                  : 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)',
                border: isMaxLevel 
                  ? '2px solid rgba(250,204,21,0.4)' 
                  : '2px solid rgba(99,102,241,0.3)',
                boxShadow: isMaxLevel 
                  ? '0 0 20px rgba(250,204,21,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : '0 0 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                animation: isMaxLevel ? 'levelGlow 2s ease-in-out infinite' : 'none'
              }}
            >
              <div className="text-center">
                <div 
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: isMaxLevel ? '#fbbf24' : '#818cf8',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                  }}
                >
                  LV
                </div>
                <div 
                  className="text-lg font-bold leading-none"
                  style={{
                    color: isMaxLevel ? '#fef3c7' : '#e0e7ff',
                    textShadow: isMaxLevel 
                      ? '0 0 10px rgba(250,204,21,0.6), 0 2px 4px rgba(0,0,0,0.8)' 
                      : '0 2px 4px rgba(0,0,0,0.8)'
                  }}
                >
                  {level}
                </div>
              </div>
              
              {/* Max level crown */}
              {isMaxLevel && (
                <div 
                  className="absolute -top-1 -right-1 text-xs"
                  style={{ 
                    animation: 'pulse 2s ease-in-out infinite',
                    filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.8))'
                  }}
                >
                  👑
                </div>
              )}
            </div>

            {/* Progress Section */}
            <div className="flex flex-col gap-1.5">
              {/* Progress text */}
              <div className="flex items-center justify-between gap-3">
                <div 
                  className="text-[11px] font-semibold tracking-wide"
                  style={{
                    color: '#9ca3af',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}
                >
                  {isMaxLevel ? (
                    <span style={{ color: '#fbbf24' }}>MAX LEVEL</span>
                  ) : (
                    <span>{currentLevelExp}<span className="opacity-50 mx-0.5">/</span>{maxLevelExp} EXP</span>
                  )}
                </div>
                <div 
                  className="text-[10px] font-medium tracking-wider uppercase"
                  style={{
                    color: '#6b7280',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}
                >
                  Total: {experience} EXP
                </div>
              </div>

              {/* Experience bar */}
              <div 
                className="relative w-64 h-6 rounded-full overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(20,20,30,0.9) 100%)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(99,102,241,0.08), 0 1px 0 rgba(255,255,255,0.05)'
                }}
              >
                {/* Inner track */}
                <div 
                  className="absolute inset-[2px] rounded-full overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(15,15,25,0.95) 0%, rgba(25,25,40,0.9) 100%)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)'
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="h-full rounded-full relative transition-all duration-500 ease-out"
                    style={{
                      width: `${progress}%`,
                      background: isMaxLevel
                        ? 'linear-gradient(90deg, #ca8a04 0%, #facc15 50%, #fde047 100%)'
                        : 'linear-gradient(90deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
                      boxShadow: isMaxLevel
                        ? '0 0 15px rgba(250,204,21,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.3)'
                        : '0 0 15px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.3)'
                    }}
                  >
                    {/* Highlight at top of bar */}
                    <div 
                      className="absolute inset-x-0 top-0 h-[40%] rounded-t-full pointer-events-none"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)'
                      }}
                    />
                    
                    {/* Animated shimmer effect */}
                    {!isMaxLevel && progress < 100 && (
                      <div 
                        className="absolute inset-0 pointer-events-none overflow-hidden rounded-full"
                      >
                        <div
                          className="absolute inset-0 w-full h-full"
                          style={{
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                            animation: 'shimmer 2s infinite'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Percentage text overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span 
                    className="text-[11px] font-bold tracking-wide"
                    style={{
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'
                    }}
                  >
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
