'use client';

import { useState } from 'react';
import { QuestionType, ValidationRule } from '@prisma/client';

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
  allowOther: boolean;
  buttonLabel?: string | null;
  ratingMax?: number | null;
  options: Array<{ id: string; text: string; order: number }>;
}

export interface QuestionUpdateInput {
  title?: string;
  description?: string | null;
  required?: boolean;
  placeholder?: string | null;
  validation?: ValidationRule | null;
  charLimit?: number | null;
  allowOther?: boolean;
  buttonLabel?: string | null;
  ratingMax?: number | null;
  options?: Array<{ text: string; order: number }>;
}

interface QuestionBuilderItemProps {
  question: QuestionData;
  onUpdate: (data: QuestionUpdateInput) => void;
  onDelete: () => void;
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

export function QuestionBuilderItem({ question, onUpdate, onDelete }: QuestionBuilderItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [localOptions, setLocalOptions] = useState(
    question.options.length > 0
      ? question.options.map((o) => o.text)
      : ['Option 1', 'Option 2']
  );

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

  const hasOptions = ['single_choice', 'multiple_choice', 'dropdown'].includes(question.type);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
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
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Delete question"
          >
            🗑️
          </button>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded editor */}
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
