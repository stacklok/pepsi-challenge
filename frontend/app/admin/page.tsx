'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';
import { Highlight, themes } from 'prism-react-renderer';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  ChartTooltip,
  ChartLegend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
);

interface ComparisonResult {
  id: number;
  github_username: string;
  preferred_model: string;
  code_prefix: string;
  base_completion: string;
  finetuned_completion: string;
  created_at: string;
  completions: Array<{
    model: string;
    completion: string;
    is_selected: boolean;
  }>;
}

interface Stats {
  total_comparisons: number;
  model_preferences: Array<{
    model: string;
    count: number;
    percentage: number;
  }>;
}

interface Analytics {
  daily_stats: Array<{
    date: string;
    total_comparisons: number;
    base_preferred: number;
    finetuned_preferred: number;
    unique_users: number;
  }>;
  user_engagement: {
    total_users: number;
    avg_comparisons_per_user: number;
    most_active_users: Array<{
      username: string;
      total: number;
    }>;
  };
  model_performance: {
    base_model: {
      total_preferred: number;
      percentage: number;
    };
    finetuned_model: {
      total_preferred: number;
      percentage: number;
    };
  };
}

export default function AdminPanel() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    checkAdmin();
    fetchStats();
    fetchResults();
    fetchAnalytics();
  }, [page, search]);

  const checkAdmin = async () => {
    try {
      const response = await fetch('/auth/is_admin', {
        credentials: 'include'
      });
      const data = await response.json();
      setIsAdmin(data.is_admin);
      if (!data.is_admin) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/results?page=${page}&per_page=10&search=${encodeURIComponent(search)}`,
        { 
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched results:', data); // For debugging
      
      setResults(data.results);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('Error fetching results:', error);
      setResults([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/analytics', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/admin/export?format=csv', {
        credentials: 'include'
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comparison-results.csv';
        a.click();
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const renderCodeWithHighlight = (code: string, language = 'python') => (
    <Highlight theme={themes.nightOwl} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre 
          className={`${className} p-4 rounded overflow-x-auto border-2 border-gray-700`} 
          style={style}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );

  if (!isAdmin || loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  const chartData = stats ? {
    labels: stats.model_preferences.map(p => p.model === 'base' ? 'Base Model' : 'Finetuned Model'),
    datasets: [{
      data: stats.model_preferences.map(p => p.count),
      backgroundColor: ['#4F46E5', '#10B981'],
      borderWidth: 0
    }]
  } : null;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6 relative z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Link 
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors relative"
          >
            Return to Home
          </Link>
        </div>
        <div>
          <button
            onClick={() => exportData()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <div className="space-y-2">
            <p className="font-bold text-white">
              Total Comparisons: {stats?.total_comparisons || 0}
            </p>
            {stats?.model_preferences.map((pref) => (
              <p 
                key={pref.model} 
                className={`font-bold ${
                  pref.model === 'finetuned' && pref.percentage > 50 
                    ? 'text-green-400' 
                    : pref.model === 'base' && pref.percentage > 50 
                      ? 'text-green-400'
                      : 'text-red-400'
                }`}
              >
                {pref.model === 'base' ? 'Base Model' : 'Fine-tuned Model'}{' '}
                {pref.percentage}% ({pref.count} votes)
              </p>
            ))}
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Model Preferences</h2>
          <div className="h-48">
            {chartData && (
              <Doughnut
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false
                }}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Comparisons</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.daily_stats || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total_comparisons" stroke="#8884d8" name="Total Comparisons" />
                <Line type="monotone" dataKey="unique_users" stroke="#82ca9d" name="Unique Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">User Engagement</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold">{analytics?.user_engagement.total_users}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Average Comparisons per User</p>
              <p className="text-2xl font-bold">
                {analytics?.user_engagement.avg_comparisons_per_user.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Most Active Users</p>
              {analytics?.user_engagement.most_active_users.map((user, index) => (
                <div key={user.username} className="flex justify-between items-center py-1">
                  <span>{user.username}</span>
                  <span className="font-medium">{user.total} comparisons</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Results Table */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Comparisons</h2>
          <input
            type="text"
            placeholder="Search..."
            className="px-4 py-2 border rounded"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="overflow-x-auto">
          {results.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Preferred Model</th>
                  <th className="text-left p-2">Code Prefix</th>
                  <th className="text-left p-2">Created At</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <>
                    <tr 
                      key={result.id} 
                      className="border-b border-gray-700 cursor-pointer transition-colors"
                      onClick={() => setExpandedRow(expandedRow === result.id ? null : result.id)}
                    >
                      <td className="p-2">{result.github_username}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          result.preferred_model === 'base' 
                            ? 'bg-indigo-100 text-indigo-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {result.preferred_model === 'base' ? 'Base' : 'Finetuned'}
                        </span>
                      </td>
                      <td className="p-2">
                        <code className="text-sm">{result.code_prefix.substring(0, 50)}...</code>
                      </td>
                      <td className="p-2">
                        {new Date(result.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}
                      </td>
                    </tr>
                    {expandedRow === result.id && (
                      <tr>
                        <td colSpan={4} className="p-4 bg-gray-900 border-b border-gray-700">
                          <div className="space-y-6">
                            <div>
                              <h3 className="font-semibold mb-2 text-white">Original Prompt</h3>
                              {renderCodeWithHighlight(result.code_prefix)}
                            </div>
                            
                            <div>
                              <h3 className="font-semibold mb-2 text-white">
                                <span className={result.preferred_model === 'base' ? 'text-green-400' : 'text-red-400'}>
                                  {result.preferred_model === 'base' ? 'Selected' : 'Rejected'}
                                </span>
                                <span className="text-gray-400 ml-2">
                                  Completion (Base Model - Qwen/Qwen2.5-Coder-0.5B)
                                </span>
                              </h3>
                              {renderCodeWithHighlight(result.base_completion)}
                            </div>

                            <div>
                              <h3 className="font-semibold mb-2 text-white">
                                <span className={result.preferred_model === 'finetuned' ? 'text-green-400' : 'text-red-400'}>
                                  {result.preferred_model === 'finetuned' ? 'Selected' : 'Rejected'}
                                </span>
                                <span className="text-gray-400 ml-2">
                                  Completion (Fine-tuned Model - stacklok/Qwen2.5-Coder-0.5B-codegate)
                                </span>
                              </h3>
                              {renderCodeWithHighlight(result.finetuned_completion)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {loading ? 'Loading...' : 'No results found'}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  );
} 