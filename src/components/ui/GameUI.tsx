import React, { useEffect, useState, useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import HotkeyPanel from './HotkeyPanel';
import { SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { RuneCounter } from './RuneCounter';
import ChatUI from './ChatUI';

interface GameUIProps {
  currentWeapon: WeaponType;
  playerHealth: number;
  maxHealth: number;
  playerShield?: number;
  maxShield?: number;
  mana?: number;
  maxMana?: number;
  energy?: number;
  maxEnergy?: number;
  rage?: number;
  maxRage?: number;
  level?: number;
  controlSystem?: any;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;
  onWeaponSwitch?: (slot: 1 | 2 | 3) => void;
  skillPointData?: SkillPointData;
  onUnlockAbility?: (unlock: AbilityUnlock) => void;
  purchasedItems?: string[];
  criticalRuneCount?: number;
  critDamageRuneCount?: number;
  criticalChance?: number;
  criticalDamageMultiplier?: number;
}

interface ResourceBarProps {
  current: number;
  max: number;
  gradient: string;
  glowColor: string;
  icon?: string;
  label?: string;
}

function ResourceBar({ current, max, gradient, glowColor, icon, label }: ResourceBarProps) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const isLow = percentage < 30;
  
  return (
    <div className="relative w-full group">
      {/* Outer container with subtle glow */}
      <div 
        className="relative w-full h-7 rounded-full overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(20,20,30,0.9) 100%)',
          boxShadow: `inset 0 2px 4px rgba(0,0,0,0.6), 0 0 20px ${glowColor}15, 0 1px 0 rgba(255,255,255,0.05)`
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
          {/* Fill bar container - use transform for smooth animation */}
          <div
            className="h-full w-full rounded-full relative"
            style={{
              transform: `scaleX(${percentage / 100})`,
              transformOrigin: 'left center',
              transition: 'transform 0.15s ease-out',
              background: gradient,
              boxShadow: `0 0 15px ${glowColor}60, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.3)`
            }}
          >
            {/* Highlight at top of bar */}
            <div 
              className="absolute inset-x-0 top-0 h-[40%] rounded-t-full pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)'
              }}
            />
            
            {/* Pulse effect when low */}
            {isLow && (
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: 'rgba(255,0,0,0.25)',
                  animation: 'lowHealthPulse 1s ease-in-out infinite'
                }}
              />
            )}
          </div>
        </div>
        
        {/* Value display */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex items-center gap-1.5">
            {icon && <span className="text-xs opacity-80">{icon}</span>}
            <span 
              className="text-xs font-bold tracking-wide"
              style={{
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'
              }}
            >
              {Math.round(current)}<span className="opacity-50 mx-0.5">/</span>{max}
            </span>
          </div>
        </div>
      </div>
      
      {/* Label (if provided) */}
      {label && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full pr-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        </div>
      )}
    </div>
  );
}

// Mana scaling based on player level
function getMaxManaForWeapon(weaponType: WeaponType, level: number): number {
  if (weaponType === WeaponType.RUNEBLADE) {
    const runebladeMana = [0, 150, 175, 200, 225, 250];
    return runebladeMana[level] || 150;
  } else if (weaponType === WeaponType.SCYTHE) {
    return 250 + (level - 1) * 25;
  }
  return 200;
}

