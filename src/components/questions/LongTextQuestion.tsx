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

  // SC2.2.1: auto-expand the textarea to fit content
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    setError(null);
    autoResize(e.target);
  }

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
    // SC2.2.2: show error if over limit (don't block; the counter shows it)
    if (charLimit && value.length > charLimit) {
      setError(`Please shorten your answer to ${charLimit} characters or fewer`);
      return;
    }
    // SC2.2.3: no limit → any length accepted
    onAnswer(value.trim());
  }

  const isOverLimit = charLimit ? value.length > charLimit : false;

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Type your answer here...'}
        rows={4}
        style={{ resize: 'none', overflow: 'hidden' }}
        className="w-full px-0 py-2 text-lg border-b-2 border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent transition-colors"
      />

      {/* SC2.2.2: character counter — shows exceeded state */}
      {charLimit && (
        <p className={`text-xs text-right mt-1 transition-colors ${isOverLimit ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
          {value.length}/{charLimit}
          {isOverLimit && ' — limit exceeded'}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          className="px-6 py-3 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          OK ✓
        </button>
        <span className="text-sm text-gray-400">Cmd+Enter to submit</span>
      </div>
    </div>
  );
}
