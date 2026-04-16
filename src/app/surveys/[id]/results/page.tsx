import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getSurveyResponses } from '@/services/survey.service';

interface Props {
  params: { id: string };
}

export default async function SurveyResultsPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/surveys/${params.id}/results`);
  }

  let data;
  try {
    data = await getSurveyResponses(params.id, session.user.id);
  } catch {
    notFound();
  }

  const { survey, responses, total, complete, partial, completionRate } = data;

  function formatDate(d: Date) {
    return new Date(d).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{survey.title}</h1>
            <p className="text-sm text-gray-500">Response Summary</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/surveys/${params.id}/edit`}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              ← Edit Survey
            </a>
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* SC6.1.3: No responses yet */}
        {total === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No responses yet</h2>
            <p className="text-gray-500 mb-6">Share your survey to start collecting responses.</p>
            {survey.slug && (
              <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-4">
                <span className="text-gray-500 text-sm">Survey link:</span>
                <a
                  href={`/s/${survey.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 font-semibold hover:underline text-sm break-all"
                >
                  /s/{survey.slug}
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* SC6.1.1: Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-3xl font-bold text-gray-900">{total}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {total === 1 ? 'response' : 'responses'}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-3xl font-bold text-green-600">{completionRate}%</p>
                <p className="text-sm text-gray-500 mt-1">completion rate</p>
              </div>
              {/* SC5.2.2: partial vs complete shown separately */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-3xl font-bold text-indigo-600">{complete}</p>
                <p className="text-sm text-gray-500 mt-1">complete</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-3xl font-bold text-amber-500">{partial}</p>
                <p className="text-sm text-gray-500 mt-1">partial</p>
              </div>
            </div>

            {/* SC6.1.2: Response list with timestamp and status */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">All Responses</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {responses.map((r) => {
                  // SC5.3.3: identified respondent or "Anonymous"
                  const identity = r.user
                    ? (r.user.name || r.user.email || 'User')
                    : r.respondentEmail
                    ? r.respondentEmail
                    : 'Anonymous';

                  return (
                    <div key={r.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-medium flex-shrink-0">
                          {identity[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{identity}</p>
                          <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400">
                          {r._count.answers} answer{r._count.answers !== 1 ? 's' : ''}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            r.status === 'complete'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {r.status === 'complete' ? 'Complete' : 'Partial'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
