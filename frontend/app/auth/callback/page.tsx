'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Just redirect to home, the backend has already handled the authentication
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto" />
      </div>
    </div>
  );
}
