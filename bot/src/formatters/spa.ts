import fs from 'fs/promises';
import path from 'path';
import type { GuildExport } from '../types.js';

export async function writeSpaExport(data: GuildExport, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'data.json'), JSON.stringify(data), 'utf-8');
  await fs.writeFile(path.join(outputDir, 'viewer.html'), buildViewerHtml(), 'utf-8');
}

function buildViewerHtml(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ArchiveForge Viewer</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#313338;color:#dbdee1;display:flex;height:100vh;overflow:hidden}
#sidebar{width:240px;background:#2b2d31;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column}
#guild-header{padding:12px;border-bottom:1px solid #1e1f22;flex-shrink:0}
#guild-name{font-weight:700;font-size:.85em;text-transform:uppercase;color:#949ba4;letter-spacing:.05em}
#channel-list{padding:8px 4px;flex:1;overflow-y:auto}
.ch-group-label{font-size:.65em;text-transform:uppercase;color:#949ba4;letter-spacing:.05em;padding:8px 8px 2px;font-weight:700}
.ch-item{padding:5px 8px;border-radius:4px;cursor:pointer;color:#949ba4;font-size:.9em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}
.ch-item:hover{background:#35373c;color:#dbdee1}
.ch-item.active{background:#404249;color:#f2f3f5}
.ch-hash{opacity:.7;font-size:.9em}
#main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
#header{padding:12px 16px;border-bottom:1px solid #3f4147;font-weight:600;display:flex;align-items:center;gap:6px;flex-shrink:0}
#search-wrap{padding:8px 16px;flex-shrink:0}
#search-input{width:100%;background:#1e1f22;border:1px solid #3f4147;color:#dbdee1;padding:6px 10px;border-radius:4px;font-size:.875em;outline:none}
#search-input:focus{border-color:#5865f2}
#messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:2px}
.msg-day{font-size:.75em;color:#949ba4;text-align:center;margin:12px 0;display:flex;align-items:center;gap:8px}
.msg-day::before,.msg-day::after{content:'';flex:1;height:1px;background:#3f4147}
.msg{display:flex;gap:12px;padding:2px 8px;border-radius:4px}
.msg:hover{background:rgba(255,255,255,.03)}
.avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;background:#5865f2;display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden}
.avatar img{width:100%;height:100%;object-fit:cover}
.meta{font-size:.75em;color:#949ba4;margin-bottom:2px}
.username{font-weight:600;color:#f2f3f5;margin-right:8px}
.content{white-space:pre-wrap;word-break:break-word;font-size:.9375em;line-height:1.375}
.att{margin-top:4px}
.att img{max-width:400px;max-height:300px;border-radius:4px;display:block;cursor:pointer}
.att a{color:#00a8fc;text-decoration:none;font-size:.875em}
.att a:hover{text-decoration:underline}
.dead{color:#ed4245;text-decoration:line-through;font-size:.875em}
#status-bar{padding:6px 16px;font-size:.75em;color:#949ba4;border-top:1px solid #3f4147;flex-shrink:0;display:flex;justify-content:space-between}
.threads-section{margin:16px 0;padding:12px;background:#2b2d31;border-radius:6px;border-left:3px solid #5865f2}
.threads-title{font-size:.8em;color:#949ba4;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;cursor:pointer}
.threads-title:hover{color:#dbdee1}
.thread-item{padding:4px 0;border-top:1px solid #3f4147;display:none}
.threads-section.open .thread-item{display:block}
#lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:100;align-items:center;justify-content:center;cursor:zoom-out}
#lightbox.open{display:flex}
#lightbox img{max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain}
</style>
</head>
<body>
<div id="sidebar">
  <div id="guild-header"><div id="guild-name">Chargement…</div></div>
  <div id="channel-list"></div>
</div>
<div id="main">
  <div id="header"><span id="channel-icon" style="color:#949ba4">#</span><span id="channel-name">—</span></div>
  <div id="search-wrap"><input id="search-input" type="search" placeholder="Rechercher dans ce salon…" autocomplete="off"></div>
  <div id="messages"></div>
  <div id="status-bar"><span id="msg-count">0 messages</span><span id="export-date"></span></div>
</div>
<div id="lightbox"><img id="lightbox-img" src="" alt=""></div>

<script>
(function(){
'use strict';
let data=null,currentChannel=null,allMessages=[];

async function init(){
  try{
    const res=await fetch('./data.json');
    if(!res.ok)throw new Error('data.json introuvable ('+res.status+')');
    data=await res.json();
    document.getElementById('guild-name').textContent=data.name;
    document.getElementById('export-date').textContent='Export: '+new Date(data.exportedAt).toLocaleDateString('fr-FR');
    renderSidebar();
    if(data.channels.length>0)selectChannel(data.channels[0].id);
  }catch(e){
    document.getElementById('messages').innerHTML='<p style="color:#ed4245;padding:16px">'+escHtml(e.message)+'</p>';
  }
}

function renderSidebar(){
  const groups={};
  for(const ch of data.channels){
    const pid=ch.parentId||'__root__';
    if(!groups[pid])groups[pid]=[];
    groups[pid].push(ch);
  }
  let html='';
  const categories=data.channels.filter(c=>c.type===4).sort((a,b)=>a.position-b.position);
  if(groups['__root__']){
    for(const ch of groups['__root__'])html+=chHtml(ch);
  }
  for(const cat of categories){
    html+=\`<div class="ch-group-label">\${escHtml(cat.name)}</div>\`;
    const children=(groups[cat.id]||[]).sort((a,b)=>a.position-b.position);
    for(const ch of children)html+=chHtml(ch);
  }
  document.getElementById('channel-list').innerHTML=html;
}

function chHtml(ch){
  if(ch.type===4)return'';
  return\`<div class="ch-item" data-id="\${ch.id}" onclick="selectCh('\${ch.id}')"><span class="ch-hash">#</span>\${escHtml(ch.name)}</div>\`;
}

window.selectCh=selectChannel;
function selectChannel(id){
  currentChannel=data.channels.find(c=>c.id===id);
  if(!currentChannel)return;
  document.querySelectorAll('.ch-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  document.getElementById('channel-name').textContent=currentChannel.name;
  allMessages=currentChannel.messages;
  document.getElementById('search-input').value='';
  renderMessages(allMessages,currentChannel.threads||[]);
}

function renderMessages(msgs,threads){
  const container=document.getElementById('messages');
  let html='';let lastDay='';
  for(const m of msgs){
    const day=new Date(m.timestamp).toLocaleDateString('fr-FR');
    if(day!==lastDay){html+=\`<div class="msg-day">\${day}</div>\`;lastDay=day;}
    html+=msgHtml(m);
  }
  if(threads&&threads.length>0){
    html+=\`<div class="threads-section" id="threads-sec">
<div class="threads-title" onclick="toggleThreads()">🧵 \${threads.length} thread(s) — cliquer pour voir</div>\`;
    for(const t of threads){
      html+=\`<div class="thread-item"><strong style="color:#949ba4;font-size:.8em">\${escHtml(t.name)} \${t.archived?'(archivé)':''}</strong>\${t.messages.map(msgHtml).join('')}</div>\`;
    }
    html+='</div>';
  }
  container.innerHTML=html;
  container.scrollTop=container.scrollHeight;
  document.getElementById('msg-count').textContent=msgs.length+' message'+(msgs.length>1?'s':'');
}

window.toggleThreads=function(){
  document.getElementById('threads-sec')?.classList.toggle('open');
};

function msgHtml(msg){
  const av=msg.authorAvatar
    ?\`<div class="avatar"><img src="\${msg.authorAvatar}" loading="lazy" alt="">\`+\`</div>\`
    :\`<div class="avatar">\${escHtml(msg.authorName[0]?.toUpperCase()||'?')}</div>\`;
  const date=new Date(msg.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const atts=msg.attachments.map(a=>{
    if(!a.isAlive)return\`<div class="att"><span class="dead">\${escHtml(a.filename)}</span></div>\`;
    const src=a.localPath?('./attachments/'+a.id+'_'+a.filename):a.url;
    if(a.contentType&&a.contentType.startsWith('image/'))
      return\`<div class="att"><img src="\${src}" alt="\${escHtml(a.filename)}" loading="lazy" onclick="openLightbox('\${src}')"></div>\`;
    return\`<div class="att"><a href="\${src}" target="_blank">\${escHtml(a.filename)}</a></div>\`;
  }).join('');
  return\`<div class="msg">\${av}<div style="min-width:0;flex:1"><div class="meta"><span class="username">\${escHtml(msg.authorName)}</span>\${date}</div><div class="content">\${escHtml(msg.content)}</div>\${atts}</div></div>\`;
}

window.openLightbox=function(src){
  const lb=document.getElementById('lightbox');
  document.getElementById('lightbox-img').src=src;
  lb.classList.add('open');
};
document.getElementById('lightbox').addEventListener('click',()=>{
  document.getElementById('lightbox').classList.remove('open');
});

document.getElementById('search-input').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase().trim();
  if(!q){renderMessages(allMessages,currentChannel?.threads||[]);return;}
  const filtered=allMessages.filter(m=>
    m.content.toLowerCase().includes(q)||m.authorName.toLowerCase().includes(q)
  );
  renderMessages(filtered,[]);
});

function escHtml(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
})();
</script>
</body>
</html>`;
}
