/**
 * Entity Interpolation System for Smooth Multiplayer Movement
 *
 * This system implements client-side prediction and entity interpolation to provide
 * smooth movement in multiplayer games, eliminating jerky position updates from server snapshots.
 *
 * Features:
 * - Linear interpolation (LERP) between server states
 * - Extrapolation for missing server updates
 * - Configurable interpolation delay and buffer size
 * - Automatic fallback to direct updates if interpolation fails
 *
 * Usage:
 * 1. Add InterpolationBuffer component to entities that need smooth movement
 * 2. Add InterpolationSystem to your ECS World
 * 3. Call addServerState() whenever you receive server position updates
 * 4. The InterpolationSystem will automatically handle smooth position/rotation updates
 *
 * Debug: Use window.getInterpolationStats() in browser console to monitor performance
 */
import { Vector3, Quaternion } from '@/utils/three-exports';
import { Component } from '../Entity';

export interface ServerState {
  timestamp: number;
  position: Vector3;
  rotation: Quaternion;
  velocity?: Vector3;
  angularVelocity?: Vector3;
}

export class InterpolationBuffer extends Component {
  public static readonly componentType = 'InterpolationBuffer';
  public readonly componentType = 'InterpolationBuffer';

  // Buffer to store recent server states
  private buffer: ServerState[] = [];
  private readonly maxBufferSize = 6; // Reduced from 10 - keep last 6 states for interpolation
  private readonly interpolationDelay = 75; // Reduced from 100ms - 75ms delay for interpolation (~4-5 frames at 60fps)

  // Current interpolation state
  private currentState: ServerState | null = null;
  private targetState: ServerState | null = null;
  private interpolationStartTime = 0;
  private interpolationDuration = 0;

  // Extrapolation settings
  private lastVelocity: Vector3 = new Vector3();
  private lastAngularVelocity: Vector3 = new Vector3();
  private extrapolationStartTime = 0;
  private maxExtrapolationTime = 200; // Reduced from 500ms - max time to extrapolate before snapping

  constructor() {
    super();
  }

  /**
   * Add a new server state to the interpolation buffer
   */
  public addServerState(position: Vector3, rotation: Quaternion, timestamp?: number): void {
    const serverTimestamp = timestamp || Date.now();

    const newState: ServerState = {
      timestamp: serverTimestamp,
      position: position.clone(),
      rotation: rotation.clone()
    };

    // Calculate velocity if we have a previous state
    if (this.buffer.length > 0) {
      const lastState = this.buffer[this.buffer.length - 1];
      const timeDiff = (serverTimestamp - lastState.timestamp) / 1000; // Convert to seconds

      if (timeDiff > 0) {
        newState.velocity = position.clone().sub(lastState.position).divideScalar(timeDiff);

        // Calculate angular velocity (simplified - could be improved)
        const angleDiff = rotation.angleTo(lastState.rotation);
        newState.angularVelocity = new Vector3(0, angleDiff / timeDiff, 0);
      }
    }

    // Add to buffer
    this.buffer.push(newState);

    // Remove old states to maintain buffer size
    while (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Clean up very old states (older than 1 second) to prevent memory buildup
    const oneSecondAgo = serverTimestamp - 1000;
    const oldStateIndex = this.buffer.findIndex(state => state.timestamp < oneSecondAgo);
    if (oldStateIndex > 0) { // Keep at least one old state for interpolation
      this.buffer.splice(0, oldStateIndex);
    }

    // Update interpolation state
    this.updateInterpolationState(serverTimestamp);
  }

  /**
   * Update the current interpolation state
   */
  private updateInterpolationState(currentTime: number): void {
    if (this.buffer.length < 2) {
      // Not enough states for interpolation
      if (this.buffer.length === 1) {
        this.currentState = { ...this.buffer[0] };
      }
      return;
    }

    // Find the two states to interpolate between
    const renderTime = currentTime - this.interpolationDelay;
    let beforeState: ServerState | null = null;
    let afterState: ServerState | null = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime && this.buffer[i + 1].timestamp >= renderTime) {
        beforeState = this.buffer[i];
        afterState = this.buffer[i + 1];
        break;
      }
    }

