import fs from 'fs/promises';
import path from 'path';
import type { GuildExport } from '../types.js';

export async function writeSpaExport(data: GuildExport, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  // Embed all data inline — no external fetch needed (works from file://)
  await fs.writeFile(path.join(outputDir, 'viewer.html'), buildViewerHtml(data), 'utf-8');
}

function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildViewerHtml(data: GuildExport): string {
  const jsonData = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.name)} — ArchiveForge</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#313338;color:#dbdee1;display:flex;height:100vh;overflow:hidden}
a{color:inherit;text-decoration:none}
#sidebar{width:230px;background:#2b2d31;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column}
#guild-header{padding:12px 14px;border-bottom:1px solid #1e1f22;display:flex;align-items:center;gap:9px;flex-shrink:0}
#guild-icon{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#5865f2;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8em;overflow:hidden;flex-shrink:0}
#guild-icon img{width:100%;height:100%;object-fit:cover}
#guild-name{font-weight:700;font-size:.88em;color:#f2f3f5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#guild-sub{font-size:.7em;color:#72767d}
#channel-list{padding:6px 4px 16px;overflow-y:auto}
.cat-label{font-size:.64em;text-transform:uppercase;color:#72767d;letter-spacing:.06em;padding:12px 8px 4px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:4px;user-select:none}
.cat-label:hover{color:#949ba4}
.cat-label::before{content:'▾';font-size:.8em;transition:transform .15s}
.cat-collapsed .cat-label::before{transform:rotate(-90deg)}
.cat-channels{overflow:hidden;transition:max-height .2s}
.cat-collapsed .cat-channels{max-height:0!important}
.ch-item{padding:5px 8px 5px 14px;border-radius:4px;cursor:pointer;color:#949ba4;font-size:.88em;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-item:hover{background:#35373c;color:#dbdee1}
.ch-item.active{background:#404249;color:#f2f3f5}
.ch-icon{opacity:.6;font-size:.8em;flex-shrink:0}
#main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
#top-bar{padding:10px 16px;border-bottom:1px solid #3f4147;display:flex;align-items:center;gap:10px;flex-shrink:0;background:#313338}
#channel-title{font-weight:700;font-size:.95em;color:#f2f3f5;display:flex;align-items:center;gap:6px}
#channel-topic{font-size:.78em;color:#72767d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
#search-wrap{padding:8px 16px;flex-shrink:0;border-bottom:1px solid #3f4147}
#search-input{width:100%;background:#1e1f22;border:1px solid #3f4147;color:#dbdee1;padding:6px 10px;border-radius:6px;font-size:.875em;outline:none}
#search-input:focus{border-color:#5865f2;box-shadow:0 0 0 3px rgba(88,101,242,.2)}
#messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:1px;scroll-behavior:smooth}
.msg-day{font-size:.72em;color:#72767d;text-align:center;margin:16px 0 8px;display:flex;align-items:center;gap:8px}
.msg-day::before,.msg-day::after{content:'';flex:1;height:1px;background:#3f4147}
.msg-group{display:flex;gap:12px;padding:2px 8px;border-radius:4px;margin-bottom:1px}
.msg-group:hover{background:rgba(255,255,255,.03)}
.avatar{width:38px;height:38px;border-radius:50%;flex-shrink:0;background:#5865f2;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9em;overflow:hidden;color:#fff}
.avatar img{width:100%;height:100%;object-fit:cover}
.msg-body{min-width:0;flex:1}
.meta{font-size:.74em;color:#72767d;margin-bottom:2px;display:flex;align-items:baseline;gap:6px}
.username{font-weight:700;color:#f2f3f5;font-size:1em}
.timestamp{font-size:.85em}
.content{white-space:pre-wrap;word-break:break-word;font-size:.9375em;line-height:1.4;color:#dcddde}
.content.empty{color:#72767d;font-style:italic;font-size:.85em}
.att{margin-top:5px}
.att-img{max-width:420px;max-height:300px;border-radius:6px;display:block;cursor:pointer;transition:opacity .15s}
.att-img:hover{opacity:.9}
.att-file{display:inline-flex;align-items:center;gap:6px;background:#2b2d31;padding:8px 12px;border-radius:6px;font-size:.875em;color:#00a8fc;margin-top:3px;border:1px solid #3f4147}
.att-dead{color:#ed4245;text-decoration:line-through;font-size:.85em}
.embed{margin-top:6px;border-left:3px solid;padding:8px 10px;background:#2b2d31;border-radius:0 6px 6px 0;max-width:480px}
.embed-title{font-weight:700;color:#f2f3f5;font-size:.9em;margin-bottom:3px}
.embed-desc{font-size:.85em;color:#b9bbbe;white-space:pre-wrap}
.reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.reaction{background:#2b2d31;border:1px solid #3f4147;border-radius:100px;padding:2px 8px;font-size:.8em;color:#b9bbbe;display:flex;align-items:center;gap:4px}
.reaction:hover{background:#404249;border-color:#5865f2;color:#f2f3f5}
.threads-block{margin:8px 0 4px;border-left:3px solid #5865f2;padding:8px 12px;background:rgba(88,101,242,.05);border-radius:0 6px 6px 0}
.threads-toggle{font-size:.78em;color:#949ba4;cursor:pointer;font-weight:600;user-select:none;display:flex;align-items:center;gap:6px}
.threads-toggle:hover{color:#dbdee1}
.threads-toggle::before{content:'▾';transition:transform .15s}
.threads-toggle.collapsed::before{transform:rotate(-90deg)}
.thread-list{margin-top:6px}
.thread-entry{border-top:1px solid #3f4147;padding-top:8px;margin-top:8px}
.thread-name{font-size:.78em;font-weight:700;color:#72767d;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
#status-bar{padding:5px 16px;font-size:.72em;color:#72767d;border-top:1px solid #3f4147;flex-shrink:0;display:flex;justify-content:space-between;background:#2b2d31}
#lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;align-items:center;justify-content:center;cursor:zoom-out}
#lightbox.open{display:flex}
#lb-img{max-width:92vw;max-height:92vh;border-radius:8px;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.8)}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#3f4147;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#4e5058}
</style>
</head>
<body>
<div id="sidebar">
  <div id="guild-header">
    <div id="guild-icon"></div>
    <div><div id="guild-name"></div><div id="guild-sub"></div></div>
  </div>
  <div id="channel-list"></div>
</div>
<div id="main">
  <div id="top-bar">
    <div id="channel-title"><span id="ch-icon" style="color:#72767d">#</span><span id="ch-name">—</span></div>
    <div id="channel-topic"></div>
  </div>
  <div id="search-wrap"><input id="search-input" type="search" placeholder="Rechercher…" autocomplete="off"></div>
  <div id="messages"></div>
  <div id="status-bar"><span id="msg-count"></span><span id="export-info"></span></div>
</div>
<div id="lightbox"><img id="lb-img" src="" alt=""></div>

<script>
(function(){
'use strict';
const DATA=${jsonData};
let currentCh=null,allMsgs=[];

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function chIcon(t){return t===15||t===16?'📋':t===5?'📣':t===2?'🔊':'#'}

// Sidebar
function buildSidebar(){
  const gi=document.getElementById('guild-icon');
  if(DATA.icon){gi.innerHTML='<img src="'+DATA.icon+'" alt="">';}else{gi.textContent=(DATA.name||'?')[0];}
  document.getElementById('guild-name').textContent=DATA.name;
  const total=DATA.channels.reduce((s,c)=>s+c.messages.length,0);
  document.getElementById('guild-sub').textContent=DATA.channels.length+' salons · '+total.toLocaleString('fr-FR')+' msgs';
  document.getElementById('export-info').textContent='Export '+new Date(DATA.exportedAt).toLocaleDateString('fr-FR');

  const catMap={};
  (DATA.categories||[]).forEach(c=>{catMap[c.id]=c;});
  const groups={};
  DATA.channels.forEach(ch=>{
    const k=ch.parentId||'__root__';
    if(!groups[k])groups[k]=[];
    groups[k].push(ch);
  });

  let html='';
  if(groups['__root__']){
    groups['__root__'].forEach(ch=>{html+=chHtml(ch);});
  }
  const cats=(DATA.categories||[]).slice().sort((a,b)=>a.position-b.position);
  cats.forEach(cat=>{
    const children=(groups[cat.id]||[]).slice().sort((a,b)=>a.position-b.position);
    if(!children.length)return;
    const chHtmls=children.map(chHtml).join('');
    html+='<div class="cat-block" data-cat="'+cat.id+'">'
      +'<div class="cat-label" onclick="toggleCat(this)">'+esc(cat.name)+'</div>'
      +'<div class="cat-channels" style="max-height:1000px">'+chHtmls+'</div>'
      +'</div>';
  });
  document.getElementById('channel-list').innerHTML=html;
}

function chHtml(ch){
  return '<div class="ch-item" data-id="'+ch.id+'" onclick="selectCh(\''+ch.id+'\')">'
    +'<span class="ch-icon">'+chIcon(ch.type)+'</span>'+esc(ch.name)+'</div>';
}

window.toggleCat=function(el){
  el.closest('.cat-block').classList.toggle('cat-collapsed');
};

window.selectCh=function(id){
  currentCh=DATA.channels.find(c=>c.id===id);
  if(!currentCh)return;
  document.querySelectorAll('.ch-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  document.getElementById('ch-icon').textContent=chIcon(currentCh.type);
  document.getElementById('ch-name').textContent=currentCh.name;
  document.getElementById('channel-topic').textContent=currentCh.topic||'';
  document.getElementById('search-input').value='';
  allMsgs=currentCh.messages;
  render(allMsgs,currentCh.threads||[]);
};

function render(msgs,threads){
  const box=document.getElementById('messages');
  let html='';let lastDay='';
  msgs.forEach(m=>{
    const day=new Date(m.timestamp).toLocaleDateString('fr-FR');
    if(day!==lastDay){html+='<div class="msg-day">'+day+'</div>';lastDay=day;}
    html+=msgHtml(m);
  });
  if(threads.length>0){
    const total=threads.reduce((s,t)=>s+t.messages.length,0);
    html+='<div class="threads-block">'
      +'<div class="threads-toggle" onclick="this.classList.toggle(\'collapsed\');this.nextSibling.style.display=this.classList.contains(\'collapsed\')?\'none\':\'\'">'
      +'🧵 '+threads.length+' thread(s) — '+total+' messages</div>'
      +'<div class="thread-list">';
    threads.forEach(t=>{
      html+='<div class="thread-entry"><div class="thread-name">'+esc(t.name)+(t.archived?' (archivé)':'')+'</div>';
      t.messages.forEach(m=>{html+=msgHtml(m);});
      html+='</div>';
    });
    html+='</div></div>';
  }
  box.innerHTML=html;
  box.scrollTop=box.scrollHeight;
  document.getElementById('msg-count').textContent=msgs.length+' message'+(msgs.length!==1?'s':'');
}

function msgHtml(m){
  const av=m.authorAvatar
    ?'<div class="avatar"><img src="'+m.authorAvatar+'" loading="lazy" alt=""></div>'
    :'<div class="avatar">'+esc((m.authorName||'?')[0].toUpperCase())+'</div>';
  const ts=new Date(m.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  let atts='';
  (m.attachments||[]).forEach(a=>{
    if(!a.isAlive){atts+='<div class="att"><span class="att-dead">'+esc(a.filename)+'</span></div>';return;}
    const src=a.localPath?('./attachments/'+a.id+'_'+a.filename):a.url;
    if(a.contentType&&a.contentType.startsWith('image/')){
      atts+='<div class="att"><img class="att-img" src="'+src+'" alt="'+esc(a.filename)+'" loading="lazy" onclick="lb(\''+src+'\')"></div>';
    }else{
      atts+='<div class="att"><a class="att-file" href="'+src+'" target="_blank">📎 '+esc(a.filename)+'</a></div>';
    }
  });
  let embeds='';
  (m.embeds||[]).forEach(e=>{
    const col=e.color?'#'+e.color.toString(16).padStart(6,'0'):'#5865f2';
    embeds+='<div class="embed" style="border-color:'+col+'">';
    if(e.title)embeds+='<div class="embed-title">'+esc(e.title)+'</div>';
    if(e.description)embeds+='<div class="embed-desc">'+esc(e.description.slice(0,500))+'</div>';
    embeds+='</div>';
  });
  let reacts='';
  if((m.reactions||[]).length>0){
    reacts='<div class="reactions">';
    m.reactions.forEach(r=>{reacts+='<div class="reaction">'+esc(r.emoji)+' '+r.count+'</div>';});
    reacts+='</div>';
  }
  const content=m.content?esc(m.content):'<span class="empty">[sans texte]</span>';
  return'<div class="msg-group">'+av+'<div class="msg-body"><div class="meta"><span class="username">'+esc(m.authorName)+'</span><span class="timestamp">'+ts+'</span></div><div class="content">'+content+'</div>'+atts+embeds+reacts+'</div></div>';
}

window.lb=function(src){
  document.getElementById('lb-img').src=src;
  document.getElementById('lightbox').classList.add('open');
};
document.getElementById('lightbox').addEventListener('click',function(){this.classList.remove('open');});

document.getElementById('search-input').addEventListener('input',function(e){
  const q=e.target.value.toLowerCase().trim();
  if(!q){render(allMsgs,currentCh?.threads||[]);return;}
  render(allMsgs.filter(m=>(m.content||'').toLowerCase().includes(q)||m.authorName.toLowerCase().includes(q)),[]);
});

buildSidebar();
if(DATA.channels.length>0)selectCh(DATA.channels[0].id);
})();
</script>
</body>
</html>`;
}
