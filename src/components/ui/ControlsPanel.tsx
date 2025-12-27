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
    { key: 'WASD', description: 'Double Tap to Dash', icon: '⌨️' },
    { key: 'Right Click (Hold)', description: 'Camera', icon: '🖱️' },
    { key: 'Left Click (Hold)', description: 'Attack', icon: '⚔️' },
    { key: 'Spacebar', description: 'Jump', icon: '⌨️' }
  ];

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .control-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .control-item:hover {
          transform: translateX(4px);
          background: rgba(99,102,241,0.1);
        }
      `}</style>

      <div 
        className={`${className}`}
        style={{
          transform: 'scale(0.75)',
          transformOrigin: 'top left'
        }}
      >
        <div 
          className="relative min-w-[280px] bottom-1 rounded-2xl overflow-hidden cursor-pointer select-none"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,25,0.65) 0%, rgba(10,10,20,0.90) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.05),
              0 4px 30px rgba(0,0,0,0.5),
              0 0 60px rgba(99,102,241,0.1),
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Decorative corner accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-lg pointer-events-none" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-500/30 rounded-tr-lg pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-500/30 rounded-bl-lg pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-500/30 rounded-br-lg pointer-events-none" />

          {/* Header */}
          <div 
            className="px-4 py-2 flex items-center justify-between"
            style={{
              borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.08)' : 'none'
            }}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  boxShadow: '0 0 15px rgba(99,102,241,0.15)'
                }}
              >
                <span className="text-lg">🎮</span>
              </div>
              <div>
                <h3 
                  className="text-sm font-bold tracking-wide uppercase"
                  style={{
                    background: 'linear-gradient(90deg, #818cf8 0%, #a78bfa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Controls
                </h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Quick Reference</p>
              </div>
            </div>

            {/* Expand/Collapse Button */}
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, rgba(30,30,45,0.95) 0%, rgba(20,20,30,0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              <span 
                className="text-gray-400 text-xs transition-transform"
                style={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block'
                }}
              >
                ▼
              </span>
            </div>
          </div>

          {/* Controls List */}
          {isExpanded && (
            <div 
              className="px-3 py-3 space-y-1.5"
              style={{
                animation: 'slideDown 0.3s ease-out'
              }}
            >
              {controls.map((control, index) => (
                <div
                  key={control.key}
                  className="control-item px-3 py-2 rounded-lg flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(90deg, rgba(30,30,45,0.4) 0%, rgba(20,20,35,0.3) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    animation: `fadeIn 0.2s ease-out ${index * 0.05}s both`
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{control.icon}</span>
                    <span 
                      className="text-xs font-bold tracking-wide"
                      style={{
                        color: '#a5b4fc',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                      }}
                    >
                      {control.key}
                    </span>
                  </div>
                  <span 
                    className="text-xs font-medium"
                    style={{
                      color: '#9ca3af'
                    }}
                  >
                    {control.description}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom glow effect when expanded */}
          {isExpanded && (
            <div 
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-[2px] rounded-full pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)',
                animation: 'fadeIn 0.3s ease-out'
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

