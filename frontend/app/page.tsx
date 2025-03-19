'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import CodeComparison from '../components/CodeComparison';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { Chat } from '@/components/code-generation/Chat';
import { Fim } from '@/components/code-generation/Fim';
import { useModels } from '@/hooks/useModels';
import { ExperimentSelector } from '@/components/ExperimentSelector';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [isSuffixVisible, setIsSuffixVisible] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [preferredModel, setPreferredModel] = useState<'A' | 'B' | null>(null);
  const [experimentId, setExperimentId] = useState<string | undefined>();
  const user = useUser();
  const {
    results,
    isLoading,
    modelAIsBase,
    submissionState,
    generate,
    submitPreference,
  } = useModels({ prompt, prefix, suffix, preferredModel, experimentId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt && !prefix.trim()) {
      alert('Please enter a code snippet before submitting.');
      return;
    }
    generate();
  };

  const handlePreferenceSubmit = async () => {
    if (!preferredModel || modelAIsBase === null) return;

    await submitPreference();

    // Reset form after 2 seconds
    setTimeout(() => {
      setPrefix('');
      setSuffix('');
      setPrompt('');
      setPreferredModel(null);
    }, 2000);
  };

  const handleLogin = () => {
    window.location.href = '/auth/login';
  };

  const renderExperimentContent = () => {
    if (!experimentId) return null;
    return experimentId?.includes('CHAT') ? (
      <Chat setPrompt={setPrompt} prompt={prompt} />
    ) : (
      <Fim
        prefix={prefix}
        suffix={suffix}
        setPrefix={setPrefix}
        isSuffixVisible={isSuffixVisible}
        setSuffix={setSuffix}
        setIsSuffixVisible={setIsSuffixVisible}
      />
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button
          onClick={handleLogin}
          size='lg'
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white
                   hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
        >
          Login with GitHub
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header user={user} />
      <main className="max-w-7xl mx-auto py-8 px-4 flex flex-col gap-8">
        {/* Input Section */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <ExperimentSelector
              value={experimentId}
              onChange={setExperimentId}
            />
            {renderExperimentContent()}

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
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <title>Loading</title>
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                'Compare Models'
              )}
            </button>
          </form>
        </Card>

        {/* Results Section */}
        {results && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <CodeComparison
                  title="Model A"
                  code={
                    prefix +
                    (modelAIsBase
                      ? results.baseResponse
                      : results.finetunedResponse) +
                    suffix
                  }
                  isFim={experimentId?.includes('FIM')}
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
                  code={
                    prefix +
                    (modelAIsBase
                      ? results.finetunedResponse
                      : results.baseResponse) +
                    suffix
                  }
                  isFim={experimentId?.includes('FIM')}
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
              <Button
                onClick={handlePreferenceSubmit}
                disabled={!preferredModel}
                variant={preferredModel ? 'secondary' : 'outline'}
              >
                Submit Preference
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Success overlay */}
      {submissionState !== 'idle' && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-300
          ${submissionState === 'success' ? 'opacity-100' : 'opacity-0'}`}
        >
          <div
            className={`bg-gray-800 rounded-lg p-8 transform transition-all duration-300
            ${
              submissionState === 'success'
                ? 'scale-100 opacity-100'
                : 'scale-95 opacity-0'
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <CheckCircleIcon className="w-16 h-16 text-green-400 animate-bounce" />
              <h2 className="text-2xl font-semibold text-white">Thank you!</h2>
              <p className="text-gray-300">
                Your feedback has been submitted successfully.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
