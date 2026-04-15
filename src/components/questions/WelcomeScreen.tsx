'use client';

import { useEffect } from 'react';

interface WelcomeScreenProps {
  title: string;
  description?: string | null;
  buttonLabel?: string | null;
  onStart: () => void;
}

export function WelcomeScreen({ title, description, buttonLabel, onStart }: WelcomeScreenProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        onStart();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  return (
    <div className="w-full max-w-xl text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{title}</h1>
      {description && (
        <p className="text-xl text-gray-600 mb-8">{description}</p>
      )}
      <button
        onClick={onStart}
        className="px-8 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-xl hover:bg-indigo-700 transition-all hover:scale-105 active:scale-100"
      >
        {buttonLabel || 'Start'}
      </button>
      <p className="mt-4 text-sm text-gray-400">press Enter ↵</p>
    </div>
  );
}
