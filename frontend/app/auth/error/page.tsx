import Link from 'next/link';

export default function AuthError() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">Authentication Error</h1>
        <p className="text-gray-300 mb-8">There was a problem authenticating with GitHub.</p>
        <Link 
          href="/"
          className="px-6 py-3 bg-gray-800 rounded-lg text-white hover:bg-gray-700 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
} 