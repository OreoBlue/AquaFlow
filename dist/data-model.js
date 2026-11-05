/** AquaFlow contract v2. Unix timestamps are in milliseconds, levels in cm, flows in L/min. */
export const LABELS = Object.freeze({
  NORMAL: {label:'Normal', title:'Aliran lancar', description:'Model mengidentifikasi kondisi saluran normal.'},
  ALIRAN_MASUK_TINGGI: {label:'Aliran tinggi', title:'Debit masuk tinggi', description:'Kenaikan ketinggian air diprediksi akibat aliran masuk besar tanpa sumbatan.'},
  TERSUMBAT: {label:'Tersumbat', title:'Sumbatan terdeteksi', description:'Model mengidentifikasi hambatan pada saluran. Periksa prototipe.'},
});
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function normalizeReading(value) {
  if (!value || typeof value !== 'object') return null;
  const fields=['timestamp','inletLpm','outletLpm','upstreamCm','downstreamCm'];
  if (fields.some(k=>!finite(value[k]))) return null;
  if (value.timestamp <= 0 || value.timestamp > Date.now()+60_000) return null;
  if (['inletLpm','outletLpm'].some(k=>value[k]<0||value[k]>30)) return null;
  if (['upstreamCm','downstreamCm'].some(k=>value[k]<0||value[k]>15)) return null;
  if (value.sensorValid===false) return null;
  if (typeof value.pumpOn!=='boolean'||typeof value.floatSafe!=='boolean') return null;
  const normalized=Object.fromEntries([...fields,'pumpOn','floatSafe'].map(k=>[k,value[k]]));
  if (typeof value.sessionId==='string') normalized.sessionId=value.sessionId.slice(0,64);
  return normalized;
}
export function normalizePrediction(value){
  if (!value||typeof value!=='object') return null;
  if (!finite(value.timestamp)||!finite(value.sourceTimestamp)||value.timestamp<=0||value.sourceTimestamp<=0) return null;
  if (value.timestamp>Date.now()+60_000 || value.sourceTimestamp>Date.now()+60_000) return null;
  if (!Object.hasOwn(LABELS,value.label)||!['model','demo'].includes(value.source)) return null;
  if (typeof value.modelVersion!=='string'||value.modelVersion.length>80) return null;
  if (value.confidence!=null&&(!finite(value.confidence)||value.confidence<0||value.confidence>1))return null;
  return {timestamp:value.timestamp, sourceTimestamp:value.sourceTimestamp,label:value.label,
    source:value.source,modelVersion:value.modelVersion,confidence:value.confidence??null};
}
export function diagnose(reading, thresholds){
  if (!reading)return {loss:null,gap:null,ratio:null};
  const gap=reading.upstreamCm-reading.downstreamCm;
  const ratio=reading.inletLpm>.05 ? reading.outletLpm/reading.inletLpm*100 : null;
  const loss=reading.inletLpm>.05 ? Math.max(0,(reading.inletLpm-reading.outletLpm)/reading.inletLpm*100) : 0;
  const ruleBlocked=loss>=thresholds.flowLossPercent && gap>=thresholds.heightGapCm;
  return {loss,gap,ratio,ruleBlocked}; // Indicative rule ONLY, never a substitute for ML inference.
}
export function presentCondition(reading,prediction,{source='demo',now=Date.now(),staleAfterMs=30_000}={}){
  if(!reading)return {kind:'invalid',label:'Data tidak valid',title:'Menunggu data valid',description:'Tidak ada pembacaan sensor yang valid.'};
  if(now-reading.timestamp>staleAfterMs)return {kind:'stale',label:'Data kedaluwarsa',title:'Pembacaan terhenti',description:'Data sensor lama tidak digunakan sebagai kondisi real-time.'};
  if(!reading.floatSafe)return {kind:'low',label:'Pengaman aktif',title:'Air bak rendah',description:'Float switch meminta pompa dimatikan oleh pengaman lokal ESP32.'};
  if(!reading.pumpOn)return {kind:'idle',label:'Siaga',title:'Pompa berhenti',description:'Menunggu pompa dinyalakan pada kondisi aman.'};
  if(!prediction)return {kind:'awaiting',label:'ML menunggu',title:'Prediksi belum tersedia',description:'Data sensor tersedia tetapi hasil inferensi ML belum diterima.'};
  if(prediction.source!==(source==='demo'?'demo':'model'))return {kind:'awaiting',label:'ML menunggu',title:'Sumber prediksi berbeda',description:'Prediksi demo tidak boleh ditampilkan sebagai inferensi model asli.'};
  if(Math.abs(prediction.sourceTimestamp-reading.timestamp)>staleAfterMs || now-prediction.timestamp>staleAfterMs)
    return {kind:'awaiting',label:'ML menunggu',title:'Prediksi belum terbaru',description:'Timestamp prediksi tidak sesuai data sensor terbaru.'};
  return {kind:prediction.label,label:LABELS[prediction.label].label,title:LABELS[prediction.label].title,description:LABELS[prediction.label].description};
}
export const sampleReading = {timestamp:1793249100000,inletLpm:4.82,outletLpm:4.61,upstreamCm:5.4,downstreamCm:5.1,pumpOn:true,floatSafe:true,sessionId:'sesi-uji-01'};
export const samplePrediction = {timestamp:1793249105000,sourceTimestamp:1793249100000,label:'NORMAL',source:'model',modelVersion:'ISI_DARI_TIM_ML',confidence:null};
