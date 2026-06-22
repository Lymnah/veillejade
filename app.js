/* app.js — couche interactive de la veille (rendu, filtres, favoris, badges, brief).
 * Lit les données globales GENERATED / NOUVELLES / ANCIENNES (donnees.js) et, si
 * présent, PROFIL (profil.local.js, privé). NE contient aucune donnée d'offre.
 */

const STAT = {positif:["d-good","Réputation positive"],attention:["d-warn","Point d'attention"],
  incertain:["d-na","Réputation incertaine"],exclu:["d-exclu","Exclu"]};
const ETH = {good:["d-good","Éthique : RAS"],warn:["d-warn","Point éthique signalé"],na:["d-na","Non vérifiable"]};

/* ---- Marquage persistant (favoris + statut), mémorisé dans le navigateur ---- */
const MARK_KEY="veille_marks_v1";
function loadMarks(){try{return JSON.parse(localStorage.getItem(MARK_KEY))||{}}catch(e){return {};}}
function saveMarks(){try{localStorage.setItem(MARK_KEY,JSON.stringify(MARKS));}catch(e){}}
let MARKS=loadMarks();
function offerId(o){return (o.entreprise||"")+"|"+(o.titre||"");}
function getMark(o){return MARKS[offerId(o)]||{fav:false,statut:""};}
function setMark(o,patch){MARKS[offerId(o)]=Object.assign(getMark(o),patch);saveMarks();}

/* ---- Index plat de toutes les offres (recherche par id) ---- */
const ALL=[].concat(NOUVELLES, ANCIENNES.reduce((a,g)=>a.concat(g.offres||[]),[]));
function findOffer(id){return ALL.find(o=>offerId(o)===id);}

/* ---- État des filtres ---- */
const FILT={q:"",note:0,fav:false,hideOut:true,statut:""};

function deadlineBadge(o){
  if(!o.delai) return "";
  const today=new Date(); today.setHours(0,0,0,0);
  const d=new Date(o.delai+"T00:00:00");
  const days=Math.round((d-today)/86400000);
  const dd=o.delai.split("-").reverse().join("/");
  if(days<0) return `<span class="badge badge-over">⌛ Délai dépassé (${dd})</span>`;
  if(days<=7) return `<span class="badge badge-soon">⏳ Plus que ${days} j — délai ${dd}</span>`;
  return `<span class="badge">📅 Délai : ${dd}</span>`;
}

function briefText(o){
  return [
    "Brief de candidature — "+(o.titre||"")+" — "+(o.entreprise||""),
    "Lieu : "+(o.lieu||"—")+" · Taux : "+(o.taux||"—")+(o.delai?(" · Délai de postulation : "+o.delai):""),
    "Annonce : "+(o.lien||"—"),
    "",
    (typeof PROFIL!=="undefined" && PROFIL ? "PROFIL DE LA CANDIDATE : "+PROFIL : ""),
    "",
    "POURQUOI CE POSTE / ANGLE À VALORISER : "+(o.pourquoi||"—"),
    (o.vigilance?("POINTS DE VIGILANCE : "+o.vigilance):""),
    "",
    "Tâche : rédige une lettre de motivation en français (ton chaleureux et professionnel, ~250 mots) pour ce poste, en valorisant l'angle ci-dessus et en répondant aux points de vigilance avec tact."
  ].filter(Boolean).join("\n");
}

