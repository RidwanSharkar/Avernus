// Centralized input handling system
import { EventEmitter } from '@/utils/EventEmitter';

export interface InputEvents {
  keyDown: { key: string; code: string };
  keyUp: { key: string; code: string };
  mouseDown: { button: number; x: number; y: number };
  mouseUp: { button: number; x: number; y: number };
  mouseMove: { x: number; y: number; deltaX: number; deltaY: number };
  wheel: { deltaX: number; deltaY: number; deltaZ: number };
}

export interface InputState {
  keys: Set<string>;
  mouse: {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    buttons: Set<number>;
  };
}

export class InputManager extends EventEmitter {
  private keys = new Set<string>();
  private mouseButtons = new Set<number>();
  private mousePosition = { x: 0, y: 0 };
  private mouseDelta = { x: 0, y: 0 };
  private previousMousePosition = { x: 0, y: 0 };
  private isPointerLocked = false;
  private canvas: HTMLCanvasElement | null = null;

  // Flag to allow all keyboard input (used for chat)
  private allowAllInput = false;

  // Double-tap detection for dash system
  private keyTimings = new Map<string, { 
    firstPressTime: number;
    firstReleaseTime: number;
    secondPressTime: number;
    isInDoubleTapSequence: boolean;
    hasValidFirstTap: boolean;
  }>();
  private readonly DOUBLE_TAP_THRESHOLD = 200; // 200ms window for double-tap (reduced from 250ms)

  constructor() {
    super();
    this.setupEventListeners();
  }

