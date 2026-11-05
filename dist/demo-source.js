import {config} from './config.js';
// Illustrative deterministic input ONLY: values and predicted classes are NOT measured or trained ML results.
const scenarios = Object.freeze({normal:'NORMAL',inflow:'ALIRAN_MASUK_TINGGI',blocked:'TERSUMBAT',low:null,invalid:null});
function sample(timestamp,scenario='normal'){
  const phase=timestamp/90000;
  const ripple=Math.sin(phase)*.12+Math.cos(phase*1.7)*.06;
  const base={timestamp,inletLpm:4.85+ripple,outletLpm:4.64+ripple*.82,upstreamCm:5.4+ripple*.4,
    downstreamCm:5.08+ripple*.3,pumpOn:true,floatSafe:true,sessionId:'DEMO-ONLY'};
  if(scenario==='inflow')return {...base,inletLpm:5.85+ripple*.25,outletLpm:5.55+ripple*.17,upstreamCm:6.5+ripple*.22,downstreamCm:6.2+ripple*.2};
  if(scenario==='blocked')return {...base,inletLpm:4.85+ripple*.15,outletLpm:2.6+ripple*.12,upstreamCm:8.2+ripple*.3,downstreamCm:3.8+ripple*.2};
  if(scenario==='low')return {...base,inletLpm:0,outletLpm:0,upstreamCm:0.5,downstreamCm:0.4,pumpOn:false,floatSafe:false};
  if(scenario==='invalid')return {...base,upstreamCm:null,sensorValid:false};
  return base;
}
function demoPrediction(r,scenario){const label=scenarios[scenario];return label ? {timestamp:r.timestamp,sourceTimestamp:r.timestamp,label,source:'demo',modelVersion:'contoh-UI-bukan-ML',confidence:null} : null;}
export function createDemoSource(){
  let timer,callbacks,scenario='normal',paused=false;
  const now=Date.now();
  const history=Array.from({length:1441},(_,i)=>sample(now-(1440-i)*60000));
  const predictionHistory=history.map(r=>demoPrediction(r,'normal'));
  const emit=()=>callbacks?.onData({latest:history.at(-1),history:[...history],prediction:predictionHistory.at(-1),predictionHistory:[...predictionHistory]});
  const tick=()=>{if(paused)return;const r=sample(Date.now(),scenario);history.push(r);predictionHistory.push(demoPrediction(r,scenario));while(history.length>18000||(history[0]&&history[0].timestamp<Date.now()-86400000)){history.shift();predictionHistory.shift();}emit();};
  return {
    start(next){callbacks=next;clearInterval(timer);emit();timer=setInterval(tick,config.intervalMs);},
    stop(){clearInterval(timer);callbacks=null;},
    setScenario(next){if(!Object.hasOwn(scenarios,next))return;scenario=next;if(!paused)tick();},
    setPaused(next){paused=Boolean(next);if(!paused)tick();},
  };
}
