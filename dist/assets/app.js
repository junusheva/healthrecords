import {configureIntake} from './intake-ui.js';
import {createCloudArchive,mergeLegacyArchive} from './cloud.js';
import { TOPICS, topicById, normalizeRecord, parseTelegramJSON, mergeRecords, filterRecords, safeUrl, safeAssetPath, cleanTitle, normalize, parseExportDate, safeLocalImageData } from './core.js';
import { METRIC_SPECS, CHECKUP_SPECS, WHO_GUIDANCE, GUIDANCE_REVIEWED, measurementSeries, checkupHistory, daysSince, validateMeasurement, validateCheckup, canonicalMeasurement, mergeUserTracking, cadenceSetting, updateCadenceOverrides, mergeCadenceOverrides } from './tracking.js';
import { getLanguage, localized, configureLanguage, translateUI } from './i18n.js';

const paths = {
  library:'<path d="M4 5h5v15H4zM11 5h4v15h-4zM17 4l4 1-3 15-4-1"/>',
  grid:'<rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/>',
  calendar:'<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 3v6M16 3v6M4 11h16M8 15h3M8 18h6"/>',
  bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',
  telegram:'<path d="m3 11 18-7-4 17-6-6-4 3v-5zM7 13 18 7M11 15l7-8"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2.5M12 16h.01"/>',
  leaf:'<path d="M20 3c-10 0-17 4-15 11 2 6 12 5 15-11ZM4 21c1-6 5-10 11-13"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  chevron:'<path d="m7 10 5 5 5-5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  book:'<path d="M12 5v15M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Z"/>',
  folder:'<path d="M3 7V5h6l2 3h10v12H3V7Z"/>',
  flask:'<path d="M9 3h6M10 3v7L4 20h16l-6-10V3M7 15h10"/>',
  heart:'<path d="M20 5c-2-2-6-2-8 1-2-3-6-3-8-1-5 5 3 11 8 15 5-4 13-10 8-15Z"/>',
  pill:'<path d="m8 16 8-8M6 18a4.2 4.2 0 0 1 0-6L12 6a4.2 4.2 0 1 1 6 6l-6 6a4.2 4.2 0 0 1-6 0Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  link:'<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M13 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>',
  file:'<path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const $ = selector => document.querySelector(selector);
const el = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon)); }
hydrateIcons();

