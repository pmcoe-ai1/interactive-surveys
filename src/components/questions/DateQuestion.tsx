'use client';

import { useState, useEffect, useRef } from 'react';

interface DateQuestionProps {
  title: string;
  description?: string | null;
  required?: boolean;
  onAnswer: (value: string) => void;
}

export function DateQuestion({ title, description, required, onAnswer }: DateQuestionProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && value) {
        submit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value]);

  function submit() {
    if (required && !value) {
      setError('Please select a date');
      return;
    }
    if (value) onAnswer(value);
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:border-indigo-500 focus:outline-none"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          disabled={!value}
          className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          OK ✓
        </button>
        <span className="text-sm text-gray-400">press Enter ↵</span>
      </div>
    </div>
  );
}
