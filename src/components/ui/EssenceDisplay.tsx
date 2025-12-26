'use client';

import React from 'react';

interface EssenceDisplayProps {
  essence: number;
  playerId?: string;
  isLocalPlayer?: boolean;
}

export default function EssenceDisplay({ essence, playerId, isLocalPlayer = false }: EssenceDisplayProps) {
  return (
    <div className="fixed bottom-16 right-4 z-40">
      <div className="bg-black bg-opacity-70 backdrop-blur-sm rounded-lg p-1 border border-purple-600">
        <div className="flex items-center space-x-0.5">
          {/* Essence icon/symbol */}
          <div className="text-purple-400 text-lg"> </div>

          {/* Essence amount */}
          <div className={`text-sm font-bold ${isLocalPlayer ? 'text-purple-400' : 'text-purple-300'}`}>
            {essence}
          </div>

          {/* Essence label */}
          <div className="text-xs text-gray-400">
            Essence
          </div>
        </div>
      </div>
    </div>
  );
}
