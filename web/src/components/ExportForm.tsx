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
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-white">Nouvel export</h2>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Guild ID</label>
        <input
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          required
          pattern="\d{17,20}"
          title="ID Discord (17-20 chiffres)"
          placeholder="123456789012345678"
          className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
        <p className="text-xs text-gray-600 mt-1">Clic droit sur le serveur Discord → Copier l&apos;identifiant</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Format d&apos;export</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as typeof format)}
          className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition"
        >
          <option value="spa">SPA Viewer — navigable offline (recommandé)</option>
          <option value="html">HTML statique — un fichier par salon</option>
          <option value="json">JSON brut — données complètes</option>
        </select>
      </div>

      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={includeAttachments}
            onChange={(e) => setIncludeAttachments(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-blue-600 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
        </div>
        <div>
          <span className="text-sm text-gray-300 group-hover:text-white transition">Télécharger les pièces jointes</span>
          <p className="text-xs text-gray-600">Stockage local dans le ZIP (peut être volumineux)</p>
        </div>
      </label>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {loading ? 'Lancement…' : 'Lancer l\'export'}
      </button>
    </form>
  );
}
