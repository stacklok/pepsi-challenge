import { useCallback, useEffect, useState } from 'react';
import { usePrevious } from './usePrevious';

export type SubmissionState = 'idle' | 'submitting' | 'success';

export const useModels = ({
  prompt,
  prefix,
  suffix,
  preferredModel,
  experimentId,
}: {
  prompt: string;
  prefix: string;
  suffix: string;
  preferredModel: 'A' | 'B' | null;
  experimentId?: string;
}) => {
  const [results, setResults] = useState<{
    baseResponse: string;
    finetunedResponse: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelAIsBase, setModelAIsBase] = useState<boolean | null>(null);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>('idle');
  const prevExperimentId = usePrevious(experimentId);

  // New streaming states
  const [streamingResults, setStreamingResults] = useState<{
    modelA: string;
    modelB: string;
  }>({ modelA: '', modelB: '' });
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingModel, setCurrentStreamingModel] = useState<
    'A' | 'B' | null
  >(null);
  const [streamProgress, setStreamProgress] = useState<{
    modelA: boolean;
    modelB: boolean;
  }>({ modelA: false, modelB: false });

  // For cleanup
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  useEffect(() => {
    if (prevExperimentId !== experimentId) {
      setResults(null);
      setStreamingResults({ modelA: '', modelB: '' });
    }
  }, [experimentId, prevExperimentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  // Non-streaming generate function (kept for backward compatibility)
  const generate = useCallback(async () => {
    setIsLoading(true);

    let body = prompt
      ? `prompt=${encodeURIComponent(prompt)}&mode=chat`
      : `prefix=${encodeURIComponent(prefix)}&suffix=${encodeURIComponent(suffix)}&mode=fim`;

    if (experimentId) {
      body += `&experiment_id=${encodeURIComponent(experimentId)}`;
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        credentials: 'include',
        body,
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
  }, [prompt, prefix, suffix, experimentId]);

  // Finalize streaming and set results
  const finalizeStreaming = useCallback(() => {
    setIsStreaming(false);
    setCurrentStreamingModel(null);

    // Convert streaming results to final results format
    if (modelAIsBase !== null) {
      setResults({
        baseResponse: modelAIsBase
          ? streamingResults.modelA
          : streamingResults.modelB,
        finetunedResponse: modelAIsBase
          ? streamingResults.modelB
          : streamingResults.modelA,
      });
    }
  }, [modelAIsBase, streamingResults]);

  // Process a single SSE message with optimized handling for different token types
  const processEventData = useCallback(
    (data: string) => {
      try {
        // Check if the data is valid JSON
        if (!data.trim()) return;

        const parsedData = JSON.parse(data);

        switch (parsedData.type) {
          case 'header':
            // Set which model is the base model
            setModelAIsBase(parsedData.modelAIsBase);
            break;

          case 'model_start':
            // Set the current streaming model
            setCurrentStreamingModel(parsedData.model);
            setStreamProgress((prev) => ({
              ...prev,
              [parsedData.model === 'A' ? 'modelA' : 'modelB']: true,
            }));
            break;

          case 'token':
            // Check if this is a code block token (sent as a complete unit)
            if (parsedData.is_code_block) {
              console.log(`Received code block for model ${parsedData.model}`);
              // For code blocks, add the complete block at once
              setStreamingResults((prev) => ({
                ...prev,
                [`model${parsedData.model}`]:
                  prev[`model${parsedData.model}`] + parsedData.text,
              }));
            } else {
              // For regular text, add tokens immediately for a more real-time feel
              setStreamingResults((prev) => ({
                ...prev,
                [`model${parsedData.model}`]:
                  prev[`model${parsedData.model}`] + parsedData.text,
              }));
            }
            break;

          case 'model_end':
            // Mark model streaming as complete
            setStreamProgress((prev) => ({
              ...prev,
              [parsedData.model === 'A' ? 'modelA' : 'modelB']: false,
            }));
            setCurrentStreamingModel(parsedData.model === 'A' ? 'B' : null);
            break;

          case 'complete':
            // Complete the streaming process
            finalizeStreaming();
            break;

          default:
            console.log('Unknown event type:', parsedData.type);
        }
      } catch (error) {
        console.error('Error parsing event data:', error, data);
      }
    },
    [finalizeStreaming],
  );

  // New streaming generate function using fetch with text/event-stream
  const generateStream = useCallback(() => {
    // Reset previous results
    setStreamingResults({ modelA: '', modelB: '' });
    setStreamProgress({ modelA: false, modelB: false });
    setResults(null);
    setIsStreaming(true);

    // Create a new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);

    // Build the API request body
    let body = prompt
      ? `prompt=${encodeURIComponent(prompt)}&mode=chat`
      : `prefix=${encodeURIComponent(prefix)}&suffix=${encodeURIComponent(suffix)}&mode=fim`;

    if (experimentId) {
      body += `&experiment_id=${encodeURIComponent(experimentId)}`;
    }

    // Make the POST request
    fetch('/api/generate-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      body,
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('ReadableStream not supported');
        }

        // Set up a reader for the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Optimized stream processing function with lower latency
        function processStream() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                // Process any remaining data in the buffer
                if (buffer.trim()) {
                  const events = buffer.split('\n\n');
                  events.forEach((event) => {
                    if (event.trim() && event.startsWith('data: ')) {
                      const data = event.replace('data: ', '');
                      processEventData(data);
                    }
                  });
                }
                setIsStreaming(false);
                setCurrentStreamingModel(null);
                return;
              }

              // Decode the chunk and add it to our buffer
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              // Process complete events in the buffer as soon as they arrive
              const events = buffer.split('\n\n');
              // Keep the last part that might be incomplete
              buffer = events.pop() || '';

              // Process each complete event immediately
              for (const event of events) {
                if (event.trim() && event.startsWith('data: ')) {
                  const data = event.replace('data: ', '');
                  // Process each event as soon as it's available
                  processEventData(data);
                }
              }

              // Continue reading the stream with minimal delay
              requestAnimationFrame(() => processStream());
            })
            .catch((error) => {
              if (error.name !== 'AbortError') {
                console.error('Stream reading error:', error);
              }
              setIsStreaming(false);
              setCurrentStreamingModel(null);
            });
        }

        // Start processing the stream
        processStream();
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Fetch error:', error);
        }
        setIsStreaming(false);
        setCurrentStreamingModel(null);
      });

    return () => {
      controller.abort();
    };
  }, [prompt, prefix, suffix, experimentId, processEventData]);

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }

    setIsStreaming(false);
    setCurrentStreamingModel(null);
    setStreamProgress({ modelA: false, modelB: false });
  }, [abortController]);

  const submitPreference = useCallback(async () => {
    // Use either streamed results or regular results
    const finalResults =
      results ||
      (modelAIsBase !== null
        ? {
            baseResponse: modelAIsBase
              ? streamingResults.modelA
              : streamingResults.modelB,
            finetunedResponse: modelAIsBase
              ? streamingResults.modelB
              : streamingResults.modelA,
          }
        : null);

    if (!finalResults || preferredModel === null || modelAIsBase === null) {
      console.error('Cannot submit preference: missing required data');
      return;
    }

    setSubmissionState('submitting');

    const preferredModelType =
      (preferredModel === 'A' && modelAIsBase) ||
      (preferredModel === 'B' && !modelAIsBase)
        ? 'base'
        : 'finetuned';

    try {
      await fetch('/api/submit-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          preferredModel: preferredModelType,
          codePrefix: prefix || prompt,
          baseCompletion: finalResults.baseResponse,
          finetunedCompletion: finalResults.finetunedResponse,
          experimentId: experimentId,
        }),
      });

      setSubmissionState('success');

      // Reset form after 2 seconds
      setTimeout(() => {
        setResults(null);
        setModelAIsBase(null);
        setStreamingResults({ modelA: '', modelB: '' });
        setSubmissionState('idle');
      }, 2000);
    } catch (error) {
      console.error('Error submitting preference:', error);
      setSubmissionState('idle');
    }
  }, [
    preferredModel,
    modelAIsBase,
    results,
    streamingResults,
    prefix,
    prompt,
    experimentId,
  ]);

  return {
    results,
    isLoading,
    modelAIsBase,
    submissionState,
    preferredModel,
    generate,
    submitPreference,

    // New streaming properties and methods
    generateStream,
    cancelStreaming,
    isStreaming,
    streamingResults,
    currentStreamingModel,
    streamProgress,
  };
};