const viewTitles = { overview:'At a glance', metrics:'Health indicators', checkups:'Visits & screenings', library:'All records', topics:'Care areas', timeline:'Timeline', documents:'Documents', treatments:'Treatment history', saved:'Saved for later' };
let state = { schemaVersion:1, channel:{name:'Telegram archive'}, records:[] };
let database;
let view = 'overview';
let activeTopic = 'all';
let layout = 'grid';
let pageLimit = 60;
let activeRecordId;
let toastTimer;
let importBusy = false;
let lastDialogFocus;
let selectedMetric='ferritin';
let languageController;
let cloudCommitBusy=false;
const cloud=createCloudArchive({onStatus:status=>{
 const labels={loading:'Loading your records from Cloudflare…',ready:'Records loaded from Cloudflare',saving:'Saving to Cloudflare…',saved:'Saved in Cloudflare R2',error:'Changes have not been saved'};
 const node=document.getElementById('cloud-status');if(node)node.textContent=typeof translateUI==='function'?translateUI(labels[status]||''):labels[status]||'';
}});

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.hidden = true, 5500);
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('health-records-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close another tab of this library and try again.'));
  });
}
function readState() {
  return new Promise((resolve, reject) => {
    const request = database.transaction('library').objectStore('library').get('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function commit(next) {
  if(cloudCommitBusy)throw new Error('Дождись завершения текущего сохранения и повтори действие.');
  cloudCommitBusy=true;
  try{const migrated=await cloud.migrateImages(next);await cloud.save(migrated);state=migrated;render();}
  finally{cloudCommitBusy=false;}
}
const localDate = date => new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date);
const readableDate = date => date ? localDate(date).toLocaleDateString(getLanguage()==='ru'?'ru-RU':'en-GB', { day:'numeric', month:'short', year:'numeric' }) : 'Date unavailable';
const monthName = date => date ? localDate(date).toLocaleDateString(getLanguage()==='ru'?'ru-RU':'en-GB', {month:'long', year:'numeric'}) : 'Undated records';
const todayDate=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
const formatNumber=value=>new Intl.NumberFormat(getLanguage()==='ru'?'ru-RU':'en-GB',{maximumFractionDigits:3}).format(value);
const elapsedLabel=date=>{const days=daysSince(date,todayDate());return days===null?'Date unavailable':getLanguage()==='ru'?`${days} дн. назад`:`${days} days ago`;};
const countLabel = count => `${count.toLocaleString()} ${count === 1 ? 'record' : 'records'}`;
const countsByTopic = () => Object.fromEntries(TOPICS.map(topic => [topic.id, state.records.filter(record => record.topic === topic.id).length]));
const findRecord = reference => state.records.find(record => record.id === String(reference) || record.messageId === String(reference));
const recordDate = record => record.eventDate || record.date;
const localImageURLs=new Map();
function attachmentURL(attachment) {
 const data=safeLocalImageData(attachment.imageData);if(!data)return safeAssetPath(attachment.url);
 if(!localImageURLs.has(data)){const split=data.indexOf(',');const mime=data.slice(5,data.indexOf(';'));const bytes=Uint8Array.from(atob(data.slice(split+1)),c=>c.charCodeAt(0));localImageURLs.set(data,URL.createObjectURL(new Blob([bytes],{type:mime})));}
 return localImageURLs.get(data);
}
window.addEventListener('beforeunload',()=>{for(const url of localImageURLs.values())URL.revokeObjectURL(url);});
const allDocuments = () => state.records.flatMap(record => record.attachments.map((attachment,index) => ({record,attachment,index})));
function sourceButtons(references, className = 'source-buttons') {
  const container = el('div',className);
  [...new Set(references || [])].forEach(reference => {
    const record = findRecord(reference); if(!record) return;
    const button = el('button','source-button',record.origin==='manual'?'Source record':`#${record.messageId}`);
    button.type = 'button'; button.title = record.title; button.setAttribute('aria-label',`Read source ${record.messageId}: ${record.title}`);
    button.addEventListener('click',() => openRecord(record.id)); container.append(button);
  });
  return container;
}

function render() {
  const saved = state.records.filter(record => record.saved).length;
  const counts = countsByTopic();
  $('#stat-records').textContent = state.records.length.toLocaleString();
  $('#stat-documents').textContent = (state.coverage?.originalAttachments!=null?state.coverage.originalAttachments+state.records.filter(r=>r.origin==='manual').reduce((n,r)=>n+r.attachments.length,0):allDocuments().length).toLocaleString();
  $('#stat-careareas').textContent = Object.values(counts).filter(Boolean).length;
  $('#nav-total').textContent = state.records.length.toLocaleString();
  $('#nav-saved').textContent = saved.toLocaleString();
  $('#source-status').textContent = state.records.length ? `${countLabel(state.records.length)} imported` : 'Waiting for an export';
  $('#backup-button').disabled = !state.records.length;
  $('.source-panel strong').textContent = state.channel.name || 'Telegram archive';
  $('#archive-range').textContent = state.coverage ? `${readableDate(state.coverage.firstPosted)} — ${readableDate(state.coverage.lastPosted)} · Telegram archive` : '';
  const sidebarTopics = $('#sidebar-topics');
  sidebarTopics.replaceChildren();
  if (state.records.length) {
    sidebarTopics.append(el('div', 'space-label', 'BROWSE TOPICS'));
    TOPICS.filter(topic => counts[topic.id]).slice(0,4).forEach(topic => {
      const button = el('button', 'nav-item sidebar-topic');
      button.type = 'button';
      button.append(el('span', 'topic-dot'), el('span', '', topic.name));
      button.addEventListener('click', () => chooseTopic(topic.id));
      sidebarTopics.append(button);
    });
  }
  renderCollection();
}
function renderCollection() {
  $('#welcome').hidden=view!=='overview';
  $('.stats-grid').hidden=view!=='overview';
  $('.main-nav').querySelectorAll('[data-view]').forEach(link => {
    const selected = link.dataset.view === view;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  const title = activeTopic !== 'all' && view === 'library' ? topicById(activeTopic).name : viewTitles[view];
  $('#breadcrumb-current').textContent = title;
  $('#collection-title').textContent = title;
  $('#section-eyebrow').textContent = view === 'metrics'?'TRACK YOUR RESULTS':view === 'checkups'?'LAST VISITS, IN CONTEXT':view === 'topics' ? 'FIND THE CONNECTIONS' : view === 'timeline' ? 'THROUGH THE YEARS' : view === 'saved' ? 'KEEP IT CLOSE' : view === 'overview' ? 'CONNECTED TO YOUR ORIGINAL RECORDS' : view === 'treatments' ? 'DATED MENTIONS, IN CONTEXT' : 'YOUR COLLECTION';
  $('#display-options').hidden = ['overview','topics','treatments','documents','metrics','checkups'].includes(view);
  $('#collection-toolbar').hidden = ['topics','overview','metrics','checkups'].includes(view);
  $('#sort').closest('label').hidden = ['treatments','timeline'].includes(view);
  $('#search').placeholder = view === 'documents' ? 'Search report text, document titles, and topics…' : view === 'treatments' ? 'Search medication names and history…' : 'Search your notes, documents, and topics…';
  const filterRow = $('#filter-row');
  filterRow.replaceChildren();
  const counts = countsByTopic();
  if (!['topics','overview','treatments','metrics','checkups'].includes(view) && state.records.length) {
    const items = [{ id:'all', name:'All topics' }, ...TOPICS.filter(topic => counts[topic.id])];
    items.forEach(topic => {
      const button = el('button', `filter-chip${activeTopic === topic.id ? ' active' : ''}`, topic.name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(activeTopic === topic.id));
      button.addEventListener('click', () => { activeTopic = topic.id; pageLimit = 60; renderCollection(); });
      filterRow.append(button);
    });
  }
  const content = $('#collection-content');
  content.replaceChildren();
  $('#results-summary').textContent = '';
  if (!state.records.length) { content.append(emptyLibrary()); return; }
  if (view === 'metrics') {renderMetrics(content);return;}
  if (view === 'checkups') {renderCheckups(content);return;}
  if (view === 'overview') { renderOverview(content); return; }
  if (view === 'documents') { renderDocuments(content); return; }
  if (view === 'treatments') { renderTreatments(content); return; }
  if (view === 'topics') {
    const notice = el('p', 'results-summary', 'Your original archive has been organized by care area. New imports use editable topic suggestions.');
    const grid = el('div', 'topic-grid');
    TOPICS.filter(topic => counts[topic.id]).forEach(topic => {
      const button = el('button', 'topic-card');
      button.type = 'button';
      const symbol = el('span', `stat-icon ${topic.color}`); symbol.innerHTML = icon(topic.icon);
      button.append(symbol, el('h3', '', topic.name), el('p', '', topic.description), el('span', 'topic-total', countLabel(counts[topic.id])));
      button.addEventListener('click', () => chooseTopic(topic.id));
      grid.append(button);
    });
    content.append(notice, grid);
    return;
  }
  const filtered = filterRecords(state.records, {query:$('#search').value, topic:activeTopic, savedOnly:view === 'saved', sort:view === 'timeline' ? 'newest' : $('#sort').value});
  $('#results-summary').textContent = `${countLabel(filtered.length)}${activeTopic !== 'all' ? ` in ${topicById(activeTopic).name}` : ''}${$('#search').value.trim() ? ' found' : ''}`;
  if (!filtered.length) {
    const empty = el('div', 'empty-state');
    const image = el('div','empty-illustration'); image.innerHTML = `<span>${icon(view === 'saved' ? 'bookmark' : 'search')}</span>`;
    empty.append(image, el('h3', '', view === 'saved' && !$('#search').value && activeTopic === 'all' ? 'Keep the useful things close.' : 'No records match just yet.'), el('p', '', view === 'saved' && !$('#search').value && activeTopic === 'all' ? 'Use the bookmark on any record to find it here later.' : 'Try a different search, or clear your topic filter.'));
    const reset = el('button', 'button button-secondary', 'Browse all records'); reset.type = 'button';
    reset.addEventListener('click', () => { $('#search').value = ''; activeTopic = 'all'; location.hash = 'library'; if(view === 'library') renderCollection(); });
    empty.append(reset); content.append(empty); return;
  }
  const visible = filtered.slice(0, pageLimit);
  if (activeTopic !== 'all' && !$('#search').value.trim() && view === 'library') {
    const profile = state.topicProfiles?.[activeTopic];
    if (profile?.length) {
      const panel = el('section','care-profile');
      panel.append(el('div','eyebrow','THE HISTORY IN CONTEXT'));
      profile.forEach(point => {const item=el('div','profile-point');item.append(el('p','',point.text),sourceButtons(point.sourceIds));panel.append(item);});
      content.append(panel);
    }
  }
  if (view === 'timeline') {
    content.append(el('p','archive-note','Dates stated in notes or documents are used when available. Otherwise, the Telegram posting date is shown.'));
    const groups = new Map();
    const chronological = [...visible].sort((a,b) => (Date.parse(recordDate(b))||0)-(Date.parse(recordDate(a))||0));
    chronological.forEach(record => { const month = monthName(recordDate(record)); if (!groups.has(month)) groups.set(month, []); groups.get(month).push(record); });
    for (const [month, records] of groups) {
      const group = el('section', 'timeline-group');
      const grid = el('div', 'record-grid list-layout');
      records.forEach(record => grid.append(recordCard(record)));
      group.append(el('h3', '', month), grid); content.append(group);
    }
  } else {
    const grid = el('div', `record-grid${layout === 'list' ? ' list-layout' : ''}`);
    visible.forEach(record => grid.append(recordCard(record)));
    content.append(grid);
  }
  if (filtered.length > pageLimit) {
    const more = el('button', 'button button-secondary', `Show more (${filtered.length - pageLimit} remaining)`);
    more.type = 'button'; more.style.marginTop = '22px';
    more.addEventListener('click', () => { pageLimit += 60; renderCollection(); }); content.append(more);
  }
}
function renderOverview(content) {
  const heading = el('div','overview-intro');
  heading.append(el('p','','A connected view of the history you’ve recorded. Open any source number to read the full original note.'));
  if(state.coverage?.snapshotDate)heading.append(el('span','snapshot-badge',readableDate(state.coverage.snapshotDate)));
  content.append(heading);
  const actions=el('div','overview-actions');
  for(const [route,label,symbol] of [['metrics','Track your health indicators','flask'],['checkups','See visits and screenings','calendar']]){const link=el('a','overview-action');link.href='#'+route;const image=el('span');image.innerHTML=icon(symbol);link.append(image,el('strong','',label));actions.append(link);}content.append(actions);
  const latest = el('section','latest-panel');
  const recent=[...state.records].sort((a,b)=>String(recordDate(b)).localeCompare(String(recordDate(a)))).slice(0,2);
  const latestHeader=el('div','panel-heading');latestHeader.append(el('h3','','Your latest detailed notes'));
  latest.append(latestHeader);
  const latestGrid=el('div','latest-grid');
  recent.forEach(record=>{const topic=topicById(record.topic);const item=el('button','latest-record');item.type='button';const symbol=el('span','stat-icon '+topic.color);symbol.innerHTML=icon(topic.icon);item.append(symbol,el('span','latest-date',readableDate(recordDate(record))),el('strong','',record.title),el('span','latest-source',record.origin==='manual'?'Source record':`Original note #${record.messageId} · posted ${readableDate(record.date)}`));item.addEventListener('click',()=>openRecord(record.id));latestGrid.append(item);});
  latest.append(latestGrid);content.append(latest);
  const grid=el('div','overview-grid');
  (state.overview || []).forEach(item=>{const topic=topicById(item.topic);const panel=el('article','overview-card');const symbol=el('span',`stat-icon ${topic.color}`);symbol.innerHTML=icon(topic.icon);panel.append(symbol,el('h3','',item.title),el('p','',item.text),sourceButtons(item.sourceIds));const button=el('button','text-link','Explore this care area');button.type='button';button.addEventListener('click',()=>chooseTopic(item.topic));panel.append(button);grid.append(panel);});
  content.append(grid);
  const labs=el('section','lab-section');
  labs.append(el('div','eyebrow','FROM THE ORIGINAL LABORATORY REPORTS'),el('h3','','Results, over time'),el('p','archive-note','Dates below are sample dates. Values, units, and reference intervals are preserved from each report. No treatment changes are inferred from them.'));
  (state.labPanels || []).forEach(panel=>{
    const section=el('section','lab-panel');section.append(el('h4','',panel.title),el('p','',panel.description));
    const scroll=el('div','table-scroll');const table=el('table','results-table');const caption=el('caption','sr-only',panel.title+' laboratory history');table.append(caption);
    const header=el('tr');[(panel.rows[0]?.analyte?'Test':'Sample date'),'Result','Reference interval','Source'].forEach(label=>{const cell=el('th','',label);cell.scope='col';header.append(cell);});const head=el('thead');head.append(header);table.append(head);
    const body=el('tbody');panel.rows.forEach(row=>{const tr=el('tr');const date=el('td','',row.analyte || readableDate(row.date));const value=el('td','');value.append(el('strong','',row.value),el('span','result-unit',row.unit));const reference=el('td','reference-interval',row.reference);const source=el('td');source.append(sourceButtons([row.sourceId]));tr.append(date,value,reference,source);body.append(tr);});table.append(body);scroll.append(table);section.append(scroll);labs.append(section);
  });content.append(labs);
  const coverage=el('div','coverage-panel');const symbol=el('span');symbol.innerHTML=icon('file');const copy=el('div');const reviewed=Number(state.coverage?.reviewedImages||0),pdfs=Number(state.coverage?.searchablePDFs||0);copy.append(el('strong','','Every original stays connected.'),el('p','',getLanguage()==='ru'?`Все исходные сообщения и файлы сохранены. Разобрано изображений: ${reviewed}; PDF с поиском по тексту: ${pdfs}. Неразборчивая рукопись отмечена для проверки. Записи и оригиналы хранятся в закрытом R2.`:`Every source message and file is preserved. Images reviewed: ${reviewed}; searchable PDFs: ${pdfs}. Unclear handwriting is marked for review. Records and originals are stored in private R2.`));coverage.append(symbol,copy);content.append(coverage);
}
function renderDocuments(content) {
  const matchingRecords=filterRecords(state.records,{query:$('#search').value,topic:activeTopic,sort:$('#sort').value});
  const documents=matchingRecords.flatMap(record=>record.attachments.map(attachment=>({record,attachment})));
  $('#results-summary').textContent=`${documents.length} document references · includes the PDF extracted from the original ZIP`;
  if(!documents.length){content.append(el('div','empty-state','No documents match this search.'));return;}
  content.append(el('p','archive-note','Search includes original message text, document titles, and text extracted from PDFs. Image scans can be opened in their original form.'));
  const grid=el('div','document-grid');
  documents.slice(0,pageLimit).forEach(({record,attachment})=>{
    const card=el('article','document-card');
    const button=el('button','document-open');button.type='button';
    const preview=el('div','document-preview');const thumbnail=safeAssetPath(attachment.thumbnail) || (attachment.type==='photo'?attachmentURL(attachment):null);
    if(thumbnail){const image=el('img');image.src=thumbnail;image.alt=`Preview: ${attachment.label || record.title}`;image.loading='lazy';preview.append(image);}else preview.innerHTML=icon('file');
    const extension=attachment.name.split('.').at(-1).toUpperCase();
    button.append(preview,el('span','document-type',`${extension} · ${attachment.text?'Text searchable':'Original document'}${attachment.protected?' · password protected':''}`),el('strong','',attachment.label || record.title),el('span','document-date',readableDate(recordDate(record))));
    button.addEventListener('click',()=>openRecord(record.id));card.append(button);grid.append(card);
  });content.append(grid);
  if(documents.length>pageLimit){const more=el('button','button button-secondary more-button','Show more documents');more.type='button';more.addEventListener('click',()=>{pageLimit+=60;renderCollection();});content.append(more);}
}
function renderTreatments(content) {
  content.append(el('p','archive-note treatment-intro','This is a history of what the records mention. Entries distinguish taking a medicine, a clinician’s plan, and documented discontinuation. They do not establish a current medication list.'));
  const words=normalize($('#search').value).trim().split(/\s+/).filter(Boolean);
  const treatments=(state.treatments || []).filter(item=>words.every(word=>normalize(`${item.name} ${item.latest} ${item.history}`).includes(word)));
  $('#results-summary').textContent=`${treatments.length} medication and supplement histories`;
  const list=el('div','treatment-list');
  treatments.forEach(item=>{const topic=topicById(item.topic);const panel=el('article','treatment-card');const heading=el('div','treatment-heading');const symbol=el('span',`stat-icon ${topic.color}`);symbol.innerHTML=icon('pill');heading.append(symbol,el('h3','',item.name));panel.append(heading,el('p','treatment-latest',item.latest),el('p','',item.history),sourceButtons(item.sourceIds));list.append(panel);});
  content.append(list);
  const additions=filterRecords(state.records,{query:$('#search').value}).filter(record=>record.clinical?.prescriptions?.length||(record.origin==='manual'&&(record.kind==='prescription'||record.topic==='treatment')));
  if(additions.length){content.append(el('h3','','Dated prescription records'));const grid=el('div','record-grid');additions.forEach(record=>grid.append(recordCard(record)));content.append(grid);}
}
function renderGuidance(id,compact=false) {
  const guidance=WHO_GUIDANCE[id]||WHO_GUIDANCE.general;
  const box=el('aside','guidance-box');
  box.append(el('span','guidance-label','WHO frequency'),el('h4','',localized(guidance,'title')));
  const details=compact?el('details','guidance-details'):box;
  if(compact)details.append(el('summary','','Details & source'));
  details.append(el('p','',localized(guidance,'text')));
  const anchor=el('a','text-link',localized(guidance,'source'));anchor.href=guidance.url;anchor.target='_blank';anchor.rel='noopener noreferrer';details.append(anchor);
  if(guidance.contextOnly)details.append(el('p','context-note','Source context, not a test-specific interval'));
  if(compact)box.append(details);
  return box;
}
function renderCadenceEditor(scope,id,guidanceId) {
 const setting=cadenceSetting(state,scope,id,guidanceId,getLanguage());
 const form=el('form','cadence-editor');const label=el('label','','Check frequency');
 const input=el('textarea');input.rows=2;input.maxLength=200;input.value=setting.value;input.placeholder=setting.whoIntervalAvailable?'':translateUI('WHO does not specify a universal interval here.');input.setAttribute('aria-label',translateUI('Check frequency'));label.append(input);form.append(label);
 form.append(el('span','cadence-origin',setting.custom?'Your setting':setting.whoIntervalAvailable?'WHO default':'No fixed WHO interval found'));
 const actions=el('div','cadence-actions');const save=el('button','button button-secondary','Save frequency');save.type='submit';actions.append(save);
 if(setting.custom){const reset=el('button','text-button','Restore WHO default');reset.type='button';reset.addEventListener('click',async()=>{reset.disabled=true;try{await commit({...state,cadenceOverrides:updateCadenceOverrides(state.cadenceOverrides,scope,id,null)});notify('WHO default restored.');}catch(error){notify(error.message);reset.disabled=false;}});actions.append(reset);}
 form.append(actions);form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await commit({...state,cadenceOverrides:updateCadenceOverrides(state.cadenceOverrides,scope,id,input.value)});notify('Frequency saved.');}catch(error){notify(error.message);save.disabled=false;}});
 return form;
}
function renderMetrics(content) {
  const header=el('div','tracking-heading');const intro=el('p','','Measurements are taken from original laboratory reports. Add new results to extend the history.');const add=el('button','button button-primary','Add a result');add.type='button';add.addEventListener('click',()=>openTrackingForm('measurement'));header.append(intro,add);content.append(header);
  const cards=el('div','metric-cards');
  METRIC_SPECS.filter(spec=>spec.featured).forEach(spec=>{
    const series=measurementSeries(state,spec.id);const last=series.at(-1);const button=el('button',`metric-card${selectedMetric===spec.id?' active':''}`);button.type='button';button.setAttribute('aria-pressed',String(selectedMetric===spec.id));button.append(el('span','metric-name',localized(spec,'name')));
    if(last){const value=el('strong','metric-value',formatNumber(last.canonical.value));value.append(el('span','metric-unit',last.canonical.unit));button.append(value,el('span','metric-date',readableDate(last.date)));}else button.append(el('span','','No measurements yet.'));
    button.addEventListener('click',()=>{selectedMetric=spec.id;renderCollection();});cards.append(button);
  });content.append(cards);
  const picker=el('label','metric-picker','Choose an indicator');const select=el('select');select.id='metric-select';
  METRIC_SPECS.forEach(spec=>{const option=el('option','',localized(spec,'name'));option.value=spec.id;select.append(option);});select.value=selectedMetric;select.addEventListener('change',()=>{selectedMetric=select.value;renderCollection();});picker.append(select);content.append(picker);
  const spec=METRIC_SPECS.find(item=>item.id===selectedMetric)||METRIC_SPECS[0];const series=measurementSeries(state,spec.id),last=series.at(-1);
  const columns=el('div','metric-detail-grid');const graph=el('section','metric-chart-panel');const heading=el('div','panel-heading');heading.append(el('h3','',localized(spec,'name')),el('span','subtle-label',`${series.length} measurements`));graph.append(heading);
  if(series.length){graph.append(drawMetricChart(spec,series));if(series.length===1)graph.append(el('p','archive-note','Only one result is available. Add another result to see a trend.'));}
  else graph.append(el('p','archive-note','No measurements yet.'));
  const unitNote=el('p','chart-unit-note',`Chart units: ${spec.unit}. `);unitNote.append('Original units and reference intervals are preserved in the table.');graph.append(unitNote);
  if(spec.id==='ferritin')graph.append(el('p','chart-unit-note',getLanguage()==='ru'?'Для графика: 1 нг/мл = 1 мкг/л.':'For the chart: 1 ng/mL = 1 µg/L.'));
  if(spec.id==='tsh')graph.append(el('p','chart-unit-note',getLanguage()==='ru'?'Для графика: 1 мкМЕ/мл = 1 мМЕ/л.':'For the chart: 1 µIU/mL = 1 mIU/L.'));
  if(spec.id==='hemoglobin')graph.append(el('p','chart-unit-note',getLanguage()==='ru'?'При добавлении г/дл: 1 г/дл = 10 г/л.':'For added g/dL results: 1 g/dL = 10 g/L.'));
  columns.append(graph);const aside=el('div','metric-side');if(last){const recent=el('div','metric-recency');recent.append(el('span','guidance-label','Latest recorded result'),el('strong','',readableDate(last.date)),el('span','elapsed-time',elapsedLabel(last.date)));aside.append(recent);}aside.append(renderCadenceEditor('metric',spec.id,spec.guidance),renderGuidance(spec.guidance));columns.append(aside);content.append(columns);
  const panel=el('section','lab-panel measurement-history');panel.append(el('h4','','History of measurements'));const scroll=el('div','table-scroll');const table=el('table','results-table');const head=el('thead');const row=el('tr');['Sample date','Result','Reference interval','Source'].forEach(text=>{const th=el('th','',text);th.scope='col';row.append(th);});head.append(row);table.append(head);const body=el('tbody');
  [...series].reverse().forEach(item=>{
    const tr=el('tr');tr.append(el('td','',readableDate(item.date)));const value=el('td');value.append(el('strong','',formatNumber(item.value)),el('span','result-unit',item.unit));if(item.note)value.append(el('p','result-note',item.note));tr.append(value);const range=el('td');range.append(el('span','',item.refLow!=null&&item.refHigh!=null?`${formatNumber(item.refLow)}–${formatNumber(item.refHigh)}`:'Reference interval not provided'));
    if(item.refLow!=null&&item.refHigh!=null){const status=item.value<item.refLow?'Below this laboratory’s reference interval':item.value>item.refHigh?'Above this laboratory’s reference interval':'Within this laboratory’s reference interval';range.append(el('span',`reference-status${item.value<item.refLow||item.value>item.refHigh?' outside':''}`,status));}tr.append(range);
    const source=el('td');if(item.sourceId)source.append(sourceButtons([item.sourceId]));else{source.append(el('span','manual-label','Manual entry'));source.append(deleteTrackingButton('measurement',item.id));}tr.append(source);body.append(tr);
  });table.append(body);scroll.append(table);panel.append(scroll,el('p','archive-note','Reference intervals come from each laboratory. The chart connects observations and does not determine a treatment plan.'));content.append(panel);content.append(guidanceFooter());
}
function drawMetricChart(spec,series) {
  const ns='http://www.w3.org/2000/svg';const make=(tag,attributes={},text)=>{const node=document.createElementNS(ns,tag);for(const [name,value]of Object.entries(attributes))node.setAttribute(name,String(value));if(text!==undefined)node.textContent=text;return node;};
  const width=760,height=300,left=63,right=28,top=35,bottom=48;const plotW=width-left-right,plotH=height-top-bottom;
  const values=series.map(item=>item.canonical.value);const min=Math.min(...values),max=Math.max(...values),padding=Math.max((max-min)*.25,max*.08,.1);const low=Math.max(0,min-padding),high=max+padding;
  const y=value=>top+plotH-(value-low)/Math.max(high-low,.001)*plotH;const first=series[0].date,last=series.at(-1).date;const span=Math.max(1,daysSince(first,last));const x=date=>series.length===1?left+plotW/2:left+(daysSince(first,date)/span)*plotW;
  const svg=make('svg',{viewBox:`0 0 ${width} ${height}`,class:'metric-chart',role:'img','aria-label':localized(spec,'name')});svg.append(make('title',{},localized(spec,'name')));
  for(let i=0;i<=4;i++){const value=low+(high-low)*i/4,py=y(value);svg.append(make('line',{x1:left,x2:width-right,y1:py,y2:py,stroke:'#e7edf4','stroke-width':1}));svg.append(make('text',{x:left-12,y:py+4,'text-anchor':'end',class:'chart-label'},formatNumber(value)));}
  if(series.length>1)svg.append(make('polyline',{points:series.map(item=>`${x(item.date)},${y(item.canonical.value)}`).join(' '),fill:'none',stroke:'#4773cc','stroke-width':3,'stroke-linejoin':'round'}));
  series.forEach(item=>{
    const point=make('circle',{cx:x(item.date),cy:y(item.canonical.value),r:6,fill:'#fff',stroke:'#4773cc','stroke-width':3,tabindex:0,class:'chart-point',role:item.sourceId?'button':'img','aria-label':`${readableDate(item.date)}: ${formatNumber(item.canonical.value)} ${spec.unit}`});point.append(make('title',{},`${readableDate(item.date)} · ${formatNumber(item.value)} ${item.unit}`));
    if(item.sourceId){const open=()=>{const record=findRecord(item.sourceId);if(record)openRecord(record.id);};point.addEventListener('click',open);point.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();open();}});}svg.append(point);svg.append(make('text',{x:x(item.date),y:y(item.canonical.value)-16,'text-anchor':'middle',class:'chart-value'},formatNumber(item.canonical.value)));
  });
  const shortDate=date=>localDate(date).toLocaleDateString(getLanguage()==='ru'?'ru-RU':'en-GB',{month:'short',year:'numeric'});
  svg.append(make('text',{x:left,y:height-13,'text-anchor':'start',class:'chart-label'},shortDate(first)));if(series.length>1)svg.append(make('text',{x:width-right,y:height-13,'text-anchor':'end',class:'chart-label'},shortDate(last)));
  return svg;
}
function renderCheckups(content) {
  const header=el('div','tracking-heading');header.append(el('p','','These are the latest documented dates in this archive. A later visit may simply be missing from the records.'));const add=el('button','button button-primary','Add a visit');add.type='button';add.addEventListener('click',()=>openTrackingForm('checkup'));header.append(add);content.append(header,el('p','archive-note','General screening intervals depend on age, test result, and risk group. A clinician’s individual plan is shown separately.'));
  const grid=el('div','checkup-grid');
  CHECKUP_SPECS.forEach(spec=>{
    spec={...spec,...state.checkupPlans?.[spec.id]};
    const history=checkupHistory(state,spec.id),last=history[0];const card=el('article','checkup-card');const title=el('div','checkup-heading');const symbol=el('span','stat-icon blue');symbol.innerHTML=icon(spec.icon);title.append(symbol,el('h3','',localized(spec,'name')));card.append(title);
    if(last){const recency=el('div','checkup-recency');recency.append(el('span','guidance-label','Last recorded date'),el('strong','',readableDate(last.date)),el('span','elapsed-time',elapsedLabel(last.date)));card.append(recency);if(last.sourceIds?.length)card.append(sourceButtons(last.sourceIds));else card.append(el('span','manual-label','Manual entry'));if(last.note)card.append(el('p','archive-note',last.note));}
    else card.append(el('p','archive-note','No visits recorded yet.'));
    if(spec.detail)card.append(el('p','archive-note',localized(spec,'detail')));
    card.append(renderCadenceEditor('checkup',spec.id,spec.guidance),renderGuidance(spec.guidance,true));
    if(spec.doctorPlan){const plan=el('div','recorded-plan');plan.append(el('strong','','Recorded clinician’s plan'),el('p','',localized(spec,'doctorPlan')),sourceButtons(spec.planSourceIds));card.append(plan);}
    if(last?.nextDate){const plan=el('div','recorded-plan');plan.append(el('strong','','Your saved plan'),el('p','',readableDate(last.nextDate)));card.append(plan);}
    if(history.length>1||history.some(item=>item.manual)){
      const details=el('details','checkup-history');details.append(el('summary','','Recent history'));history.forEach(item=>{const line=el('div','checkup-history-line');line.append(el('span','',readableDate(item.date)));if(item.sourceIds?.length)line.append(sourceButtons(item.sourceIds));if(item.manual)line.append(deleteTrackingButton('checkup',item.id));details.append(line);});card.append(details);
    }
    const button=el('button','text-link checkup-add','Add a visit');button.type='button';button.addEventListener('click',()=>openTrackingForm('checkup',spec.id));card.append(button);grid.append(card);
  });content.append(grid,guidanceFooter());
}
function guidanceFooter() {
  const footer=el('p','guidance-footer');footer.append(el('span','','Guidance checked'),document.createTextNode(`: ${readableDate(GUIDANCE_REVIEWED)}. `),el('span','',getLanguage()==='ru'?'Общие рекомендации ВОЗ и планы из твоих записей показаны раздельно. Национальные требования к обследованиям здесь не оценивались.':'WHO population guidance and plans from your records are shown separately. National examination requirements have not been assessed here.'));return footer;
}
function deleteTrackingButton(type,id) {
  const button=el('button','delete-entry','Delete manual entry');button.type='button';button.addEventListener('click',async()=>{
    button.disabled=true;const key=type==='measurement'?'manualMeasurements':'manualCheckups';try{await commit({...state,[key]:(state[key]||[]).filter(item=>item.id!==id)});notify('Manual entry removed.');}catch(error){button.disabled=false;notify(error.message);}
  });return button;
}
function openTrackingForm(type,preselected) {
  const dialog=$('#entry-dialog');dialog.replaceChildren();const heading=el('div','modal-heading');const title=el('h2','',type==='measurement'?'Result entry':'Visit entry');title.id='entry-title';const close=el('button','icon-button');close.type='button';close.setAttribute('aria-label','Close');close.innerHTML=icon('close');close.addEventListener('click',()=>dialog.close());heading.append(title,close);dialog.append(heading);
  const form=el('form','tracking-form');
  const field=(labelText,name,element)=>{const label=el('label','',labelText);element.name=name;element.id='tracking-'+name;label.append(element);form.append(label);return element;};
  const picker=el('select');const specs=type==='measurement'?METRIC_SPECS:CHECKUP_SPECS;specs.forEach(spec=>{const option=el('option','',spec.name);option.value=spec.id;picker.append(option);});picker.value=preselected || (type==='measurement'?selectedMetric:CHECKUP_SPECS[0].id);field(type==='measurement'?'Indicator':'Visit or examination',type==='measurement'?'metric':'checkup',picker);
  const date=el('input');date.type='date';date.required=true;date.max=todayDate();date.value=todayDate();field(type==='measurement'?'Sample date':'Date','date',date);
  if(type==='measurement'){
    const value=el('input');value.inputMode='decimal';value.required=true;value.autocomplete='off';field('Value','value',value);
    const unit=el('select');const fillUnits=()=>{unit.replaceChildren();const spec=METRIC_SPECS.find(item=>item.id===picker.value);spec.units.forEach(text=>{const option=el('option','',text);option.value=text;unit.append(option);});unit.value=spec.unit;};fillUnits();picker.addEventListener('change',fillUnits);field('Unit','unit',unit);
    for(const [label,name]of [['Lower reference value','refLow'],['Upper reference value','refHigh']]){const input=el('input');input.inputMode='decimal';input.placeholder='Optional';field(label,name,input);}
  }else{const next=el('input');next.type='date';field('Next date from your clinician’s plan','nextDate',next);}
  const note=el('textarea');note.rows=3;note.maxLength=2000;field('Comment or laboratory','note',note);
  const status=el('p','entry-status');status.setAttribute('role','status');form.append(status);
  const actions=el('div','form-actions');const cancel=el('button','button button-secondary','Cancel');cancel.type='button';cancel.addEventListener('click',()=>dialog.close());const save=el('button','button button-primary',type==='measurement'?'Save result':'Save visit');save.type='submit';actions.append(cancel,save);form.append(actions);
  form.addEventListener('submit',async event=>{
    event.preventDefault();save.disabled=true;status.textContent='';
    try{const values=Object.fromEntries(new FormData(form));const entry=type==='measurement'?validateMeasurement(values,todayDate()):validateCheckup(values,todayDate());entry.id='manual:'+crypto.randomUUID();const key=type==='measurement'?'manualMeasurements':'manualCheckups';await commit({...state,[key]:[...(state[key]||[]),entry]});dialog.close();notify(type==='measurement'?'Result saved.':'Visit saved.');}
    catch(error){status.textContent=error.message;}
    finally{save.disabled=false;}
  });dialog.append(form);openDialog(dialog);
}
function emptyLibrary() {
  const empty = el('div', 'empty-state');
  const illustration = el('div', 'empty-illustration'); illustration.innerHTML = `<span>${icon('book')}</span>`;
  const button = el('button', 'button button-primary'); button.type = 'button'; button.innerHTML = icon('plus'); button.append('Import your first records'); button.addEventListener('click', openImport);
  empty.append(illustration, el('h3', '', 'A fresh page for everything you’ve collected.'), el('p', '', 'Your channel’s posts will appear here once you import an export. No notes have been imported yet.'), button);
  const steps = el('div', 'empty-steps');
  [
    ['telegram','Bring it together','Import the posts from your Telegram channel.'],
    ['grid','Find your way','Search your words and browse suggested topics.'],
    ['link','Keep the context','Read the full message and return to its source.'],
  ].forEach(([symbol,title,description]) => {
    const step = el('div','empty-step'); const image = el('span'); image.innerHTML = icon(symbol);
    const copy = el('div'); copy.append(el('strong','',title),el('p','',description)); step.append(image,copy); steps.append(step);
  });
  empty.append(steps);
  const note = el('div','pending-note'); note.innerHTML = icon('lock'); note.append('Original channel content has not been accessed.'); empty.append(note);
  return empty;
}
function recordCard(record) {
  const topic = topicById(record.topic);
  const card = el('article', 'record-card');
  const top = el('div', 'card-top');
  const badge = el('span', `topic-badge ${topic.color}`); badge.innerHTML = icon(topic.icon); badge.append(topic.name);
  const save = el('button', `icon-button card-save${record.saved ? ' saved' : ''}`); save.type = 'button'; save.innerHTML = icon('bookmark');
  save.setAttribute('aria-label', `${record.saved ? 'Unsave' : 'Save'}: ${record.title}`); save.setAttribute('aria-pressed', String(record.saved));
  save.addEventListener('click', async () => { save.disabled = true; try { await toggleSaved(record.id); } catch (error) { save.disabled = false; notify(error.message); } });
  top.append(badge, save);
  const open = el('button', 'record-open', record.title); open.type = 'button'; open.addEventListener('click', () => openRecord(record.id));
  const excerpt = record.summary || record.text.split('\n').filter(Boolean).slice(1).join(' ') || record.text || `${record.attachments.length} attachment(s)`;
  const footer = el('div', 'card-footer');
  const date = el('span', '', readableDate(recordDate(record)));
  const source = el('span'); source.innerHTML = icon('telegram'); source.append(record.channelName || 'Telegram');
  footer.append(date, source);
  if(record.eventDate && record.date?.slice(0,10)!==record.eventDate){const posted=el('span','posted-label',`Posted ${readableDate(record.date)}`);footer.append(posted);}
  if(record.attachments.length){const attachmentCount=el('span','');attachmentCount.innerHTML=icon('file');attachmentCount.append(String(record.attachments.length));footer.append(attachmentCount);}
  card.append(top, open, el('p', 'record-excerpt', excerpt), footer);
  return card;
}
function chooseTopic(topic) {
  activeTopic = topic; pageLimit = 60;
  if (location.hash !== '#library') location.hash = 'library';
  else { view = 'library'; renderCollection(); }
  closeMenu();
  $('#collection-title').scrollIntoView({block:'start',behavior:'smooth'});
}
function openDialog(dialog) {
  if(dialog.open)return;
  lastDialogFocus = document.activeElement;
  dialog.showModal();
}
function openImport() { $('#import-progress').textContent = ''; $('#import-progress').classList.remove('error'); openDialog($('#import-dialog')); }
function renderTextWithLinks(target, text) {
  target.replaceChildren();
  const expression = /https?:\/\/[^\s<>]+/g;
  let lastIndex = 0;
  for (const match of text.matchAll(expression)) {
    const rawUrl = match[0].replace(/[.,;!?)]*$/, '');
    target.append(document.createTextNode(text.slice(lastIndex, match.index)));
    const href = safeUrl(rawUrl);
    if (href) { const anchor = el('a','',rawUrl); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; target.append(anchor); }
    else target.append(document.createTextNode(rawUrl));
    lastIndex = match.index + rawUrl.length;
  }
  target.append(document.createTextNode(text.slice(lastIndex)));
}
function openRecord(id) {
  const record = state.records.find(item => item.id === id); if (!record) return;
  activeRecordId = id;
  $('#record-title').textContent = record.title;
  $('#record-meta').replaceChildren();
  const topic = topicById(record.topic);
  const badge = el('span', `topic-badge ${topic.color}`, topic.name);
  $('#record-meta').append(badge, el('span','',readableDate(recordDate(record))));
  if(record.eventDate && record.date?.slice(0,10)!==record.eventDate)$('#record-meta').append(el('span','posted-label',`Posted ${readableDate(record.date)}`));
  renderTextWithLinks($('#record-body'), record.text || 'This message contains an attachment.');
  if(Object.keys(record.clinical||{}).length){
   const clinical=el('section','clinical-facts');clinical.append(el('h3','','Extracted medical information'));
   const metadata=[record.clinical.clinic,record.clinical.clinician,record.clinical.specialty].filter(Boolean);if(metadata.length)clinical.append(el('p','clinical-meta',metadata.join(' · ')));
   for(const [key,label]of [['findings','Symptoms and findings'],['assessments','Diagnosis in the source'],['prescriptions','Historical prescriptions'],['procedures','Completed procedures'],['recommendations','Clinician’s recommendations'],['uncertain','Needs checking']])if(record.clinical[key]?.length){
    const group=el('div','clinical-group'+(key==='uncertain'?' clinical-uncertain':''));group.append(el('h4','',label));const list=el('ul');record.clinical[key].forEach(text=>{const item=el('li','',text);item.dataset.noTranslate='';list.append(item);});group.append(list);clinical.append(group);
   }
   $('#record-body').append(clinical);
  }
  const attachments = $('#record-attachments'); attachments.replaceChildren();
  if(record.annotation)attachments.append(el('p','source-annotation',record.annotation));
  record.attachments.forEach(attachment => {
    const item=el('section','attachment-view');
    item.append(el('h3','',attachment.label || attachment.name));
    const url=attachmentURL(attachment), thumbnail=safeAssetPath(attachment.thumbnail);
    if(url){
      const anchor=el('a','attachment-original');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';
      if(attachment.type==='photo' || thumbnail){const image=el('img');image.src=attachment.type==='photo'?url:thumbnail;image.alt=attachment.label || attachment.name;image.loading='lazy';anchor.append(image);}
      const label=el('span','attachment-open-label',attachment.protected?'Open password-protected original':'Open original document');anchor.append(label);item.append(anchor);
      const download=el('a','text-link','Download original');download.href=url;download.download=attachment.name;item.append(download);
    }else item.append(el('p','archive-note','Attachment reference only. The file was not included in this browser import.'));
    if(attachment.text){const details=el('details','extracted-text');details.append(el('summary','','Read extracted PDF text'));const text=el('div','record-body');text.textContent=attachment.text;details.append(text);item.append(details);}
    attachments.append(item);
  });
  const source = $('#record-source'); source.replaceChildren();
  const sourceUrl = safeUrl(record.sourceUrl);
  if (sourceUrl) { const anchor = el('a'); anchor.href = sourceUrl; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.innerHTML = icon('telegram'); anchor.append('Open original Telegram message'); source.append(anchor); }
  else if(record.origin==='manual')source.textContent=translateUI('Added to your private Cloudflare archive. Original text and files are preserved.');
  else source.textContent = `Original Telegram message #${record.messageId} · ${record.channelName} · posted ${record.originalDate || readableDate(record.date)}. ${record.dateNote || ''}`;
  const references=[record.replyTo,...(record.relatedIds||[])].filter(Boolean);
  if(references.length){const related=el('div','related-records');related.append(el('strong','','Connected records'),sourceButtons(references));source.append(related);}
  $('#edit-title').value = record.title;
  $('#edit-topic').replaceChildren(...TOPICS.map(item => { const option = el('option','',item.name); option.value = item.id; return option; }));
  $('#edit-topic').value = record.topic;
  $('#edit-notes').value = record.notes || '';
  $('#notes-status').textContent = '';
  updateRecordSave(record);
  openDialog($('#record-dialog'));
  $('#record-dialog').scrollTop=0;
}
function updateRecordSave(record) {
  $('#record-save').classList.toggle('selected',record.saved);
  $('#record-save').setAttribute('aria-pressed',String(record.saved));
  $('#record-save').setAttribute('aria-label',record.saved?'Unsave record':'Save record');
}
async function toggleSaved(id) {
  const records = state.records.map(record => record.id === id ? {...record,saved:!record.saved} : record);
  await commit({...state,records});
  if (activeRecordId === id) updateRecordSave(records.find(record => record.id === id));
}

