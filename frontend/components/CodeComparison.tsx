'use client';

import React from 'react';
import { Markdown } from './Markdown';
import { getMarkdownNormalize } from '@/lib/utils';

type CodeComparisonProps = {
  title: string;
  code: string;
  isFim: boolean;
};

const CodeComparison: React.FC<CodeComparisonProps> = ({ title, code, isFim }) => {

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="p-4">
        <div className="!m-0 !p-0 !bg-transparent overflow-auto max-h-[500px] text-sm">
          <Markdown
            value={getMarkdownNormalize(isFim, code)}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeComparison; 