  public initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    
    // Add canvas-specific event listeners to ensure we capture events
    // that might be handled by React Three Fiber
    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Don't automatically request pointer lock - let systems handle this
    // canvas.addEventListener('click', () => {
    //   if (!this.isPointerLocked) {
    //     this.requestPointerLock();
    //   }
    // });
  }

  public requestPointerLock(): void {
    if (this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  public exitPointerLock(): void {
    document.exitPointerLock();
  }

  public isKeyPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  public isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  public getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }

  public getMouseDelta(): { x: number; y: number } {
    return { ...this.mouseDelta };
  }

  public getInputState(): InputState {
    return {
      keys: new Set(this.keys),
      mouse: {
        x: this.mousePosition.x,
        y: this.mousePosition.y,
        deltaX: this.mouseDelta.x,
        deltaY: this.mouseDelta.y,
        buttons: new Set(this.mouseButtons),
      },
    };
  }

  public setAllowAllInput(allow: boolean): void {
    this.allowAllInput = allow;
  }

  public checkDoubleTap(key: string): boolean {
    const keyLower = key.toLowerCase();
    const timing = this.keyTimings.get(keyLower);
    
    if (!timing) return false;

    const now = Date.now();
    
    // Only return true if we have a valid double-tap sequence:
    // 1. We have a valid first tap (press + release)
    // 2. We're currently in a double-tap sequence
    // 3. The second press happened within the threshold after the first release
    if (timing.hasValidFirstTap && 
        timing.isInDoubleTapSequence && 
        timing.secondPressTime > 0) {
      
      const timeBetweenTaps = timing.secondPressTime - timing.firstReleaseTime;
      return timeBetweenTaps <= this.DOUBLE_TAP_THRESHOLD;
    }
    
    return false;
  }

  public resetDoubleTap(key: string): void {
    const keyLower = key.toLowerCase();
    const timing = this.keyTimings.get(keyLower);
    if (timing) {
      timing.firstPressTime = 0;
      timing.firstReleaseTime = 0;
      timing.secondPressTime = 0;
      timing.isInDoubleTapSequence = false;
      timing.hasValidFirstTap = false;
    }
  }

  public update(): void {
    // Reset mouse delta each frame
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    
    // Clean up old timing entries to prevent memory leaks
    this.cleanupOldTimings();
  }
  
  private cleanupOldTimings(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 5000; // 5 seconds
    const keysToDelete: string[] = [];
    
    // Use forEach instead of for...of to avoid ES2015 iteration issues
    this.keyTimings.forEach((timing, key) => {
      // Remove entries that haven't been used in a while
      const lastActivity = Math.max(
        timing.firstPressTime, 
        timing.firstReleaseTime, 
        timing.secondPressTime
      );
      
      if (lastActivity > 0 && now - lastActivity > CLEANUP_THRESHOLD) {
        keysToDelete.push(key);
      }
    });
    
    // Delete the keys after iteration to avoid modifying map during iteration
    keysToDelete.forEach(key => this.keyTimings.delete(key));
  }
  
  // Debug method to help track double tap detection
  public getDoubleTapDebugInfo(key: string): any {
    const keyLower = key.toLowerCase();
    const timing = this.keyTimings.get(keyLower);
    
    if (!timing) return null;
    
    const now = Date.now();
    return {
      key: keyLower,
      firstPressTime: timing.firstPressTime,
      firstReleaseTime: timing.firstReleaseTime,
      secondPressTime: timing.secondPressTime,
      hasValidFirstTap: timing.hasValidFirstTap,
      isInDoubleTapSequence: timing.isInDoubleTapSequence,
      timeSinceFirstPress: timing.firstPressTime > 0 ? now - timing.firstPressTime : 0,
      timeSinceFirstRelease: timing.firstReleaseTime > 0 ? now - timing.firstReleaseTime : 0,
      timeSinceSecondPress: timing.secondPressTime > 0 ? now - timing.secondPressTime : 0,
      threshold: this.DOUBLE_TAP_THRESHOLD
    };
  }

  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    // Mouse events
    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    // Pointer lock events
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this));

    // Prevent context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Handle window focus/blur to reset input state
    window.addEventListener('blur', this.onWindowBlur.bind(this));
    window.addEventListener('focus', this.onWindowFocus.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    
    if (!this.keys.has(key)) {
      this.keys.add(key);
      this.emit('keyDown', { key: event.key, code: event.code });

      // Track key timing for double-tap detection
      const now = Date.now();
      let timing = this.keyTimings.get(key);
      
      if (!timing) {
        timing = { 
          firstPressTime: 0, 
          firstReleaseTime: 0, 
          secondPressTime: 0,
          isInDoubleTapSequence: false,
          hasValidFirstTap: false
        };
        this.keyTimings.set(key, timing);
      }

      // Handle double-tap sequence logic
      if (!timing.hasValidFirstTap) {
        // This is the first press
        timing.firstPressTime = now;
        timing.isInDoubleTapSequence = false;
        timing.hasValidFirstTap = false; // Will be set to true on release
      } else if (timing.hasValidFirstTap && !timing.isInDoubleTapSequence) {
        // This could be the second press - check if it's within threshold
        const timeSinceFirstRelease = now - timing.firstReleaseTime;
        if (timeSinceFirstRelease <= this.DOUBLE_TAP_THRESHOLD) {
          // Valid second press
          timing.secondPressTime = now;
          timing.isInDoubleTapSequence = true;
        } else {
          // Too late for double-tap, treat as new first press
          timing.firstPressTime = now;
          timing.firstReleaseTime = 0;
          timing.secondPressTime = 0;
          timing.isInDoubleTapSequence = false;
          timing.hasValidFirstTap = false;
        }
      }
    }

    // Prevent default for game keys (unless all input is allowed, e.g., for chat)
    if (this.isGameKey(key) && !this.allowAllInput) {
      event.preventDefault();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    
    if (this.keys.has(key)) {
      this.keys.delete(key);
      this.emit('keyUp', { key: event.key, code: event.code });

      // Track key release timing for double-tap detection
      const timing = this.keyTimings.get(key);
      if (timing) {
        const now = Date.now();
        
        if (!timing.hasValidFirstTap && timing.firstPressTime > 0) {
          // This completes the first tap
          timing.firstReleaseTime = now;
          timing.hasValidFirstTap = true;
        } else if (timing.isInDoubleTapSequence) {
          // This completes the double-tap sequence
          // The double-tap detection should have already been triggered
          // Reset for next potential sequence
          setTimeout(() => {
            if (timing) {
              timing.firstPressTime = 0;
              timing.firstReleaseTime = 0;
              timing.secondPressTime = 0;
              timing.isInDoubleTapSequence = false;
              timing.hasValidFirstTap = false;
            }
          }, 100); // Small delay to allow dash system to process
        }
      }
    }
  }

  private onMouseDown(event: MouseEvent): void {
    this.mouseButtons.add(event.button);
    this.emit('mouseDown', {
      button: event.button,
      x: event.clientX,
      y: event.clientY,
    });
  }

  private onMouseUp(event: MouseEvent): void {
    this.mouseButtons.delete(event.button);
    this.emit('mouseUp', {
      button: event.button,
      x: event.clientX,
      y: event.clientY,
    });
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isPointerLocked) {
      // Use movement deltas when pointer is locked
      this.mouseDelta.x += event.movementX;
      this.mouseDelta.y += event.movementY;
    } else {
      // Use absolute position when not locked
      this.previousMousePosition.x = this.mousePosition.x;
      this.previousMousePosition.y = this.mousePosition.y;
      this.mousePosition.x = event.clientX;
      this.mousePosition.y = event.clientY;
      
      // Calculate delta from previous position
      const deltaX = this.mousePosition.x - this.previousMousePosition.x;
      const deltaY = this.mousePosition.y - this.previousMousePosition.y;
      
      // Accumulate delta for this frame
      this.mouseDelta.x += deltaX;
      this.mouseDelta.y += deltaY;
    }

    this.emit('mouseMove', {
      x: this.mousePosition.x,
      y: this.mousePosition.y,
      deltaX: this.mouseDelta.x,
      deltaY: this.mouseDelta.y,
    });
  }

  private onWheel(event: WheelEvent): void {
    this.emit('wheel', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
    });
    
    event.preventDefault();
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement !== null;
  }

  private onPointerLockError(): void {
    // console.warn('Pointer lock failed');
    this.isPointerLocked = false;
  }

  private onWindowBlur(): void {
    // Clear all input state when window loses focus
    this.keys.clear();
    this.mouseButtons.clear();
    this.keyTimings.clear();
  }

  private onWindowFocus(): void {
    // Reset mouse delta when window regains focus
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  private isGameKey(key: string): boolean {
    // Define which keys should have their default behavior prevented
    const gameKeys = ['w', 'a', 's', 'd', ' ', 'shift', 'tab', 'escape'];
    return gameKeys.includes(key);
  }

  public destroy(): void {
    // Remove document event listeners
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('mousedown', this.onMouseDown.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('wheel', this.onWheel.bind(this));
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.removeEventListener('pointerlockerror', this.onPointerLockError.bind(this));
    window.removeEventListener('blur', this.onWindowBlur.bind(this));
    window.removeEventListener('focus', this.onWindowFocus.bind(this));

    // Remove canvas event listeners if canvas exists
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.removeEventListener('wheel', this.onWheel.bind(this));
    }

    // Clear state
    this.keys.clear();
    this.mouseButtons.clear();
    this.keyTimings.clear();
    this.removeAllListeners();
  }
}
