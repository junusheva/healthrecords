import test from 'node:test';
import assert from 'node:assert/strict';
import {CARE_ITEMS,careLastDone,careInterval,careNextTasks,careMonthCells,validateCareEvent,validateCareInterval,addCareInterval,mergeCareData,extractCareCandidates} from '../dist/assets/care.js';
import {analyzeIntakeText,buildIntakeUpdate} from '../dist/assets/intake.js';
import {enrichArchive,createCloudArchive} from '../dist/assets/cloud.js';
import {handleRequest} from '../worker/index.js';
import {ArchiveData} from '../worker/archive.js';
import {authFixture} from './helpers/auth.mjs';
import {objectContext} from './helpers/r2.mjs';
const today='2026-11-27';
const entry=(item,date,status='done',more={})=>validateCareEvent({id:'care:'+item+':'+date,item,date,status,...more},today);
test('reviewed intake routes vaccinations and replacements to their calendar with source links',()=>{
 const draft=analyzeIntakeText('Сделала прививку АДС-М 11.01.2026\nЗаменила зубную щётку 12.01.2026',today);
 assert.deepEqual(draft.careCandidates.map(item=>[item.item,item.date,item.status]),[['td','2026-01-11','done'],['toothbrush','2026-01-12','done']]);
 const saved=buildIntakeUpdate({records:[]},{...draft,images:[]},today,'synthetic-care','2026-11-27T10:00:00Z');assert.equal(saved.careEvents.length,2);assert.equal(saved.careEvents[0].sourceId,saved.records[0].id);
 draft.careCandidates[0].selected=false;assert.equal(buildIntakeUpdate({records:[]},{...draft,images:[]},today,'unselected','2026-11-27T10:00:00Z').careEvents.length,1);
});
test('care extraction separates plans from doses, avoids HPV tests and does not invent missing dates',()=>{
 assert.deepEqual(extractCareCandidates('ВПЧ ПЦР отрицательно\nНе делала прививку от гриппа\nКак часто менять мочалку?',null,today),[]);
 const plans=extractCareCandidates('Запланирована прививка ВПЧ 01.02.2027\nНужно заменить мочалку','2026-01-01',today);
 assert.equal(plans[0].status,'planned');assert.equal(plans[0].date,'2027-02-01');assert.equal(plans[1].date,'');assert.equal(plans[1].selected,false);
 assert.equal(extractCareCandidates('Заменила мочалку',null,today)[0].date,'');
});
test('unknown dates remain unknown and planned vaccinations never become a last received dose',()=>{
 const empty={careEvents:[]};assert.equal(careLastDone(empty,'toothbrush'),null);assert.deepEqual(careNextTasks(empty),[]);
 const plans={careEvents:[entry('td','2027-02-01','planned')]};assert.equal(careLastDone(plans,'td'),null);assert.equal(careNextTasks(plans)[0].date,'2027-02-01');
});
test('calendar arithmetic preserves end-of-month dates across leap years and year boundaries',()=>{
 assert.equal(addCareInterval('2026-01-31',{amount:1,unit:'months'}),'2026-02-28');
 assert.equal(addCareInterval('2028-01-31',{amount:1,unit:'months'}),'2028-02-29');
 assert.equal(addCareInterval('2028-02-29',{amount:1,unit:'years'}),'2029-02-28');
 assert.equal(addCareInterval('2026-12-20',{amount:28,unit:'days'}),'2027-01-17');
 assert.equal(addCareInterval('2026-01-01',null),null);
});
test('toothbrush timing and loofah materials use distinct attributed defaults with editable overrides',()=>{
 assert.deepEqual(careInterval({},'toothbrush').value,{amount:3,unit:'months'});assert.equal(careInterval({},'loofah').value,null);
 assert.deepEqual(careInterval({carePreferences:{loofahMaterial:'natural'}},'loofah').value,{amount:28,unit:'days'});
 assert.deepEqual(careInterval({carePreferences:{loofahMaterial:'plastic'}},'loofah').value,{amount:2,unit:'months'});
 assert.equal(careInterval({carePreferences:{loofahMaterial:'silicone'}},'loofah').value,null);
 const archive={careEvents:[entry('toothbrush','2026-01-03')],careCadenceOverrides:{toothbrush:{amount:4,unit:'months'}}};
 assert.equal(careNextTasks(archive,'hygiene')[0].date,'2026-05-03');assert.equal(careInterval(archive,'toothbrush').custom,true);
 assert.deepEqual(careNextTasks({...archive,careCadenceOverrides:{toothbrush:null}}),[]);
 assert.equal(CARE_ITEMS.find(item=>item.id==='toothbrush').authority,'American Dental Association');
});
test('finite vaccine courses do not acquire a blanket recurrence and confirmed plans replace estimates',()=>{
 assert.equal(careInterval({},'td').value,null);assert.equal(careInterval({},'hpv-vaccine').value,null);
 const source={careEvents:[entry('influenza','2026-01-03'),entry('td','2026-01-02')]};assert.deepEqual(careNextTasks(source).map(item=>item.date),['2027-01-03']);
 source.careEvents.push(entry('influenza','2026-12-03','planned'));assert.equal(careNextTasks(source).length,1);assert.equal(careNextTasks(source)[0].projected,false);
 const complete={careEvents:[entry('hpv-vaccine','2026-01-02','done',{courseComplete:true})],careCadenceOverrides:{'hpv-vaccine':{amount:6,unit:'months'}}};assert.deepEqual(careNextTasks(complete),[]);
});
test('completed dates, interval inputs and restored backup values are validated before saving',()=>{
 assert.throws(()=>entry('td','2027-01-01'));assert.throws(()=>entry('td','2026-02-30'));assert.throws(()=>entry('unknown','2026-01-02'));
 assert.doesNotThrow(()=>entry('td','2027-01-01','planned'));
 for(const value of [{amount:-1,unit:'months'},{amount:1.5,unit:'months'},{amount:2,unit:'unknown'}])assert.throws(()=>validateCareInterval(value));
 assert.throws(()=>mergeCareData({}, {carePreferences:{loofahMaterial:'unknown-product'}},today));
});
test('backups deduplicate care entries, preserve current edits and survive source enrichment',()=>{
 const current={schemaVersion:1,records:[],careEvents:[entry('toothbrush','2026-01-03','done',{note:'Current note'})],careCadenceOverrides:{toothbrush:{amount:4,unit:'months'}}};
 const backup={careEvents:[entry('toothbrush','2026-01-03','done',{note:'Older note'}),entry('td','2026-01-01')],careCadenceOverrides:{toothbrush:{amount:2,unit:'months'}}};
 const merged=mergeCareData(current,backup,today);assert.equal(merged.careEvents.length,2);assert.equal(merged.careEvents[0].note,'Current note');assert.equal(merged.careCadenceOverrides.toothbrush.amount,4);
 assert.equal(mergeCareData(merged,backup,today).careEvents.length,2);
 const enriched=enrichArchive({schemaVersion:1,records:[],careEvents:[]},current);assert.equal(enriched.careEvents.length,1);assert.equal(enriched.careEvents[0].note,'Current note');
});
test('month grids use Monday first and contain all 29 days of a leap-year February',()=>{
 const cells=careMonthCells('2028-02');assert.equal(cells.length,42);assert.equal(new Date(cells[0]+'T12:00:00Z').getUTCDay(),1);assert.equal(cells.filter(date=>date.startsWith('2028-02')).length,29);assert.throws(()=>careMonthCells('2026-13'));
});
test('vaccinations, replacement history and frequencies persist together in R2 across restarts',async()=>{
 const f=await authFixture(),{cookie}=await f.login();
 const fetchImpl=(path,options={})=>handleRequest(new Request('https://healthrecords.ayaijan.com'+path,{...options,headers:{...Object.fromEntries(new Headers(options.headers)),Cookie:cookie,Origin:'https://healthrecords.ayaijan.com'}}),f.env);
 const client=createCloudArchive({origin:'https://healthrecords.ayaijan.com',fetchImpl}),archive=await client.load();
 archive.careEvents=[entry('td','2026-01-02'),entry('toothbrush','2026-01-03')];archive.carePreferences={loofahMaterial:'plastic'};archive.careCadenceOverrides={toothbrush:{amount:4,unit:'months'}};await client.save(archive);
 const stored=JSON.parse(new TextDecoder().decode(f.bucket.objects.get('archive/state.json').bytes));assert.equal(stored.state.careEvents.length,2);
 const restarted=new ArchiveData(objectContext(f.dataStorage),f.env);f.env.ARCHIVE_DATA.get=()=>({fetch:request=>restarted.fetch(request)});
 const another=createCloudArchive({origin:'https://healthrecords.ayaijan.com',fetchImpl}),loaded=await another.load();assert.equal(careLastDone(loaded,'td').date,'2026-01-02');assert.equal(careInterval(loaded,'toothbrush').value.amount,4);assert.equal(loaded.carePreferences.loofahMaterial,'plastic');
});
