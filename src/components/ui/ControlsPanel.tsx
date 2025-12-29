import React, { useState, useEffect } from 'react';

interface ControlsPanelProps {
  className?: string;
}

export default function ControlsPanel({ className = '' }: ControlsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-minimize after 10 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isExpanded) {
      timer = setTimeout(() => {
        setIsExpanded(false);
      }, 10000); // 10 seconds
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isExpanded]);

  const controls = [
    { key: 'WASD', description: 'Movement', icon: '⌨️' },
    { key: 'Double Tap WASD', description: 'Dash', icon: '⌨️' },
    { key: 'Right Click (Hold)', description: 'Rotate', icon: '🖱️' },
    { key: 'Left Click (Hold)', description: 'Attack', icon: '⚔️' },
    { key: 'Scoll Wheel', description: 'Zoom Camera', icon: '🖱️' },
    { key: 'Space Bar', description: 'Jump', icon: '⌨️' }
  ];

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        .control-item {
          transition: all 0.2s ease-out;
        }
        .control-item:hover {
          background: rgba(99,102,241,0.1);
        }
      `}</style>

      <div className={`${className}`}>
        <div
          className={`relative bottom-1 right-1 rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-300 ease-out ${
            isExpanded ? 'min-w-[270px]' : 'w-12'
          }`}
          style={{
            background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Header */}
          <div className={`flex items-center justify-center px-3 py-2.5 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
            {isExpanded ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 flex items-center justify-center">
                    <span className="text-lg">🎮</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wide">Controls</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Quick Reference</p>
                  </div>
                </div>

                {/* Expand/Collapse Button */}
                <div className="w-7 h-6 rounded-lg bg-black/40 border border-white/20 flex items-center justify-center">
                  <span
                    className="text-gray-400 text-xs transition-transform duration-200"
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}
                  >
                    ▼
                  </span>
                </div>
              </>
            ) : (
              <div className="w-7 h-6 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 flex items-center justify-center">
                <span className="text-sm">🎮</span>
              </div>
            )}
          </div>

          {/* Controls List */}
          {isExpanded && (
            <div className="px-3 pb-3 space-y-1.5 animate-in slide-in-from-top-2 duration-300">
              {controls.map((control, index) => (
                <div
                  key={control.key}
                  className="px-3 py-2 rounded-lg bg-black/10 border border-white/5 hover:bg-indigo-500/10 transition-all duration-200 flex items-center justify-between group"
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{control.icon}</span>
                    <span className="text-xs font-bold text-indigo-300 tracking-wide">
                      {control.key}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {control.description}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

