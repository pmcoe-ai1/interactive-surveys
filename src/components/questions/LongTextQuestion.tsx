'use client';

import { useState, useEffect, useRef } from 'react';

interface LongTextQuestionProps {
  title: string;
  description?: string | null;
  placeholder?: string | null;
  required?: boolean;
  charLimit?: number | null;
  onAnswer: (value: string) => void;
}

export function LongTextQuestion({
  title,
  description,
  placeholder,
  required,
  charLimit,
  onAnswer,
}: LongTextQuestionProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      submit();
    }
  }

  function submit() {
    if (required && !value.trim()) {
      setError('This field is required');
      return;
    }
    onAnswer(value.trim());
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          if (charLimit && e.target.value.length > charLimit) return;
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Type your answer here...'}
        rows={4}
        className="w-full px-0 py-2 text-lg border-b-2 border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent transition-colors resize-none"
      />

      {charLimit && (
        <p className="text-xs text-gray-400 text-right mt-1">
          {value.length}/{charLimit}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          OK ✓
        </button>
        <span className="text-sm text-gray-400">Cmd+Enter to submit</span>
      </div>
    </div>
  );
}
