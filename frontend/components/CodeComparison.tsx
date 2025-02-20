'use client';

import React, { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

interface CodeComparisonProps {
  title: string;
  code: string;
}

export default function CodeComparison({ title, code }: CodeComparisonProps) {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code]);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="p-1 bg-gray-900">
        <pre ref={codeRef} className="p-4 m-0 overflow-auto max-h-[500px] text-sm">
          <code className="language-python">{code}</code>
        </pre>
      </div>
    </div>
  );
} 