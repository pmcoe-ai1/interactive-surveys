'use client';

import { useState, useEffect, useRef } from 'react';
import { QuestionType, ValidationRule, RatingStyle } from '@prisma/client';

export interface QuestionData {
  id: string;
  type: QuestionType;
  title: string;
  description?: string | null;
  required: boolean;
  order: number;
  placeholder?: string | null;
  validation?: ValidationRule | null;
  charLimit?: number | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  ratingStyle?: RatingStyle | null;
  ratingMax?: number | null;
  searchable?: boolean;
  allowOther: boolean;
  buttonLabel?: string | null;
  options: Array<{ id: string; text: string; order: number }>;
}

export interface QuestionUpdateInput {
  title?: string;
  description?: string | null;
  required?: boolean;
  placeholder?: string | null;
  validation?: ValidationRule | null;
  charLimit?: number | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  ratingStyle?: RatingStyle | null;
  ratingMax?: number | null;
  searchable?: boolean;
  allowOther?: boolean;
  buttonLabel?: string | null;
  options?: Array<{ text: string; order: number }>;
}

interface QuestionBuilderItemProps {
  question: QuestionData;
  onUpdate: (data: QuestionUpdateInput) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
  rating: 'Rating',
  yes_no: 'Yes / No',
  dropdown: 'Dropdown',
  date: 'Date',
  welcome_screen: 'Welcome Screen',
  thank_you_screen: 'Thank You Screen',
};

export function QuestionBuilderItem({ question, onUpdate, onDelete, onDuplicate }: QuestionBuilderItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [localOptions, setLocalOptions] = useState(
    question.options.length > 0
      ? question.options.map((o) => o.text)
      : ['Option 1', 'Option 2']
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Collapse on Escape (SC1.3.3)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && expanded) {
        setExpanded(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expanded]);

  function handleTitleChange(title: string) {
    onUpdate({ title });
  }

  function handleOptionChange(idx: number, value: string) {
    const updated = [...localOptions];
    updated[idx] = value;
    setLocalOptions(updated);
    onUpdate({ options: updated.map((text, order) => ({ text, order })) });
  }

  function addOption() {
    const updated = [...localOptions, `Option ${localOptions.length + 1}`];
    setLocalOptions(updated);
    onUpdate({ options: updated.map((text, order) => ({ text, order })) });
  }

  function removeOption(idx: number) {
    const updated = localOptions.filter((_, i) => i !== idx);
    setLocalOptions(updated);
    onUpdate({ options: updated.map((text, order) => ({ text, order })) });
  }

  function confirmDelete() {
    setShowDeleteConfirm(true);
  }

  function executeDelete() {
    setShowDeleteConfirm(false);
    onDelete();
  }

  const hasOptions = ['single_choice', 'multiple_choice', 'dropdown'].includes(question.type);

  return (
    <div ref={cardRef} className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-gray-400 text-sm font-medium w-6 text-center">{question.order + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {TYPE_LABELS[question.type]}
            </span>
            {question.required && (
              <span className="text-xs text-red-500">Required</span>
            )}
          </div>
          <p className="text-sm text-gray-700 truncate mt-0.5">{question.title || 'Untitled question'}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="text-gray-400 hover:text-indigo-500 transition-colors p-1 text-sm"
            title="Duplicate question"
          >
            ⧉
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              confirmDelete();
            }}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Delete question"
          >
            🗑️
          </button>
          <span className="text-gray-400 ml-1">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Delete confirmation dialog (SC1.5.1, SC1.5.3) */}
      {showDeleteConfirm && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium mb-3">Delete this question?</p>
          <div className="flex gap-2">
            <button
              onClick={executeDelete}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expanded editor (SC1.3.1, SC1.3.2) */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Question text</label>
            <input
              type="text"
              value={question.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Type your question here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {question.type === 'short_text' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Validation</label>
              <select
                value={question.validation ?? 'none'}
                onChange={(e) => onUpdate({ validation: e.target.value as ValidationRule })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="none">None</option>
                <option value="email">Email</option>
                <option value="url">URL</option>
                <option value="number">Number</option>
              </select>
            </div>
          )}

          {(question.type === 'short_text' || question.type === 'long_text') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder text</label>
              <input
                type="text"
                value={question.placeholder ?? ''}
                onChange={(e) => onUpdate({ placeholder: e.target.value || null })}
                placeholder="Enter placeholder..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* S2.2: char limit editor for long_text */}
          {question.type === 'long_text' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Character limit (optional)</label>
              <input
                type="number"
                min={1}
                value={question.charLimit ?? ''}
                onChange={(e) =>
                  onUpdate({ charLimit: e.target.value ? parseInt(e.target.value, 10) : null })
                }
                placeholder="e.g. 500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* S2.5: rating style/max editor */}
          {question.type === 'rating' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rating style</label>
                <select
                  value={question.ratingStyle ?? 'stars'}
                  onChange={(e) => onUpdate({ ratingStyle: e.target.value as RatingStyle })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="stars">Stars</option>
                  <option value="numeric">Numeric</option>
                  <option value="emoji">Emoji</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max rating</label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={question.ratingMax ?? 5}
                  onChange={(e) => onUpdate({ ratingMax: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {(question.type === 'welcome_screen' || question.type === 'thank_you_screen') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Button label</label>
              <input
                type="text"
                value={question.buttonLabel ?? ''}
                onChange={(e) => onUpdate({ buttonLabel: e.target.value || null })}
                placeholder={question.type === 'welcome_screen' ? 'Start' : 'Done'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {hasOptions && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Options</label>
              <div className="space-y-2">
                {localOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {localOptions.length > 1 && (
                      <button
                        onClick={() => removeOption(idx)}
                        className="text-gray-400 hover:text-red-500 text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addOption}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Add option
              </button>

              {question.type === 'single_choice' && (
                <label className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    checked={question.allowOther}
                    onChange={(e) => onUpdate({ allowOther: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600">Allow "Other" option with free text</span>
                </label>
              )}

              {/* S2.7: searchable toggle for dropdown */}
              {question.type === 'dropdown' && (
                <label className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    checked={question.searchable ?? false}
                    onChange={(e) => onUpdate({ searchable: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600">Enable search field</span>
                </label>
              )}
            </div>
          )}

          {/* S2.4: min/max selections for multiple_choice */}
          {question.type === 'multiple_choice' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min selections</label>
                <input
                  type="number"
                  min={0}
                  value={question.minSelections ?? ''}
                  onChange={(e) =>
                    onUpdate({ minSelections: e.target.value ? parseInt(e.target.value, 10) : null })
                  }
                  placeholder="None"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max selections</label>
                <input
                  type="number"
                  min={1}
                  value={question.maxSelections ?? ''}
                  onChange={(e) =>
                    onUpdate({ maxSelections: e.target.value ? parseInt(e.target.value, 10) : null })
                  }
                  placeholder="None"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="rounded"
              />
              <span className="text-gray-600">Required</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
