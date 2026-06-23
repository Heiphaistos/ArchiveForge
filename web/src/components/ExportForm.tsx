'use client';
import { useState } from 'react';

interface Props {
  onCreated: () => void;
}

export function ExportForm({ onCreated }: Props) {
  const [guildId, setGuildId] = useState('');
  const [format, setFormat] = useState<'spa' | 'html' | 'json'>('spa');
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: guildId.trim(), format, includeAttachments }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: unknown };
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      setGuildId('');
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="field">
        <label className="label">Guild ID</label>
        <input
          className="input"
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          required
          pattern="\d{17,20}"
          title="ID Discord (17-20 chiffres)"
          placeholder="123456789012345678"
        />
        <span className="hint">Clic droit sur le serveur Discord → Copier l&apos;identifiant</span>
      </div>

      <div className="field">
        <label className="label">Format d&apos;export</label>
        <select
          className="select"
          value={format}
          onChange={(e) => setFormat(e.target.value as typeof format)}
        >
          <option value="spa">SPA Viewer — navigable offline (recommandé)</option>
          <option value="html">HTML statique — un fichier par salon</option>
          <option value="json">JSON brut — données complètes</option>
        </select>
      </div>

      <label className="toggle-row">
        <div className="toggle-wrap">
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(e) => setIncludeAttachments(e.target.checked)}
          />
          <div className="toggle-track" />
          <div className="toggle-thumb" />
        </div>
        <div>
          <div className="toggle-label">Télécharger les pièces jointes</div>
          <div className="toggle-desc">Stockage local dans le ZIP (peut être volumineux)</div>
        </div>
      </label>

      {error && <div className="error-box">{error}</div>}

      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? '⏳ Lancement…' : '▶ Lancer l\'export'}
      </button>
    </form>
  );
}
