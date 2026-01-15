"use client";

import { useEffect, useState } from 'react';

interface Stats {
  db: {
    products: number;
    glitches: number;
    anomalies: number;
  };
  queues: {
    scraping: {
      active: number;
      completed: number;
      failed: number;
      waiting: number;
      delayed: number;
    };
  };
  status: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
            </p>
          </div>
          <button 
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </header>

        {loading && !stats && (
            <div className="text-center py-12">Loading stats...</div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Database Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Database</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-600">Products</span>
                  <span className="text-2xl font-mono">{stats.db.products}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-600">Detected Anomalies</span>
                  <span className="text-2xl font-mono">{stats.db.anomalies}</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="text-gray-600">Confirmed Glitches</span>
                  <span className="text-2xl font-mono text-green-600">{stats.db.glitches}</span>
                </div>
              </div>
            </div>

            {/* Queues Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Queue: Scraping</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-xs text-blue-600 uppercase font-bold">Active</div>
                  <div className="text-2xl font-mono text-blue-800">{stats.queues.scraping.active}</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <div className="text-xs text-yellow-600 uppercase font-bold">Waiting</div>
                  <div className="text-2xl font-mono text-yellow-800">{stats.queues.scraping.waiting}</div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                   <div className="text-xs text-green-600 uppercase font-bold">Completed</div>
                   <div className="text-2xl font-mono text-green-800">{stats.queues.scraping.completed}</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                   <div className="text-xs text-red-600 uppercase font-bold">Failed</div>
                   <div className="text-2xl font-mono text-red-800">{stats.queues.scraping.failed}</div>
                </div>
              </div>
            </div>

             {/* System Status Card */}
             <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Health</h2>
               <div className="flex items-center space-x-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${stats.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="uppercase font-bold text-gray-700">{stats.status}</span>
               </div>
               <div className="text-sm text-gray-600">
                  <p>Environment: {process.env.NODE_ENV || 'development'}</p>
               </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
