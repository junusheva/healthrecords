import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTelegramJSON, mergeRecords, filterRecords, flattenText, safeUrl, safeAssetPath, inferTopics, parseExportDate} from '../dist/assets/core.js';

const sample = {name:'Test channel',type:'private_channel',id:1234567890,messages:[
  {id:1,type:'service',date:'2026-01-01T08:00:00',text:'Channel created'},
  {id:2,type:'message',date:'2026-01-02T08:00:00',text:['Анализ крови\n',{type:'bold',text:'Ферритин'},' — ссылка ',{type:'link',text:'https://example.com'}]},
  {id:3,type:'message',date:'2026-01-03T08:00:00',text:'',photo:'photos/report.jpg'},
  {id:4,type:'message',date:'not-a-date',text:'Тревога и сон'},
]};
test('preserves rich text, attachment-only posts, dates, and source links while skipping service events',()=>{
  const {records} = parseTelegramJSON(sample);
  assert.equal(records.length,3);
  assert.equal(records[0].text,'Анализ крови\nФерритин — ссылка https://example.com');
  assert.equal(records[0].sourceUrl,'https://t.me/c/1234567890/2');
  assert.equal(records[0].topic,'tests');
  assert.equal(records[1].attachments[0].name,'photos/report.jpg');
  assert.equal(records[2].date,null);
  assert.equal(records[2].topic,'mind');
});
test('reimport deduplicates without overwriting bookmarks or personal edits',()=>{
  const incoming = parseTelegramJSON(sample).records;
  const existing = incoming.map((record,index)=>index===0?{...record,saved:true,notes:'Keep this',title:'My title',topic:'other'}:record);
  const merged = mergeRecords(existing,incoming);
  assert.equal(merged.added,0);
  assert.equal(merged.records.length,3);
  assert.equal(merged.records[0].saved,true);
  assert.equal(merged.records[0].notes,'Keep this');
  assert.equal(merged.records[0].title,'My title');
});
test('a downloaded backup round-trips record identity and annotations',()=>{
  const {records,channel} = parseTelegramJSON(sample);
  records[0].saved=true; records[0].notes='My observation';
  const restored=parseTelegramJSON(JSON.parse(JSON.stringify({schemaVersion:1,channel,records})));
  assert.deepEqual(restored.records,records);
  assert.equal(mergeRecords(records,restored.records).added,0);
});
test('supports Cyrillic multiword search, user notes, topic filters, saved-only filters, and sort',()=>{
  const records=parseTelegramJSON(sample).records;
  records[0].saved=true; records[0].notes='Проверить через месяц';
  assert.equal(filterRecords(records,{query:'ФЕРРИТИН кровь'}).length,0);
  assert.equal(filterRecords(records,{query:'ФЕРРИТИН крови'}).length,1);
  assert.equal(filterRecords(records,{query:'проверить месяц',savedOnly:true}).length,1);
  assert.equal(filterRecords(records,{topic:'mind'}).length,1);
  assert.equal(filterRecords(records,{sort:'newest'})[0].messageId,'3');
  assert.equal(filterRecords(records,{sort:'oldest'})[0].messageId,'4');
});
test('keeps channels distinct and validates import shape',()=>{
  const a=parseTelegramJSON(sample).records;
  const b=parseTelegramJSON({...sample,id:9876543210}).records;
  assert.equal(mergeRecords(a,b).added,3);
  assert.throws(()=>parseTelegramJSON({foo:'bar'}),/No message list/);
  assert.equal(parseTelegramJSON({schemaVersion:1,records:[]}).records.length,0);
});
test('blocks script URL schemes and keeps nested text as plain text',()=>{
  assert.equal(safeUrl('javascript:alert(1)'),null);
  assert.equal(safeUrl('data:text/html,<script>'),null);
  assert.equal(safeUrl('https://example.com'), 'https://example.com/');
  assert.equal(flattenText([{text:'<script>alert(1)</script>'},' text']),'\x3cscript>alert(1)</script> text');
  assert.deepEqual(inferTopics('A note with no health keywords.'),['other']);
});
test('uses export Unix timestamps to avoid changing dates across time zones',()=>{
  const {records}=parseTelegramJSON({name:'Channel',messages:[{id:1,text:'Date test',date:'2026-01-01T06:00:00',date_unixtime:'1767225600'}]});
  assert.equal(records[0].date,'2026-01-01T00:00:00.000Z');
});
test('rejects full account exports with multiple chats',()=>{
  assert.throws(()=>parseTelegramJSON({chats:{list:[sample,{...sample,id:456}]}}),/Export only the channel/);
});
test('reads both Telegram HTML date formats without inventing a timezone',()=>{
  assert.equal(parseExportDate('18 June 2024, 11:31:34'),'2024-06-18T11:31:34');
  assert.equal(parseExportDate('1 January 2026, 22:12:18'),'2026-01-01T22:12:18');
  assert.equal(parseExportDate('27.11.2026 13:40:00 UTC+05:00'),'2026-11-27T13:40:00+05:00');
  assert.equal(parseExportDate('not a date'),null);
});
test('rejects arbitrary attachment origins and preserves structured source dates and PDF text',()=>{
  assert.equal(safeAssetPath('media/abc123.pdf'),'media/abc123.pdf');
  for(const value of ['../private.pdf','media/../private.pdf','https://example.com/file.pdf','javascript:alert(1)','//example.com/file.pdf'])assert.equal(safeAssetPath(value),null);
  const {records}=parseTelegramJSON({schemaVersion:1,records:[{id:'health:1',messageId:'1',date:'2026-01-03T15:15:15',eventDate:'2026-01-02',text:'Appointment notes',topic:'gynecology',attachments:[{name:'report.pdf',url:'media/abc123.pdf',text:'Ферритин 41.25'}]}]});
  assert.equal(records[0].eventDate,'2026-01-02');
  assert.equal(records[0].date,'2026-01-03T15:15:15');
  assert.equal(filterRecords(records,{query:'ферритин 41.25'}).length,1);
});
