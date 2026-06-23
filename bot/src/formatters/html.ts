import fs from 'fs/promises';
import path from 'path';
import type { ChannelData, MessageData } from '../types.js';

export async function writeHtmlExport(channels: ChannelData[], outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  for (const ch of channels) {
    const html = buildChannelHtml(ch);
    await fs.writeFile(path.join(outputDir, `${ch.name}-${ch.id}.html`), html, 'utf-8');
  }
}

function buildChannelHtml(ch: ChannelData): string {
  const msgs = ch.messages.map(renderMsg).join('\n');
  const threadSections = ch.threads
    .map(
      (t) => `<section class="thread">
<h2>🧵 ${escapeHtml(t.name)} ${t.archived ? '(archivé)' : ''}</h2>
${t.messages.map(renderMsg).join('\n')}
</section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>#${escapeHtml(ch.name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#313338;color:#dbdee1;padding:16px;line-height:1.4}
h1{font-size:1.2rem;margin-bottom:16px;color:#f2f3f5;padding-bottom:8px;border-bottom:1px solid #3f4147}
h2{font-size:1rem;margin:24px 0 12px;color:#949ba4}
.msg{display:flex;gap:12px;padding:4px 0;border-radius:4px}
.msg:hover{background:rgba(255,255,255,.03)}
.avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#5865f2;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff}
.meta{font-size:.75em;color:#949ba4;margin-bottom:2px}
.username{font-weight:600;color:#f2f3f5;margin-right:8px}
.content{white-space:pre-wrap;word-break:break-word;font-size:.95em}
.att{margin-top:6px}
.att img{max-width:400px;max-height:300px;border-radius:4px;display:block}
.att a{color:#00a8fc;text-decoration:none}
.dead{color:#ed4245;text-decoration:line-through}
.thread{margin:24px 0;padding:16px;background:#2b2d31;border-radius:8px}
</style>
</head>
<body>
<h1>#${escapeHtml(ch.name)}</h1>
${msgs}
${threadSections}
</body>
</html>`;
}

function renderMsg(msg: MessageData): string {
  const avatar = `<img class="avatar" src="${msg.authorAvatar ?? ''}" alt="${escapeHtml(msg.authorName)}" loading="lazy">`;
  const date = new Date(msg.timestamp).toLocaleString('fr-FR');
  const atts = msg.attachments
    .map((a) => {
      if (!a.isAlive) return `<div class="att"><span class="dead">${escapeHtml(a.filename)} (lien mort)</span></div>`;
      const src = a.localPath ? `./attachments/${a.id}_${a.filename}` : a.url;
      const isImg = a.contentType?.startsWith('image/');
      return `<div class="att">${isImg ? `<img src="${src}" alt="${escapeHtml(a.filename)}" loading="lazy">` : `<a href="${src}">${escapeHtml(a.filename)}</a>`}</div>`;
    })
    .join('');

  return `<div class="msg">
${avatar}
<div style="min-width:0;flex:1">
<div class="meta"><span class="username">${escapeHtml(msg.authorName)}</span>${date}</div>
<div class="content">${escapeHtml(msg.content)}</div>
${atts}
</div>
</div>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
