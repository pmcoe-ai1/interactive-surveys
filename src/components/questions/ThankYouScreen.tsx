'use client';

interface ThankYouScreenProps {
  title: string;
  description?: string | null;
  buttonLabel?: string | null;
  ctaUrl?: string | null;
}

export function ThankYouScreen({ title, description, buttonLabel, ctaUrl }: ThankYouScreenProps) {
  return (
    <div className="w-full max-w-xl text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{title}</h1>
      {description && (
        <p className="text-xl text-gray-600 mb-8">{description}</p>
      )}
      {ctaUrl && (
        <a
          href={ctaUrl}
          className="inline-block px-8 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          {buttonLabel || 'Done'}
        </a>
      )}
    </div>
  );
}
