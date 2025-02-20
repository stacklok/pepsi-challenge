'use client';

import React, { useState, useEffect } from 'react';
import CodeComparison from '../components/CodeComparison';
import UserAvatar from '../components/UserAvatar';

export default function Home() {
  const [prefix, setPrefix] = useState('');
  const [results, setResults] = useState<{
    baseResponse: string;
    finetunedResponse: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelAIsBase, setModelAIsBase] = useState<boolean | null>(null);
  const [preferredModel, setPreferredModel] = useState<'A' | 'B' | null>(null);
  const [user, setUser] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        credentials: 'include',
        body: `prefix=${encodeURIComponent(prefix)}`,
      });

      const data = await response.json();
      setModelAIsBase(data.modelAIsBase);
      setResults({
        baseResponse: data.modelAIsBase ? data.modelA : data.modelB,
        finetunedResponse: data.modelAIsBase ? data.modelB : data.modelA,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferenceSubmit = async () => {
    if (!preferredModel || modelAIsBase === null) return;

    const preferredModelType = (
      (preferredModel === 'A' && modelAIsBase) ||
      (preferredModel === 'B' && !modelAIsBase)
    ) ? 'base' : 'finetuned';

    try {
      await fetch('http://localhost:5000/submit-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          preferredModel: preferredModelType,
          codePrefix: prefix,
          baseCompletion: modelAIsBase ? results.baseResponse : results.finetunedResponse,
          finetunedCompletion: modelAIsBase ? results.finetunedResponse : results.baseResponse
        }),
      });

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting preference:', error);
    }
  };

  const handleLogin = () => {
    window.location.href = 'http://localhost:5000/auth/login';
  };

  // Only check user status once when component mounts
  useEffect(() => {
    fetch('http://localhost:5000/auth/user', {
      credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
      if (data.username) {
        setUser(data);
      }
    })
    .catch(console.error);
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <button
          onClick={handleLogin}
          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg
                   hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
        >
          Login with GitHub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto py-6 px-4 flex justify-between items-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            LLM Pepsi Challenge
          </h1>
          <UserAvatar user={user} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 flex flex-col gap-8">
        {/* Input Section */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code-input" className="block text-lg font-medium text-gray-200 mb-2">
                Enter your code prefix
              </label>
              <textarea
                id="code-input"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-lg font-mono text-sm text-gray-100 
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                placeholder="def main():"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg
                       hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 
                       transform hover:scale-105"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Compare Models'
              )}
            </button>
          </form>
        </div>

        {/* Results Section */}
        {results && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <CodeComparison
                  title="Model A"
                  code={prefix + (modelAIsBase ? results.baseResponse : results.finetunedResponse)}
                />
                <div className="mt-4 flex items-center">
                  <input
                    type="radio"
                    id="preferA"
                    name="preference"
                    value="A"
                    checked={preferredModel === 'A'}
                    onChange={() => setPreferredModel('A')}
                    className="mr-2"
                  />
                  <label htmlFor="preferA">Preferred Output</label>
                </div>
              </div>
              <div>
                <CodeComparison
                  title="Model B"
                  code={prefix + (modelAIsBase ? results.finetunedResponse : results.baseResponse)}
                />
                <div className="mt-4 flex items-center">
                  <input
                    type="radio"
                    id="preferB"
                    name="preference"
                    value="B"
                    checked={preferredModel === 'B'}
                    onChange={() => setPreferredModel('B')}
                    className="mr-2"
                  />
                  <label htmlFor="preferB">Preferred Output</label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={handlePreferenceSubmit}
                disabled={!preferredModel}
                className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105
                  ${preferredModel 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
              >
                Submit Preference
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 