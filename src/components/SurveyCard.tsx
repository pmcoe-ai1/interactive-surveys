'use client';

import Link from 'next/link';
import { SurveyStatus } from '@prisma/client';

interface SurveyCardProps {
  survey: {
    id: string;
    title: string;
    status: SurveyStatus;
    responseCount: number;
    updatedAt: string;
  };
}

const statusColors: Record<SurveyStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  live: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
};

const statusLabels: Record<SurveyStatus, string> = {
  draft: 'Draft',
  live: 'Live',
  closed: 'Closed',
};

export function SurveyCard({ survey }: SurveyCardProps) {
  const updatedDate = new Date(survey.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link href={`/surveys/${survey.id}/edit`}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
            {survey.title}
          </h3>
          <span className={`ml-2 shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[survey.status]}`}>
            {statusLabels[survey.status]}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{survey.responseCount} response{survey.responseCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>Updated {updatedDate}</span>
        </div>
      </div>
    </Link>
  );
}
