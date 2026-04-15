export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-4">📧</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-600">
          A magic link has been sent to your email address. Click the link to sign in.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          The link will expire in 24 hours.
        </p>
      </div>
    </div>
  );
}
