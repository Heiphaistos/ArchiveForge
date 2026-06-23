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
      <div className="spinner">
        <div className="spin" />
        Chargement…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <p>Aucun export</p>
        <p>Lance ton premier export ci-dessus</p>
      </div>
    );
  }

  return (
    <div className="job-list">
      {jobs.map((job) => (
        <ExportCard key={job.id} job={job} onDelete={handleDelete} />
      ))}
    </div>
  );
}
