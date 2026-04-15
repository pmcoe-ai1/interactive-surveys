'use client';

import { useState, useCallback } from 'react';
import { QuestionType } from '@prisma/client';
import { QuestionTypePicker } from './QuestionTypePicker';
import { QuestionBuilderItem, QuestionData, QuestionUpdateInput } from './QuestionBuilderItem';

interface SurveyBuilderProps {
  surveyId: string;
  initialQuestions: QuestionData[];
  surveyTitle: string;
  surveySlug: string | null;
}

export function SurveyBuilder({ surveyId, initialQuestions, surveyTitle, surveySlug }: SurveyBuilderProps) {
  const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions);
  const [showPicker, setShowPicker] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddQuestion = useCallback(async (type: QuestionType) => {
    setShowPicker(false);
    setSaving(true);

    const defaultTitles: Record<QuestionType, string> = {
      short_text: 'Your answer',
      long_text: 'Tell us more',
      single_choice: 'Choose one option',
      multiple_choice: 'Select all that apply',
      rating: 'How would you rate this?',
      yes_no: 'Yes or No?',
      dropdown: 'Select an option',
      date: 'Select a date',
      welcome_screen: 'Welcome!',
      thank_you_screen: 'Thank you!',
    };

    const defaultOptions: Partial<Record<QuestionType, Array<{ text: string; order: number }>>> = {
      single_choice: [
        { text: 'Option 1', order: 0 },
        { text: 'Option 2', order: 1 },
        { text: 'Option 3', order: 2 },
      ],
      multiple_choice: [
        { text: 'Option 1', order: 0 },
        { text: 'Option 2', order: 1 },
        { text: 'Option 3', order: 2 },
      ],
      dropdown: [
        { text: 'Option 1', order: 0 },
        { text: 'Option 2', order: 1 },
      ],
    };

    const res = await fetch(`/api/surveys/${surveyId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        title: defaultTitles[type],
        options: defaultOptions[type],
      }),
    });

    setSaving(false);

    if (!res.ok) return;

    const result = await res.json();
    setQuestions((prev) => [...prev, result.question]);

    if (result.warning) {
      setWarning(result.warning);
      setTimeout(() => setWarning(null), 5000);
    }
  }, [surveyId]);

  const handleUpdateQuestion = useCallback(async (
    questionId: string,
    data: QuestionUpdateInput
  ) => {
    // Optimistic update
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, ...data } as QuestionData : q))
    );

    await fetch(`/api/surveys/${surveyId}/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }, [surveyId]);

  const handleDeleteQuestion = useCallback(async (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));

    await fetch(`/api/surveys/${surveyId}/questions/${questionId}`, {
      method: 'DELETE',
    });
  }, [surveyId]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900">{surveyTitle}</h1>
            <p className="text-xs text-gray-500">{questions.length} question{questions.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {surveySlug && (
              <a
                href={`/s/${surveySlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Preview ↗
              </a>
            )}
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Warning banner */}
      {warning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <p className="text-amber-800 text-sm text-center">⚠️ {warning}</p>
        </div>
      )}

      {/* Builder content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {questions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No questions yet</h2>
            <p className="text-gray-500 mb-6">Add your first question to get started.</p>
            <button
              onClick={() => setShowPicker(true)}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Add Question
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {questions
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((q) => (
                  <QuestionBuilderItem
                    key={q.id}
                    question={q}
                    onUpdate={(data) => handleUpdateQuestion(q.id, data)}
                    onDelete={() => handleDeleteQuestion(q.id)}
                  />
                ))}
            </div>

            <button
              onClick={() => setShowPicker(true)}
              disabled={saving}
              className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all font-medium disabled:opacity-50"
            >
              {saving ? '...' : '+ Add Question'}
            </button>
          </>
        )}
      </main>

      {showPicker && (
        <QuestionTypePicker
          onSelect={handleAddQuestion}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
