'use client';

import { useState, useEffect, useRef } from 'react';
import { ValidationRule } from '@prisma/client';

interface ShortTextQuestionProps {
  title: string;
  description?: string | null;
  placeholder?: string | null;
  validation?: ValidationRule | null;
  required?: boolean;
  onAnswer: (value: string) => void;
}

function validateInput(value: string, rule?: ValidationRule | null): string | null {
  if (!value) return null;
  switch (rule) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Please enter a valid email address';
    case 'url':
      try {
        new URL(value);
        return null;
      } catch {
        return 'Please enter a valid URL';
      }
    case 'number':
      return isNaN(Number(value)) ? 'Please enter a valid number' : null;
    default:
      return null;
  }
}

export function ShortTextQuestion({
  title,
  description,
  placeholder,
  validation,
  required,
  onAnswer,
}: ShortTextQuestionProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      submit();
    }
  }

  function submit() {
    if (required && !value.trim()) {
      setError('This field is required');
      return;
    }
    const validationError = validateInput(value, validation);
    if (validationError) {
      setError(validationError);
      return;
    }
    onAnswer(value.trim());
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <input
        ref={inputRef}
        type={validation === 'email' ? 'email' : validation === 'url' ? 'url' : validation === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Type your answer here...'}
        className="w-full px-0 py-2 text-lg border-b-2 border-gray-300 focus:border-indigo-500 focus:outline-none bg-transparent transition-colors"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          OK ✓
        </button>
        <span className="text-sm text-gray-400">press Enter ↵</span>
      </div>
    </div>
  );
}
