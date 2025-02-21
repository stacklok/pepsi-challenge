'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface Result {
  id: number;
  github_username: string;
  preferred_model: string;
  code_prefix: string;
  base_completion: string;
  finetuned_completion: string;
  created_at: string;
  base_model_name: string;
  finetuned_model_name: string;
}

interface PaginatedResults {
  results: Result[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

interface ModelStats {
  total_comparisons: number;
  model_preferences: {
    model: string;
    count: number;
    percentage: number;
  }[];
}

export default function AdminPanel() {
  const router = useRouter();
  const [results, setResults] = useState<PaginatedResults | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', { credentials: 'include' });
      if (response.status === 403) {
        router.push('/');
        return;
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchResults = async (pageNum: number, searchTerm: string) => {
    try {
      const response = await fetch(
        `/api/admin/results?page=${pageNum}&search=${encodeURIComponent(searchTerm)}`,
        { credentials: 'include' }
      );
      
      if (response.status === 403) {
        router.push('/');
        return;
      }
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  useEffect(() => {
    fetchResults(page, search);
    fetchStats();
  }, [page]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      setPage(1); // Reset to first page when searching
      fetchResults(1, search);
    }, 300);
    
    setSearchTimeout(timeout);
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [search]);

  if (!results || !stats) return <div className="text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Return Home
          </Link>
        </div>

        {/* Stats Section */}
        <div className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Model Preference Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.model_preferences.map((pref) => (
              <div 
                key={pref.model}
                className="bg-gray-700 rounded-lg p-4 flex flex-col items-center"
              >
                <h3 className="text-lg font-medium mb-2">
                  {pref.model === 'base' ? 'Base Model' : 'Fine-tuned Model'}
                </h3>
                <div className="text-3xl font-bold mb-1">{pref.percentage}%</div>
                <div className="text-gray-400">({pref.count} votes)</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4 text-gray-400">
            Total Comparisons: {stats.total_comparisons}
          </div>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white 
                     placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-6 py-3 text-left text-gray-300">Expand</th>
                <th className="px-6 py-3 text-left text-gray-300">GitHub Username</th>
                <th className="px-6 py-3 text-left text-gray-300">Preferred Model</th>
                <th className="px-6 py-3 text-left text-gray-300">Created At</th>
              </tr>
            </thead>
            <tbody>
              {results.results.map((result) => (
                <>
                  <tr key={result.id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setExpandedRow(expandedRow === result.id ? null : result.id)}
                        className="p-2 hover:bg-gray-600 rounded-full"
                      >
                        {expandedRow === result.id ? (
                          <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">{result.github_username}</td>
                    <td className="px-6 py-4">{result.preferred_model}</td>
                    <td className="px-6 py-4">
                      {new Date(result.created_at).toLocaleString()}
                    </td>
                  </tr>
                  {expandedRow === result.id && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 bg-gray-900">
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Original Prompt</h3>
                            <SyntaxHighlighter
                              language="python"
                              style={vscDarkPlus}
                              className="rounded-lg"
                            >
                              {result.code_prefix}
                            </SyntaxHighlighter>
                          </div>
                          
                          <div>
                            <h3 className="text-lg font-semibold mb-2 text-green-400">
                              Selected Completion ({result.preferred_model === 'base' ? 
                                `Base Model (${result.base_model_name})` : 
                                `Fine-tuned Model (${result.finetuned_model_name})`})
                            </h3>
                            <SyntaxHighlighter
                              language="python"
                              style={vscDarkPlus}
                              className="rounded-lg"
                            >
                              {result.preferred_model === 'base' ? 
                                result.base_completion : 
                                result.finetuned_completion}
                            </SyntaxHighlighter>
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold mb-2 text-red-400">
                              Rejected Completion ({result.preferred_model === 'base' ? 
                                `Fine-tuned Model (${result.finetuned_model_name})` : 
                                `Base Model (${result.base_model_name})`})
                            </h3>
                            <SyntaxHighlighter
                              language="python"
                              style={vscDarkPlus}
                              className="rounded-lg"
                            >
                              {result.preferred_model === 'base' ? 
                                result.finetuned_completion : 
                                result.base_completion}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-700 
                     disabled:text-gray-500 hover:bg-blue-600 transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-300">
            Page {page} of {results.total_pages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === results.total_pages}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-700 
                     disabled:text-gray-500 hover:bg-blue-600 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
} 