// Audio System for managing game sound effects and music
import { Howl, Howler } from 'howler';
import { System } from '@/ecs/System';
import { Vector3 } from 'three';

export interface SoundConfig {
  volume?: number;
  loop?: boolean;
  rate?: number;
}

export class AudioSystem extends System {
  public readonly requiredComponents = []; // Audio system doesn't require specific components

  private soundCache = new Map<string, Howl>();
  private masterVolume = 0.7;
  private sfxVolume = 0.8;
  private listenerPosition = new Vector3(0, 0, 0);

  constructor() {
    super();
    this.setupAudioContext();
  }

  private setupAudioContext() {
    // Configure Howler for 3D spatial audio
    Howler.orientation(0, 0, -1, 0, 1, 0); // Forward direction
    Howler.volume(this.masterVolume);
  }

  public updateListenerPosition(position: Vector3) {
    this.listenerPosition.copy(position);
    Howler.pos(position.x, position.y, position.z);
  }

  // Preload weapon sound effects and background music
  public async preloadWeaponSounds() {
    const weaponSounds = [
      { id: 'bow_draw', file: 'bow/draw.mp3' },
      { id: 'bow_release', file: 'bow/release.mp3' },
      { id: 'bow_viper_sting_release', file: 'bow/viper_sting_release.mp3' },
      { id: 'bow_barrage_release', file: 'bow/barrage_release.mp3' },
      { id: 'bow_cobra_shot_release', file: 'bow/cobra_shot_release.mp3' },
      { id: 'bow_cloudkill_release', file: 'bow/cloudkill_release.mp3' },
      { id: 'sabres_swing', file: 'sabres/sabres_swing.mp3' },
      { id: 'sabres_backstab', file: 'sabres/backstab.mp3' },
      { id: 'sabres_flourish', file: 'sabres/flourish.mp3' },
      { id: 'sabres_shadow_step', file: 'sabres/shadow_step.mp3' },
      { id: 'sabres_skyfall', file: 'sabres/skyfall.mp3' },
      { id: 'entropic_bolt', file: 'scythe/entropic_bolts.mp3' },
      { id: 'crossentropy', file: 'scythe/crossentropy.mp3' },
      { id: 'frost_nova', file: 'scythe/frost_nova.mp3' },
      { id: 'scythe_mantra', file: 'scythe/mantra.mp3' },
      { id: 'scythe_sunwell', file: 'scythe/sunwell.mp3' },
      { id: 'scythe_cryoflame', file: 'scythe/cryoflame.mp3' },
      { id: 'sword_swing_1', file: 'sword/swing_1.mp3' },
      { id: 'sword_swing_2', file: 'sword/swing_2.mp3' },
      { id: 'sword_swing_3', file: 'sword/swing_3.mp3' },
      { id: 'sword_charge', file: 'sword/charge.mp3' },
      { id: 'sword_deflect', file: 'sword/deflect.mp3' },
      { id: 'windshear', file: 'sword/windshear.mp3' },
      { id: 'colossus_strike', file: 'sword/colossus_strike.mp3' },
      { id: 'runeblade_heartrend', file: 'runeblade/heartrend.mp3' },
      { id: 'runeblade_smite', file: 'runeblade/smite.mp3' },
      { id: 'runeblade_wraithblade', file: 'runeblade/wraithblade.mp3' },
      { id: 'runeblade_void_grasp', file: 'runeblade/void_grasp.mp3' },
      { id: 'ui_selection', file: 'ui/selection.mp3' },
      { id: 'ui_interface', file: 'ui/interface.mp3' },
      { id: 'ui_dash', file: 'ui/dash.mp3' },
      { id: 'hit_box', file: 'ui/HitBox.mp3' },
      { id: 'lightning_1', file: 'ui/lightning1.mp3' },
      { id: 'lightning_2', file: 'ui/lightning2.mp3' },
      { id: 'lightning_3', file: 'ui/lightning3.mp3' },
      { id: 'lightning_4', file: 'ui/lightning4.mp3' },
      { id: 'inhibitor_destroyed', file: 'ui/Inhibitor.mp3' },
      { id: 'minion_death', file: 'ui/deathEffect.mp3' }
      // Removed background_music from preload - loaded lazily
    ];

    const loadPromises = weaponSounds.map(async ({ id, file }) => {
      try {
        const sound = new Howl({
          src: [`/audio/sfx/${file}`],
          volume: this.sfxVolume * this.masterVolume,
          preload: true,
          html5: false // Use Web Audio API for better performance
        });

        // Wait for sound to load
        await new Promise<void>((resolve, reject) => {
          sound.on('load', () => resolve());
          sound.on('loaderror', (soundId, error) => reject(new Error(`Failed to load ${file}: ${error}`)));
        });

        this.soundCache.set(id, sound);
        console.log(`✅ Loaded sound: ${id}`);
      } catch (error) {
        console.warn(`⚠️ Failed to load sound ${id}:`, error);
        // Continue with other sounds instead of failing completely
      }
    });

    await Promise.all(loadPromises);
    console.log('🎵 Weapon sound preloading complete');
  }

