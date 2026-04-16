'use client';

import { useState, useEffect } from 'react';
import { RatingStyle } from '@prisma/client';

interface RatingQuestionProps {
  title: string;
  description?: string | null;
  ratingMax?: number | null;
  ratingStyle?: RatingStyle | null;
  required?: boolean;
  onAnswer: (value: number) => void;
}

export function RatingQuestion({
  title,
  description,
  ratingMax = 5,
  ratingStyle = 'stars',
  required,
  onAnswer,
}: RatingQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const max = ratingMax ?? 5;
  const effectiveStyle = ratingStyle ?? 'stars';

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= max) {
        setSelected(num);
        setTimeout(() => onAnswer(num), 200);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [max, onAnswer]);

  function handleSelect(value: number) {
    setSelected(value);
    setTimeout(() => onAnswer(value), 200);
  }

  const display = hovered ?? selected;

  const emojis = ['😠', '😕', '😐', '😊', '😄'];

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const isActive = display !== null && n <= display;
          return (
            <button
              key={n}
              onClick={() => handleSelect(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              {effectiveStyle === 'stars' && (
                <span className={`text-3xl ${isActive ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
              )}
              {effectiveStyle === 'numeric' && (
                <span className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold text-sm ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-indigo-400'
                }`}>
                  {n}
                </span>
              )}
              {effectiveStyle === 'emoji' && (
                <span className={`text-3xl ${n === display ? 'scale-125' : 'opacity-50'} transition-all`}>
                  {emojis[n - 1] ?? '😊'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-4">
        {selected && (
          <button
            onClick={() => onAnswer(selected)}
            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            OK ✓
          </button>
        )}
        {!required && !selected && (
          <button
            onClick={() => onAnswer(0)}
            className="px-6 py-2.5 text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            Skip →
          </button>
        )}
      </div>
    </div>
  );
}
