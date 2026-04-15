'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked: 'An account with this email already exists. Please sign in with the original provider.',
  OAuthSignin: 'There was a problem signing in with the OAuth provider. Please try again.',
  OAuthCallback: 'There was a problem with the OAuth callback. Please try again.',
  EmailSignin: 'The magic link could not be sent. Please check your email and try again.',
  CredentialsSignin: 'Invalid credentials. Please try again.',
  SessionRequired: 'Please sign in to access this page.',
  Default: 'An error occurred during authentication. Please try again.',
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const message = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <Link
          href="/auth/signin"
          className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
