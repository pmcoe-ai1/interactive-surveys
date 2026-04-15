'use client';

import { useState, useEffect, useRef } from 'react';

interface Option {
  id: string;
  text: string;
  order: number;
}

interface DropdownQuestionProps {
  title: string;
  description?: string | null;
  options: Option[];
  required?: boolean;
  onAnswer: (value: string) => void;
}

export function DropdownQuestion({
  title,
  description,
  options,
  required,
  onAnswer,
}: DropdownQuestionProps) {
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && selected) {
        submit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const sortedOptions = [...options].sort((a, b) => a.order - b.order);

  function submit() {
    if (required && !selected) {
      setError('Please select an option');
      return;
    }
    if (selected) onAnswer(selected);
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <select
        ref={selectRef}
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          setError(null);
        }}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:border-indigo-500 focus:outline-none bg-white"
      >
        <option value="">Select an option...</option>
        {sortedOptions.map((opt) => (
          <option key={opt.id} value={opt.text}>
            {opt.text}
          </option>
        ))}
      </select>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          disabled={!selected}
          className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          OK ✓
        </button>
        <span className="text-sm text-gray-400">press Enter ↵</span>
      </div>
    </div>
  );
}
