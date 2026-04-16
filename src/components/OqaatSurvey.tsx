'use client';

import { useState, useCallback, useEffect } from 'react';
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
  searchable?: boolean;
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
type Direction = 'forward' | 'backward';

export function OqaatSurvey({ surveyId, surveySlug, questions, thankYouMessage }: OqaatSurveyProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
  const [responseId, setResponseId] = useState<string | null>(null);
  const [transition, setTransition] = useState<TransitionState>('visible');
  const [direction, setDirection] = useState<Direction>('forward');
  const [completed, setCompleted] = useState(false);
  // SC3.5.3: detect prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sort questions by order
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
  const currentQuestion = sortedQuestions[currentIndex];

  // SC3.1.3: question 5 of 10 shows 50% — use (currentIndex+1)/total
  const progressPercent = Math.round(((currentIndex + 1) / Math.max(sortedQuestions.length, 1)) * 100);

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

  // SC3.5.1: forward transition — current slides up, next slides in from below (200-300ms)
  const advance = useCallback(
    async (questionId: string, value: string | string[] | number) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      await saveAnswer(questionId, value);

      setDirection('forward');
      if (!reducedMotion) {
        setTransition('exit');
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

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
          if (!reducedMotion) {
            setTransition('enter');
            await new Promise((resolve) => setTimeout(resolve, 50));
            setTransition('visible');
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex, sortedQuestions, responseId, surveySlug, reducedMotion]
  );

  const handleStart = useCallback(async () => {
    setDirection('forward');
    if (!reducedMotion) {
      setTransition('exit');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

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
        if (!reducedMotion) {
          setTransition('enter');
          await new Promise((resolve) => setTimeout(resolve, 50));
          setTransition('visible');
        }
      }
    }
  }, [currentIndex, sortedQuestions, responseId, reducedMotion]);

  // SC3.2.3 / SC3.5.2: go back — direction reverses, slides down instead of up
  const navigateBack = useCallback(async () => {
    if (currentIndex === 0) return;

    setDirection('backward');
    if (!reducedMotion) {
      setTransition('exit');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setCurrentIndex(currentIndex - 1);
    if (!reducedMotion) {
      setTransition('enter');
      await new Promise((resolve) => setTimeout(resolve, 50));
      setTransition('visible');
    }
    setDirection('forward');
  }, [currentIndex, reducedMotion]);

  // SC3.2.3: Shift+Tab or Up arrow → go back
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const inInput =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;

      if (
        !inInput &&
        (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey))
      ) {
        e.preventDefault();
        navigateBack();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateBack]);

  if (completed) {
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

  // SC3.5.1 / SC3.5.2: direction-aware transition classes
  const forwardClasses: Record<TransitionState, string> = {
    visible: 'opacity-100 translate-y-0',
    exit: 'opacity-0 -translate-y-4',    // slide up out
    enter: 'opacity-0 translate-y-4',    // slide in from below
  };
  const backwardClasses: Record<TransitionState, string> = {
    visible: 'opacity-100 translate-y-0',
    exit: 'opacity-0 translate-y-4',     // slide down out
    enter: 'opacity-0 -translate-y-4',   // slide in from above
  };
  const transitionClasses = direction === 'backward' ? backwardClasses : forwardClasses;

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
            searchable={q.searchable}
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
      {/* SC3.1.1: progress bar (hidden for welcome screen) */}
      {!isWelcome && (
        <div className="w-full h-1 bg-gray-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* SC3.1.1: one question centered on screen; SC3.3.1: responsive padding */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {/* SC3.5.3: motion-reduce:transition-none for prefers-reduced-motion */}
        <div
          className={`w-full max-w-xl transition-all duration-200 ease-out motion-reduce:transition-none ${transitionClasses[transition]}`}
        >
          {renderQuestion(currentQuestion)}
        </div>
      </div>

      {/* Footer: question counter + back button; SC3.3.1: reduce padding on mobile */}
      {!isWelcome && (
        <div className="py-4 px-4 sm:px-8 flex items-center justify-between text-sm text-gray-400 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <span>
              {currentIndex + 1} / {sortedQuestions.length}
            </span>
            {/* SC3.2.3: visible back button */}
            {currentIndex > 0 && (
              <button
                onClick={navigateBack}
                className="text-gray-400 hover:text-gray-600 transition-colors text-xs"
                title="Go back (Shift+Tab or ↑)"
              >
                ← Back
              </button>
            )}
          </div>
          <span>Powered by Interactive Surveys</span>
        </div>
      )}
    </div>
  );
}
