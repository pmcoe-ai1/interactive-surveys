'use client';

import { useState, useCallback } from 'react';
import { WelcomeScreen } from '@/components/questions/WelcomeScreen';
import { ShortTextQuestion } from '@/components/questions/ShortTextQuestion';
import { SingleChoiceQuestion } from '@/components/questions/SingleChoiceQuestion';
import { YesNoQuestion } from '@/components/questions/YesNoQuestion';
import { ThankYouScreen } from '@/components/questions/ThankYouScreen';

type Step = 'welcome' | 'name' | 'role' | 'recommend' | 'email' | 'thanks';

export default function DemoPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [transitioning, setTransitioning] = useState(false);

  const advance = useCallback((nextStep: Step, key?: string, value?: string) => {
    if (key && value) {
      setAnswers(prev => ({ ...prev, [key]: value }));
    }
    setTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setTransitioning(false);
    }, 250);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div
        className={`transition-all duration-250 ${
          transitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        {step === 'welcome' && (
          <WelcomeScreen
            title="Product Feedback Survey"
            description="Help us improve! This takes about 2 minutes."
            buttonLabel="Let's Go"
            onStart={() => advance('name')}
          />
        )}

        {step === 'name' && (
          <ShortTextQuestion
            title="What's your name?"
            description="We'd love to know who we're talking to."
            placeholder="Type your name..."
            required={true}
            onAnswer={(val) => advance('role', 'name', val)}
          />
        )}

        {step === 'role' && (
          <SingleChoiceQuestion
            title="What best describes your role?"
            options={[
              { id: '1', text: 'Developer', order: 0 },
              { id: '2', text: 'Designer', order: 1 },
              { id: '3', text: 'Product Manager', order: 2 },
              { id: '4', text: 'Founder / CEO', order: 3 },
            ]}
            allowOther={true}
            onAnswer={(val) => advance('recommend', 'role', val)}
          />
        )}

        {step === 'recommend' && (
          <YesNoQuestion
            title="Would you recommend our product?"
            description="Be honest — we can take it!"
            onAnswer={(val) => advance('email', 'recommend', val)}
          />
        )}

        {step === 'email' && (
          <ShortTextQuestion
            title="What's your email?"
            description="So we can follow up on your feedback."
            placeholder="you@example.com"
            validation="email"
            required={true}
            onAnswer={(val) => advance('thanks', 'email', val)}
          />
        )}

        {step === 'thanks' && (
          <ThankYouScreen
            title="Thanks for your feedback!"
            description={`We appreciate your time${answers.name ? `, ${answers.name}` : ''}. Your input helps us build a better product.`}
          />
        )}
      </div>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gray-200">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{
            width: `${
              { welcome: 0, name: 20, role: 40, recommend: 60, email: 80, thanks: 100 }[step]
            }%`,
          }}
        />
      </div>
    </div>
  );
}
