import * as React from 'react';

interface MerchantItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  currency: 'essence';
}

interface MerchantUIProps {
  isVisible: boolean;
  onClose?: () => void;
  onPurchase?: (itemId: string) => void;
}

const MERCHANT_ITEMS: MerchantItem[] = [
  {
    id: 'critical_damage_rune',
    name: 'Critical Strike Damage Rune',
    description: 'Permanently increases your critical strike damage by 15%',
    cost: 45,
    currency: 'essence'
  },
  {
    id: 'critical_chance_rune',
    name: 'Critical Strike Chance Rune',
    description: 'Permanently increases your weapon critical strike chance by 3%',
    cost: 35,
    currency: 'essence'
  },
  {
    id: 'ascendant_wings',
    name: 'Ascendant Wings',
    description: 'Angelic wings that replace your dragon wings with a celestial appearance',
    cost: 50,
    currency: 'essence'
  }
];

export default function MerchantUI({ isVisible, onClose, onPurchase }: MerchantUIProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-gray-600 rounded-lg p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Merchant</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Items Grid */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {MERCHANT_ITEMS.map((item) => (
            <div
              key={item.id}
              className="bg-gray-800 border border-gray-600 rounded-lg p-4 hover:bg-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                <div className="text-right">
                  <div className="font-bold text-purple-400">
                    {item.cost} ✨
                  </div>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-3">{item.description}</p>

              <button
                onClick={() => onPurchase?.(item.id)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Purchase
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-400 text-sm">
          Items and purchasing system coming soon!
        </div>
      </div>
    </div>
  );
}
