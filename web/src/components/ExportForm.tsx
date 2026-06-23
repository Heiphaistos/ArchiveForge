'use client';
import { useState, useCallback } from 'react';

interface ChannelInfo {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
  topic: string | null;
}
interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  channels: ChannelInfo[];
  categories: { id: string; name: string; position: number }[];
}

const FORMAT_OPTIONS = [
  { value: 'spa',      label: 'SPA Viewer',       desc: 'Visionneuse offline navigable — recherche, lightbox, threads', icon: '🌐' },
  { value: 'html',     label: 'HTML statique',     desc: 'Un fichier HTML par salon, lisible dans tout navigateur',     icon: '📄' },
  { value: 'json',     label: 'JSON brut',         desc: 'Données complètes — idéal pour traitement automatisé',        icon: '{ }' },
  { value: 'markdown', label: 'Markdown',           desc: 'Fichiers .md par salon — lisible comme documentation',       icon: '✏️' },
];

const SCOPE_OPTIONS = [
  { value: 'full',     label: 'Export complet',       desc: 'Tous les salons du serveur', icon: '🌍' },
  { value: 'select',   label: 'Salons spécifiques',   desc: 'Choisir canal par canal',    icon: '✅' },
  { value: 'forums',   label: 'Forums uniquement',    desc: 'Tous les forums du serveur', icon: '📋' },
  { value: 'category', label: 'Par catégorie',        desc: 'Sélectionner une catégorie', icon: '📁' },
];

// Discord channel type numbers
const CH_TYPE_FORUM = 15;
const CH_TYPE_MEDIA = 16;

function getChannelIcon(type: number): string {
  if (type === 15 || type === 16) return '📋';
  if (type === 5) return '📣';
  if (type === 2) return '🔊';
  return '#';
}

interface Props {
  onCreated: () => void;
}

