import React, { useEffect, useState } from 'react';

interface VictoryNotificationProps {
  winner: 'Red' | 'Blue' | null;
  onAnimationComplete?: () => void;
}

const VictoryNotification: React.FC<VictoryNotificationProps> = ({
  winner,
  onAnimationComplete
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (winner) {
      setShow(true);
      // Hide after animation completes (5 seconds)
      const timer = setTimeout(() => {
        setShow(false);
        onAnimationComplete?.();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [winner, onAnimationComplete]);

  if (!show || !winner) return null;

  const bgColor = winner === 'Red' ? 'from-red-600 to-red-800' : 'from-blue-600 to-blue-800';
  const textColor = winner === 'Red' ? 'text-red-100' : 'text-blue-100';
  const borderColor = winner === 'Red' ? 'border-red-400' : 'border-blue-400';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Victory notification */}
      <div className="relative animate-bounce-in">
        <div
          className={`
            relative px-12 py-8 rounded-2xl border-2
            bg-gradient-to-br ${bgColor}
            ${borderColor}
            shadow-2xl
            transform scale-100
            transition-all duration-500 ease-out
          `}
          style={{
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.1),
              0 8px 32px rgba(0,0,0,0.6),
              0 0 80px ${winner === 'Red' ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)'},
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
            animation: 'victory-bounce 2s ease-in-out infinite'
          }}
        >
          {/* Decorative particles */}
          <div className="absolute -inset-4 rounded-2xl opacity-30">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-white rounded-full animate-ping"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>

          {/* Main text */}
          <div className="relative z-10 text-center">
            <h1
              className={`
                text-6xl font-bold tracking-wider uppercase
                ${textColor}
                drop-shadow-2xl
              `}
              style={{
                textShadow: `
                  0 2px 4px rgba(0,0,0,0.8),
                  0 0 20px ${winner === 'Red' ? 'rgba(239,68,68,0.8)' : 'rgba(59,130,246,0.8)'},
                  0 0 40px ${winner === 'Red' ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)'}
                `,
                fontFamily: 'serif'
              }}
            >
              {winner} Wins!
            </h1>

            {/* Subtitle */}
            <p className="mt-4 text-xl opacity-90 font-medium">
              Victory Achieved
            </p>
          </div>

          {/* Trophy icon effect */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <div className="text-4xl animate-pulse">🏆</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes victory-bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(50px);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            transform: translateY(0);
          }
        }

        .animate-bounce-in {
          animation: bounce-in 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>
    </div>
  );
};

export default VictoryNotification;
