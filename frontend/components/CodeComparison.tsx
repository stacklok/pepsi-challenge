'use client';

import React, { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-python';

type CodeComparisonProps = {
  title: string;
  code: string;
};

const CodeComparison: React.FC<CodeComparisonProps> = ({ title, code }) => {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Need to wait for next tick to ensure DOM is updated
    setTimeout(() => {
      if (codeRef.current) {
        Prism.highlightAll();
      }
    }, 0);
  }, [code]);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="p-4 bg-[#1e1e1e]">
        <pre ref={codeRef} className="!m-0 !p-0 !bg-transparent overflow-auto max-h-[500px] text-sm">
          <code className="language-python">{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeComparison; 