'use client';
import { useState } from 'react';
import { ExportForm } from '@/components/ExportForm';
import { ExportList } from '@/components/ExportList';
import { ImportForm } from '@/components/ImportForm';
import { ImportList } from '@/components/ImportList';

type Tab = 'export' | 'import';

export function ClientDashboard() {
  const [tab, setTab] = useState<Tab>('export');
  const [exportRefresh, setExportRefresh] = useState(0);
  const [importRefresh, setImportRefresh] = useState(0);

  return (
    <>
      <div className="tabs">
        <button
          className={`tab ${tab === 'export' ? 'tab-active' : ''}`}
          onClick={() => setTab('export')}
        >
          ↓ Exporter
        </button>
        <button
          className={`tab ${tab === 'import' ? 'tab-active' : ''}`}
          onClick={() => setTab('import')}
        >
          ↑ Importer / Cloner
        </button>
      </div>

      {tab === 'export' && (
        <>
          <div className="card">
            <div className="card-title">Nouvel export</div>
            <ExportForm onCreated={() => setExportRefresh((r) => r + 1)} />
          </div>
          <div className="section-title">Historique exports</div>
          <ExportList refresh={exportRefresh} />
        </>
      )}

      {tab === 'import' && (
        <>
          <div className="card">
            <div className="card-title">Importer un export</div>
            <ImportForm onCreated={() => setImportRefresh((r) => r + 1)} />
          </div>
          <div className="section-title">Historique imports</div>
          <ImportList refresh={importRefresh} />
        </>
      )}
    </>
  );
}