export function ExportForm({ onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [guildInput, setGuildInput] = useState('');
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Step 2
  const [scope, setScope] = useState<'full' | 'select' | 'forums' | 'category'>('full');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Step 3
  const [format, setFormat] = useState<'spa' | 'html' | 'json' | 'markdown'>('spa');
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [afterDate, setAfterDate] = useState('');
  const [beforeDate, setBeforeDate] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchGuild = useCallback(async () => {
    const id = guildInput.trim();
    if (!/^\d{17,20}$/.test(id)) {
      setFetchError('ID invalide (17-20 chiffres)');
      return;
    }
    setFetchLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/guild-info?guildId=${id}`);
      const data = await res.json() as { error?: string } & GuildInfo;
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
      setGuildInfo(data);
      setStep(2);
    } catch (e) {
      setFetchError((e as Error).message);
    } finally {
      setFetchLoading(false);
    }
  }, [guildInput]);

  function toggleChannel(id: string) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCategory(catId: string) {
    const catChannels = guildInfo!.channels.filter((c) => c.parentId === catId).map((c) => c.id);
    const allSelected = catChannels.every((id) => selectedChannels.has(id));
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      catChannels.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function selectAll() {
    setSelectedChannels(new Set(guildInfo!.channels.map((c) => c.id)));
  }
  function selectNone() {
    setSelectedChannels(new Set());
  }

  function getChannelIds(): string[] | undefined {
    if (!guildInfo) return undefined;
    if (scope === 'full') return undefined;
    if (scope === 'forums') {
      return guildInfo.channels
        .filter((c) => c.type === CH_TYPE_FORUM || c.type === CH_TYPE_MEDIA)
        .map((c) => c.id);
    }
    if (scope === 'category') {
      return selectedCategory
        ? guildInfo.channels.filter((c) => c.parentId === selectedCategory).map((c) => c.id)
        : undefined;
    }
    return selectedChannels.size > 0 ? [...selectedChannels] : undefined;
  }

  async function handleSubmit() {
    if (!guildInfo) return;
    setSubmitLoading(true);
    setSubmitError(null);

    const channelIds = getChannelIds();
    const body: Record<string, unknown> = {
      guildId: guildInfo.id,
      format,
      includeAttachments,
      channelIds,
    };
    if (afterDate) body.afterDate = new Date(afterDate).toISOString();
    if (beforeDate) body.beforeDate = new Date(beforeDate).toISOString();

    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: unknown };
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      setStep(1);
      setGuildInput('');
      setGuildInfo(null);
      setSelectedChannels(new Set());
      setScope('full');
      setFormat('spa');
      setAfterDate('');
      setBeforeDate('');
      onCreated();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitLoading(false);
    }
  }

  // ------ RENDER ------

  return (
    <div className="form-stepper">
      {/* Step indicators */}
      <div className="steps-indicator">
        {(['Serveur', 'Portée', 'Options'] as const).map((label, i) => (
          <div key={label} className={`step-item ${step === i + 1 ? 'step-active' : step > i + 1 ? 'step-done' : ''}`}>
            <div className="step-dot">{step > i + 1 ? '✓' : i + 1}</div>
            <span className="step-label">{label}</span>
            {i < 2 && <div className="step-line" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Guild */}
      {step === 1 && (
        <div className="form">
          <div className="field">
            <label className="label">Guild ID</label>
            <div className="input-row">
              <input
                className="input"
                value={guildInput}
                onChange={(e) => setGuildInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchGuild()}
                placeholder="123456789012345678"
                pattern="\d{17,20}"
              />
              <button
                type="button"
                className="btn btn-primary btn-inline"
                onClick={fetchGuild}
                disabled={fetchLoading}
              >
                {fetchLoading ? <span className="spin" /> : '→'}
              </button>
            </div>
            <span className="hint">Clic droit sur le serveur → Copier l&apos;identifiant</span>
          </div>
          {fetchError && <div className="error-box">{fetchError}</div>}
        </div>
      )}

      {/* Step 2 — Scope */}
      {step === 2 && guildInfo && (
        <div className="form">
          <div className="guild-badge">
            {guildInfo.icon && <img src={guildInfo.icon} alt="" className="guild-icon" />}
            <div>
              <div className="guild-name">{guildInfo.name}</div>
              <div className="guild-meta">{guildInfo.channels.length} salons · {guildInfo.categories.length} catégories</div>
            </div>
          </div>

          <div className="field">
            <label className="label">Mode d&apos;export</label>
            <div className="scope-grid">
              {SCOPE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`scope-card ${scope === s.value ? 'scope-selected' : ''}`}
                  onClick={() => setScope(s.value as typeof scope)}
                >
                  <span className="scope-icon">{s.icon}</span>
                  <span className="scope-label">{s.label}</span>
                  <span className="scope-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {scope === 'select' && (
            <div className="field">
              <div className="ch-header">
                <label className="label">Salons</label>
                <div className="ch-actions">
                  <button type="button" className="btn-link" onClick={selectAll}>Tout</button>
                  <button type="button" className="btn-link" onClick={selectNone}>Aucun</button>
                  <span className="ch-count">{selectedChannels.size} sélectionné{selectedChannels.size > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="ch-list">
                {guildInfo.categories.map((cat) => {
                  const catChannels = guildInfo.channels.filter((c) => c.parentId === cat.id);
                  if (catChannels.length === 0) return null;
                  const allSel = catChannels.every((c) => selectedChannels.has(c.id));
                  const someSel = catChannels.some((c) => selectedChannels.has(c.id));
                  return (
                    <div key={cat.id} className="ch-category">
                      <button
                        type="button"
                        className={`ch-cat-row ${allSel ? 'ch-selected' : someSel ? 'ch-partial' : ''}`}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <span className="ch-cat-check">{allSel ? '☑' : someSel ? '▣' : '☐'}</span>
                        <span className="ch-cat-name">📁 {cat.name.toUpperCase()}</span>
                      </button>
                      {catChannels.map((ch) => (
                        <label key={ch.id} className={`ch-item ${selectedChannels.has(ch.id) ? 'ch-selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedChannels.has(ch.id)}
                            onChange={() => toggleChannel(ch.id)}
                          />
                          <span className="ch-icon">{getChannelIcon(ch.type)}</span>
                          <span className="ch-name">{ch.name}</span>
                          {ch.topic && <span className="ch-topic">{ch.topic.slice(0, 40)}</span>}
                        </label>
                      ))}
                    </div>
                  );
                })}
                {/* Channels without category */}
                {guildInfo.channels.filter((c) => !c.parentId).map((ch) => (
                  <label key={ch.id} className={`ch-item ${selectedChannels.has(ch.id) ? 'ch-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.has(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                    />
                    <span className="ch-icon">{getChannelIcon(ch.type)}</span>
                    <span className="ch-name">{ch.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {scope === 'category' && (
            <div className="field">
              <label className="label">Catégorie</label>
              <select
                className="select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">-- Choisir une catégorie --</option>
                {guildInfo.categories.map((cat) => {
                  const count = guildInfo.channels.filter((c) => c.parentId === cat.id).length;
                  return <option key={cat.id} value={cat.id}>{cat.name} ({count} salons)</option>;
                })}
              </select>
            </div>
          )}

          {scope === 'forums' && (
            <div className="info-box">
              {guildInfo.channels.filter((c) => c.type === CH_TYPE_FORUM || c.type === CH_TYPE_MEDIA).length} forum(s) détecté(s) dans ce serveur
            </div>
          )}

          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Retour</button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Suivant →</button>
          </div>
        </div>
      )}

      {/* Step 3 — Format + Options */}
      {step === 3 && guildInfo && (
        <div className="form">
          <div className="field">
            <label className="label">Format d&apos;export</label>
            <div className="format-grid">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`format-card ${format === f.value ? 'format-selected' : ''}`}
                  onClick={() => setFormat(f.value as typeof format)}
                >
                  <span className="format-icon">{f.icon}</span>
                  <span className="format-label">{f.label}</span>
                  <span className="format-desc">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">Filtre par date (optionnel)</label>
            <div className="date-row">
              <div className="field" style={{ flex: 1 }}>
                <label className="label" style={{ fontSize: '0.72rem' }}>Depuis</label>
                <input type="datetime-local" className="input" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="label" style={{ fontSize: '0.72rem' }}>Jusqu&apos;au</label>
                <input type="datetime-local" className="input" value={beforeDate} onChange={(e) => setBeforeDate(e.target.value)} />
              </div>
            </div>
          </div>

          <label className="toggle-row">
            <div className="toggle-wrap">
              <input type="checkbox" checked={includeAttachments} onChange={(e) => setIncludeAttachments(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </div>
            <div>
              <div className="toggle-label">Télécharger les pièces jointes</div>
              <div className="toggle-desc">Stocke images/fichiers dans le ZIP (peut être très volumineux)</div>
            </div>
          </label>

          {submitError && <div className="error-box">{submitError}</div>}

          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>← Retour</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitLoading}
              onClick={handleSubmit}
            >
              {submitLoading ? <><span className="spin" /> Lancement…</> : '▶ Lancer l\'export'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
