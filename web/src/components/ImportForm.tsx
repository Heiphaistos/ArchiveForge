'use client';
import { useState, useEffect, useCallback } from 'react';

interface ExportJobSummary {
  id: string;
  guildId: string;
  guildName: string | null;
  format: string;
  status: string;
  channelCount: number | null;
  messageCount: number | null;
  createdAt: number;
  zipPath: string | null;
}

interface Props {
  onCreated: () => void;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function ImportForm({ onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [exports, setExports] = useState<ExportJobSummary[]>([]);
  const [exportsLoading, setExportsLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [targetGuildId, setTargetGuildId] = useState('');
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2
  const [importCategories, setImportCategories] = useState(true);
  const [importChannels, setImportChannels] = useState(true);
  const [importRoles, setImportRoles] = useState(false);
  const [importMessages, setImportMessages] = useState(false);
  const [messageLimit, setMessageLimit] = useState(200);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadExports = useCallback(async () => {
    const res = await fetch('/api/exports');
    if (res.ok) {
      const data = (await res.json()) as ExportJobSummary[];
      setExports(data.filter((j) => j.status === 'completed' && j.zipPath));
    }
    setExportsLoading(false);
  }, []);

  useEffect(() => { loadExports(); }, [loadExports]);

  const selectedExport = exports.find((e) => e.id === selectedJobId) ?? null;

  function handleNext() {
    setStep1Error(null);
    if (!selectedJobId) { setStep1Error('Sélectionne un export source'); return; }
    if (!/^\d{17,20}$/.test(targetGuildId.trim())) {
      setStep1Error('Guild ID cible invalide (17-20 chiffres)');
      return;
    }
    setStep(2);
  }

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceJobId: selectedJobId,
          targetGuildId: targetGuildId.trim(),
          importCategories,
          importChannels,
          importRoles,
          importMessages,
          messageLimit,
        }),
      });
      const data = await res.json() as { error?: unknown };
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      // Reset
      setStep(1);
      setSelectedJobId('');
      setTargetGuildId('');
      setImportMessages(false);
      setImportRoles(false);
      setMessageLimit(200);
      onCreated();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="form-stepper">
      {/* Step indicators */}
      <div className="steps-indicator">
        {(['Source & Cible', 'Options'] as const).map((label, i) => (
          <>
            <div key={label} className={`step-item ${step === i + 1 ? 'step-active' : step > i + 1 ? 'step-done' : ''}`}>
              <div className="step-dot">{step > i + 1 ? '✓' : i + 1}</div>
              <span className="step-label">{label}</span>
            </div>
            {i < 1 && <div key={`line-${i}`} className="step-line" />}
          </>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="form">
          <div className="field">
            <label className="label">Export source</label>
            {exportsLoading ? (
              <div className="spinner"><div className="spin" />Chargement des exports…</div>
            ) : exports.length === 0 ? (
              <div className="info-box">Aucun export terminé disponible. Lance d&apos;abord un export.</div>
            ) : (
              <select
                className="select"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                <option value="">-- Choisir un export --</option>
                {exports.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.guildName ?? ex.guildId} · {ex.format.toUpperCase()}
                    {ex.channelCount != null ? ` · ${ex.channelCount} salons` : ''}
                    {ex.messageCount != null ? ` · ${ex.messageCount.toLocaleString()} msg` : ''}
                    {' · '}{fmtDate(ex.createdAt)}
                  </option>
                ))}
              </select>
            )}
            {selectedExport && (
              <div className="import-source-preview">
                <span className="import-source-label">
                  Cloner <strong>{selectedExport.guildName ?? selectedExport.guildId}</strong>
                  {' '}({selectedExport.format.toUpperCase()})
                </span>
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Guild ID du serveur cible</label>
            <input
              className="input"
              value={targetGuildId}
              onChange={(e) => setTargetGuildId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              placeholder="123456789012345678"
              pattern="\d{17,20}"
            />
            <span className="hint">Le bot doit être membre de ce serveur avec la permission Administrateur</span>
          </div>

          {step1Error && <div className="error-box">{step1Error}</div>}

          <button type="button" className="btn btn-primary btn-block" onClick={handleNext}>
            Suivant →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="form">
          <div className="import-warning">
            ⚠ Le bot créera des canaux et rôles dans le serveur cible. Cette action est irréversible.
          </div>

          <div className="field">
            <label className="label">Options d&apos;import</label>

            <label className="toggle-row">
              <div className="toggle-wrap">
                <input type="checkbox" checked={importCategories} onChange={(e) => setImportCategories(e.target.checked)} />
                <div className="toggle-track" /><div className="toggle-thumb" />
              </div>
              <div>
                <div className="toggle-label">Créer les catégories</div>
                <div className="toggle-desc">Recrée l&apos;arborescence des catégories</div>
              </div>
            </label>

            <label className="toggle-row">
              <div className="toggle-wrap">
                <input type="checkbox" checked={importChannels} onChange={(e) => setImportChannels(e.target.checked)} />
                <div className="toggle-track" /><div className="toggle-thumb" />
              </div>
              <div>
                <div className="toggle-label">Créer les salons</div>
                <div className="toggle-desc">Texte, annonces, forums et vocaux</div>
              </div>
            </label>

            <label className="toggle-row">
              <div className="toggle-wrap">
                <input type="checkbox" checked={importRoles} onChange={(e) => setImportRoles(e.target.checked)} />
                <div className="toggle-track" /><div className="toggle-thumb" />
              </div>
              <div>
                <div className="toggle-label">Créer les rôles</div>
                <div className="toggle-desc">Couleurs uniquement — les permissions ne sont pas transférées</div>
              </div>
            </label>

            <label className="toggle-row">
              <div className="toggle-wrap">
                <input type="checkbox" checked={importMessages} onChange={(e) => setImportMessages(e.target.checked)} />
                <div className="toggle-track" /><div className="toggle-thumb" />
              </div>
              <div>
                <div className="toggle-label">Rejouer les messages</div>
                <div className="toggle-desc">Envoie les messages via webhooks (lent — ~1 msg/sec)</div>
              </div>
            </label>

            {importMessages && (
              <div className="field" style={{ marginTop: '12px', paddingLeft: '2px' }}>
                <label className="label">
                  Limite de messages par salon
                  <span className="badge badge-pending" style={{ marginLeft: 8 }}>{messageLimit}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={2000}
                  step={50}
                  value={messageLimit}
                  onChange={(e) => setMessageLimit(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--blurple)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  <span>1</span>
                  <span>~{Math.ceil(messageLimit * 1.1 / 60)} min/salon</span>
                  <span>2000</span>
                </div>
              </div>
            )}
          </div>

          {submitError && <div className="error-box">{submitError}</div>}

          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Retour</button>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={submitLoading || (!importCategories && !importChannels && !importRoles && !importMessages)}
              onClick={handleSubmit}
            >
              {submitLoading ? <><span className="spin" /> Lancement…</> : '▶ Lancer l\'import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
