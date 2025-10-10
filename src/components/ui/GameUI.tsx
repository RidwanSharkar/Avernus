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
  level?: number; // Player level for mana scaling
  controlSystem?: any; // Reference to control system for ability cooldowns
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
  color: string;
  backgroundColor?: string;
}

function ResourceBar({ current, max, color, backgroundColor = '#333'}: ResourceBarProps) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  
  return (
    <div className="w-full">
      <div 
        className="w-full h-6 rounded-lg border-2 border-gray-600 overflow-hidden relative"
        style={{ backgroundColor }}
      >
        <div
          className="h-full transition-all duration-300 ease-out rounded-sm"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-white font-medium drop-shadow-lg">
            {Math.round(current)}/{max}
          </span>
        </div>
      </div>
    </div>
  );
}

// Mana scaling based on player level
function getMaxManaForWeapon(weaponType: WeaponType, level: number): number {
  if (weaponType === WeaponType.RUNEBLADE) {
    // Runeblade scaling: Level 1: 150, Level 2: 175, Level 3: 200, Level 4: 225, Level 5: 250
    const runebladeMana = [0, 150, 175, 200, 225, 250];
    return runebladeMana[level] || 150;
  } else if (weaponType === WeaponType.SCYTHE) {
    // Scythe scaling: Level 1: 250, Level 2: 275, Level 3: 300, Level 4: 325, Level 5: 350
    return 250 + (level - 1) * 25;
  }
  return 200; // Default for other weapons
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
  level = 1, // Default to level 1
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

  // Continuous regeneration for all weapons (resources regenerate even when not using that weapon)
  useEffect(() => {
    const interval = setInterval(() => {
      setWeaponResources(prev => {
        const updated = { ...prev };

        // Mana regeneration for Scythe (10 mana per second = 5 every 500ms)
        const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, level);
        if (updated[WeaponType.SCYTHE].mana < scytheMaxMana) {
          updated[WeaponType.SCYTHE].mana = Math.min(scytheMaxMana, updated[WeaponType.SCYTHE].mana + 4);
        }

        // Mana regeneration for Runeblade (4 mana per second = 2 every 500ms)
        const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, level);
        if (updated[WeaponType.RUNEBLADE].mana < runebladeMaxMana) {
          updated[WeaponType.RUNEBLADE].mana = Math.min(runebladeMaxMana, updated[WeaponType.RUNEBLADE].mana + 2);
        }

        // Energy regeneration for Bow and Sabres (14 energy per second = 7 every 500ms)
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
      
      // Update Scythe mana capacity
      const scytheMaxMana = getMaxManaForWeapon(WeaponType.SCYTHE, level);
      if (updated[WeaponType.SCYTHE].mana < scytheMaxMana) {
        updated[WeaponType.SCYTHE].mana = scytheMaxMana; // Fill to new max capacity
      }
      
      // Update Runeblade mana capacity
      const runebladeMaxMana = getMaxManaForWeapon(WeaponType.RUNEBLADE, level);
      if (updated[WeaponType.RUNEBLADE].mana < runebladeMaxMana) {
        updated[WeaponType.RUNEBLADE].mana = runebladeMaxMana; // Fill to new max capacity
      }
      
      return updated;
    });
  }, [level]);

  // Rage decay for Sword (5 rage per second after 5 seconds of no damage)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setWeaponResources(prev => {
        const updated = { ...prev };

        // Only decay rage for Sword weapon
        const swordData = updated[WeaponType.SWORD];
        const timeSinceLastDamage = now - swordData.lastSwordDamageTime;

        // If it's been more than 6 seconds since last sword damage, decay rage
        if (timeSinceLastDamage > 8000 && swordData.rage > 0) {
          swordData.rage = Math.max(0, swordData.rage - 2);
        }

        return updated;
      });
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  // Function to consume mana (for Crossentropy bolt and Runeblade abilities)
  const consumeMana = (amount: number): boolean => {
    if (currentWeapon === WeaponType.SCYTHE || currentWeapon === WeaponType.RUNEBLADE) {
      // Apply Runeblade Arcane Mastery passive (-10% mana cost)
      let actualCost = amount;
      if (currentWeapon === WeaponType.RUNEBLADE && controlSystem) {
        // Check if Runeblade passive is unlocked
        const weaponSlot = selectedWeapons?.primary === WeaponType.RUNEBLADE ? 'primary' : 'secondary';
        if (weaponSlot && controlSystem.isPassiveAbilityUnlocked &&
            controlSystem.isPassiveAbilityUnlocked('P', WeaponType.RUNEBLADE, weaponSlot)) {
          actualCost = Math.floor(amount * 0.9); // 10% reduction
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
        return true; // Successfully consumed mana
      } else {
        return false; // Not enough mana
      }
    }
    return false; // Wrong weapon type
  };

  // Function to add mana (for Particle Beam refund when hitting frozen enemies)
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

  // Function to check if Runeblade has enough mana for abilities
  const hasRunebladeMana = (amount: number) => {
    return currentWeapon === WeaponType.RUNEBLADE && currentMana >= amount;
  };

  // Function to consume energy (for bow and sabres abilities)
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

  // Function to gain energy (for sabres abilities like backstab refund)
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

  // Function to gain rage (for sword attacks)
  const gainRage = (amount: number) => {
    if (currentWeapon === WeaponType.SWORD) {
      setWeaponResources(prev => ({
        ...prev,
        [currentWeapon]: {
          ...prev[currentWeapon],
          rage: Math.min(maxRage, prev[currentWeapon].rage + amount),
          lastSwordDamageTime: Date.now() // Update last damage time when gaining rage
        }
      }));
    }
  };

  // Function to consume rage 
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

  // Function to consume all rage 
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



  // Expose functions globally for other components to use
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
      // Runeblade mana abilities
      canCastSmite: () => currentMana >= 45,
      canCastDeathGrasp: () => currentMana >= 25,
      canCastWraithStrike: () => currentMana >= 30,
      canCastCorruptedAura: () => currentMana >= 8,
      // Bow energy abilities
      canCastBarrage: () => currentEnergy >= 40,
      canCastCobraShot: () => currentEnergy >= 40,
      canCastViperSting: () => currentEnergy >= 60,
      canCastCloudkill: () => currentEnergy >= 40,
      // Sword rage abilities
      canCastWindShear: () => currentRage >= 10,
      // Sabres energy abilities
      canCastBackstab: () => currentEnergy >= 60,
      canCastSkyfall: () => currentEnergy >= 40,
      canCastSunder: () => currentEnergy >= 35,
      canCastStealth: () => true // No energy cost for Stealth
    };
  }, [currentMana, currentEnergy, currentRage, currentWeapon, addMana]);

  const getResourceBar = () => {
    switch (currentWeapon) {
      case WeaponType.SCYTHE:
        return (
          <ResourceBar
            current={currentMana}
            max={getMaxManaForWeapon(WeaponType.SCYTHE, level)} // Dynamic Scythe mana based on level
            color="#4A90E2"
            backgroundColor="#1a2332"
          />
        );
      case WeaponType.SWORD:
        return (
          <ResourceBar
            current={currentRage}
            max={maxRage}
            color="#FF6B35"
            backgroundColor="#332318"
          />
        );
      case WeaponType.BOW:
      case WeaponType.SABRES:
        return (
          <ResourceBar
            current={currentEnergy}
            max={maxEnergy}
            color="#FFD700"
            backgroundColor="#332b18"
          />
        );
      case WeaponType.RUNEBLADE:
        return (
          <ResourceBar
            current={currentMana}
            max={getMaxManaForWeapon(WeaponType.RUNEBLADE, level)} // Dynamic Runeblade mana based on level
            color="#9B59B6" // Purple color for mana
            backgroundColor="#2a1a33"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Rune Counter - positioned in right corner */}
      <div className="fixed bottom-4 right-4 z-50">
        <RuneCounter
          criticalRuneCount={criticalRuneCount}
          critDamageRuneCount={critDamageRuneCount}
          criticalChance={criticalChance}
          criticalDamageMultiplier={criticalDamageMultiplier}
        />
      </div>

      {/* Main UI Panel - positioned above the hotkey panel */}
      <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-black bg-opacity-60 backdrop-blur-sm rounded-lg p-4 border border-gray-600 min-w-80">
          {/* Shield Bar - Thinner bar above health */}
          <div className="w-full mb-2">
            <div 
              className="w-full h-3 rounded-lg border border-blue-500 overflow-hidden relative"
              style={{ backgroundColor: '#1a2332' }}
            >
              <div
                className="h-full transition-all duration-300 ease-out rounded-sm"
                style={{
                  width: `${Math.max(0, Math.min(100, (playerShield / maxShield) * 100))}%`,
                  backgroundColor: '#4A90E2',
                  boxShadow: '0 0 8px #4A90E240'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-white font-medium drop-shadow-lg">
                  {Math.round(playerShield)}/{maxShield}
                </span>
              </div>
            </div>
          </div>
          
          {/* HP Bar */}
          <div className="mb-2">
            <ResourceBar
              current={playerHealth}
              max={maxHealth}
              color="#DC2626"
              backgroundColor="#331a1a"
            />
          </div>
          
          {/* Resource Bar (weapon-specific) */}
          {getResourceBar()}

          {/* Skill Points Display */}
          {skillPointData && skillPointData.skillPoints > 0 && (
            <div className="mt-2 text-center">
              <div className="text-yellow-400 text-xs font-medium drop-shadow-lg">
                Ability Points: {skillPointData.skillPoints}
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Hotkey Panel - positioned below the main UI */}
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