function card(o, isNew){
  const mk=getMark(o);
  const tags=(o.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("");
  const r=o.repute||{}; const rs=STAT[r.statut]||STAT.incertain;
  const repute = r.note!=null || r.statut
    ? `<span class="pill"><span class="dot ${rs[0]}"></span>${r.source||"Avis"} ${r.note!=null?r.note+"/5":""} ${r.avis?"("+r.avis+" avis)":""}</span>` : "";
  let eth="";
  if(isNew && o.ethique){const e=ETH[o.ethique]||ETH.na;
    eth=`<span class="pill"><span class="dot ${e[0]}"></span>${o.ethiqueTxt||e[1]}</span>`;}
  const dl=deadlineBadge(o);
  const id=offerId(o).replace(/&/g,"&amp;").replace(/"/g,"&quot;");
  const statuts=["","À postuler","Postulé","Écarté"];
  const opts=statuts.map(s=>`<option value="${s}" ${mk.statut===s?"selected":""}>${s||"— statut —"}</option>`).join("");
  return `<div class="card ${mk.statut==='Écarté'?'is-out':''} ${mk.fav?'is-fav':''}" data-id="${id}">
    <div class="top">
      <div>
        <h3><a href="${o.lien||'#'}" target="_blank" rel="noopener">${o.titre||"—"}</a></h3>
        <div class="co">${o.entreprise||""}</div>
      </div>
      <div class="score">${o.note!=null?o.note:"—"}</div>
    </div>
    ${tags?`<div class="tags">${tags}</div>`:""}
    ${isNew&&o.pourquoi?`<div class="why">${o.pourquoi}</div>`:""}
    <div class="row">
      <span>📍 ${o.lieu||"—"}</span>
      ${o.taux?`<span>⏱️ ${o.taux}</span>`:""}
      ${o.date?`<span>🗓️ ${o.date}</span>`:""}
      ${dl}
      ${repute}
      ${eth}
    </div>
    ${isNew&&o.vigilance?`<div class="vig">⚠️ ${o.vigilance}</div>`:""}
    <div class="actions">
      <button class="act fav ${mk.fav?'on':''}" data-act="fav">${mk.fav?"★ Favori":"☆ Favori"}</button>
      <select class="act statut" data-act="statut" title="Statut de candidature">${opts}</select>
      <button class="act brief" data-act="brief">📋 Brief candidature</button>
    </div>
  </div>`;
}

function passes(o){
  const mk=getMark(o);
  if(FILT.hideOut && mk.statut==="Écarté") return false;
  if(FILT.fav && !mk.fav) return false;
  if(FILT.statut && mk.statut!==FILT.statut) return false;
  if(FILT.note && (o.note||0) < FILT.note) return false;
  if(FILT.q){
    const hay=((o.titre||"")+" "+(o.entreprise||"")+" "+(o.tags||[]).join(" ")+" "+(o.lieu||"")).toLowerCase();
    if(!hay.includes(FILT.q.toLowerCase())) return false;
  }
  return true;
}

function buildFilters(){
  const f=document.getElementById("filters");
  f.innerHTML=`
    <input type="text" id="f-q" placeholder="Rechercher (titre, employeur, tag…)">
    <select id="f-note">
      <option value="0">Note min : toutes</option>
      <option value="6">≥ 6</option><option value="7">≥ 7</option><option value="8">≥ 8</option>
    </select>
    <select id="f-statut">
      <option value="">Tous statuts</option>
      <option value="À postuler">À postuler</option>
      <option value="Postulé">Postulé</option>
      <option value="Écarté">Écarté</option>
    </select>
    <label><input type="checkbox" id="f-fav"> ⭐ favoris</label>
    <label><input type="checkbox" id="f-out" checked> masquer écartées</label>
    <span class="count" id="f-count"></span>`;
  const rer=()=>renderLists();
  f.querySelector("#f-q").addEventListener("input",e=>{FILT.q=e.target.value;rer();});
  f.querySelector("#f-note").addEventListener("change",e=>{FILT.note=+e.target.value;rer();});
  f.querySelector("#f-statut").addEventListener("change",e=>{FILT.statut=e.target.value;rer();});
  f.querySelector("#f-fav").addEventListener("change",e=>{FILT.fav=e.target.checked;rer();});
  f.querySelector("#f-out").addEventListener("change",e=>{FILT.hideOut=e.target.checked;rer();});
}

function renderLists(){
  const n=document.getElementById("list-new"), a=document.getElementById("list-old");
  const newF=NOUVELLES.filter(passes);
  n.innerHTML = newF.length
    ? newF.map(o=>card(o,true)).join("")
    : `<div class="empty"><div class="big">🍼</div>Aucune offre ne correspond aux filtres.</div>`;
  let oldCount=0, html="";
  ANCIENNES.forEach(g=>{
    const offres=(g.offres||[]).filter(passes);
    oldCount+=offres.length;
    if(offres.length){
      html+=`<h2 class="day">${(g.jour||"").replace(/-/g,"/")}</h2>`+offres.map(o=>card(o,false)).join("");
    }
  });
  a.innerHTML = html || `<div class="empty"><div class="big">📂</div>Aucune offre ne correspond aux filtres.</div>`;
  const c=document.getElementById("f-count");
  if(c) c.textContent = newF.length+" nouvelle(s) · "+oldCount+" ancienne(s)";
}

/* Délégation des actions sur les cartes (favori / statut / brief) */
function wireActions(container){
  container.addEventListener("click",e=>{
    const btn=e.target.closest(".act"); if(!btn) return;
    const cardEl=e.target.closest(".card"); if(!cardEl) return;
    const o=findOffer(cardEl.getAttribute("data-id")); if(!o) return;
    if(btn.dataset.act==="fav"){ setMark(o,{fav:!getMark(o).fav}); renderLists(); }
    else if(btn.dataset.act==="brief"){
      const txt=briefText(o);
      navigator.clipboard.writeText(txt).then(()=>{
        const old=btn.textContent; btn.textContent="✓ Copié !"; btn.classList.add("on");
        setTimeout(()=>{btn.textContent=old; btn.classList.remove("on");},1800);
      }).catch(()=>{ window.prompt("Copiez ce brief :", txt); });
    }
  });
  container.addEventListener("change",e=>{
    const sel=e.target.closest("select.statut"); if(!sel) return;
    const cardEl=e.target.closest(".card"); const o=findOffer(cardEl.getAttribute("data-id")); if(!o) return;
    setMark(o,{statut:sel.value}); renderLists();
  });
}

function renderMeta(){
  const el=document.getElementById("meta"); const g=GENERATED;
  if(typeof g==="string"){ el.textContent=g; return; }
  const rows=[
    ["Mise à jour", g.date],
    ["Recherché", g.recherche],
    ["Retenu", g.retenu],
    ["Pédiatrie / formation", g.marche],
    ["Écarté", g.ecarte]
  ].filter(r=>r[1]);
  const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  el.innerHTML=rows.map(r=>'<div class="meta-row"><span class="meta-k">'+esc(r[0])+'</span><span class="meta-v">'+esc(r[1])+'</span></div>').join("");
}
function render(){
  renderMeta();
  buildFilters();
  renderLists();
}
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  const nw=t.dataset.tab==="new";
  document.getElementById("list-new").style.display=nw?"":"none";
  document.getElementById("list-old").style.display=nw?"none":"";
}));
wireActions(document.getElementById("list-new"));
wireActions(document.getElementById("list-old"));
render();
