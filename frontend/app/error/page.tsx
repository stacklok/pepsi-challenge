'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const message =
    searchParams.get('message') || 'An authentication error occurred';
  const type = searchParams.get('type');

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            {type === 'access_denied'
              ? 'Access Denied'
              : 'Authentication Error'}
          </h2>
          <p className="text-gray-600 mb-6">{message}</p>
        </div>

        <div className="flex justify-center">
          <Link
            href="/"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Return to Home
          </Link>
        </div>

        {type === 'access_denied' && (
          <p className="text-sm text-gray-500 text-center mt-4">
            If you believe this is a mistake, please contact the administrator.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