export default function GameUI({
  currentWeapon,
  playerHealth,
  maxHealth,
  playerShield = 200,
  maxShield = 200,
  mana = 200,
  maxMana = 200,
  energy = 100,
  maxEnergy = 100,
  rage = 0,
  maxRage = 100,
  level = 1,
  controlSystem,
  selectedWeapons,
  onWeaponSwitch,
  skillPointData,
  onUnlockAbility,
  purchasedItems = [],
  criticalRuneCount = 0,
  critDamageRuneCount = 0,
  criticalChance = 0,
  criticalDamageMultiplier = 2.0
}: GameUIProps) {
  // Store resources per weapon type to persist across switches
  const [weaponResources, setWeaponResources] = useState<{
    [key in WeaponType]: {
      mana: number;
      energy: number;
      rage: number;
      lastSwordDamageTime: number;
    }
  }>({
    [WeaponType.SCYTHE]: { mana, energy: maxEnergy, rage: 0, lastSwordDamageTime: Date.now() },
    [WeaponType.SWORD]: { mana: maxMana, energy: maxEnergy, rage, lastSwordDamageTime: Date.now() },
    [WeaponType.BOW]: { mana: maxMana, energy, rage: 0, lastSwordDamageTime: Date.now() },
    [WeaponType.SABRES]: { mana: maxMana, energy, rage: 0, lastSwordDamageTime: Date.now() },
    [WeaponType.RUNEBLADE]: { mana, energy: maxEnergy, rage: 0, lastSwordDamageTime: Date.now() }
  });

  // Get current weapon's resources
  const currentResources = weaponResources[currentWeapon];
  const currentMana = currentResources?.mana ?? mana;
  const currentEnergy = currentResources?.energy ?? energy;
  const currentRage = currentResources?.rage ?? rage;
  const lastSwordDamageTime = currentResources?.lastSwordDamageTime ?? Date.now();

  // Wrapper for unlockAbility to ensure ControlSystem is updated immediately
  const handleUnlockAbility = useCallback((unlock: AbilityUnlock) => {
    if (controlSystem) {
      controlSystem.unlockAbility(unlock.weaponType, unlock.abilityKey, unlock.weaponSlot);
    }
    if (onUnlockAbility) {
      onUnlockAbility(unlock);
    }
  }, [controlSystem, onUnlockAbility]);

  // Continuous regeneration for all weapons
  useEffect(() => {
    const interval = setInterval(() => {
      setWeaponResources(prev => {
        const updated = { ...prev };

        const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, level);
        if (updated[WeaponType.SCYTHE].mana < scytheMaxMana) {
          updated[WeaponType.SCYTHE].mana = Math.min(scytheMaxMana, updated[WeaponType.SCYTHE].mana + 4);
        }

        const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, level);
        if (updated[WeaponType.RUNEBLADE].mana < runebladeMaxMana) {
          updated[WeaponType.RUNEBLADE].mana = Math.min(runebladeMaxMana, updated[WeaponType.RUNEBLADE].mana + 2);
        }

        if (updated[WeaponType.BOW].energy < maxEnergy) {
          updated[WeaponType.BOW].energy = Math.min(maxEnergy, updated[WeaponType.BOW].energy + 6);
        }
        if (updated[WeaponType.SABRES].energy < maxEnergy) {
          updated[WeaponType.SABRES].energy = Math.min(maxEnergy, updated[WeaponType.SABRES].energy + 7);
        }

        return updated;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [maxEnergy, level]);

  // Handle mana capacity increase when leveling up
  useEffect(() => {
    setWeaponResources(prev => {
      const updated = { ...prev };
      
      const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, level);
      if (updated[WeaponType.SCYTHE].mana < scytheMaxMana) {
        updated[WeaponType.SCYTHE].mana = scytheMaxMana;
      }
      
      const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, level);
      if (updated[WeaponType.RUNEBLADE].mana < runebladeMaxMana) {
        updated[WeaponType.RUNEBLADE].mana = runebladeMaxMana;
      }
      
      return updated;
    });
  }, [level]);

  // Rage decay for Sword
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setWeaponResources(prev => {
        const updated = { ...prev };

        const swordData = updated[WeaponType.SWORD];
        const timeSinceLastDamage = now - swordData.lastSwordDamageTime;

        if (timeSinceLastDamage > 8000 && swordData.rage > 0) {
          swordData.rage = Math.max(0, swordData.rage - 2);
        }

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Function to consume mana
  const consumeMana = (amount: number): boolean => {
    if (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) {
      let actualCost = amount;
      if (currentWeapon === WeaponType.RUNEBLADE && controlSystem) {
        const weaponSlot = selectedWeapons?.primary === WeaponType.RUNEBLADE ? 'primary' : 'secondary';
        if (weaponSlot && controlSystem.isPassiveAbilityUnlocked &&
            controlSystem.isPassiveAbilityUnlocked('P', WeaponType.RUNEBLADE, weaponSlot)) {
          actualCost = Math.floor(amount * 0.9);
        }
      }

      if (currentMana >= actualCost) {
        setWeaponResources(prev => ({
          ...prev,
          [currentWeapon]: {
            ...prev[currentWeapon],
            mana: Math.max(0, prev[currentWeapon].mana - actualCost)
          }
        }));
        return true;
      } else {
        return false;
      }
    }
    return false;
  };

  const addMana = (amount: number) => {
    if (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) {
      const maxMana = getMaxManaForWeapon(currentWeapon, level);
      setWeaponResources(prev => ({
        ...prev,
        [currentWeapon]: {
          ...prev[currentWeapon],
          mana: Math.min(maxMana, prev[currentWeapon].mana + amount)
        }
      }));
    }
  };

  const hasRunebladeMana = (amount: number) => {
    return currentWeapon === WeaponType.RUNEBLADE && currentMana >= amount;
  };

  const consumeEnergy = (amount: number) => {
    if (currentWeapon === WeaponType.BOW || currentWeapon === WeaponType.SABRES) {
      setWeaponResources(prev => ({
        ...prev,
        [currentWeapon]: {
          ...prev[currentWeapon],
          energy: Math.max(0, prev[currentWeapon].energy - amount)
        }
      }));
    }
  };

  const gainEnergy = (amount: number) => {
    if (currentWeapon === WeaponType.BOW || currentWeapon === WeaponType.SABRES) {
      setWeaponResources(prev => ({
        ...prev,
        [currentWeapon]: {
          ...prev[currentWeapon],
          energy: Math.min(maxEnergy, prev[currentWeapon].energy + amount)
        }
      }));
    }
  };

  const gainRage = (amount: number) => {
    if (currentWeapon === WeaponType.SWORD) {
      setWeaponResources(prev => ({
        ...prev,
        [currentWeapon]: {
          ...prev[currentWeapon],
          rage: Math.min(maxRage, prev[currentWeapon].rage + amount),
          lastSwordDamageTime: Date.now()
        }
      }));
    }
  };

  const consumeRage = (amount: number) => {
    if (currentWeapon === WeaponType.SWORD) {
      setWeaponResources(prev => ({
        ...prev,
        [currentWeapon]: {
          ...prev[currentWeapon],
          rage: Math.max(0, prev[currentWeapon].rage - amount)
        }
      }));
    }
  };

  const consumeAllRage = () => {
    if (currentWeapon === WeaponType.SWORD) {
      setWeaponResources(prev => ({
        ...prev,
        [currentWeapon]: {
          ...prev[currentWeapon],
          rage: 0
        }
      }));
    }
  };

  // Expose functions globally
  useEffect(() => {
    (window as any).gameUI = {
      consumeMana,
      addMana,
      consumeEnergy,
      gainEnergy,
      gainRage,
      consumeRage,
      consumeAllRage,
      getCurrentMana: () => currentMana,
      getCurrentEnergy: () => currentEnergy,
      getCurrentRage: () => currentRage,
      canCastCrossentropy: () => currentMana >= 40,
      canCastEntropicBolt: () => currentMana >= 10,
      canCastCrossentropyBolt: () => currentMana >= 40,
      canCastReanimate: () => currentMana >= 20,
      canCastFrostNova: () => currentMana >= 25,
      canCastSmite: () => currentMana >= 45,
      canCastDeathGrasp: () => currentMana >= 25,
      canCastWraithStrike: () => currentMana >= 30,
      canCastCorruptedAura: () => currentMana >= 8,
      canCastBarrage: () => currentEnergy >= 40,
      canCastCobraShot: () => currentEnergy >= 40,
      canCastViperSting: () => currentEnergy >= 60,
      canCastCloudkill: () => currentEnergy >= 40,
      canCastWindShear: () => currentRage >= 10,
      canCastBackstab: () => currentEnergy >= 60,
      canCastSkyfall: () => currentEnergy >= 40,
      canCastSunder: () => currentEnergy >= 35,
      canCastStealth: () => true
    };
  }, [currentMana, currentEnergy, currentRage, currentWeapon, addMana]);

  const getResourceBar = () => {
    switch (currentWeapon) {
      case WeaponType.SCYTHE:
        return (
          <ResourceBar
            current={currentMana}
            max={getMaxManaForWeapon(WeaponType.SCYTHE, level)}
            gradient="linear-gradient(90deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)"
            glowColor="#3b82f6"
            icon="✦"
          />
        );
      case WeaponType.SWORD:
        return (
          <ResourceBar
            current={currentRage}
            max={maxRage}
            gradient="linear-gradient(90deg, #c2410c 0%, #ea580c 50%, #fb923c 100%)"
            glowColor="#ea580c"
            icon="⚔"
          />
        );
      case WeaponType.BOW:
      case WeaponType.SABRES:
        return (
          <ResourceBar
            current={currentEnergy}
            max={maxEnergy}
            gradient="linear-gradient(90deg, #a16207 0%, #ca8a04 50%, #facc15 100%)"
            glowColor="#ca8a04"
            icon="⚡"
          />
        );
      case WeaponType.RUNEBLADE:
        return (
          <ResourceBar
            current={currentMana}
            max={getMaxManaForWeapon(WeaponType.RUNEBLADE, level)}
            gradient="linear-gradient(90deg, #6b21a8 0%, #9333ea 50%, #c084fc 100%)"
            glowColor="#9333ea"
            icon="◈"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes lowHealthPulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.5; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
      `}</style>

      {/* Rune Counter */}
      <div className="fixed bottom-6 right-4 z-50">
        <RuneCounter
          criticalRuneCount={criticalRuneCount}
          critDamageRuneCount={critDamageRuneCount}
          criticalChance={criticalChance}
          criticalDamageMultiplier={criticalDamageMultiplier}
        />
      </div>

      {/* Main UI Panel */}
      <div 
        className="fixed bottom-28 left-1/2 z-50" 
        style={{ 
          transform: 'translateX(-50%) scale(0.8)',
          transformOrigin: 'center bottom'
        }}
      >
        <div 
          className="relative min-w-[340px] p-3 rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,25,0.95) 0%, rgba(10,10,20,0.98) 100%)',
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
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-500/30 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-500/30 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-500/30 rounded-br-lg" />

          {/* Shield Bar */}
          <div className="mb-3">
            <ResourceBar
              current={playerShield}
              max={maxShield}
              gradient="linear-gradient(90deg, #0e7490 0%, #06b6d4 50%, #22d3ee 100%)"
              glowColor="#06b6d4"
              icon="🛡"
            />
          </div>
          
          {/* HP Bar */}
          <div className="mb-3">
            <ResourceBar
              current={playerHealth}
              max={maxHealth}
              gradient="linear-gradient(90deg, #991b1b 0%, #dc2626 50%, #f87171 100%)"
              glowColor="#dc2626"
              icon="❤"
            />
          </div>
          
          {/* Resource Bar */}
          {getResourceBar()}

          {/* Skill Points Display */}
          {skillPointData && skillPointData.skillPoints > 0 && (
            <div 
              className="mt-4 py-2 px-4 rounded-lg text-center"
              style={{
                background: 'linear-gradient(90deg, rgba(250,204,21,0.1) 0%, rgba(250,204,21,0.2) 50%, rgba(250,204,21,0.1) 100%)',
                border: '1px solid rgba(250,204,21,0.3)',
                animation: 'float 2s ease-in-out infinite'
              }}
            >
              <span className="text-yellow-300 text-xs font-bold tracking-wide uppercase">
                ✨ {skillPointData.skillPoints} Ability Point{skillPointData.skillPoints > 1 ? 's' : ''} Available
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Hotkey Panel */}
      <HotkeyPanel
        currentWeapon={currentWeapon}
        controlSystem={controlSystem}
        selectedWeapons={selectedWeapons}
        onWeaponSwitch={onWeaponSwitch}
        skillPointData={skillPointData}
        onUnlockAbility={handleUnlockAbility}
        purchasedItems={purchasedItems}
      />

      {/* Chat UI */}
      <ChatUI />
    </>
  );
}
