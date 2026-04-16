'use client';

import { useState, useCallback } from 'react';
import { QuestionType } from '@prisma/client';
import { ShortTextQuestion } from './questions/ShortTextQuestion';
import { LongTextQuestion } from './questions/LongTextQuestion';
import { SingleChoiceQuestion } from './questions/SingleChoiceQuestion';
import { MultipleChoiceQuestion } from './questions/MultipleChoiceQuestion';
import { YesNoQuestion } from './questions/YesNoQuestion';
import { RatingQuestion } from './questions/RatingQuestion';
import { DropdownQuestion } from './questions/DropdownQuestion';
import { DateQuestion } from './questions/DateQuestion';
import { WelcomeScreen } from './questions/WelcomeScreen';
import { ThankYouScreen } from './questions/ThankYouScreen';

interface QuestionOption {
  id: string;
  text: string;
  order: number;
}

interface SurveyQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string | null;
  required: boolean;
  order: number;
  placeholder?: string | null;
  validation?: string | null;
  charLimit?: number | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  ratingStyle?: string | null;
  ratingMax?: number | null;
  allowOther: boolean;
  buttonLabel?: string | null;
  ctaUrl?: string | null;
  options: QuestionOption[];
}

interface OqaatSurveyProps {
  surveyId: string;
  surveySlug: string;
  questions: SurveyQuestion[];
  thankYouMessage?: string | null;
}

type TransitionState = 'visible' | 'exit' | 'enter';

