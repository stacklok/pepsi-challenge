"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from "chart.js";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { getMarkdownNormalize } from "@/lib/utils";
import { Header } from "@/components/Header";
import { useUser } from "@/hooks/useUser";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/TablePagination";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { usePrevious } from "@/hooks/usePrevious";

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
  experiment_id: string | null;
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

interface Stat {
  experiment_id: string; // Could be "all" or a specific experiment ID
  total_comparisons: number;
  model_preferences: Array<{
    model: string;
    count: number;
    percentage: number;
  }>;
}

interface Stats {
  stats: Stat[];
}

export default function AdminPanel() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const user = useUser();
  const theme = useTheme();
  const prevPage = usePrevious(page);

  useEffect(() => {
    checkAdmin();
    fetchStats();
    fetchResults();
    fetchUsers();
  }, []);

  useEffect(() => {
    if(page !== prevPage) {
      fetchResults();
    }
  }, [page, prevPage])

  const checkAdmin = async () => {
    try {
      const response = await fetch("/auth/is_admin", {
        credentials: "include",
      });
      const data = await response.json();
      setIsAdmin(data.is_admin);
      if (!data.is_admin) {
        router.push("/");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.push("/");
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/results?page=${page}&per_page=10`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched results:", data); // For debugging

      setResults(data.results);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error("Error fetching results:", error);
      setResults([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const users = await response.json();

      setUsers(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch("/api/admin/export?format=csv", {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "comparison-results.csv";
        a.click();
      }
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  const grantAdmin = async (username) => {
    try {
      await fetch(`/api/admin/users/${username}/grant-admin`, {
        method: "PUT",
        credentials: "include",
      });
    } catch (error) {
      console.error(
        `Error granting admin to user: ${username}, error: ${error}`
      );
    }

    fetchUsers();
  };

  const revokeAdmin = async (username) => {
    try {
      await fetch(`/api/admin/users/${username}/revoke-admin`, {
        method: "PUT",
        credentials: "include",
      });
    } catch (error) {
      console.error(
        `Error revoking admin from user: ${username}, error: ${error}`
      );
    }

    fetchUsers();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, admin: isUserAdmin }),
      });

      if (!response.ok) {
        throw new Error("Failed to add user");
      }

      // Reset form and close modal
      setUsername("");
      setIsUserAdmin(false);

      // Refresh user list or show success message
      // You might want to call a function here to reload your users list
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Failed to add user. Please try again.");
    } finally {
      setIsLoading(false);
    }

    fetchUsers();
  };

  const deleteUser = async (username) => {
    try {
      await fetch(`/api/admin/users/${username}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch (error) {
      console.error(`Error deleting user ${username}:`, error);
    }

    fetchUsers();
  };

  const renderCodeWithHighlight = (code: string, isFim: boolean) => (
    <Markdown value={getMarkdownNormalize(isFim, code)} />
  );

  if (!isAdmin) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  const overallStat = stats?.stats.find((stat) => stat.experiment_id === "all");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header user={user} />
      <div className="max-w-7xl container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
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
            <Button onClick={() => exportData()} variant="secondary">
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 min-h-72">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-white">
                Total Comparisons: {overallStat?.total_comparisons || 0}
              </p>
              {overallStat?.model_preferences?.map((pref) => (
                <p
                  key={pref.model}
                  className={`font-bold ${
                    pref.model === "finetuned" && pref.percentage > 50
                      ? "text-green-400"
                      : pref.model === "base" && pref.percentage > 50
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {pref.model === "base" ? "Base Model" : "Fine-tuned Model"}{" "}
                  {pref.percentage}% ({pref.count} votes)
                </p>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Model Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              {overallStat && (
                <Doughnut
                  height="250"
                  data={{
                    labels: overallStat.model_preferences?.map((p) =>
                      p.model === "base" ? "Base Model" : "Finetuned Model"
                    ),
                    datasets: [
                      {
                        data: overallStat.model_preferences?.map(
                          (p) => p.count
                        ),
                        backgroundColor: ["#4F46E5", "#10B981"],
                        borderWidth: 0,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    color: theme.selected === "dark" ? "white" : "black",
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Comparisons</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length > 0 ? (
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Preferred Model</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead>Experiment</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <Fragment key={result.id}>
                        <TableRow
                          className="cursor-pointer transition-colors"
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === result.id ? null : result.id
                            )
                          }
                        >
                          <TableCell className="p-2">
                            {result.github_username}
                          </TableCell>
                          <TableCell className="p-2">
                            <span
                              className={`px-2 py-1 rounded text-sm ${
                                result.preferred_model === "base"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {result.preferred_model === "base"
                                ? "Base"
                                : "Finetuned"}
                            </span>
                          </TableCell>
                          <TableCell className="p-2">
                            <code className="text-sm">
                              {result.code_prefix.substring(0, 50)}...
                            </code>
                          </TableCell>
                          <TableCell className="p-2">
                            {result?.experiment_id ?? "N/A"}
                          </TableCell>
                          <TableCell className="p-2">
                            {new Date(result.created_at).toLocaleString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false,
                              }
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedRow === result.id && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="p-4 bg-popover-foreground dark:bg-popover"
                            >
                              <div className="space-y-6">
                                <div>
                                  <h3 className="font-semibold mb-2 text-white">
                                    Original Prompt
                                  </h3>
                                  {renderCodeWithHighlight(
                                    result.code_prefix,
                                    result?.experiment_id
                                      ? result.experiment_id.includes("FIM")
                                      : true
                                  )}
                                </div>

                                <div>
                                  <h3 className="font-semibold mb-2 text-white">
                                    <span
                                      className={
                                        result.preferred_model === "base"
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {result.preferred_model === "base"
                                        ? "Selected"
                                        : "Rejected"}
                                    </span>
                                    <span className="text-gray-400 ml-2">
                                      Completion (Base Model -
                                      Qwen/Qwen2.5-Coder-0.5B)
                                    </span>
                                  </h3>
                                  {renderCodeWithHighlight(
                                    result.base_completion,
                                    result?.experiment_id
                                      ? result.experiment_id.includes("FIM")
                                      : true
                                  )}
                                </div>

                                <div>
                                  <h3 className="font-semibold mb-2 text-white">
                                    <span
                                      className={
                                        result.preferred_model === "finetuned"
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {result.preferred_model === "finetuned"
                                        ? "Selected"
                                        : "Rejected"}
                                    </span>
                                    <span className="text-gray-400 ml-2">
                                      Completion (Fine-tuned Model -
                                      stacklok/Qwen2.5-Coder-0.5B-codegate)
                                    </span>
                                  </h3>
                                  {renderCodeWithHighlight(
                                    result.finetuned_completion,
                                    result?.experiment_id
                                      ? result.experiment_id.includes("FIM")
                                      : true
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {loading ? "Loading..." : "No results found"}
                </div>
              )}

              {results.length > 0 && (
                <TablePagination
                  page={page}
                  setPage={setPage}
                  totalPages={totalPages}
                />
              )}
            </CardContent>
          </Card>

          {stats?.stats.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Experiment Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Experiment</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Base Model</TableHead>
                      <TableHead>Finetuned Model</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.stats
                      .filter((stat) => stat.experiment_id !== "all")
                      .map((stat) => {
                        const basePreference = stat.model_preferences.find(
                          (p) => p.model === "base"
                        );
                        const finetunedPreference = stat.model_preferences.find(
                          (p) => p.model === "finetuned"
                        );

                        return (
                          <TableRow key={stat.experiment_id}>
                            <TableCell>{stat.experiment_id}</TableCell>
                            <TableCell>{stat.total_comparisons}</TableCell>
                            <TableCell>
                              {basePreference ? (
                                <span
                                  className={`${
                                    basePreference.percentage > 50
                                      ? "text-green-400"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {basePreference.count} (
                                  {basePreference.percentage}%)
                                </span>
                              ) : (
                                "0 (0%)"
                              )}
                            </TableCell>
                            <TableCell>
                              {finetunedPreference ? (
                                <span
                                  className={`${
                                    finetunedPreference.percentage > 50
                                      ? "text-green-400"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {finetunedPreference.count} (
                                  {finetunedPreference.percentage}%)
                                </span>
                              ) : (
                                "0 (0%)"
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* User Management Table */}
          <Card>
            <CardHeader className="flex flex-row justify-between items-center w-full">
              <CardTitle>User Management</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Add User</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="flex flex-col mb-2">
                      <label htmlFor="username" className="mb-2">
                        Github Username
                      </label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center">
                        <label htmlFor="isAdmin">Grant Admin?:</label>
                        <Checkbox
                          id="isAdmin"
                          checked={isUserAdmin}
                          onCheckedChange={(val) =>
                            typeof val === "boolean" && setIsUserAdmin(val)
                          }
                          className="ml-4"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <DialogClose asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="mr-4"
                        >
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? "Adding..." : "Add User"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {users.length > 0 ? (
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Preferred Model</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <Fragment key={user.id}>
                          <TableRow key={user.id}>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>
                              {user.admin === false ? "❌" : "✅"}
                            </TableCell>
                            <TableCell>
                              <div className="px-0">
                                {user.admin === false ? (
                                  <Button
                                    onClick={() => grantAdmin(user.username)}
                                    variant="secondary"
                                  >
                                    Grant Admin
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => revokeAdmin(user.username)}
                                    variant="destructive"
                                  >
                                    Revoke Admin
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => deleteUser(user.username)}
                                variant="ghost"
                                size="icon"
                                title="Delete User"
                              >
                                🗑️
                              </Button>
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {loading ? "Loading..." : "No results found"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
