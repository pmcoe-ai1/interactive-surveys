import { notFound } from 'next/navigation';
import { getSurveyBySlug } from '@/services/survey.service';
import { OqaatSurvey } from '@/components/OqaatSurvey';

interface Props {
  params: { slug: string };
}

export default async function PublicSurveyPage({ params }: Props) {
  const survey = await getSurveyBySlug(params.slug);

  if (!survey) {
    notFound();
  }

  if (survey.status === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Survey Closed</h1>
          <p className="text-gray-600">This survey is no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  return (
    <OqaatSurvey
      surveyId={survey.id}
      surveySlug={survey.slug!}
      questions={survey.questions.map((q) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description,
        required: q.required,
        order: q.order,
        placeholder: q.placeholder,
        validation: q.validation,
        charLimit: q.charLimit,
        minSelections: q.minSelections,
        maxSelections: q.maxSelections,
        ratingStyle: q.ratingStyle,
        ratingMax: q.ratingMax,
        searchable: q.searchable,
        allowOther: q.allowOther,
        buttonLabel: q.buttonLabel,
        ctaUrl: q.ctaUrl,
        options: q.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
      }))}
      thankYouMessage={survey.thankYouMessage}
    />
  );
}
