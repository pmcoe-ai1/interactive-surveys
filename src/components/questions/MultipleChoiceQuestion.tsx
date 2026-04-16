'use client';

import { useState, useEffect } from 'react';

interface Option {
  id: string;
  text: string;
  order: number;
}

interface MultipleChoiceQuestionProps {
  title: string;
  description?: string | null;
  options: Option[];
  allowOther?: boolean;
  minSelections?: number | null;
  maxSelections?: number | null;
  required?: boolean;
  onAnswer: (values: string[]) => void;
}

export function MultipleChoiceQuestion({
  title,
  description,
  options,
  allowOther,
  minSelections,
  maxSelections,
  required,
  onAnswer,
}: MultipleChoiceQuestionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedOptions = [...options].sort((a, b) => a.order - b.order);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= sortedOptions.length) {
        const opt = sortedOptions[num - 1];
        toggleOption(opt.text);
      }
      if (e.key === 'Enter') {
        submit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, sortedOptions]);

  function toggleOption(text: string) {
    // SC2.4.2: show error when trying to exceed max selections
    if (!selected.has(text) && maxSelections && selected.size >= maxSelections) {
      setError(`Select at most ${maxSelections}`);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) {
        next.delete(text);
      } else {
        next.add(text);
      }
      return next;
    });
    setError(null);
  }

  function submit() {
    const values = Array.from(selected);
    if (showOther && otherText) values.push(otherText);

    if (required && values.length === 0) {
      setError('Please select at least one option');
      return;
    }
    if (minSelections && values.length < minSelections) {
      setError(`Please select at least ${minSelections} options`);
      return;
    }
    onAnswer(values);
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-2">{description}</p>}
      <p className="text-sm text-gray-400 mb-6">Choose all that apply</p>

      <div className="space-y-2 mb-6">
        {sortedOptions.map((opt, idx) => {
          const isSelected = selected.has(opt.text);
          return (
            <button
              key={opt.id}
              onClick={() => toggleOption(opt.text)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-bold border-2 ${
                isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'
              }`}>
                {isSelected ? '✓' : idx + 1}
              </span>
              <span className="font-medium">{opt.text}</span>
            </button>
          );
        })}

        {allowOther && (
          <button
            onClick={() => { setShowOther(!showOther); }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              showOther
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-bold border-2 ${
              showOther ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'
            }`}>
              {showOther ? '✓' : sortedOptions.length + 1}
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

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <button
        onClick={submit}
        className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
      >
        OK ✓
      </button>
    </div>
  );
}
