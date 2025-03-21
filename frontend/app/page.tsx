'use client';

import { ExperimentSelector } from '@/components/ExperimentSelector';
import { Header } from '@/components/Header';
import { Chat } from '@/components/code-generation/Chat';
import { Fim } from '@/components/code-generation/Fim';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useModels } from '@/hooks/useModels';
import { usePrevious } from '@/hooks/usePrevious';
import { useUser } from '@/hooks/useUser';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/solid';
import type React from 'react';
import { useEffect, useState } from 'react';
import CodeComparison from '../components/CodeComparison';

export default function Home() {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [isSuffixVisible, setIsSuffixVisible] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [preferredModel, setPreferredModel] = useState<'A' | 'B' | null>(null);
  const [experimentId, setExperimentId] = useState<string | undefined>();
  const [isStreamingMode, setIsStreamingMode] = useState(true);
  const user = useUser();
  const prevExperiment = usePrevious(experimentId);

  const {
    results,
    isLoading,
    modelAIsBase,
    submissionState,
    generate,
    submitPreference,
    // New streaming properties
    generateStream,
    cancelStreaming,
    isStreaming,
    streamingResults,
    currentStreamingModel,
    streamProgress,
  } = useModels({ prompt, prefix, suffix, preferredModel, experimentId });

  console.log({ streamProgress: JSON.stringify(streamProgress) });

  useEffect(() => {
    if (experimentId !== prevExperiment) {
      setPrefix('');
      setSuffix('');
      setPrompt('');
    }
  }, [experimentId, prevExperiment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt && !prefix.trim()) {
      alert('Please enter a code snippet before submitting.');
      return;
    }

    // Choose between streaming and non-streaming based on user preference
    if (isStreamingMode) {
      generateStream();
    } else {
      generate();
    }
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

  const getModelAContent = () => {
    if (results) {
      return (
        prefix +
        (modelAIsBase ? results.baseResponse : results.finetunedResponse) +
        suffix
      );
    }
    // If no results but streaming
    if (streamingResults?.modelA) {
      return streamingResults.modelA;
    }
    return '';
  };

  const getModelBContent = () => {
    if (results) {
      return (
        prefix +
        (modelAIsBase ? results.finetunedResponse : results.baseResponse) +
        suffix
      );
    }
    // If no results but streaming
    if (streamingResults?.modelB) {
      return streamingResults.modelB;
    }
    return '';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button
          onClick={handleLogin}
          size="lg"
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
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-xl">
                The Power of Thinking Without Thinking
              </CardTitle>
              <CardDescription>
                Because sometimes you think, and sometimes you just vibe with
                the AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ExperimentSelector
                value={experimentId}
                onChange={setExperimentId}
              />

              {renderExperimentContent()}

              <div className="flex items-center space-x-2 mb-4">
                <label
                  htmlFor="use-streaming"
                  className="cursor-pointer flex items-center"
                >
                  <Checkbox
                    id="use-streaming"
                    checked={isStreamingMode}
                    onCheckedChange={() => setIsStreamingMode(!isStreamingMode)}
                    className="mr-2"
                  />
                  Enable streaming mode
                </label>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={isLoading || isStreaming}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg
                          hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                          focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                          transform hover:scale-105"
                >
                  {isLoading || isStreaming ? (
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
                      {isStreaming
                        ? `Processing... (${currentStreamingModel === 'A' ? 'Model A' : currentStreamingModel === 'B' ? 'Model B' : 'Preparing'})`
                        : 'Processing...'}
                    </span>
                  ) : (
                    'Compare Models'
                  )}
                </button>

                {isStreaming && (
                  <Button
                    type="button"
                    onClick={cancelStreaming}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <XCircleIcon className="h-5 w-5" />
                    Cancel Generation
                  </Button>
                )}
              </div>
            </CardContent>
          </form>
        </Card>

        {/* Results Section - Now works with both streaming and non-streaming results */}
        {(results || streamingResults.modelA || streamingResults.modelB) && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">Model A</h3>
                  {currentStreamingModel === 'A' && (
                    <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full animate-pulse">
                      Generating...
                    </span>
                  )}
                </div>
                <CodeComparison
                  title="Model A"
                  code={getModelAContent()}
                  isFim={experimentId?.includes('FIM')}
                  isGenerating={currentStreamingModel === 'A'}
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
                    disabled={isStreaming}
                  />
                  <label htmlFor="preferA">Preferred Output</label>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium">Model B</h3>
                  {currentStreamingModel === 'B' && (
                    <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full animate-pulse">
                      Generating...
                    </span>
                  )}
                </div>
                <CodeComparison
                  title="Model B"
                  code={getModelBContent()}
                  isFim={experimentId?.includes('FIM')}
                  isGenerating={currentStreamingModel === 'B'}
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
                    disabled={isStreaming}
                  />
                  <label htmlFor="preferB">Preferred Output</label>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handlePreferenceSubmit}
                disabled={!preferredModel || isStreaming}
                variant="secondary"
                size="lg"
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
