import {config} from './config.js';
import {normalizeReading,normalizePrediction,diagnose,presentCondition,sampleReading,samplePrediction,LABELS} from './data-model.js';
import {createDemoSource} from './demo-source.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
let thresholds=stored('aquaflow-thresholds',config.thresholds);
if(!Number.isFinite(thresholds.flowLossPercent)||thresholds.flowLossPercent<1||thresholds.flowLossPercent>100||!Number.isFinite(thresholds.heightGapCm)||thresholds.heightGapCm<.1||thresholds.heightGapCm>10) thresholds={...config.thresholds};
let theme=stored('aquaflow-theme','dark'), color=stored('aquaflow-color','#39d9ce');
let latest=null,history=[],prediction=null,historyPredictions=new Map(),range=15,page=0,paused=false,previousKind=null,connectionError=null;
const events=[];
const nf=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const time=t=>Number.isFinite(t)?new Date(t).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false}):'—';
const dateTime=t=>Number.isFinite(t)?new Date(t).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'—';
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3300);}
function setTheme(value){theme=value==='light'?'light':'dark';document.documentElement.dataset.theme=theme;save('aquaflow-theme',theme);$('#theme-toggle').setAttribute('aria-pressed',String(theme==='light'));}
function setColor(value){if(!/^#[\da-f]{6}$/i.test(value))value='#39d9ce';color=value;const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));document.documentElement.style.setProperty('--accent',value);document.documentElement.style.setProperty('--accent-rgb',rgb.join(','));$('#custom-color').value=value;$$('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===value));save('aquaflow-color',value);}
setTheme(theme);setColor(color);
$('#theme-toggle').onclick=$('#settings-theme').onclick=()=>setTheme(theme==='dark'?'light':'dark');
$$('[data-color]').forEach(b=>b.onclick=()=>setColor(b.dataset.color));
$('#custom-color').oninput=e=>setColor(e.target.value);
$('#date-label').textContent=new Date().toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
function openDialog(id){$$('dialog[open]').forEach(d=>d.close());$(id).showModal();}
$('#settings-open').onclick=()=>{$('#threshold-flow').value=thresholds.flowLossPercent;$('#threshold-height').value=thresholds.heightGapCm;openDialog('#settings-dialog');};
['#integration-open','#system-integration','#settings-integration'].forEach(id=>$(id).onclick=()=>openDialog('#integration-dialog'));
$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#schema-example').textContent=JSON.stringify(sampleReading,null,2);
$('#prediction-schema').textContent=JSON.stringify(samplePrediction,null,2);
$('#copy-schema').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(sampleReading,null,2));toast('Format pembacaan disalin.');}catch{toast('Salin JSON secara manual.');}};
$('#threshold-form').onsubmit=e=>{e.preventDefault();const next={flowLossPercent:Number($('#threshold-flow').value),heightGapCm:Number($('#threshold-height').value)};if(next.flowLossPercent<1||next.flowLossPercent>100||next.heightGapCm<.1||next.heightGapCm>10)return;thresholds=next;save('aquaflow-thresholds',next);$('#settings-saved').textContent='Tersimpan di browser';addEvent('Ambang baseline diubah',`Debit ${nf(next.flowLossPercent,0)}% · tinggi ${nf(next.heightGapCm,1)} cm`);render();toast('Ambang baseline disimpan; tidak mengubah keputusan ML.');};
$$('.nav-tab').forEach(button=>button.onclick=()=>{const id=button.dataset.tab;$$('.nav-tab').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-current',b===button?'page':'false');});$$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===id));try{window.history.replaceState(null,'',`#${id}`);}catch{}});
const tab=['overview','history','system'].includes(location.hash.slice(1))?location.hash.slice(1):'overview';$(`.nav-tab[data-tab="${tab}"]`)?.click();
$$('[data-range]').forEach(button=>button.onclick=()=>{range=Number(button.dataset.range);page=0;$$('[data-range]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});render();});
function filtered(){const end=config.source==='demo'&&paused&&latest?latest.timestamp:Date.now();return history.filter(r=>r.timestamp>=end-range*60000&&r.timestamp<=end+1000);}
function addEvent(title,detail){events.unshift({timestamp:Date.now(),title,detail});if(events.length>20)events.pop();renderEvents();}
function renderEvents(){const parent=$('#event-list');parent.replaceChildren();events.slice(0,3).forEach(event=>{const div=document.createElement('div');div.className='event-item';const dot=document.createElement('span');dot.className='event-dot';const text=document.createElement('div');const p=document.createElement('p');p.textContent=event.title;const small=document.createElement('small');small.textContent=event.detail;const t=document.createElement('time');t.textContent=time(event.timestamp);text.append(p,small);div.append(dot,text,t);parent.append(div);});}
function conditionFor(r,p,now=Date.now()){
  if(connectionError&&config.source==='firebase')return {kind:'invalid',label:'Koneksi terganggu',title:'Tidak terhubung',description:'Periksa autentikasi, izin database, dan jaringan.'};
  return presentCondition(r,p,{source:config.source,now,staleAfterMs:config.staleAfterMs});
}
function renderMetrics(){
  const state=conditionFor(latest,prediction),d=diagnose(latest,thresholds);
  const demo=config.source==='demo';
  const ratio=d.ratio;
  const mapping={
    '#condition-chip':state.label,'#condition-title':state.title,'#condition-description':state.description,
    '#efficiency-value':nf(ratio,0),'#inlet-value':nf(latest?.inletLpm),'#outlet-value':nf(latest?.outletLpm),
    '#flow-delta':latest?`${nf(latest.inletLpm-latest.outletLpm)} L/mnt`:'—',
    '#upstream-value':nf(latest?.upstreamCm,1),'#downstream-value':nf(latest?.downstreamCm,1),'#level-delta':latest?`${nf(d.gap,1)} cm`:'—',
    '#pump-state':latest?(latest.pumpOn?'Beroperasi':'Berhenti'):'—',
    '#pump-description':latest?(latest.pumpOn?'Status terbaca dari perangkat':'Pompa tidak beroperasi'):'Menunggu pembacaan',
    '#float-state':latest?(latest.floatSafe?'Air cukup':'Air rendah'):'—',
    '#balance-value':`${nf(ratio,0)}${ratio===null?'':'%'}`,
    '#balance-inlet':`${nf(latest?.inletLpm)} L/mnt`,'#balance-outlet':`${nf(latest?.outletLpm)} L/mnt`,
    '#diagnostic-title':latest?(d.ruleBlocked?'Ambang terlampaui':'Ambang tidak terlampaui'):'Menunggu data',
    '#diagnostic-subtitle':latest?'Perbandingan aturan, terpisah dari prediksi ML':'Tidak ada data untuk dibandingkan',
    '#loss-pct':`${nf(d.loss,1)}% / ambang ${nf(thresholds.flowLossPercent,0)}%`,
    '#height-gap':`${nf(d.gap,1)} / ${nf(thresholds.heightGapCm,1)} cm`};
  Object.entries(mapping).forEach(([id,value])=>$(id).textContent=value);
  $('#prediction-meta').textContent=state.kind==='NORMAL'||state.kind==='ALIRAN_MASUK_TINGGI'||state.kind==='TERSUMBAT'
    ? `${demo?'CONTOH LABEL · BUKAN MODEL ML':`MODEL ${prediction.modelVersion||'—'}`} · ${prediction.confidence==null?'Skor tidak tersedia':`Keyakinan ${nf(prediction.confidence*100,1)}%`}`
    : `${demo?'SIMULASI':'INFERENSI ML'} · ${state.label}`;
  $('#upstream-fill').style.height=`${Math.min(100,Math.max(0,(latest?.upstreamCm||0)/10*100))}%`;
  $('#downstream-fill').style.height=`${Math.min(100,Math.max(0,(latest?.downstreamCm||0)/10*100))}%`;
  const safeRatio=ratio==null?0:Math.min(100,Math.max(0,ratio));
  $('#balance-donut').style.background=ratio==null?'var(--border)':`conic-gradient(var(--accent) 0% ${safeRatio}%,var(--secondary) ${safeRatio}% 100%)`;
  $('#loss-meter').style.width=`${Math.min(100,Math.max(0,(d.loss||0)/thresholds.flowLossPercent*100))}%`;
  $('#height-meter').style.width=`${Math.min(100,Math.max(0,(d.gap||0)/thresholds.heightGapCm*100))}%`;
  const warning=['TERSUMBAT','low','invalid','stale'].includes(state.kind);
  $('#condition-chip').style.color=warning?'var(--warning-text)':'var(--accent-text)';
  $('#diagnostic-icon').style.color=d.ruleBlocked?'var(--warning-text)':'var(--accent-text)';
  $('#diagnostic-icon').textContent=!latest?'○':d.ruleBlocked?'!':'✓';
  $('#pump-dot').style.background=latest?.pumpOn?'var(--accent)':'var(--amber)';
  if(previousKind!==null&&state.kind!==previousKind)addEvent(state.title,`Status ${demo?'demo':'pemantauan'} · ${state.label.toLowerCase()}`);
  previousKind=state.kind;
}
function updateTimestamp(){
  const state=conditionFor(latest,prediction),bad=['invalid','stale'].includes(state.kind);
  $('#last-update').textContent=latest?`${bad?'Data terakhir':'Diperbarui'} ${time(latest.timestamp)}`:'Belum ada data valid';
  $('#stream-label').textContent=connectionError&&config.source==='firebase'?'Koneksi bermasalah':paused&&config.source==='demo'?'Simulasi dijeda':state.kind==='stale'?'Data kedaluwarsa':!latest?'Menunggu sensor':config.source==='demo'?'Simulasi berjalan':'Data live aktif';
  $('.live-dot').classList.toggle('paused',bad||paused||!latest);
  // Re-render status only on transition, avoiding charts on each second.
  if(state.kind!==previousKind)renderMetrics();
}
function chart(target,records,keys,type){
  const el=$(target),w=600,h=185,left=32,right=12,top=14,bottom=29,cw=w-left-right,ch=h-top-bottom;
  const max=Math.max(type==='level'?10:6,...records.flatMap(r=>keys.map(k=>r[k])))*1.05;
  const sampled=records.length>50?Array.from({length:50},(_,i)=>records[Math.round(i*(records.length-1)/49)]):records;
  const x=i=>left+(sampled.length<=1?cw/2:i/(sampled.length-1)*cw),y=n=>top+ch-n/max*ch;
  let content=`<title>${type==='level'?'Tinggi hulu dan hilir dalam cm':'Debit inlet dan outlet dalam liter per menit'}</title>`;
  for(let i=0;i<=3;i++){const n=max*i/3;content+=`<line class="gridline" x1="${left}" x2="${w-right}" y1="${y(n)}" y2="${y(n)}"/><text x="${left-8}" y="${y(n)+3}" text-anchor="end">${nf(n,0)}</text>`;}
  if(sampled.length){keys.forEach((key,k)=>{const stroke=k?'var(--secondary)':'var(--accent)',points=sampled.map((r,i)=>`${x(i)},${y(r[key])}`).join(' ');if(type==='level')content+=`<polygon points="${left},${top+ch} ${points} ${x(sampled.length-1)},${top+ch}" fill="${stroke}" opacity="${k?.04:.08}"/>`;content+=`<polyline points="${points}" stroke="${stroke}" stroke-width="2.5" fill="none" ${k?'stroke-dasharray="5 3"':''}/><circle cx="${x(sampled.length-1)}" cy="${y(sampled.at(-1)[key])}" r="3.5" fill="${stroke}"/>`;});
    const indices=[...new Set([0,Math.floor((sampled.length-1)/3),Math.floor((sampled.length-1)*2/3),sampled.length-1])];indices.forEach(i=>content+=`<text x="${x(i)}" y="${h-5}" text-anchor="${i===0?'start':i===sampled.length-1?'end':'middle'}">${time(sampled[i].timestamp)}</text>`);
  }else content+=`<text x="300" y="95" text-anchor="middle">Belum ada data dalam rentang ini</text>`;
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" preserveAspectRatio="none">${content}</svg>`;
}
function renderSparkline(records){
  const values=records.slice(-35).map(r=>r.outletLpm),el=$('#sparkline');if(!values.length){el.replaceChildren();return;}
  const low=Math.min(...values)-.08,high=Math.max(...values)+.08,points=values.map((v,i)=>`${i/Math.max(1,values.length-1)*300},${52-(v-low)/(high-low)*43}`).join(' ');
  el.innerHTML=`<defs><linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)" stop-opacity=".18"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><polygon points="0,64 ${points} 300,64" fill="url(#spark-gradient)" stroke="none"/><polyline points="${points}" fill="none"/>`;
}
function historicalLabel(r){const p=historyPredictions.get(r.timestamp);if(!r.floatSafe)return 'Pengaman aktif';if(!r.pumpOn)return 'Siaga';if(!p||p.source!==(config.source==='demo'?'demo':'model'))return 'Belum ada prediksi';return LABELS[p.label]?.label||'Belum ada prediksi';}
function renderHistory(records){
  const sorted=[...records].reverse(),count=sorted.length;page=Math.min(page,Math.max(0,Math.ceil(count/15)-1));$('#record-count').textContent=`${count} pembacaan`;$('#page-info').textContent=`Halaman ${page+1} / ${Math.max(1,Math.ceil(count/15))}`;$('#previous-page').disabled=page===0;$('#next-page').disabled=(page+1)*15>=count;
  const body=$('#history-body');body.replaceChildren();sorted.slice(page*15,page*15+15).forEach(r=>{const tr=document.createElement('tr');[dateTime(r.timestamp),nf(r.inletLpm),nf(r.outletLpm),nf(r.upstreamCm,1),nf(r.downstreamCm,1),r.pumpOn?'Aktif':'Mati',historicalLabel(r)].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});body.append(tr);});
  if(!count){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent='Belum ada pembacaan valid pada rentang ini.';tr.append(td);body.append(tr);}
}
$('#previous-page').onclick=()=>{page=Math.max(0,page-1);renderHistory(filtered());};
$('#next-page').onclick=()=>{page++;renderHistory(filtered());};
$('#export-button').onclick=()=>{
  const rows=filtered();if(!rows.length){toast('Belum ada data valid untuk diekspor.');return;}
  const csv=['timestamp_iso,session_id,inlet_lpm,outlet_lpm,upstream_cm,downstream_cm,pump_on,float_safe,prediction_label,prediction_source,model_version',
    ...rows.map(r=>{const p=historyPredictions.get(r.timestamp);return [new Date(r.timestamp).toISOString(),r.sessionId||'',r.inletLpm.toFixed(3),r.outletLpm.toFixed(3),r.upstreamCm.toFixed(3),r.downstreamCm.toFixed(3),r.pumpOn,r.floatSafe,p?.label||'',p?.source||'',p?.modelVersion||''].join(',');})].join('\r\n');
  const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`aquaflow-${config.source}-${range}mnt-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`${rows.length} pembacaan ${config.source==='demo'?'simulasi':'live'} diekspor.`);
};
function render(){renderMetrics();const rows=filtered();chart('#flow-chart',rows,['inletLpm','outletLpm'],'flow');chart('#level-chart',rows,['upstreamCm','downstreamCm'],'level');renderSparkline(rows);renderHistory(rows);updateTimestamp();}
const components=[['01','ESP32 DevKit V1','Firmware akuisisi dan pengaman lokal'],['02','Flow sensor YF-S201 × 2','Debit inlet / outlet (L/menit)'],['03','Ultrasonik × 2','Tinggi air hulu dan hilir (cm)'],['04','Pompa DC 12 V + driver','Sirkulasi air dan kendali lokal'],['05','Float switch','Interlock lokal saat air bak rendah'],['06','Servo / mekanisme sekat','Perlu keputusan tim Hardware (simulasi memakai sekat virtual)']];
components.forEach(([n,title,description])=>{const item=document.createElement('div');item.className='component-item';const num=document.createElement('span');num.textContent=n;const text=document.createElement('div');const b=document.createElement('b');b.textContent=title;const small=document.createElement('small');small.textContent=description;text.append(b,small);item.append(num,text);$('#component-list').append(item);});
let source;
if(config.source==='demo') source=createDemoSource();
else if(config.source==='firebase'){const {createFirebaseSource}=await import('./firebase-adapter.js');source=createFirebaseSource();}
else throw new Error('Sumber data tidak dikenal.');
const isDemo=config.source==='demo';
$('#source-label').lastChild.textContent=isDemo?'SIMULASI':'LIVE · FIREBASE';
$('#source-badge').textContent=isDemo?'SIMULASI':'LIVE TARGET';
$('#source-message').textContent=isDemo?'Contoh pembacaan dan label; bukan sensor atau inferensi ML sebenarnya.':'Pembacaan ESP32 dan prediksi Python melalui Firebase; login operator diperlukan.';
$('#footer-mode').textContent=isDemo?'SIMULASI · Contoh data tiap 5 detik':'LIVE · ESP32 → Firebase ↔ Python ML → Dashboard';
$('#settings-source-info').textContent=isDemo?'Sumber demo lokal. Model ML dan hardware belum terhubung.':'Mode live Firebase. Membutuhkan akun, aturan database, ESP32, dan model ML terlatih.';
$('#scenario').disabled=!isDemo;$('#pause-button').disabled=!isDemo;
$('#scenario').onchange=e=>{source.setScenario?.(e.target.value);addEvent('Skenario demo diubah',e.target.selectedOptions[0].textContent+(paused?' · berlaku sesudah dilanjutkan':''));if(paused)toast('Skenario akan diterapkan saat simulasi dilanjutkan.');};
$('#pause-button').onclick=()=>{paused=!paused;source.setPaused?.(paused);$('#pause-button').innerHTML=paused?'<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>':'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';$('#pause-button').setAttribute('aria-label',paused?'Lanjutkan simulasi':'Jeda simulasi');$('#pause-button').title=paused?'Lanjutkan simulasi':'Jeda simulasi';addEvent(paused?'Simulasi dijeda':'Simulasi dilanjutkan','Pembaruan data contoh');updateTimestamp();};
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#login-feedback').textContent='Menghubungkan...';try{await source.signIn($('#login-email').value,$('#login-password').value);$('#login-password').value='';$('#login-feedback').textContent='Berhasil masuk';$('#login-dialog').close();}catch(err){$('#login-feedback').textContent=`Login gagal: ${err.code||err.message}`;}};
addEvent(isDemo?'Simulasi dimulai':'Sumber live dipilih',isDemo?'Data contoh lokal, tidak ada hardware/ML asli':'Menunggu autentikasi dan pembacaan sensor');
source.start({
  onData(data){
    connectionError=null;
    latest=normalizeReading(data.latest);
    history=(Array.isArray(data.history)?data.history:[]).map(normalizeReading).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);
    prediction=normalizePrediction(data.prediction);
    historyPredictions=new Map((Array.isArray(data.predictionHistory)?data.predictionHistory:[]).map(normalizePrediction).filter(Boolean).map(p=>[p.sourceTimestamp,p]));
    render();
  },
  onError(error){connectionError=error;latest=null;prediction=null;render();addEvent('Koneksi atau sumber data gagal',error.message);toast(error.message);},
  onAuthRequired(){latest=null;prediction=null;connectionError=null;render();openDialog('#login-dialog');},
  onAuthReady(email){addEvent('Operator terautentikasi',email);},
});
const clockTimer=setInterval(()=>{updateTimestamp();},1000);
window.addEventListener('pagehide',()=>{source.stop();clearInterval(clockTimer);});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
