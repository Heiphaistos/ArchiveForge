'use client';
import { useEffect, useState, useCallback } from 'react';
import { ExportCard, type JobRow } from './ExportCard';

interface Props {
  refresh: number;
}

export function ExportList({ refresh }: Props) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/exports');
    if (res.ok) {
      const data = (await res.json()) as JobRow[];
      setJobs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refresh]);

  // Polling auto si jobs actifs ou en attente
  useEffect(() => {
    const hasLive = jobs.some((j) => j.status === 'active' || j.status === 'pending');
    if (!hasLive) return;
    const id = setInterval(load, 3_000);
    return () => clearInterval(id);
  }, [jobs, load]);

  async function handleDelete(id: string) {
    await fetch(`/api/exports/${id}`, { method: 'DELETE' });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        Chargement…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-lg">Aucun export</p>
        <p className="text-sm mt-1">Lance ton premier export ci-dessus</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <ExportCard key={job.id} job={job} onDelete={handleDelete} />
      ))}
    </div>
  );
}
