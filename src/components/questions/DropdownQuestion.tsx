'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const sortedOptions = [...options].sort((a, b) => a.order - b.order);

  // SC2.7.2: filter options by typed text
  const filteredOptions = sortedOptions.filter((o) =>
    o.text.toLowerCase().includes(search.toLowerCase())
  );

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Short delay to allow dropdown to render
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submit = useCallback(() => {
    if (required && !selected) {
      setError('Please select an option');
      return;
    }
    onAnswer(selected);
  }, [selected, required, onAnswer]);

  // Enter key to submit (when dropdown is closed)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !isOpen && selected) {
        submit();
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selected, submit]);

  // SC2.7.3: select an option → dropdown closes and shows selected value
  function selectOption(text: string) {
    setSelected(text);
    setIsOpen(false);
    setSearch('');
    setError(null);
  }

  return (
    <div className="w-full max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <div ref={containerRef} className="relative">
        {/* Trigger button — SC2.7.3: shows selected value */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:border-indigo-500 focus:outline-none bg-white hover:border-indigo-300 transition-colors text-left"
        >
          <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
            {selected || 'Select an option...'}
          </span>
          <span className="text-gray-400 ml-2 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
        </button>

        {/* SC2.7.1: scrollable list of options */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-indigo-300 rounded-xl shadow-lg overflow-hidden">
            {/* SC2.7.2: search field filters options */}
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search options..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 text-center">No options match</p>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => selectOption(opt.text)}
                    className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                      selected === opt.text
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    {opt.text}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        {selected ? (
          <button
            onClick={submit}
            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            OK ✓
          </button>
        ) : !required ? (
          <button
            onClick={submit}
            className="px-6 py-2.5 text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            Skip →
          </button>
        ) : (
          <button
            disabled
            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            OK ✓
          </button>
        )}
        <span className="text-sm text-gray-400">press Enter ↵</span>
      </div>
    </div>
  );
}
