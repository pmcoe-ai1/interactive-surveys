'use client';

import { QuestionType } from '@prisma/client';

interface QuestionTypeOption {
  type: QuestionType;
  label: string;
  icon: string;
  description: string;
}

const QUESTION_TYPES: QuestionTypeOption[] = [
  { type: 'short_text', label: 'Short Text', icon: '✏️', description: 'Single-line text answer' },
  { type: 'long_text', label: 'Long Text', icon: '📝', description: 'Multi-line text answer' },
  { type: 'single_choice', label: 'Single Choice', icon: '🔘', description: 'Pick one option' },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: '☑️', description: 'Pick multiple options' },
  { type: 'rating', label: 'Rating', icon: '⭐', description: 'Star or numeric rating' },
  { type: 'yes_no', label: 'Yes / No', icon: '✅', description: 'Binary yes or no' },
  { type: 'dropdown', label: 'Dropdown', icon: '▼', description: 'Select from a dropdown list' },
  { type: 'date', label: 'Date', icon: '📅', description: 'Pick a date' },
  { type: 'welcome_screen', label: 'Welcome Screen', icon: '👋', description: 'Intro screen with start button' },
  { type: 'thank_you_screen', label: 'Thank You', icon: '🎉', description: 'Closing thank you message' },
];

interface QuestionTypePickerProps {
  onSelect: (type: QuestionType) => void;
  onClose: () => void;
}

export function QuestionTypePicker({ onSelect, onClose }: QuestionTypePickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Question</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
          {QUESTION_TYPES.map((qt) => (
            <button
              key={qt.type}
              onClick={() => onSelect(qt.type)}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group"
            >
              <span className="text-2xl">{qt.icon}</span>
              <div>
                <div className="font-medium text-gray-900 group-hover:text-indigo-700 text-sm">
                  {qt.label}
                </div>
                <div className="text-xs text-gray-500">{qt.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { QUESTION_TYPES };
