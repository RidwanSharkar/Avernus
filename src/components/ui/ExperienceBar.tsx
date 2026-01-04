'use client';

import React from 'react';

interface ExperienceBarProps {
  experience: number;
  level: number;
  essence?: number;
  playerId?: string;
  isLocalPlayer?: boolean;
}

export default function ExperienceBar({ experience, level, essence, playerId, isLocalPlayer = false }: ExperienceBarProps) {
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
        @keyframes levelGlow {
          0%, 100% {
            --glow-opacity: 0.15;
          }
          50% {
            --glow-opacity: 0.25;
          }
        }
      `}</style>

      <div className="fixed top-3 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
          {/* Level Badge */}
          <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30">
            <div className="text-center">
              <div className="text-[9px] font-semibold text-indigo-300/80 uppercase tracking-wider">LV</div>
              <div className="text-sm font-bold text-white leading-none">{level}</div>
            </div>

            {/* Max level indicator */}
            {isMaxLevel && (
              <div className="absolute -top-0.5 -right-0.5 w-3 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-[8px]">
                ⭐
              </div>
            )}
          </div>

          {/* Progress Section */}
          <div className="flex flex-col gap-1">
            {/* Progress text */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-300 font-medium">
                {isMaxLevel ? (
                  <span className="text-yellow-400 font-semibold">MAX LEVEL</span>
                ) : (
                  <>{currentLevelExp}<span className="text-gray-500 mx-0.5">/</span>{maxLevelExp} EXP</>
                )}
              </span>
              <span className="text-gray-500 text-[10px]">• {experience} total</span>
            </div>

            {/* Experience bar */}
            <div className="relative w-48 h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                {/* Subtle shine effect */}
                {!isMaxLevel && progress > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full animate-pulse" />
                )}

                {/* Max level special effect */}
                {isMaxLevel && (
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 rounded-full animate-pulse" />
                )}
              </div>

              {/* Progress percentage */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>

          {/* Essence Display */}
          {essence !== undefined && (
            <div className="flex items-center space-x-1 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-purple-600/30">
              {/* Essence icon/symbol */}
              <div className="text-purple-400 text-xs">⚡</div>

              {/* Essence amount */}
              <div className={`text-xs font-bold ${isLocalPlayer ? 'text-purple-400' : 'text-purple-300'}`}>
                {essence}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
