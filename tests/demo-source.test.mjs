import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoSource} from '../dist/demo-source.js';
import {normalizeReading} from '../dist/data-model.js';
test('demo covers normal, high inflow, blockage, safety, invalid without real ML claim',()=>{
 const source=createDemoSource();let data;
 source.start({onData:payload=>{data=payload;},onError:error=>{throw error;}});
 try {
  assert.equal(data.prediction.label,'NORMAL');
  assert.equal(data.prediction.source,'demo');
  source.setScenario('inflow');assert.equal(data.prediction.label,'ALIRAN_MASUK_TINGGI');
  source.setScenario('blocked');assert.equal(data.prediction.label,'TERSUMBAT');
  source.setScenario('low');assert.equal(data.latest.floatSafe,false);assert.equal(data.prediction,null);
  source.setScenario('invalid');assert.equal(normalizeReading(data.latest),null);assert.equal(data.prediction,null);
 } finally {source.stop();}
});
