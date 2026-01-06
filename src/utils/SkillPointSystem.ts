import { WeaponType } from '@/components/dragon/weapons';

export interface SkillPointData {
  skillPoints: number;
  unlockedAbilities: Record<string, Set<string>>; // weaponType -> Set of unlocked abilities (R, F)
}

export interface AbilityUnlock {
  weaponType: WeaponType;
  abilityKey: 'E' | 'R' | 'F' | 'P';
  weaponSlot: 'primary' | 'secondary'; // Which slot this weapon is in
}

export class SkillPointSystem {
  private static readonly SKILL_POINTS_PER_LEVEL = 1;
  
  /**
   * Get initial skill point data for a new player
   */
  static getInitialSkillPointData(): SkillPointData {
    return {
      skillPoints: 1,
      unlockedAbilities: {}
    };
  }
  
  /**
   * Calculate skill points gained when leveling up
   */
  static getSkillPointsForLevel(level: number): number {
    if (level <= 1) return 0;
    return (level - 1) * this.SKILL_POINTS_PER_LEVEL;
  }
  
  /**
   * Get available abilities that can be unlocked with current setup
   */
  static getAvailableUnlocks(
    skillPointData: SkillPointData,
    selectedWeapons: {
      primary: WeaponType;
      secondary: WeaponType;
      tertiary?: WeaponType;
    } | null
  ): AbilityUnlock[] {
    if (!selectedWeapons || skillPointData.skillPoints <= 0) {
      return [];
    }

    const available: AbilityUnlock[] = [];

    // Check primary weapon E, R, F, and P abilities
    const primaryKey = `${selectedWeapons.primary}_primary`;
    const primaryUnlocked = skillPointData.unlockedAbilities[primaryKey] || new Set();
    if (!primaryUnlocked.has('E')) {
      available.push({
        weaponType: selectedWeapons.primary,
        abilityKey: 'E',
        weaponSlot: 'primary'
      });
    }
    if (!primaryUnlocked.has('R')) {
      available.push({
        weaponType: selectedWeapons.primary,
        abilityKey: 'R',
        weaponSlot: 'primary'
      });
    }
    if (!primaryUnlocked.has('F')) {
      available.push({
        weaponType: selectedWeapons.primary,
        abilityKey: 'F',
        weaponSlot: 'primary'
      });
    }
    if (!primaryUnlocked.has('P')) {
      available.push({
        weaponType: selectedWeapons.primary,
        abilityKey: 'P',
        weaponSlot: 'primary'
      });
    }

    // Check secondary weapon E, R, F, and P abilities
    const secondaryKey = `${selectedWeapons.secondary}_secondary`;
    const secondaryUnlocked = skillPointData.unlockedAbilities[secondaryKey] || new Set();
    if (!secondaryUnlocked.has('E')) {
      available.push({
        weaponType: selectedWeapons.secondary,
        abilityKey: 'E',
        weaponSlot: 'secondary'
      });
    }
    if (!secondaryUnlocked.has('R')) {
      available.push({
        weaponType: selectedWeapons.secondary,
        abilityKey: 'R',
        weaponSlot: 'secondary'
      });
    }
    if (!secondaryUnlocked.has('F')) {
      available.push({
        weaponType: selectedWeapons.secondary,
        abilityKey: 'F',
        weaponSlot: 'secondary'
      });
    }
    if (!secondaryUnlocked.has('P')) {
      available.push({
        weaponType: selectedWeapons.secondary,
        abilityKey: 'P',
        weaponSlot: 'secondary'
      });
    }

    return available;
  }
  
  /**
   * Check if a specific ability is unlocked
   */
  static isAbilityUnlocked(
    skillPointData: SkillPointData,
    weaponType: WeaponType,
    abilityKey: 'E' | 'R' | 'F' | 'P',
    weaponSlot: 'primary' | 'secondary'
  ): boolean {
    const key = `${weaponType}_${weaponSlot}`;
    const unlockedForWeapon = skillPointData.unlockedAbilities[key] || new Set();
    return unlockedForWeapon.has(abilityKey);
  }
  
