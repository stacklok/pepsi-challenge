'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Doughnut } from 'react-chartjs-2';
import { formatDistanceToNow } from 'date-fns';
import { endpoints } from '@/config/api';

interface UserStats {
  total_comparisons: number;
  preferences: {
    base: number;
    finetuned: number;
  };
  recent_comparisons: Array<{
    id: number;
    code_prefix: string;
    preferred_model: string;
    created_at: string;
  }>;
}

export default function Dashboard() {
  const router = useRouter();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(endpoints.user_stats, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setUserStats(data);
        } else if (response.status === 401) {
          router.push(endpoints.login);
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [router]);

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (!userStats) {
    return <div className="text-center p-8">No data available</div>;
  }

  const chartData = {
    labels: ['Base Model', 'Finetuned Model'],
    datasets: [{
      data: [userStats.preferences.base, userStats.preferences.finetuned],
      backgroundColor: ['#4F46E5', '#10B981'],
      borderWidth: 0
    }]
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Comparisons Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Total Comparisons</h2>
          <p className="text-3xl font-bold text-indigo-600">
            {userStats.total_comparisons}
          </p>
        </Card>

        {/* Model Preferences Chart */}
        <Card className="p-6 col-span-2">
          <h2 className="text-lg font-semibold mb-4">Your Model Preferences</h2>
          <div className="h-64">
            <Doughnut
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false
              }}
            />
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-full p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {userStats.recent_comparisons.map((comparison) => (
              <div
                key={comparison.id}
                className="border-b pb-4 last:border-0"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm text-gray-600">
                      {comparison.code_prefix}
                    </p>
                    <p className="text-sm mt-1">
                      Preferred: <span className="font-semibold">
                        {comparison.preferred_model === 'base' ? 'Base Model' : 'Finetuned Model'}
                      </span>
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(comparison.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
