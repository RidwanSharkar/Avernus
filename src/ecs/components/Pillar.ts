// Pillar component for PVP player-owned defensive pillars
import { Component } from '../Entity';

export class Pillar extends Component {
  public static readonly componentType = 'Pillar';
  public readonly componentType = 'Pillar';

  // Pillar ownership and identification
  public ownerId: string; // Player ID who owns this pillar
  public pillarIndex: number; // Pillar index (0 or 1 for each player)

  // State
  public isActive: boolean;
  public isDead: boolean;
  public deathTime: number;
  public isCorrupted: boolean; // Whether the pillar has corrupted aura effect
  public corruptedStartTime: number; // When corruption started

  constructor(
    ownerId: string = '',
    pillarIndex: number = 0
  ) {
    super();

    this.ownerId = ownerId;
    this.pillarIndex = pillarIndex;

    // State
    this.isActive = true;
    this.isDead = false;
    this.deathTime = 0;
    this.isCorrupted = false;
    this.corruptedStartTime = 0;
  }

  public die(currentTime: number): void {
    this.isDead = true;
    this.isActive = false;
    this.deathTime = currentTime;
  }

  public getDisplayName(): string {
    return `Pillar ${this.pillarIndex + 1} (Owner: ${this.ownerId})`;
  }

  public reset(): void {
    this.ownerId = '';
    this.pillarIndex = 0;
    this.isActive = true;
    this.isDead = false;
    this.deathTime = 0;
    this.isCorrupted = false;
    this.corruptedStartTime = 0;
    this.enabled = true;
  }

  public clone(): Pillar {
    const clone = new Pillar(this.ownerId, this.pillarIndex);
    clone.isActive = this.isActive;
    clone.isDead = this.isDead;
    clone.deathTime = this.deathTime;
    clone.isCorrupted = this.isCorrupted;
    clone.corruptedStartTime = this.corruptedStartTime;
    return clone;
  }
}