export function OqaatSurvey({ surveyId, surveySlug, questions, thankYouMessage }: OqaatSurveyProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
  const [responseId, setResponseId] = useState<string | null>(null);
  const [transition, setTransition] = useState<TransitionState>('visible');
  const [completed, setCompleted] = useState(false);

  // Sort questions by order
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
  const currentQuestion = sortedQuestions[currentIndex];

  const progressPercent = Math.round((currentIndex / Math.max(sortedQuestions.length, 1)) * 100);

  async function ensureResponse() {
    if (responseId) return responseId;

    const res = await fetch(`/api/s/${surveySlug}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyId }),
    });

    if (res.ok) {
      const data = await res.json();
      setResponseId(data.id);
      return data.id;
    }
    return null;
  }

  async function saveAnswer(questionId: string, value: string | string[] | number) {
    const rid = await ensureResponse();
    if (!rid) return;

    const body: Record<string, unknown> = { questionId };

    if (typeof value === 'number') {
      body.numericValue = value;
    } else if (Array.isArray(value)) {
      body.selectedOptions = value;
    } else {
      body.value = value;
    }

    await fetch(`/api/s/${surveySlug}/responses/${rid}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function completeResponse() {
    if (!responseId) return;
    await fetch(`/api/s/${surveySlug}/responses/${responseId}/complete`, {
      method: 'POST',
    });
  }

  const advance = useCallback(
    async (questionId: string, value: string | string[] | number) => {
      // Save the answer
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      await saveAnswer(questionId, value);

      // Transition out
      setTransition('exit');
      await new Promise((resolve) => setTimeout(resolve, 200));

      const nextIndex = currentIndex + 1;

      if (nextIndex >= sortedQuestions.length) {
        await completeResponse();
        setCompleted(true);
      } else {
        const nextQuestion = sortedQuestions[nextIndex];
        if (nextQuestion.type === 'thank_you_screen') {
          await completeResponse();
          setCompleted(true);
        } else {
          setCurrentIndex(nextIndex);
          setTransition('enter');
          await new Promise((resolve) => setTimeout(resolve, 50));
          setTransition('visible');
        }
      }
    },
    [currentIndex, sortedQuestions, responseId, surveySlug]
  );

  const handleStart = useCallback(async () => {
    // Welcome screen — just advance without saving an answer
    setTransition('exit');
    await new Promise((resolve) => setTimeout(resolve, 200));

    const nextIndex = currentIndex + 1;
    if (nextIndex >= sortedQuestions.length) {
      setCompleted(true);
    } else {
      const nextQuestion = sortedQuestions[nextIndex];
      if (nextQuestion.type === 'thank_you_screen') {
        await completeResponse();
        setCompleted(true);
      } else {
        setCurrentIndex(nextIndex);
        setTransition('enter');
        await new Promise((resolve) => setTimeout(resolve, 50));
        setTransition('visible');
      }
    }
  }, [currentIndex, sortedQuestions, responseId]);

  if (completed) {
    // Check if last question is a thank_you_screen
    const lastQ = sortedQuestions[sortedQuestions.length - 1];
    if (lastQ?.type === 'thank_you_screen') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-8">
          <ThankYouScreen
            title={lastQ.title}
            description={lastQ.description}
            buttonLabel={lastQ.buttonLabel}
            ctaUrl={lastQ.ctaUrl}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="max-w-xl w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {thankYouMessage || 'Thank you!'}
          </h1>
          <p className="text-gray-600">Your response has been recorded.</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const transitionClasses: Record<TransitionState, string> = {
    visible: 'opacity-100 translate-y-0',
    exit: 'opacity-0 -translate-y-4',
    enter: 'opacity-0 translate-y-4',
  };

  function renderQuestion(q: SurveyQuestion) {
    switch (q.type) {
      case 'welcome_screen':
        return (
          <WelcomeScreen
            title={q.title}
            description={q.description}
            buttonLabel={q.buttonLabel}
            onStart={handleStart}
          />
        );

      case 'thank_you_screen':
        return (
          <ThankYouScreen
            title={q.title}
            description={q.description}
            buttonLabel={q.buttonLabel}
            ctaUrl={q.ctaUrl}
          />
        );

      case 'short_text':
        return (
          <ShortTextQuestion
            title={q.title}
            description={q.description}
            placeholder={q.placeholder}
            validation={q.validation as 'none' | 'email' | 'url' | 'number' | null}
            required={q.required}
            onAnswer={(val) => advance(q.id, val)}
          />
        );

      case 'long_text':
        return (
          <LongTextQuestion
            title={q.title}
            description={q.description}
            placeholder={q.placeholder}
            required={q.required}
            charLimit={q.charLimit}
            onAnswer={(val) => advance(q.id, val)}
          />
        );

      case 'single_choice':
        return (
          <SingleChoiceQuestion
            title={q.title}
            description={q.description}
            options={q.options}
            allowOther={q.allowOther}
            required={q.required}
            onAnswer={(val) => advance(q.id, val)}
          />
        );

      case 'multiple_choice':
        return (
          <MultipleChoiceQuestion
            title={q.title}
            description={q.description}
            options={q.options}
            allowOther={q.allowOther}
            minSelections={q.minSelections}
            maxSelections={q.maxSelections}
            required={q.required}
            onAnswer={(vals) => advance(q.id, vals)}
          />
        );

      case 'yes_no':
        return (
          <YesNoQuestion
            title={q.title}
            description={q.description}
            onAnswer={(val) => advance(q.id, val)}
          />
        );

      case 'rating':
        return (
          <RatingQuestion
            title={q.title}
            description={q.description}
            ratingMax={q.ratingMax}
            ratingStyle={q.ratingStyle as 'stars' | 'numeric' | 'emoji' | null}
            required={q.required}
            onAnswer={(val) => advance(q.id, val)}
          />
        );

      case 'dropdown':
        return (
          <DropdownQuestion
            title={q.title}
            description={q.description}
            options={q.options}
            required={q.required}
            onAnswer={(val) => advance(q.id, val)}
          />
        );

      case 'date':
        return (
          <DateQuestion
            title={q.title}
            description={q.description}
            required={q.required}
            onAnswer={(val) => advance(q.id, val)}
          />
        );

      default:
        return (
          <div className="text-gray-500">Unknown question type: {q.type}</div>
        );
    }
  }

  const isWelcome = currentQuestion.type === 'welcome_screen';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress bar (hidden for welcome screen) */}
      {!isWelcome && (
        <div className="w-full h-1 bg-gray-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          className={`w-full max-w-xl transition-all duration-200 ease-out ${transitionClasses[transition]}`}
        >
          {renderQuestion(currentQuestion)}
        </div>
      </div>

      {/* Footer with question counter */}
      {!isWelcome && (
        <div className="py-4 px-8 flex items-center justify-between text-sm text-gray-400 border-t border-gray-100">
          <span>
            {currentIndex + 1} / {sortedQuestions.length}
          </span>
          <span>Powered by Interactive Surveys</span>
        </div>
      )}
    </div>
  );
}