    if (beforeState && afterState) {
      // We have states to interpolate between
      this.currentState = beforeState;
      this.targetState = afterState;
      this.interpolationStartTime = currentTime;
      this.interpolationDuration = afterState.timestamp - beforeState.timestamp;
      this.extrapolationStartTime = 0; // Reset extrapolation
    } else if (this.buffer.length > 0) {
      // No states to interpolate - use extrapolation
      const latestState = this.buffer[this.buffer.length - 1];
      if (latestState.velocity) {
        this.lastVelocity.copy(latestState.velocity);
        this.extrapolationStartTime = currentTime;
      }
    }
  }

  /**
   * Get the interpolated position at the current render time
   */
  public getInterpolatedPosition(currentTime: number): Vector3 {
    if (!this.currentState || !this.targetState) {
      // No interpolation available - use latest state or extrapolation
      if (this.buffer.length > 0) {
        const latestState = this.buffer[this.buffer.length - 1];

        if (this.extrapolationStartTime > 0 && latestState.velocity) {
          const extrapolationTime = (currentTime - this.extrapolationStartTime) / 1000;
          const maxTime = this.maxExtrapolationTime / 1000;

          if (extrapolationTime < maxTime) {
            // Extrapolate position
            return latestState.position.clone().add(
              latestState.velocity.clone().multiplyScalar(extrapolationTime)
            );
          }
        }

        return latestState.position.clone();
      }
      return new Vector3(0, 0, 0);
    }

    // Calculate interpolation factor
    const elapsed = currentTime - this.interpolationStartTime;
    let t = elapsed / this.interpolationDuration;

    // Clamp t between 0 and 1
    t = Math.max(0, Math.min(1, t));

    // Linear interpolation between current and target states
    const interpolatedPosition = new Vector3();
    interpolatedPosition.lerpVectors(this.currentState.position, this.targetState.position, t);

    return interpolatedPosition;
  }

  /**
   * Get the interpolated rotation at the current render time
   */
  public getInterpolatedRotation(currentTime: number): Quaternion {
    if (!this.currentState || !this.targetState) {
      // No interpolation available - use latest state
      if (this.buffer.length > 0) {
        return this.buffer[this.buffer.length - 1].rotation.clone();
      }
      return new Quaternion();
    }

    // Calculate interpolation factor
    const elapsed = currentTime - this.interpolationStartTime;
    let t = elapsed / this.interpolationDuration;
    t = Math.max(0, Math.min(1, t));

    // Spherical linear interpolation for rotations
    const interpolatedRotation = new Quaternion();
    interpolatedRotation.copy(this.currentState.rotation);
    interpolatedRotation.slerp(this.targetState.rotation, t);

    return interpolatedRotation;
  }

  /**
   * Get the interpolated transform (position and rotation) at the current render time
   */
  public getInterpolatedTransform(currentTime: number): { position: Vector3; rotation: Quaternion } {
    return {
      position: this.getInterpolatedPosition(currentTime),
      rotation: this.getInterpolatedRotation(currentTime)
    };
  }

  /**
   * Check if we're currently extrapolating (no recent server updates)
   */
  public isExtrapolating(currentTime: number): boolean {
    return this.extrapolationStartTime > 0 &&
           (currentTime - this.extrapolationStartTime) < this.maxExtrapolationTime;
  }

  /**
   * Get buffer statistics for debugging
   */
  public getBufferStats() {
    return {
      bufferSize: this.buffer.length,
      maxBufferSize: this.maxBufferSize,
      interpolationDelay: this.interpolationDelay,
      isInterpolating: this.currentState !== null && this.targetState !== null,
      isExtrapolating: this.extrapolationStartTime > 0,
      latestTimestamp: this.buffer.length > 0 ? this.buffer[this.buffer.length - 1].timestamp : null
    };
  }

  /**
   * Clear the interpolation buffer
   */
  public clearBuffer(): void {
    this.buffer.length = 0;
    this.currentState = null;
    this.targetState = null;
    this.interpolationStartTime = 0;
    this.extrapolationStartTime = 0;
  }

  public reset(): void {
    this.clearBuffer();
    this.lastVelocity.set(0, 0, 0);
    this.lastAngularVelocity.set(0, 0, 0);
    this.enabled = true;
  }
}
