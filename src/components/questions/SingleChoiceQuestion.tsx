'use client';

import { useState, useEffect } from 'react';

interface Option {
  id: string;
  text: string;
  order: number;
}

interface SingleChoiceQuestionProps {
  title: string;
  description?: string | null;
  options: Option[];
  allowOther?: boolean;
  required?: boolean;
  onAnswer: (value: string) => void;
}

export function SingleChoiceQuestion({
  title,
  description,
  options,
  allowOther,
  required,
  onAnswer,
}: SingleChoiceQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedOptions = [...options].sort((a, b) => a.order - b.order);

  // Keyboard shortcut: number keys 1-9
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= sortedOptions.length) {
        const opt = sortedOptions[num - 1];
        selectOption(opt.text);
      }
      if (e.key === 'Enter' && selected) {
        submit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedOptions, selected, otherText, showOther]);

  function selectOption(optionText: string) {
    if (optionText === '__other__') {
      setSelected('__other__');
      setShowOther(true);
    } else {
      setSelected(optionText);
      setShowOther(false);
    }
    setError(null);
  }

  function submit() {
    if (!selected) {
      if (required) {
        setError('Please select an option');
      }
      return;
    }
    if (selected === '__other__') {
      onAnswer(otherText || 'Other');
    } else {
      onAnswer(selected);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <div className="space-y-2 mb-6">
        {sortedOptions.map((opt, idx) => (
          <button
            key={opt.id}
            onClick={() => selectOption(opt.text)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              selected === opt.text
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-md border border-current flex items-center justify-center text-xs font-bold">
              {idx + 1}
            </span>
            <span className="font-medium">{opt.text}</span>
          </button>
        ))}

        {allowOther && (
          <button
            onClick={() => selectOption('__other__')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              selected === '__other__'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-md border border-current flex items-center justify-center text-xs font-bold">
              {sortedOptions.length + 1}
            </span>
            <span className="font-medium">Other</span>
          </button>
        )}
      </div>

      {showOther && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="Please specify..."
          className="w-full px-0 py-2 text-lg border-b-2 border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent mb-4"
          autoFocus
        />
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {selected ? (
        <button
          onClick={submit}
          className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          OK ✓
        </button>
      ) : !required && (
        <button
          onClick={submit}
          className="px-6 py-2.5 text-gray-400 hover:text-gray-600 transition-colors text-sm"
        >
          Skip →
        </button>
      )}
    </div>
  );
}
