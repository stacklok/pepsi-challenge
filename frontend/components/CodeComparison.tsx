'use client';

import { usePrevious } from '@/hooks/usePrevious';
import { type FC, useEffect, useMemo, useRef } from 'react';
import { Markdown } from './Markdown';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type CodeComparisonProps = {
  title: string;
  code: string;
  isFim: boolean;
  isGenerating?: boolean;
};

const getMarkdownNormalize = (isFim: boolean, code: string) => {
  if (!isFim) return code;
  // Make sure there's a newline after the language identifier and before the closing backticks
  return `\`\`\`python\n${code}\n\`\`\``;
};

// Fixed function to properly format code blocks before rendering
const formatMarkdown = (content: string): string => {
  let markdownContent = content;
  const codeBlockRegex = /```(\w*)([\s\S]*?)```/g;
  markdownContent = markdownContent.replace(
    codeBlockRegex,
    (_, language, code) => {
      return `\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n`;
    },
  );
  return markdownContent;
};

const CodeComparison: FC<CodeComparisonProps> = ({
  title,
  code,
  isFim,
  isGenerating = false,
}) => {
  // Process the content with our custom formatter
  const processedContent = useMemo(() => {
    const content = getMarkdownNormalize(isFim, code);
    return formatMarkdown(content);
  }, [code, isFim]);
  const previousProcessedContent = usePrevious(processedContent);

  // Create a ref for the scrollable container
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom every time processedContent updates
  useEffect(() => {
    if (scrollRef.current && previousProcessedContent !== processedContent) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [processedContent, previousProcessedContent]);

  return (
    <Card
      className={
        isGenerating
          ? 'border-2 border-blue-500/30 shadow-lg shadow-blue-500/10'
          : ''
      }
    >
      <CardHeader
        className={`${
          isGenerating
            ? 'bg-gradient-to-r from-blue-500/80 to-purple-600/80 animate-pulse'
            : 'bg-gradient-to-r from-blue-500 to-purple-600'
        } rounded-t-lg flex flex-row justify-between items-center`}
      >
        <CardTitle className="text-white">{title}</CardTitle>
        {isGenerating && (
          <div className="flex items-center">
            <div className="flex space-x-1">
              <div
                className="h-2 w-2 rounded-full bg-white/70 animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="h-2 w-2 rounded-full bg-white/70 animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <div
                className="h-2 w-2 rounded-full bg-white/70 animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="bg-popover-foreground dark:bg-popover pt-4 rounded-b-lg">
        <div
          ref={scrollRef}
          className={`overflow-auto max-h-[500px] text-sm ${isGenerating ? 'border-l-4 border-blue-500/30 pl-2' : ''}`}
        >
          <Markdown value={processedContent} />
        </div>
      </CardContent>
    </Card>
  );
};

export default CodeComparison;
