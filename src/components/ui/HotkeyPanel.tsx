import React, { useState, useEffect, useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import { SkillPointSystem, SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { weaponAbilities, getAbilityIcon, type AbilityData as BaseAbilityData } from '@/utils/weaponAbilities';

interface AbilityData extends BaseAbilityData {
  currentCooldown: number;
  isActive?: boolean;
  isLocked?: boolean;
}

interface HotkeyPanelProps {
  currentWeapon: WeaponType;
  controlSystem?: any; // Reference to control system for cooldown data
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;
  onWeaponSwitch?: (slot: 1 | 2 | 3) => void;
  skillPointData?: SkillPointData;
  onUnlockAbility?: (unlock: AbilityUnlock) => void;
  purchasedItems?: string[];
}

interface WeaponData {
  name: string;
  type: WeaponType;
  key: '1' | '2' | '3';
  icon: string;
}

interface TooltipProps {
  content: {
    name: string;
    description: string;
  };
  visible: boolean;
  x: number;
  y: number;
}

function Tooltip({ content, visible, x, y }: TooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm max-w-xs pointer-events-none"
      style={{
        left: x - 150, // Center tooltip above cursor
        top: y - 80,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="font-semibold text-blue-300 mb-1">{content.name}</div>
      <div className="text-gray-300">{content.description}</div>
    </div>
  );
}

/**
 * RoundedSquareProgress Component
 * Renders a sweeping cooldown animation around a rounded square.
 */
const RoundedSquareProgress: React.FC<{
  size: number;
  strokeWidth: number;
  percentage: number;
  borderRadius: number;
  isActive?: boolean;
}> = ({ size, strokeWidth, percentage, borderRadius, isActive }) => {
  const halfStroke = strokeWidth / 2;
  const adjustedSize = size - strokeWidth;
  const perimeter = 4 * adjustedSize;
  const dashOffset = perimeter - (perimeter * percentage) / 100;

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0"
      style={{ zIndex: 10 }}
    >
      <rect
        x={halfStroke}
        y={halfStroke}
        width={adjustedSize}
        height={adjustedSize}
        rx={borderRadius}
        ry={borderRadius}
        stroke={isActive ? "#ff3333" : "#39ff14"}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={perimeter}
        strokeDashoffset={dashOffset}
        style={{
          transition: 'stroke-dashoffset 0.1s ease-out'
        }}
      />
    </svg>
  );
};

export default function HotkeyPanel({ currentWeapon, controlSystem, selectedWeapons, onWeaponSwitch, skillPointData, onUnlockAbility, purchasedItems = [] }: HotkeyPanelProps) {
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [weaponSwitchCooldown, setWeaponSwitchCooldown] = useState<{ current: number; max: number }>({ current: 0, max: 5 });

  // Define selected weapons for switching (only show 1, 2, and 3 keys)
  const weapons: WeaponData[] = [];

  if (selectedWeapons) {
    // Primary weapon - key 1
    const primaryWeapon = {
      name: selectedWeapons.primary === WeaponType.SWORD ? 'Sword' :
            selectedWeapons.primary === WeaponType.BOW ? 'Bow' :
            selectedWeapons.primary === WeaponType.SCYTHE ? 'Scythe' :
            selectedWeapons.primary === WeaponType.SABRES ? 'Sabres' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
      type: selectedWeapons.primary,
      key: '1' as const,
      icon: selectedWeapons.primary === WeaponType.SWORD ? '💎' :
            selectedWeapons.primary === WeaponType.BOW ? '🏹' :
            selectedWeapons.primary === WeaponType.SCYTHE ? '🦋' :
            selectedWeapons.primary === WeaponType.SABRES ? '⚔️' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? '🔮' : '❓'
    };
    weapons.push(primaryWeapon);

    // Secondary weapon - key 2
    const secondaryWeapon = {
      name: selectedWeapons.secondary === WeaponType.SWORD ? 'Sword' :
            selectedWeapons.secondary === WeaponType.BOW ? 'Bow' :
            selectedWeapons.secondary === WeaponType.SCYTHE ? 'Scythe' :
            selectedWeapons.secondary === WeaponType.SABRES ? 'Sabres' :
            selectedWeapons.secondary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
      type: selectedWeapons.secondary,
      key: '2' as const,
      icon: selectedWeapons.secondary === WeaponType.SWORD ? '💎' :
            selectedWeapons.secondary === WeaponType.BOW ? '🏹' :
            selectedWeapons.secondary === WeaponType.SCYTHE ? '🦋' :
            selectedWeapons.secondary === WeaponType.SABRES ? '⚔️' :
            selectedWeapons.secondary === WeaponType.RUNEBLADE ? '🔮' : '❓'
    };
    weapons.push(secondaryWeapon);

    // Purchased items - key 3 (takes precedence over tertiary weapon)
    if (purchasedItems.length > 0) {
      // Show the first purchased item in the 3 slot
      const firstPurchasedItem = purchasedItems[0];
      let itemName = 'Unknown Item';
      let itemIcon = '🎁';

      if (firstPurchasedItem === 'damage_boost') {
        itemName = 'Damage Boost';
        itemIcon = '💪';
      } else if (firstPurchasedItem === 'ascendant_wings') {
        itemName = 'Ascendant Wings';
        itemIcon = '🕊️';
      }

      const purchasedItemSlot = {
        name: itemName,
        type: WeaponType.SWORD, // Use sword as placeholder since we need a WeaponType
        key: '3' as const,
        icon: itemIcon,
        isPurchasedItem: true // Custom flag to identify this is a purchased item
      };
      weapons.push(purchasedItemSlot);
    }
    // Tertiary weapon - key 3 (only if no purchased items and tertiary weapon exists)
    else if (selectedWeapons.tertiary) {
      const tertiaryWeapon = {
        name: selectedWeapons.tertiary === WeaponType.SWORD ? 'Sword' :
              selectedWeapons.tertiary === WeaponType.BOW ? 'Bow' :
              selectedWeapons.tertiary === WeaponType.SCYTHE ? 'Scythe' :
              selectedWeapons.tertiary === WeaponType.SABRES ? 'Sabres' :
              selectedWeapons.tertiary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
        type: selectedWeapons.tertiary,
        key: '3' as const,
        icon: selectedWeapons.tertiary === WeaponType.SWORD ? '💎' :
              selectedWeapons.tertiary === WeaponType.BOW ? '🏹' :
              selectedWeapons.tertiary === WeaponType.SCYTHE ? '🦋' :
              selectedWeapons.tertiary === WeaponType.SABRES ? '⚔️' :
              selectedWeapons.tertiary === WeaponType.RUNEBLADE ? '🔮' : '❓'
      };
      weapons.push(tertiaryWeapon);
    }
  }

  // Convert base abilities to include runtime state
  const createAbilitiesWithState = (baseAbilities: BaseAbilityData[]): AbilityData[] => {
    return baseAbilities.map(ability => ({
      ...ability,
      currentCooldown: 0
    }));
  };

  // Update cooldowns from control system
  useEffect(() => {
    if (!controlSystem || !controlSystem.getAbilityCooldowns) return;

    const updateCooldowns = () => {
      const abilityCooldowns = controlSystem.getAbilityCooldowns();
      const newCooldowns: Record<string, number> = {};

      // Extract current cooldown values
      Object.keys(abilityCooldowns).forEach(key => {
        newCooldowns[key] = abilityCooldowns[key].current;
      });

      setCooldowns(newCooldowns);

      // Update weapon switch cooldown if available
      if (controlSystem.getWeaponSwitchCooldown) {
        setWeaponSwitchCooldown(controlSystem.getWeaponSwitchCooldown());
      }
    };

    // Update cooldowns every 100ms for smooth animation
    const interval = setInterval(updateCooldowns, 100);
    updateCooldowns(); // Initial update

    return () => clearInterval(interval);
  }, [controlSystem, currentWeapon]);

  const handleAbilityHover = useCallback((
    e: React.MouseEvent,
    ability: AbilityData
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: ability.name,
      description: ability.description
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleWeaponHover = useCallback((
    e: React.MouseEvent,
    weapon: WeaponData
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: weapon.name,
      description: `Switch to ${weapon.name} (${weapon.key})`
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleAbilityLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  // Helper function to check if an ability is locked
  const isAbilityLocked = useCallback((ability: AbilityData): boolean => {
    if (!selectedWeapons || !skillPointData) return false;

    // Only Q ability is unlocked by default for both primary and secondary weapons
    if (ability.key === 'Q') return false;

    // Determine weapon slot
    let weaponSlot: 'primary' | 'secondary';
    let weaponType: WeaponType;

    if (currentWeapon === selectedWeapons.primary) {
      weaponSlot = 'primary';
      weaponType = selectedWeapons.primary;
    } else if (currentWeapon === selectedWeapons.secondary) {
      weaponSlot = 'secondary';
      weaponType = selectedWeapons.secondary;
    } else {
      return false; // Not a selected weapon
    }

    // E, R, F, and P abilities are all unlockable for both weapons
    if (ability.key === 'E' || ability.key === 'R' || ability.key === 'F' || ability.key === 'P') {
      return !SkillPointSystem.isAbilityUnlocked(skillPointData, weaponType, ability.key, weaponSlot);
    }

    return false;
  }, [currentWeapon, selectedWeapons, skillPointData]);

  // Helper function to check if an ability can be unlocked (has skill points and is available)
  const canUnlockAbility = useCallback((ability: AbilityData): boolean => {
    if (!selectedWeapons || !skillPointData || skillPointData.skillPoints <= 0) return false;
    if (!ability.isLocked) return false; // Already unlocked

    // Check if this ability is in the available unlocks
    const availableUnlocks = SkillPointSystem.getAvailableUnlocks(skillPointData, selectedWeapons);
    return availableUnlocks.some(unlock =>
      unlock.abilityKey === ability.key &&
      (
        (currentWeapon === selectedWeapons.primary && unlock.weaponSlot === 'primary') ||
        (currentWeapon === selectedWeapons.secondary && unlock.weaponSlot === 'secondary')
      )
    );
  }, [currentWeapon, selectedWeapons, skillPointData]);

  // Handle ability unlock when clicking the + button
  const handleAbilityUnlock = useCallback((ability: AbilityData) => {
    if (!selectedWeapons || !onUnlockAbility) return;

    let weaponSlot: 'primary' | 'secondary';
    let weaponType: WeaponType;

    if (currentWeapon === selectedWeapons.primary) {
      weaponSlot = 'primary';
      weaponType = selectedWeapons.primary;
    } else if (currentWeapon === selectedWeapons.secondary) {
      weaponSlot = 'secondary';
      weaponType = selectedWeapons.secondary;
    } else {
      return; // Unknown weapon
    }

    onUnlockAbility({
      weaponType,
      abilityKey: ability.key as 'R' | 'F' | 'P',
      weaponSlot
    });
  }, [currentWeapon, selectedWeapons, onUnlockAbility]);

  const currentAbilities = weaponAbilities[currentWeapon] ? createAbilitiesWithState(weaponAbilities[currentWeapon]) : [];
  
  // Mark abilities as locked
  const abilitiesWithLockStatus = currentAbilities.map(ability => ({
    ...ability,
    isLocked: isAbilityLocked(ability)
  }));

  if (currentAbilities.length === 0) {
    return null; // Don't render for weapons that aren't implemented
  }


  return (
    <>
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-black bg-opacity-70 backdrop-blur-sm rounded-lg p-3 border border-gray-600">
          <div className="flex items-center space-x-4">
            {/* Weapon Icons */}
            {weapons.map((weapon) => {
              const isCurrentWeapon = weapon.type === currentWeapon;
              const isOnCooldown = weaponSwitchCooldown.current > 0;
              const cooldownPercentage = weaponSwitchCooldown.max > 0 ? (weaponSwitchCooldown.current / weaponSwitchCooldown.max) * 100 : 0;

              const handleWeaponClick = useCallback(() => {
                // Don't allow clicking on purchased items
                if ((weapon as any).isPurchasedItem) return;

                if (!isOnCooldown && onWeaponSwitch) {
                  const slot = weapon.key === '1' ? 1 : weapon.key === '2' ? 2 : 3;
                  onWeaponSwitch(slot as 1 | 2 | 3);
                }
              }, [isOnCooldown, onWeaponSwitch, weapon.key, weapon]);

              return (
                <div
                  key={weapon.key}
                  className={`relative w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                    (weapon as any).isPurchasedItem
                      ? 'border-purple-400 bg-purple-900 bg-opacity-50'
                      : isCurrentWeapon
                        ? 'border-yellow-400 bg-yellow-900 bg-opacity-50'
                        : isOnCooldown
                          ? 'border-red-500 bg-red-900 bg-opacity-30'
                          : 'border-gray-400 bg-gray-900 bg-opacity-30 hover:bg-opacity-50'
                  } ${(weapon as any).isPurchasedItem ? 'cursor-default' : 'cursor-pointer'} flex items-center justify-center`}
                  onClick={handleWeaponClick}
                  onMouseEnter={(e) => handleWeaponHover(e, weapon)}
                  onMouseLeave={handleAbilityLeave}
                >
                  {/* Hotkey indicator */}
                  <div className="absolute -top-2 -left-2 bg-gray-800 border border-gray-600 rounded text-xs text-white px-1 py-0.5 font-semibold">
                    {weapon.key}
                  </div>

                  {/* Weapon icon */}
                  <div className={`text-2xl ${
                    (weapon as any).isPurchasedItem
                      ? 'text-purple-400'
                      : isCurrentWeapon
                        ? 'text-yellow-400'
                        : isOnCooldown
                          ? 'text-red-400'
                          : 'text-gray-300'
                  }`}>
                    {weapon.icon}
                  </div>

                  {/* Cooldown overlay */}
                  {isOnCooldown && (
                    <>
                      <div className="absolute inset-0 bg-black bg-opacity-60 rounded-lg" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-sm font-bold bg-black bg-opacity-60 rounded px-1">
                          {Math.ceil(weaponSwitchCooldown.current)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Separator */}
            <div className="w-px h-8 bg-gray-600" />

            {/* Ability Icons */}
            {abilitiesWithLockStatus.map((ability) => {
              const currentCooldown = cooldowns[ability.key] || 0;
              const cooldownPercentage = ability.cooldown > 0 ? (currentCooldown / ability.cooldown) * 100 : 0;
              const isOnCooldown = currentCooldown > 0;
              const isUnassigned = ability.name === 'Not Assigned';
              const isLocked = ability.isLocked;
              const canUnlock = canUnlockAbility(ability);

              return (
                <div
                  key={ability.key}
                  className={`relative w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                    isLocked
                      ? canUnlock
                        ? 'border-blue-400 bg-blue-900 bg-opacity-30 hover:bg-opacity-50 cursor-pointer'
                        : 'border-gray-500 bg-gray-700 opacity-60 cursor-not-allowed'
                      : isUnassigned
                        ? 'border-gray-600 bg-gray-800 opacity-50 cursor-pointer'
                        : isOnCooldown
                          ? 'border-red-500 bg-red-900 bg-opacity-30 cursor-pointer'
                          : ability.key === 'P'
                            ? 'border-purple-400 bg-purple-900 bg-opacity-30 cursor-pointer' // Special styling for passive abilities
                            : 'border-green-400 bg-green-900 bg-opacity-30 hover:bg-opacity-50 cursor-pointer'
                  } flex items-center justify-center`}
                  onMouseEnter={(e) => handleAbilityHover(e, ability)}
                  onMouseLeave={handleAbilityLeave}
                  onClick={canUnlock ? () => handleAbilityUnlock(ability) : undefined}
                >
                  {/* Hotkey indicator */}
                  <div className="absolute -top-2 -left-2 bg-gray-800 border border-gray-600 rounded text-xs text-white px-1 py-0.5 font-semibold">
                    {ability.key}
                  </div>

                  {/* Ability icon */}
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-lg font-bold ${
                    isLocked
                      ? canUnlock
                        ? 'text-blue-400'
                        : 'text-gray-500'
                      : isUnassigned
                        ? 'text-gray-500'
                        : isOnCooldown
                          ? 'text-red-400'
                          : ability.key === 'P'
                            ? 'text-purple-400' // Special color for passive abilities
                            : 'text-green-400'
                  }`}>
                    {isLocked
                      ? canUnlock
                        ? '➕'
                        : '🔒'
                      : getAbilityIcon(currentWeapon, ability.key)
                    }
                  </div>

                  {/* Cooldown overlay */}
                  {isOnCooldown && !isUnassigned && (
                    <>

                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-sm font-bold bg-black bg-opacity-60 rounded px-1">
                          {Math.ceil(currentCooldown)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Active state indicator for abilities */}
                  {(() => {
                    if (!controlSystem || !controlSystem.getAbilityCooldowns) return null;
                    
                    const abilityCooldowns = controlSystem.getAbilityCooldowns();
                    const abilityData = abilityCooldowns[ability.key];
                    
                    if (abilityData && abilityData.isActive) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />
                      );
                    }
                    
                    // Check for charging states (Viper Sting, Barrage)
                    if (ability.key === 'R' && currentWeapon === WeaponType.BOW && controlSystem.isViperStingChargingActive?.()) {
                      const progress = controlSystem.getViperStingChargeProgress?.() || 0;
                      return (
                        <div className="absolute inset-0 rounded-lg bg-purple-400 bg-opacity-20 border-2 border-purple-400">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-purple-400 bg-opacity-60 transition-all duration-100"
                            style={{ height: `${progress * 100}%` }}
                          />
                        </div>
                      );
                    }
                    
                    if (ability.key === 'Q' && currentWeapon === WeaponType.BOW && controlSystem.isBarrageChargingActive?.()) {
                      const progress = controlSystem.getBarrageChargeProgress?.() || 0;
                      return (
                        <div className="absolute inset-0 rounded-lg bg-orange-400 bg-opacity-20 border-2 border-orange-400">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-orange-400 bg-opacity-60 transition-all duration-100"
                            style={{ height: `${progress * 100}%` }}
                          />
                        </div>
                      );
                    }
                    
                    // Check for Cobra Shot charging state
                    if (ability.key === 'E' && currentWeapon === WeaponType.BOW && controlSystem.isCobraShotChargingActive?.()) {
                      const progress = controlSystem.getCobraShotChargeProgress?.() || 0;
                      return (
                        <div className="absolute inset-0 rounded-lg bg-green-400 bg-opacity-20 border-2 border-green-400">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-green-400 bg-opacity-60 transition-all duration-100"
                            style={{ height: `${progress * 100}%` }}
                          />
                        </div>
                      );
                    }

                    
                    // Check for Skyfall active state
                    if (ability.key === 'R' && currentWeapon === WeaponType.SABRES && controlSystem.isSkyfallActive?.()) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />
                      );
                    }

                    // Check for Stealth active state
                    if (ability.key === 'F' && currentWeapon === WeaponType.SABRES && controlSystem.isStealthActive?.()) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-purple-400 bg-opacity-20 border-2 border-purple-400 animate-pulse" />
                      );
                    }

                    // Check for Death Grasp active state
                    if (ability.key === 'Q' && currentWeapon === WeaponType.RUNEBLADE) {
                      const abilityData = abilityCooldowns[ability.key];
                      if (abilityData && abilityData.isActive) {
                        return (
                          <div className="absolute inset-0 rounded-lg bg-purple-400 bg-opacity-20 border-2 border-purple-400 animate-pulse" />
                        );
                      }
                    }

                    // Check for Smite active state
                    if (ability.key === 'E' && currentWeapon === WeaponType.RUNEBLADE) {
                      const abilityData = abilityCooldowns[ability.key];
                      if (abilityData && abilityData.isActive) {
                        return (
                          <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />
                        );
                      }
                    }

                    // Check for Corrupted Aura active state
                    if (ability.key === 'F' && currentWeapon === WeaponType.RUNEBLADE && controlSystem.isCorruptedAuraActive?.()) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-red-400 bg-opacity-20 border-2 border-red-400 animate-pulse" />
                      );
                    }

                    return null;
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tooltipContent && (
        <Tooltip 
          content={tooltipContent}
          visible={true}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      )}
    </>
  );
}

