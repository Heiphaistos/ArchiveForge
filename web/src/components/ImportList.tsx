'use client';
import { useEffect, useState, useCallback } from 'react';
import { ImportCard, type ImportJobRow } from './ImportCard';

interface Props {
  refresh: number;
}

export function ImportList({ refresh }: Props) {
  const [jobs, setJobs] = useState<ImportJobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/imports');
    if (res.ok) {
      const data = (await res.json()) as ImportJobRow[];
      setJobs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refresh]);

  useEffect(() => {
    const hasLive = jobs.some((j) => j.status === 'active' || j.status === 'pending');
    if (!hasLive) return;
    const id = setInterval(load, 3_000);
    return () => clearInterval(id);
  }, [jobs, load]);

  async function handleDelete(id: string) {
    await fetch(`/api/imports/${id}`, { method: 'DELETE' });
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
        <p>Aucun import</p>
        <p>Lance ton premier import ci-dessus</p>
      </div>
    );
  }

  return (
    <div className="job-list">
      {jobs.map((job) => (
        <ImportCard key={job.id} job={job} onDelete={handleDelete} />
      ))}
    </div>
  );
}