  /**
   * Unlock an ability and spend a skill point
   */
  static unlockAbility(
    skillPointData: SkillPointData,
    weaponType: WeaponType,
    abilityKey: 'E' | 'R' | 'F' | 'P',
    weaponSlot: 'primary' | 'secondary'
  ): SkillPointData {
    if (skillPointData.skillPoints <= 0) {
      throw new Error('No skill points available');
    }

    const key = `${weaponType}_${weaponSlot}`;
    const newUnlockedAbilities = { ...skillPointData.unlockedAbilities };

    if (!newUnlockedAbilities[key]) {
      newUnlockedAbilities[key] = new Set();
    } else {
      newUnlockedAbilities[key] = new Set(newUnlockedAbilities[key]);
    }

    if (newUnlockedAbilities[key].has(abilityKey)) {
      throw new Error('Ability already unlocked');
    }

    newUnlockedAbilities[key].add(abilityKey);

    return {
      skillPoints: skillPointData.skillPoints - 1,
      unlockedAbilities: newUnlockedAbilities
    };
  }
  
  /**
   * Update skill points when player levels up
   */
  static updateSkillPointsForLevel(
    skillPointData: SkillPointData,
    newLevel: number
  ): SkillPointData {
    // Calculate total skill points: initial 1 + (level - 1) skill points per level
    const initialSkillPoints = 1;
    const levelBasedSkillPoints = Math.max(0, (newLevel - 1) * this.SKILL_POINTS_PER_LEVEL);
    const totalSkillPoints = initialSkillPoints + levelBasedSkillPoints;
    const spentSkillPoints = this.getSpentSkillPoints(skillPointData);
    const availableSkillPoints = Math.max(0, totalSkillPoints - spentSkillPoints);

    return {
      ...skillPointData,
      skillPoints: availableSkillPoints
    };
  }
  
  /**
   * Calculate how many skill points have been spent
   */
  static getSpentSkillPoints(skillPointData: SkillPointData): number {
    let spent = 0;
    Object.values(skillPointData.unlockedAbilities).forEach(abilitySet => {
      spent += abilitySet.size;
    });
    return spent;
  }
  
  /**
   * Get ability name for display
   */
  static getAbilityName(weaponType: WeaponType, abilityKey: 'E' | 'R' | 'F' | 'P'): string {
    const abilityNames: Record<WeaponType, Record<'E' | 'R' | 'F' | 'P', string>> = {
      [WeaponType.SWORD]: {
        E: 'Frost Nova',
        R: 'Colossus Strike',
        F: 'Wind Shear',
        P: 'Titanheart'
      },
      [WeaponType.BOW]: {
        E: 'Barrage',
        R: 'Viper Sting',
        F: 'Cloudkill',
        P: 'Sharpshooter'
      },
      [WeaponType.SCYTHE]: {
        E: 'Cobra Shot',
        R: 'Crossentropy',
        F: 'Summon Totem',
        P: 'Cryoflame'
      },
      [WeaponType.SABRES]: {
        E: 'Death Grasp',
        R: 'Skyfall',
        F: 'Shadow Step',
        P: 'Lethality'
      },
      [WeaponType.RUNEBLADE]: {
        E: 'Smite',
        R: 'Unholy Smite',
        F: 'Corruption',
        P: 'Arcane Mastery'
      }
    };

    return abilityNames[weaponType]?.[abilityKey] || 'Unknown Ability';
  }
  
  /**
   * Get weapon display name
   */
  static getWeaponDisplayName(weaponType: WeaponType): string {
    const weaponNames: Record<WeaponType, string> = {
      [WeaponType.SWORD]: 'Sword',
      [WeaponType.BOW]: 'Bow',
      [WeaponType.SCYTHE]: 'Scythe',
      [WeaponType.SABRES]: 'Sabres',
      [WeaponType.RUNEBLADE]: 'Runeblade'
    };
    
    return weaponNames[weaponType] || 'Unknown Weapon';
  }
  
  /**
   * Serialize skill point data for storage/network
   */
  static serialize(skillPointData: SkillPointData): string {
    const serializable = {
      skillPoints: skillPointData.skillPoints,
      unlockedAbilities: {} as Record<string, string[]>
    };
    
    Object.entries(skillPointData.unlockedAbilities).forEach(([key, abilitySet]) => {
      serializable.unlockedAbilities[key] = Array.from(abilitySet);
    });
    
    return JSON.stringify(serializable);
  }
  
  /**
   * Deserialize skill point data from storage/network
   */
  static deserialize(data: string): SkillPointData {
    try {
      const parsed = JSON.parse(data);
      const skillPointData: SkillPointData = {
        skillPoints: parsed.skillPoints || 0,
        unlockedAbilities: {}
      };
      
      Object.entries(parsed.unlockedAbilities || {}).forEach(([key, abilities]) => {
        skillPointData.unlockedAbilities[key] = new Set(abilities as string[]);
      });
      
      return skillPointData;
    } catch (error) {
      console.error('Failed to deserialize skill point data:', error);
      return this.getInitialSkillPointData();
    }
  }
}
