'use client';
import { useState } from 'react';
import { ExportForm } from '@/components/ExportForm';
import { ExportList } from '@/components/ExportList';

export function ClientDashboard() {
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="space-y-6">
      <ExportForm onCreated={() => setRefresh((r) => r + 1)} />
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Historique</h2>
        <ExportList refresh={refresh} />
      </div>
    </div>
  );
}
