import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalMeasurement,measurementSeries,checkupHistory,cadenceSetting,updateCadenceOverrides,mergeUserTracking,validateMeasurement,validateCheckup} from '../dist/assets/tracking.js';

test('equivalent units are compared while incompatible units are rejected',()=>{
 assert.deepEqual(canonicalMeasurement('hemoglobin',13.2,'g/dL'),{value:132,unit:'g/L'});
 assert.deepEqual(canonicalMeasurement('ferritin',41.25,'нг/мл'),{value:41.25,unit:'µg/L'});
 assert.equal(canonicalMeasurement('ferritin',41.25,'g/L'),null);
});
test('source observations and manual entries keep their dates, references and ordering',()=>{
 const archive={measurements:[{id:'source:1',metric:'ferritin',date:'2026-01-02',value:41.25,unit:'нг/мл',sourceId:1}],checkups:[{id:'visit:1',checkup:'dermatologist',date:'2026-01-02',sourceIds:[1]}]};
 const manualMeasurements=[{id:'manual:1',...validateMeasurement({metric:'ferritin',value:'42,5',unit:'нг/мл',date:'2026-01-03'},'2026-01-10')}];
 const manualCheckups=[{id:'manual:visit',...validateCheckup({checkup:'dermatologist',date:'2026-01-03',nextDate:'2026-02-03'},'2026-01-10')}];
 const added=mergeUserTracking(archive,{manualMeasurements,manualCheckups},'2026-01-10');
 const restored={...archive,...mergeUserTracking(added,{manualMeasurements,manualCheckups},'2026-01-10')};
 assert.deepEqual(measurementSeries(restored,'ferritin').map(item=>item.value),[41.25,42.5]);
 assert.equal(restored.manualMeasurements.length,1);assert.equal(checkupHistory(restored,'dermatologist')[0].date,'2026-01-03');
 assert.equal(archive.measurements.length,1);
});
test('an editable frequency can replace, clear and restore the WHO default independently per item',()=>{
 const fallback=cadenceSetting({},'checkup','hpv','hpv','ru');assert.ok(fallback.value);assert.equal(fallback.custom,false);
 const changed=updateCadenceOverrides({},'checkup','hpv','Every six months');
 assert.equal(cadenceSetting({cadenceOverrides:changed},'checkup','hpv','hpv','en').value,'Every six months');
 const blank=updateCadenceOverrides(changed,'checkup','hpv','');assert.equal(cadenceSetting({cadenceOverrides:blank},'checkup','hpv','hpv','ru').value,'');
 const reset=updateCadenceOverrides(blank,'checkup','hpv',null);assert.equal(cadenceSetting({cadenceOverrides:reset},'checkup','hpv','hpv','ru').value,fallback.value);
 assert.equal(cadenceSetting({},'checkup','fluorography','tuberculosis','ru').value,'');
});
