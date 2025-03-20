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

  useEffect(() => {
    if (prevExperimentId !== experimentId) {
      setResults(null);
    }
  }, [experimentId, prevExperimentId]);

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

  const submitPreference = useCallback(async () => {
    if (!results || preferredModel === null || modelAIsBase === null) {
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
          baseCompletion: results.baseResponse,
          finetunedCompletion: results.finetunedResponse,
          experimentId: experimentId,
        }),
      });

      setSubmissionState('success');

      // Reset form after 2 seconds
      setTimeout(() => {
        setResults(null);
        setModelAIsBase(null);
        setSubmissionState('idle');
      }, 2000);
    } catch (error) {
      console.error('Error submitting preference:', error);
      setSubmissionState('idle');
    }
  }, [preferredModel, modelAIsBase, results, prefix, prompt, experimentId]);

  return {
    results,
    isLoading,
    modelAIsBase,
    submissionState,
    preferredModel,
    generate,
    submitPreference,
  };
};