  // Lazy load background music to avoid slow initial page loads
  public async preloadBackgroundMusic(): Promise<void> {
    if (this.soundCache.has('background_music')) {
      return; // Already loaded
    }

    try {
      console.log('🎵 Loading background music...');
      const sound = new Howl({
        src: ['/audio/sfx/ui/Avernus.mp3'],
        volume: this.sfxVolume * this.masterVolume,
        preload: true,
        html5: false, // Use Web Audio API for better performance
        loop: true // Enable looping for background music
      });

      // Wait for sound to load
      await new Promise<void>((resolve, reject) => {
        sound.on('load', () => resolve());
        sound.on('loaderror', (soundId, error) => reject(new Error(`Failed to load background music: ${error}`)));
      });

      this.soundCache.set('background_music', sound);
      console.log('✅ Background music loaded successfully');
    } catch (error) {
      console.warn('⚠️ Failed to load background music:', error);
    }
  }

  // Alternative streaming approach for large background music files
  public startBackgroundMusicStreaming(): void {
    if (this.backgroundAudioElement) {
      return; // Already streaming
    }

    try {
      console.log('🎵 Starting background music streaming...');
      this.backgroundAudioElement = new Audio('/audio/sfx/ui/Avernus.mp3');
      this.backgroundAudioElement.loop = true;
      this.backgroundAudioElement.volume = 0.725 * this.sfxVolume * this.masterVolume;
      this.backgroundAudioElement.preload = 'none'; // Stream instead of preload

      // Add event listeners
      this.backgroundAudioElement.addEventListener('canplaythrough', () => {
        console.log('✅ Background music ready to stream');
      });

      this.backgroundAudioElement.addEventListener('error', (e) => {
        console.warn('⚠️ Background music streaming failed:', e);
      });

      // Start playing (will begin streaming)
      this.backgroundAudioElement.play().catch(error => {
        console.warn('Failed to start streaming background music:', error);
      });
    } catch (error) {
      console.warn('Failed to create streaming audio element:', error);
    }
  }

  public stopBackgroundMusicStreaming(): void {
    if (this.backgroundAudioElement) {
      this.backgroundAudioElement.pause();
      this.backgroundAudioElement.currentTime = 0;
      this.backgroundAudioElement = null;
      console.log('🎵 Stopped background music streaming');
    }
  }

  // Play weapon sound effect (local only)
  public playWeaponSound(soundId: string, position: Vector3, config?: SoundConfig) {
    const sound = this.soundCache.get(soundId);
    if (!sound) {
      // Silently fail for missing sounds to avoid console spam
      return null;
    }

    const soundInstance = sound.play();

    // Skip 3D positioning to ensure sounds play at max volume regardless of distance

    // Apply custom config
    if (config) {
      if (config.volume !== undefined) {
        sound.volume(config.volume * this.sfxVolume * this.masterVolume, soundInstance);
      }
      if (config.rate !== undefined) {
        sound.rate(config.rate, soundInstance);
      }
    }

    return soundInstance;
  }

  // Play bow draw sound (called when charging starts)
  public playBowDrawSound(position: Vector3) {
    return this.playWeaponSound('bow_draw', position, { volume: 0.6 });
  }

  // Play bow release sound (called when arrow is fired)
  public playBowReleaseSound(position: Vector3, chargeProgress?: number) {
    // Adjust volume/pitch based on charge level
    const volume = 0.7 + (chargeProgress || 0) * 0.3; // 0.7 to 1.0
    const rate = 0.9 + (chargeProgress || 0) * 0.2; // 0.9 to 1.1

    return this.playWeaponSound('bow_release', position, {
      volume,
      rate
    });
  }