function parseHTML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const messageNodes = [...doc.querySelectorAll('.message.default')];
  if (!messageNodes.length) throw new Error('This HTML file has no exported Telegram messages. Choose messages.html.');
  const channel = {name:doc.querySelector('.page_header .name, .page_header .text')?.textContent.trim() || doc.querySelector('title')?.textContent.trim() || 'Telegram archive',type:'html_export'};
  const records = [];
  const getText = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (['SCRIPT','STYLE','IFRAME'].includes(node.tagName)) return '';
    if (node.tagName === 'BR') return '\n';
    const body = [...node.childNodes].map(getText).join('');
    const href = node.tagName === 'A' ? safeUrl(node.getAttribute('href')) : null;
    return href && !body.includes(href) ? `${body} (${href})` : body;
  };
  for (const node of messageNodes) {
    const bodyNode = node.querySelector('.body > .text') || node.querySelector('.text');
    const body = bodyNode ? getText(bodyNode).trim() : '';
    const rawDate = node.querySelector('.date')?.getAttribute('title') || '';
    const date = parseExportDate(rawDate);
    const attachments = [...node.querySelectorAll('a[href]')].filter(anchor => !bodyNode?.contains(anchor)).map(anchor => anchor.getAttribute('href')).filter(href => href && !href.startsWith('#') && !safeUrl(href) && !/^(?:javascript|data|tg):/i.test(href)).map(name => ({name,type:'file'}));
    if (!body && !attachments.length) continue;
    records.push(normalizeRecord({id:node.id.replace(/^message/,'') || undefined,text:body,date,attachments},channel));
  }
  return {channel,records};
}
async function importFiles(fileList) {
  if (importBusy || !fileList.length) return;
  const progress = $('#import-progress');
  const files = [...fileList];
  if (files.some(file => file.size > 50 * 1024 * 1024) || files.reduce((sum,file) => sum+file.size,0) > 100 * 1024 * 1024) { progress.textContent = 'Choose exports smaller than 50 MB per file and 100 MB in total. A text-only channel export is usually enough.'; progress.classList.add('error'); return; }
  importBusy = true; $('#import-file').disabled = true;
  progress.classList.remove('error'); progress.textContent = 'Reading and organizing your export…';
  try {
    if (!cloud.ready) throw new Error('Дождись загрузки записей из Cloudflare перед импортом.');
    let records = state.records;
    let channel = state.channel;
    let totalAdded = 0;
    let found = 0;
    let tracking={manualMeasurements:state.manualMeasurements||[],manualCheckups:state.manualCheckups||[],cadenceOverrides:state.cadenceOverrides||{}};
    for (const file of files) {
      if (!/\.(?:json|html?)$/i.test(file.name)) throw new Error('Choose a JSON or HTML export. If you have a ZIP, extract it first.');
      const text = (await file.text()).replace(/^\uFEFF/, '');
      let parsed;
      try { if(/\.json$/i.test(file.name)){const json=JSON.parse(text);parsed=parseTelegramJSON(json);if(json.schemaVersion===1)tracking=mergeUserTracking(tracking,json,todayDate());}else parsed=parseHTML(text); }
      catch(error) { throw new Error(`${file.name}: ${error instanceof SyntaxError ? 'This is not valid JSON. Choose result.json from your export.' : error.message}`); }
      parsed.records=parsed.records.map(record=>{
        const existing=state.records.find(item=>item.messageId===record.messageId && item.channelName===record.channelName && normalize(item.text)===normalize(record.text) && item.date?.slice(0,10)===record.date?.slice(0,10));
        return existing ? {...record,id:existing.id} : record;
      });
      found += parsed.records.length;
      const merged = mergeRecords(records,parsed.records);
      if (!records.length && parsed.channel) channel = {...channel,...parsed.channel};
      records = merged.records; totalAdded += merged.added;
    }
    if (!found) throw new Error('This export has no text messages or attachment references to import.');
    await commit({...state,...tracking,channel,records,importedAt:new Date().toISOString()});
    progress.textContent = totalAdded ? `${countLabel(totalAdded)} added. Your collection is ready to browse.` : 'These records are already in your library. Your saved notes have been kept.';
    if (totalAdded) notify(`${countLabel(totalAdded)} added to your library.`);
  } catch(error) { progress.textContent = error.message; progress.classList.add('error'); }
  finally { importBusy = false; $('#import-file').disabled = false; $('#import-file').value = ''; }
}

