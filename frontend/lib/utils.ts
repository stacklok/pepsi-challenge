import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getMarkdownNormalize = (isFim: boolean, code: string) => {
  if (!isFim) return code;
  // Make sure there's a newline after the language identifier and before the closing backticks
  return `\`\`\`python\n${code}\n\`\`\``;
};
