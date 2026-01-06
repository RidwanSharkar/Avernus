import React from 'react';
import { useBowPowershot } from './useBowPowershot';
import BowPowershot from './BowPowershot';

export default function BowPowershotManager() {
  const { activeEffects, removeEffect } = useBowPowershot();

  return (
    <>
      {activeEffects.map((effect) => (
        <BowPowershot
          key={effect.id}
          position={effect.position}
          direction={effect.direction}
          subclass={effect.subclass}
          isElementalShotsUnlocked={effect.isElementalShotsUnlocked}
          isPerfectShot={effect.isPerfectShot}
          chargeProgress={effect.chargeProgress}
          onComplete={() => removeEffect(effect.id)}
        />
      ))}
    </>
  );
}
