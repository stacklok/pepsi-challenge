'use client';

import type React from 'react';
import { Markdown } from './Markdown';
import { getMarkdownNormalize } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type CodeComparisonProps = {
  title: string;
  code: string;
  isFim: boolean;
};

const CodeComparison: React.FC<CodeComparisonProps> = ({
  title,
  code,
  isFim,
}) => {
  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-lg">
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="bg-popover-foreground dark:bg-popover pt-4 rounded-b-lg">
        <div className="overflow-auto max-h-[500px] text-sm">
          <Markdown value={getMarkdownNormalize(isFim, code)} />
        </div>
      </CardContent>
    </Card>
  );
};

export default CodeComparison;
