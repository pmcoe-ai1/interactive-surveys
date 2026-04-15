import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getSurveyById } from '@/services/survey.service';
import { SurveyBuilder } from '@/components/SurveyBuilder';
import { QuestionData } from '@/components/QuestionBuilderItem';

interface Props {
  params: { id: string };
}

export default async function SurveyEditPage({ params }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/surveys/${params.id}/edit`);
  }

  const survey = await getSurveyById(params.id, session.user.id);

  if (!survey) {
    notFound();
  }

  const questions: QuestionData[] = survey.questions.map((q) => ({
    id: q.id,
    type: q.type,
    title: q.title,
    description: q.description,
    required: q.required,
    order: q.order,
    placeholder: q.placeholder,
    validation: q.validation,
    charLimit: q.charLimit,
    allowOther: q.allowOther,
    buttonLabel: q.buttonLabel,
    ratingMax: q.ratingMax,
    options: q.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
  }));

  return (
    <SurveyBuilder
      surveyId={survey.id}
      initialQuestions={questions}
      surveyTitle={survey.title}
      surveySlug={survey.slug}
    />
  );
}
