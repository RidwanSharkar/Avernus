// Merchant system for handling player interactions with the merchant
import { Vector3 } from '@/utils/three-exports';

export interface MerchantState {
  position: Vector3;
  rotation: [number, number, number];
  isPlayerNearby: boolean;
  isPlayerInVisibilityRange: boolean;
  lastInteractionTime: number;
}

export class MerchantSystem {
  private merchantPosition: Vector3;
  private merchantRotation: [number, number, number] = [0, -Math.PI / 2, 0]; // Start at 90 degrees clockwise
  private defaultRotation: [number, number, number] = [0, Math.PI / 2, 0]; // 90 degrees clockwise
  private interactionRange: number = 2.0;
  private visibilityRange: number = 5.0; // Render merchant when player is within 5 units
  private isPlayerNearby: boolean = false; // For interaction (2.0 units)
  private isPlayerInVisibilityRange: boolean = false; // For rendering (5.0 units)
  private lastInteractionTime: number = 0;
  private lastActiveTime: number = 0;
  private rotationSpeed: number = Math.PI; // 90 degrees per interaction
  private returnToDefaultDelay: number = 3000; // 3 seconds
  private isReturningToDefault: boolean = false;

  constructor(merchantPosition: Vector3) {
    this.merchantPosition = merchantPosition.clone();
  }

  public update(deltaTime: number, playerPosition?: Vector3): void {
    const currentTime = Date.now();

    if (playerPosition) {
      const distance = playerPosition.distanceTo(this.merchantPosition);
      const wasNearby = this.isPlayerNearby;
      this.isPlayerNearby = distance <= this.interactionRange;
      this.isPlayerInVisibilityRange = distance <= this.visibilityRange;

      // Rotate towards player when they get nearby
      if (this.isPlayerNearby) {
        // Update last active time when player is nearby
        this.lastActiveTime = currentTime;
        this.isReturningToDefault = false;

        // Calculate direction from merchant to player
        const direction = new Vector3()
          .subVectors(playerPosition, this.merchantPosition)
          .normalize();

        // Calculate rotation angle to face the player
        const angle = Math.atan2(direction.x, direction.z);

        // Smoothly rotate towards the player
        const currentRotation = this.merchantRotation[1];
        const angleDifference = angle - currentRotation;

        // Normalize angle difference to [-PI, PI]
        let normalizedDiff = angleDifference;
        while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
        while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;

        // Smooth rotation with some damping
        const rotationSpeed = 2.0; // radians per second
        const maxRotationStep = rotationSpeed * deltaTime;
        const rotationStep = Math.max(-maxRotationStep, Math.min(maxRotationStep, normalizedDiff));

        this.merchantRotation[1] += rotationStep;
      } else if (this.lastActiveTime > 0 && (currentTime - this.lastActiveTime) >= this.returnToDefaultDelay) {
        // Player has left and 3 seconds have passed, start returning to default
        this.isReturningToDefault = true;

        // Smoothly rotate back to default rotation
        const currentRotation = this.merchantRotation[1];
        const targetRotation = this.defaultRotation[1];
        const angleDifference = targetRotation - currentRotation;

        // Normalize angle difference to [-PI, PI]
        let normalizedDiff = angleDifference;
        while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
        while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;

        // Smooth rotation back to default
        const returnSpeed = 1.5; // radians per second (slower than towards player)
        const maxRotationStep = returnSpeed * deltaTime;
        const rotationStep = Math.max(-maxRotationStep, Math.min(maxRotationStep, normalizedDiff));

        this.merchantRotation[1] += rotationStep;

        // Check if we're close enough to default to stop returning
        if (Math.abs(normalizedDiff) < 0.01) {
          this.merchantRotation[1] = this.defaultRotation[1];
          this.isReturningToDefault = false;
          this.lastActiveTime = 0; // Reset timer
        }
      }
    } else {
      this.isPlayerNearby = false;
      this.isPlayerInVisibilityRange = false;
      // If no player position provided and we're not already returning, start the timer
      if (!this.isReturningToDefault && this.lastActiveTime === 0) {
        this.lastActiveTime = currentTime;
      }
    }
  }

  public interact(): void {
    // Rotate the merchant when interacted with
    this.merchantRotation[1] += this.rotationSpeed;
    this.lastInteractionTime = Date.now();
    this.lastActiveTime = Date.now(); // Reset the return-to-default timer
    this.isReturningToDefault = false; // Stop returning to default if active
  }

  public getMerchantState(): MerchantState {
    return {
      position: this.merchantPosition.clone(),
      rotation: [...this.merchantRotation],
      isPlayerNearby: this.isPlayerNearby,
      isPlayerInVisibilityRange: this.isPlayerInVisibilityRange,
      lastInteractionTime: this.lastInteractionTime
    };
  }

  public isPlayerInRange(playerPosition: Vector3): boolean {
    return playerPosition.distanceTo(this.merchantPosition) <= this.interactionRange;
  }
}
