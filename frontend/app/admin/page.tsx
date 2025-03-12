'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';
import { Highlight, themes } from 'prism-react-renderer';
import Link from 'next/link';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
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

interface User {
  id: number;
  username: string;
  admin: boolean;
}

interface Stats {
  total_comparisons: number;
  model_preferences: Array<{
    model: string;
    count: number;
    percentage: number;
  }>;
}

export default function AdminPanel() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const openModal = () => {
    setIsUserAdmin(false);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  useEffect(() => {
    checkAdmin();
    fetchStats();
    fetchResults();
    fetchUsers();
  }, [page, search]);

  const checkAdmin = async () => {
    try {
      const response = await fetch('/auth/is_admin', {
        credentials: 'include'
      });
      const data = await response.json();
      console.error('Error checking admin status:', data);
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

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `/api/admin/users`,
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
      
      const users = await response.json();
      
      setUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
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

  const grantAdmin = async (username) => {
    try {
      await fetch(`/api/admin/users/${username}/grant-admin`, {
        method: 'PUT',
        credentials: 'include'
      });
    } catch (error) {
      console.error(`Error granting admin to user: ${username}, error: ${error}`);
    }

    fetchUsers();
  };

  const revokeAdmin = async (username) => {
    try {
      await fetch(`/api/admin/users/${username}/revoke-admin`, {
        method: 'PUT',
        credentials: 'include'
      });
    } catch (error) {
      console.error(`Error revoking admin from user: ${username}, error: ${error}`);
    }

    fetchUsers();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, admin: isUserAdmin }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add user');
      }
      
      // Reset form and close modal
      setUsername('');
      setIsUserAdmin(false);
      closeModal();
      
      // Refresh user list or show success message
      // You might want to call a function here to reload your users list
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user. Please try again.');
    } finally {
      setIsLoading(false);
    }

    fetchUsers();
  };

  const deleteUser = async (username) => {
    try {
      await fetch(`/api/admin/users/${username}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error(`Error deleting user ${username}:`, error);
    }

    fetchUsers();
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

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
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
                    <th className="text-left p-2">Prompt</th>
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
        
        {/* User Management Table */}
        <Card className="p-6">

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">User Management</h2>
          <button
            onClick={openModal}
            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 justify-self-end"
          >
            Add User
          </button>
          {/* Modal/Popup */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 max-w-md w-full">
                <h2 className="text-xl font-bold text-gray-700 mb-4">Add New User</h2>
                
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2" htmlFor="username">
                      Github Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full border text-black rounded px-3 py-2"
                      required
                    />
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex items-center">
                      <label className="ml-2 block text-gray-700" htmlFor="isAdmin">
                        Grant Admin?:
                      </label>
                      <input
                        id="isAdmin"
                        type="checkbox"
                        checked={isUserAdmin}
                        onChange={(e) => setIsUserAdmin(e.target.checked)}
                        className="h-4 w-10 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="mr-2 bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300"
                    >
                      {isLoading ? 'Adding...' : 'Add User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </div>
          <div className="overflow-x-auto">
            {users.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Username</th>
                    <th className="text-left p-2">Admin</th>
                    <th className="text-left p-2">Action</th>
                    <th className="text-left p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <>
                      <tr 
                        key={user.id} 
                        className="border-b border-gray-700 transition-colors"
                      >
                        <td className="p-2">{user.username}</td>
                        <td className="p-2">{user.admin == false ? "❌" : "✅"}</td>
                        <td className="p-2">
                          <tr>
                            <td className="px-0">{user.admin == false ?
                                <button
                                  onClick={() => grantAdmin(user.username)}
                                  className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Grant Admin
                                </button>
                              :
                                <button
                                  onClick={() => revokeAdmin(user.username)}
                                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 "
                                >
                                  Revoke Admin
                                </button>
                              }
                            </td>
                          </tr>
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => deleteUser(user.username)}
                            className="px-2 py-1 bg-black-600 text-white rounded hover:bg-white "
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
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
        </Card>
      </div>
    </div>
  );
} 