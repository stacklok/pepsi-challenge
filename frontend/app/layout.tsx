import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';
import 'github-markdown-css/github-markdown.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LLM Code Comparison',
  description: 'Compare base and finetuned LLM code completions',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-screen`}>
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      </body>
    </html>
  );
}