  // Play viper sting release sound (called when viper sting is fired)
  public playViperStingReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_viper_sting_release', position, { volume: 0.9 });
  }

  // Play barrage release sound (called when barrage is fired)
  public playBarrageReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_barrage_release', position, { volume: 0.9 });
  }

  // Play cobra shot release sound (called when cobra shot is fired)
  public playCobraShotReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_cobra_shot_release', position, { volume: 0.9 });
  }

  // Play cloudkill release sound (called when cloudkill is fired)
  public playCloudkillReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_cloudkill_release', position, { volume: 0.9 });
  }

  // Play sabres swing sound
  public playSabresSwingSound(position: Vector3) {
    return this.playWeaponSound('sabres_swing', position, { volume: 0.8 });
  }

  // Play sabres flourish sound (Sunder ability)
  public playSabresFlourishSound(position: Vector3) {
    return this.playWeaponSound('sabres_flourish', position, { volume: 0.9 });
  }

  // Play sabres shadow step sound (Stealth ability)
  public playSabresShadowStepSound(position: Vector3) {
    return this.playWeaponSound('sabres_shadow_step', position, { volume: 0.8 });
  }

  // Play sabres skyfall sound
  public playSabresSkyfallSound(position: Vector3) {
    return this.playWeaponSound('sabres_skyfall', position, { volume: 1.0 });
  }


  // Play entropic bolt sound
  public playEntropicBoltSound(position: Vector3) {
    return this.playWeaponSound('entropic_bolt', position, { volume: 0.8 });
  }

  // Play crossentropy sound
  public playCrossentropySound(position: Vector3) {
    return this.playWeaponSound('crossentropy', position, { volume: 0.9 });
  }

  // Play sword swing sounds (combo steps 1-3)
  public playSwordSwingSound(comboStep: 1 | 2 | 3, position: Vector3) {
    const soundId = `sword_swing_${comboStep}`;
    return this.playWeaponSound(soundId, position, { volume: 0.8 });
  }

  // Play sword deflect sound (Q ability)
  public playSwordDeflectSound(position: Vector3) {
    return this.playWeaponSound('sword_deflect', position, { volume: 0.9 });
  }

  // Play sword charge sound (E ability)
  public playSwordChargeSound(position: Vector3) {
    return this.playWeaponSound('sword_charge', position, { volume: 0.9 });
  }

  // Play windshear sound
  public playWindshearSound(position: Vector3) {
    return this.playWeaponSound('windshear', position, { volume: 0.9 });
  }

  // Play colossus strike sound
  public playColossusStrikeSound(position: Vector3) {
    return this.playWeaponSound('colossus_strike', position, { volume: 1.0 });
  }

  // Play frost nova sound
  public playFrostNovaSound(position: Vector3) {
    return this.playWeaponSound('frost_nova', position, { volume: 0.9 });
  }

  // Play backstab sound
  public playBackstabSound(position: Vector3) {
    return this.playWeaponSound('sabres_backstab', position, { volume: 0.8 });
  }

  // ===== ENEMY SOUND EFFECTS (25% volume) =====

  // Play enemy bow draw sound
  public playEnemyBowDrawSound(position: Vector3) {
    // return this.playWeaponSound('bow_draw', position, { volume: 0.0725 }); // 0.6 * 0.25
  }

  // Play enemy bow release sound
  public playEnemyBowReleaseSound(position: Vector3, chargeProgress?: number) {
    const volume = (0.7 + (chargeProgress || 0) * 0.3) * 0.25; // 25% of original volume
    const rate = 0.9 + (chargeProgress || 0) * 0.2;
    return this.playWeaponSound('bow_release', position, { volume, rate });
  }

  // Play enemy viper sting release sound
  public playEnemyViperStingReleaseSound(position: Vector3) {
    return this.playWeaponSound('bow_viper_sting_release', position, { volume: 0.25 }); // 0.9 * 0.25
  }

  // Play enemy sabres swing sound
  public playEnemySabresSwingSound(position: Vector3) {
    return this.playWeaponSound('sabres_swing', position, { volume: 0.35 }); // 0.8 * 0.25
  }

  // Play enemy sabres flourish sound
  public playEnemySabresFlourishSound(position: Vector3) {
    return this.playWeaponSound('sabres_flourish', position, { volume: 0.45 }); // 0.9 * 0.25
  }

  // Play enemy sabres shadow step sound
  public playEnemySabresShadowStepSound(position: Vector3) {
    return this.playWeaponSound('sabres_shadow_step', position, { volume: 0.65 }); // 0.8 * 0.5
  }

  // Play enemy sabres skyfall sound
  public playEnemySabresSkyfallSound(position: Vector3) {
    return this.playWeaponSound('sabres_skyfall', position, { volume: 0.5 }); // 1.0 * 0.5
  }

  // Play enemy entropic bolt sound
  public playEnemyEntropicBoltSound(position: Vector3) {
    return this.playWeaponSound('entropic_bolt', position, { volume: 0.3 }); // 0.8 * 0.25
  }

  // Play enemy crossentropy sound
  public playEnemyCrossentropySound(position: Vector3) {
    return this.playWeaponSound('crossentropy', position, { volume: 0.3 }); // 0.9 * 0.25
  }

  // Play enemy sword swing sounds
  public playEnemySwordSwingSound(comboStep: 1 | 2 | 3, position: Vector3) {
    const soundId = `sword_swing_${comboStep}`;
    return this.playWeaponSound(soundId, position, { volume: 0.35 }); // 0.8 * 0.25
  }

  // Play enemy sword deflect sound
  public playEnemySwordDeflectSound(position: Vector3) {
    return this.playWeaponSound('sword_deflect', position, { volume: 0.75 }); // 0.9 * 0.5
  }

  // Play enemy sword charge sound
  public playEnemySwordChargeSound(position: Vector3) {
    return this.playWeaponSound('sword_charge', position, { volume: 0.35 }); // 0.9 * 0.25
  }

  // Play enemy windshear sound
  public playEnemyWindshearSound(position: Vector3) {
    return this.playWeaponSound('windshear', position, { volume: 0.35 }); // 0.9 * 0.5
  }

  // Play enemy colossus strike sound
  public playEnemyColossusStrikeSound(position: Vector3) {
    return this.playWeaponSound('colossus_strike', position, { volume: 0.65 }); // 1.0 * 0.5
  }

  // Play enemy frost nova sound
  public playEnemyFrostNovaSound(position: Vector3) {
    return this.playWeaponSound('frost_nova', position, { volume: 0.65 }); // 0.9 * 0.5
  }

  // Play enemy backstab sound
  public playEnemyBackstabSound(position: Vector3) {
    return this.playWeaponSound('sabres_backstab', position, { volume: 0.45 }); // 0.8 * 0.5
  }

  // Play enemy runeblade sounds
  public playEnemyRunebladeHeartrendSound(position: Vector3) {
    return this.playWeaponSound('runeblade_heartrend', position, { volume: 0.4 }); // Assuming 0.8 base volume
  }

  public playEnemyRunebladeSmiteSound(position: Vector3) {
    return this.playWeaponSound('runeblade_smite', position, { volume: 0.6 }); // Assuming 0.9 base volume
  }

  public playEnemyRunebladeWraithbladeSound(position: Vector3) {
    return this.playWeaponSound('runeblade_wraithblade', position, { volume: 0.4 }); // Assuming 0.8 base volume
  }

  public playEnemyRunebladeVoidGraspSound(position: Vector3) {
    return this.playWeaponSound('runeblade_void_grasp', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  // Play enemy scythe sounds
  public playEnemyScytheMantraSound(position: Vector3) {
    return this.playWeaponSound('scythe_mantra', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  public playEnemyScytheSunwellSound(position: Vector3) {
    return this.playWeaponSound('scythe_sunwell', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  public playEnemyScytheCryoflameSound(position: Vector3) {
    return this.playWeaponSound('scythe_cryoflame', position, { volume: 0.45 }); // Assuming 0.9 base volume
  }

  // Stop a specific sound instance
  public stopSound(soundId: string, soundInstance?: number) {
    const sound = this.soundCache.get(soundId);
    if (sound) {
      if (soundInstance !== undefined) {
        sound.stop(soundInstance);
      } else {
        sound.stop();
      }
    }
  }

  // Set master volume (0.0 to 1.0)
  public setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.masterVolume);
  }

  // Set SFX volume (0.0 to 1.0)
  public setSFXVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    // Update all cached sounds
    this.soundCache.forEach(sound => {
      sound.volume(volume * this.masterVolume);
    });
  }

  // Get current volumes
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public getSFXVolume(): number {
    return this.sfxVolume;
  }

  // Mute/unmute all audio
  public setMuted(muted: boolean) {
    Howler.mute(muted);
  }

  public isMuted(): boolean {
    return Howler.volume() === 0;
  }

  // Play runeblade heartrend sound (Corrupted Aura toggle)
  public playRunebladeHeartrendSound(position: Vector3) {
    return this.playWeaponSound('runeblade_heartrend', position, { volume: 0.8 });
  }

  // Play runeblade smite sound
  public playRunebladeSmiteSound(position: Vector3) {
    return this.playWeaponSound('runeblade_smite', position, { volume: 0.9 });
  }

  // Play runeblade wraithblade sound
  public playRunebladeWraithbladeSound(position: Vector3) {
    return this.playWeaponSound('runeblade_wraithblade', position, { volume: 0.9 });
  }

  // Play runeblade void grasp sound (death grasp Q ability)
  public playRunebladeVoidGraspSound(position: Vector3) {
    return this.playWeaponSound('runeblade_void_grasp', position, { volume: 0.9 });
  }

  // Play scythe mantra sound (totem summon)
  public playScytheMantraSound(position: Vector3) {
    return this.playWeaponSound('scythe_mantra', position, { volume: 0.8 });
  }

  // Play scythe sunwell sound (reanimate ability)
  public playScytheSunwellSound(position: Vector3) {
    return this.playWeaponSound('scythe_sunwell', position, { volume: 0.8 });
  }

  // Play scythe cryoflame sound (entropic bolt with passive)
  public playScytheCryoflameSound(position: Vector3) {
    return this.playWeaponSound('scythe_cryoflame', position, { volume: 0.8 });
  }

  // Play UI selection sound
  public playUISelectionSound() {
    return this.playWeaponSound('ui_selection', new Vector3(0, 0, 0), { volume: 0.7 });
  }

  // Play UI interface sound (for navigation buttons)
  public playUIInterfaceSound() {
    return this.playWeaponSound('ui_interface', new Vector3(0, 0, 0), { volume: 0.7 });
  }

  // Play UI dash sound (when dashing)
  public playUIDashSound() {
    return this.playWeaponSound('ui_dash', new Vector3(0, 0, 0), { volume: 0.8 });
  }

  // Play hit box sound (when any weapon deals damage to enemy players/summoned units/pillars)
  public playHitBoxSound(position: Vector3) {
    return this.playWeaponSound('hit_box', position, { volume: 0.7 });
  }

  // Play random lightning strike sound (when lightning hits the map)
  public playLightningStrikeSound(position: Vector3) {
    const lightningSounds = ['lightning_1', 'lightning_2', 'lightning_3', 'lightning_4'];
    const randomSoundId = lightningSounds[Math.floor(Math.random() * lightningSounds.length)];
    return this.playWeaponSound(randomSoundId, position, { volume: 0.5 }); // Half volume as requested
  }

  // Play inhibitor destroyed sound (when a pillar/inhibitor is destroyed)
  public playInhibitorDestroyedSound() {
    return this.playWeaponSound('inhibitor_destroyed', new Vector3(0, 0, 0), { volume: 0.8 });
  }

  // Play minion death sound (when a summoned unit dies)
  public playMinionDeathSound() {
    return this.playWeaponSound('minion_death', new Vector3(0, 0, 0), { volume: 0.575 });
  }

  // Background music controls (local only, 50% volume)
  private backgroundMusicInstance: number | null = null;
  private backgroundAudioElement: HTMLAudioElement | null = null; // For streaming fallback

  public startBackgroundMusic() {
    if (this.backgroundMusicInstance !== null) {
      return; // Already playing
    }

    const bgMusic = this.soundCache.get('background_music');
    if (bgMusic) {
      // Set volume to 40% (0.4) and play - slightly reduced
      bgMusic.volume(0.35 * this.sfxVolume * this.masterVolume);
      this.backgroundMusicInstance = bgMusic.play();
      console.log('🎵 Started background music');
    }
  }

  public stopBackgroundMusic() {
    // Stop Howl-based playback
    const bgMusic = this.soundCache.get('background_music');
    if (bgMusic && this.backgroundMusicInstance !== null) {
      bgMusic.stop(this.backgroundMusicInstance);
      this.backgroundMusicInstance = null;
    }

    // Also stop streaming playback if active
    this.stopBackgroundMusicStreaming();

    console.log('🎵 Stopped background music');
  }

  // Clean up resources
  public dispose() {
    // Stop and clean up background music
    this.stopBackgroundMusic();

    // Clean up sound cache
    this.soundCache.forEach(sound => {
      sound.unload();
    });
    this.soundCache.clear();
  }

  // ECS System update method
  public update(entities: any[], deltaTime: number): void {
    // Audio system doesn't need to update entities directly
    // Could be used for spatial audio updates if needed
  }
}