function closeMenu() { $('#sidebar').classList.remove('open'); $('#menu-scrim').hidden = true; $('#menu-button').setAttribute('aria-expanded','false'); }
function navigate() {
  const requested = location.hash.slice(1);
  if (!Object.hasOwn(viewTitles,requested)) { if (requested !== 'main') { view = 'overview'; renderCollection(); } return; }
  view = requested; pageLimit = 60;
  if (view === 'topics') activeTopic = 'all';
  if(['overview','treatments','metrics','checkups'].includes(view))activeTopic='all';
  renderCollection(); closeMenu();window.scrollTo({top:0});
}
document.querySelectorAll('[data-import]').forEach(button => button.addEventListener('click',openImport));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close',() => { lastDialogFocus?.focus(); });
  dialog.addEventListener('click',event => { if (event.target !== dialog) return; const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); });
});
$('#menu-button').addEventListener('click',() => { const open = $('#sidebar').classList.toggle('open'); $('#menu-scrim').hidden = !open; $('#menu-button').setAttribute('aria-expanded',String(open)); });
$('#menu-scrim').addEventListener('click',closeMenu);
window.addEventListener('hashchange',navigate);
$('#search').addEventListener('input',() => { pageLimit = 60; renderCollection(); });
$('#sort').addEventListener('change',() => { pageLimit = 60; renderCollection(); });
$('#grid-view').addEventListener('click',() => setLayout('grid'));
$('#list-view').addEventListener('click',() => setLayout('list'));
function setLayout(value) { layout = value; for (const name of ['grid','list']) { $(`#${name}-view`).classList.toggle('selected',name===value); $(`#${name}-view`).setAttribute('aria-pressed',String(name===value)); } renderCollection(); }
document.addEventListener('keydown',event => {
  if (event.key === 'Escape') closeMenu();
  if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); if(['topics','overview'].includes(view)) {location.hash='library';view='library';renderCollection();} $('#search').focus(); }
});
$('#import-file').addEventListener('change',event => importFiles(event.target.files));
for (const event of ['dragenter','dragover']) $('#dropzone').addEventListener(event,e => { e.preventDefault(); $('#dropzone').classList.add('dragging'); });
for (const event of ['dragleave','drop']) $('#dropzone').addEventListener(event,e => { e.preventDefault(); $('#dropzone').classList.remove('dragging'); });
$('#dropzone').addEventListener('drop',event => importFiles(event.dataTransfer.files));
$('#backup-button').addEventListener('click',() => {
  if (!state.records.length) return;
  const blob = new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const anchor = el('a'); anchor.href = url; anchor.download = `health-records-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  notify('Backup downloaded. Keep it somewhere safe.');
});
$('#record-save').addEventListener('click',async () => { const button = $('#record-save'); button.disabled = true; try { await toggleSaved(activeRecordId); } catch(error) { notify(error.message); } finally { button.disabled = false; } });
$('#record-edit').addEventListener('submit',async event => {
  event.preventDefault(); const title = $('#edit-title').value.trim(); if(!title) { $('#edit-title').focus(); return; }
  const button = event.submitter; button.disabled = true;
  const records = state.records.map(record => record.id === activeRecordId ? {...record,title,topic:$('#edit-topic').value,notes:$('#edit-notes').value} : record);
  try { await commit({...state,records}); $('#record-title').textContent = title; $('#notes-status').textContent = translateUI('Saved in Cloudflare R2'); const badge = $('#record-meta .topic-badge'); const topic = topicById($('#edit-topic').value); badge.textContent = topic.name; badge.className = `topic-badge ${topic.color}`; }
  catch(error) { $('#notes-status').textContent = 'Could not save changes.'; notify(error.message); }
  finally { button.disabled = false; }
});

async function initialize() {
  try {
    let snapshot;
    if(cloud.available)snapshot=await cloud.load();
    else{
      snapshot=window.HEALTH_ARCHIVE;
      if(!snapshot){const response=await fetch('./data.json',{cache:'no-cache'});if(!response.ok)throw new Error('Для просмотра записей открой опубликованный сайт.');snapshot=await response.json();}
      $('#cloud-status').textContent='Local preview. Open the published website to save to Cloudflare.';
    }
    const seed = parseTelegramJSON(snapshot);
    state = {...state,...snapshot,channel:seed.channel,records:seed.records};
    if(cloud.available){
    const remote=state;const originalSeed=state;let next=state,legacy;
    // Read an old browser-only version once; never write medical data back there.
    try{const databases=await indexedDB.databases();if(databases.some(item=>item.name==='health-records-library')){database=await openDatabase();legacy=await readState();}}
    catch{}
    if(legacy?.schemaVersion===1&&Array.isArray(legacy.records))next=mergeLegacyArchive(next,legacy,todayDate(),originalSeed);
    next=await cloud.migrateImages(next);
    if(JSON.stringify(next)!==JSON.stringify(remote))await cloud.save(next);
    state=next;
    if(legacy){await new Promise((resolve,reject)=>{const transaction=database.transaction('library','readwrite');transaction.objectStore('library').delete('state');transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});database.close();database=undefined;}
    }
  }catch(error){const status=$('#cloud-status');if(status)status.textContent=error.message;notify(error.message);}
  const translations={...state.translationsRu};
  for(const spec of [...METRIC_SPECS,...CHECKUP_SPECS])translations[spec.name]=spec.nameRu;
  languageController=configureLanguage({translationsRu:translations},()=>render());
  navigate(); render();languageController.apply();
}
configureIntake({getState:()=>state,commit,uploadImages:async images=>(await cloud.migrateImages({records:[{attachments:images}]})).records[0].attachments,openDialog,notify,getLanguage,todayDate,onSaved:id=>{activeTopic='all';$('#search').value='';location.hash='library';openRecord(id);}});
initialize();
