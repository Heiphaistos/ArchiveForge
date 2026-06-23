'use client';
import { useState } from 'react';
import { ExportForm } from '@/components/ExportForm';
import { ExportList } from '@/components/ExportList';

export function ClientDashboard() {
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <div className="card">
        <div className="card-title">Nouvel export</div>
        <ExportForm onCreated={() => setRefresh((r) => r + 1)} />
      </div>

      <div className="section-title">Historique</div>
      <ExportList refresh={refresh} />
    </>
  );
}
