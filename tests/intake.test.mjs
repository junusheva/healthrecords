import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeIntakeText,intakeDateCandidates,buildIntakeUpdate,extractClinicalText} from '../dist/assets/intake.js';
import {parseTelegramJSON,safeLocalImageData} from '../dist/assets/core.js';
import {measurementSeries,checkupHistory,mergeUserTracking} from '../dist/assets/tracking.js';
import {imageMimeFromBytes,recognizeIntakeImages,OCR_RESOURCES} from '../dist/assets/ocr.js';
const today='2026-11-27';
const png='data:image/png;base64,iVBORw0KGgo=';
test('extracts Russian and English results with decimal commas and source reference ranges',()=>{
 const draft=analyzeIntakeText('Дата взятия анализа: 20.11.2026\nФерритин: 32,5 нг/мл (10–120)\nTSH 1.75 mIU/L (0.4-4)',today);
 assert.equal(draft.date,'2026-11-20');assert.equal(draft.topic,'tests');
 assert.deepEqual(draft.measurements.map(row=>[row.metric,row.value,row.selected]),[['ferritin',32.5,true],['tsh',1.75,true]]);
 assert.equal(draft.measurements[0].refLow,10);assert.equal(draft.measurements[0].refHigh,120);
});
test('does not turn missing units, birth dates, invalid dates or a reference-only row into results',()=>{
 const draft=analyzeIntakeText('Дата рождения 12.03.1992\nФерритин 32,5\nРеференс: ферритин 10–120 нг/мл',today);
 assert.equal(draft.date,'');assert.equal(draft.measurements.length,1);assert.equal(draft.measurements[0].unit,'');assert.equal(draft.measurements[0].selected,false);
 assert.deepEqual(intakeDateCandidates('31.02.2026\n01.12.2026',today),[]);
 assert.deepEqual(intakeDateCandidates('Анализ 20.11.2026\nСтарый анализ 01.10.2026',today),['2026-11-20','2026-10-01']);
});
test('qualified results and planned tests never become exact numerical observations',()=>{
 const draft=analyzeIntakeText('20.11.2026\nФерритин <15 нг/мл\nНужно сдать ТТГ 2 мМЕ/л',today);
 assert.equal(draft.measurements.length,0);assert.ok(draft.warnings.includes('qualified-result'));
});
test('finds completed visits while excluding plans, negation and HPV vaccination',()=>{
 const draft=analyzeIntakeText('20.11.2026\nБыла у гинеколога\nНе делала флюорографию\nНужно посетить невролога\nВакцинация ВПЧ',today);
 assert.deepEqual(draft.visits.map(row=>row.checkup),['gynecologist']);
 const exam=analyzeIntakeText('Дерматолог 21.11.2026. Осмотр родинок, дерматоскопия.',today);
 assert.deepEqual(exam.visits.map(row=>row.checkup),['dermatologist','moles']);
});
test('a reviewed image record reaches search, topics, result history and visit history with source links',()=>{
 const before={schemaVersion:1,channel:{name:'Archive'},records:[],manualMeasurements:[],manualCheckups:[]};
 const draft=analyzeIntakeText('20.11.2026\nФерритин 32,5 нг/мл\nБыла у гинеколога',today);
 const original='media/'+('a'.repeat(64))+'.png';
 const updated=buildIntakeUpdate(before,{...draft,images:[{name:'result.png',url:original,text:'Ферритин 32,5 нг/мл'}]},today,'test-uuid','2026-11-27T10:00:00Z');
 assert.equal(before.records.length,0);assert.equal(updated.records.length,1);
 assert.equal(updated.records[0].origin,'manual');assert.equal(updated.records[0].attachments[0].imageData,null);assert.equal(updated.records[0].attachments[0].url,original);
 assert.equal(measurementSeries(updated,'ferritin')[0].value,32.5);
 assert.equal(measurementSeries(updated,'ferritin')[0].sourceId,updated.records[0].id);
 assert.deepEqual(checkupHistory(updated,'gynecologist')[0].sourceIds,[updated.records[0].id]);
 const backup=JSON.parse(JSON.stringify(updated));const parsed=parseTelegramJSON(backup);const tracking=mergeUserTracking({},backup,today);
 assert.equal(parsed.records[0].attachments[0].url,original);assert.equal(parsed.records[0].origin,'manual');
 assert.equal(tracking.manualMeasurements[0].sourceId,parsed.records[0].id);
 assert.deepEqual(tracking.manualCheckups[0].sourceIds,[parsed.records[0].id]);
});
test('unselected observations stay as source text and unsupported images cannot enter the archive',()=>{
 const draft=analyzeIntakeText('20.11.2026\nФерритин 32,5 нг/мл',today);draft.measurements[0].selected=false;
 const updated=buildIntakeUpdate({records:[]},{...draft,images:[]},today,'skip','2026-11-27T10:00:00Z');
 assert.equal(updated.manualMeasurements.length,0);assert.match(updated.records[0].text,/Ферритин/);
 assert.equal(safeLocalImageData('data:image/svg+xml;base64,PHN2Zz4='),null);
 assert.equal(safeLocalImageData('https://other.example/picture.png'),null);
 assert.throws(()=>buildIntakeUpdate({records:[]},{...draft,images:[{name:'bad.svg',imageData:'data:image/svg+xml;base64,PHN2Zz4='}]},today,'bad','2026-11-27T10:00:00Z'),/R2/);
});
test('recognition receives image data in a local worker, terminates it and keeps its original image',async()=>{
 const seen=[];let terminated=0;
 const images=[{name:'report.png',imageData:png,text:''}];
 const output=await recognizeIntakeImages(images,{createWorker:async(languages,mode,options)=>{
  assert.deepEqual(languages,['rus','eng']);assert.equal(options.workerPath,OCR_RESOURCES.worker);
  return {recognize:async data=>{seen.push(data);return {data:{text:'Ферритин 32,5 нг/мл',confidence:91}};},terminate:async()=>{terminated++;}};
 }});
 assert.deepEqual(seen,[png]);assert.equal(output[0].imageData,png);assert.match(output[0].text,/Ферритин/);assert.equal(terminated,1);
 assert.equal(imageMimeFromBytes(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(imageMimeFromBytes(new TextEncoder().encode('<svg>')),null);
});
test('failed or cancelled recognition never silently saves records and releases the worker',async()=>{
 let terminated=0;
 await assert.rejects(recognizeIntakeImages([{imageData:png}],{createWorker:async()=>({recognize:async()=>{throw new Error('recognition failed');},terminate:async()=>{terminated++;}})}),/recognition failed/);
 assert.equal(terminated,1);
 const controller=new AbortController();controller.abort();
 await assert.rejects(recognizeIntakeImages([],{signal:controller.signal}),{name:'AbortError'});
});
test('keeps a source diagnosis, prescriptions, doctor and future plans in separate editable fields',()=>{
 const text='Клиника: Example\nВрач: Иванова А. А.\nЖалобы: боль в шее\nДиагноз: Цервикалгия?\nНазначения: препарат по схеме из документа\nРекомендации: контроль через месяц';
 const clinical=extractClinicalText(text);
 assert.equal(clinical.clinic,'Example');assert.equal(clinical.clinician,'Иванова А. А.');
 assert.deepEqual(clinical.assessments,['Цервикалгия?']);assert.deepEqual(clinical.recommendations,['контроль через месяц']);
 const draft=analyzeIntakeText(text,today);
 const updated=buildIntakeUpdate({records:[]},{...draft,images:[]},today,'clinical','2026-11-27T10:00:00Z');
 assert.equal(updated.records[0].clinical.assessments[0],'Цервикалгия?');assert.equal(updated.manualCheckups.length,0);
});
test('reads a short source date and blood pressure without counting a recommendation as a completed visit',()=>{
 const draft=analyzeIntakeText('Дата осмотра: 20.11.26\nАД 112/72 мм рт. ст.\nРекомендации:\nФлюорография\nКонсультация психиатра',today);
 assert.equal(draft.date,'2026-11-20');assert.deepEqual(draft.measurements.map(item=>[item.metric,item.value,item.selected]),[['systolic',112,true],['diastolic',72,true]]);assert.equal(draft.visits.length,0);
});

