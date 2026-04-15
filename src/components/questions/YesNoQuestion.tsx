'use client';

import { useState, useEffect } from 'react';

interface YesNoQuestionProps {
  title: string;
  description?: string | null;
  onAnswer: (value: 'yes' | 'no') => void;
}

export function YesNoQuestion({ title, description, onAnswer }: YesNoQuestionProps) {
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null);

  // Keyboard shortcuts: Y for Yes, N for No, Enter to confirm
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'y' || e.key === 'Y' || e.key === '1') {
        setSelected('yes');
        setTimeout(() => onAnswer('yes'), 200);
      } else if (e.key === 'n' || e.key === 'N' || e.key === '2') {
        setSelected('no');
        setTimeout(() => onAnswer('no'), 200);
      } else if (e.key === 'Enter' && selected) {
        onAnswer(selected);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, onAnswer]);

  function handleSelect(value: 'yes' | 'no') {
    setSelected(value);
    // Auto-advance after brief visual feedback
    setTimeout(() => onAnswer(value), 250);
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <div className="flex gap-4">
        <button
          onClick={() => handleSelect('yes')}
          className={`flex-1 py-5 rounded-xl border-2 font-bold text-lg transition-all ${
            selected === 'yes'
              ? 'border-green-500 bg-green-50 text-green-700 scale-105'
              : 'border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-700'
          }`}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">👍</span>
            <span>Yes</span>
            <span className="text-xs text-gray-400 font-normal">[Y]</span>
          </div>
        </button>

        <button
          onClick={() => handleSelect('no')}
          className={`flex-1 py-5 rounded-xl border-2 font-bold text-lg transition-all ${
            selected === 'no'
              ? 'border-red-500 bg-red-50 text-red-700 scale-105'
              : 'border-gray-200 hover:border-red-400 hover:bg-red-50 text-gray-700'
          }`}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">👎</span>
            <span>No</span>
            <span className="text-xs text-gray-400 font-normal">[N]</span>
          </div>
        </button>
      </div>
    </div>
  );
}
