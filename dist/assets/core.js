export const TOPICS = [
  { id: 'gynecology', name: 'Gynecology & pelvic health', icon: 'heart', color: 'rose', description: 'Consultations, pelvic rehabilitation, cycle notes, and screening.', words: ['гинеколог', 'клайра', 'димия', 'фемофлор', 'флороценоз', 'кандид', 'молочниц', 'влагалищ', 'вульв', 'вестибул', 'тазов', 'менстру', 'месячн', 'беременн', 'пап-тест', 'gynecol', 'pelvic', 'cervical', 'pregnan'] },
  { id: 'urology', name: 'Urinary health', icon: 'flask', color: 'blue', description: 'Urinary symptoms, appointments, and related treatments.', words: ['цистит', 'мочи', 'мочеиспуск', 'фурамаг', 'канефрон', 'монурал', 'urinary', 'cystitis'] },
  { id: 'neurology', name: 'Neurology & neck', icon: 'leaf', color: 'green', description: 'Neck imaging, neurological consultations, and rehabilitation.', words: ['невролог', 'невропатолог', 'шеи', 'шейн', 'шоп', 'цервик', 'позвоноч', 'neurology', 'cervical spine', 'neck pain'] },
  { id: 'dermatology', name: 'Skin & dermatology', icon: 'sun', color: 'amber', description: 'Skin consultations, mole checks, and original prescriptions.', words: ['дерматолог', 'родинк', 'невус', 'кож', 'dermatol', 'skin', 'mole'] },
  { id: 'dental', name: 'Dental care', icon: 'heart', color: 'lavender', description: 'Dental treatment plans and wisdom-tooth extraction notes.', words: ['стоматолог', 'зуб', 'dental', 'dentist', 'tooth', 'teeth'] },
  { id: 'tests', name: 'Tests & results', icon: 'flask', color: 'blue', description: 'Investigations, lab work, and what the results say.', words: ['анализ', 'результат', 'ферритин', 'гемоглобин', 'мрт', 'узи', 'рентген', 'крови', 'диагност', 'laboratory', 'blood test', 'lab result', 'ferritin', 'mri', 'ultrasound', 'screening'] },
  { id: 'care', name: 'Other care', icon: 'heart', color: 'rose', description: 'ENT, parasitology, and other consultations.', words: ['лор', 'паразитолог', 'прием', 'приём', 'консультац', 'врач', 'клиник', 'доктор', 'больниц', 'appointment', 'consultation', 'doctor', 'clinic', 'referral'] },
  { id: 'treatment', name: 'Treatment & medication', icon: 'pill', color: 'lavender', description: 'Prescriptions, treatments, and vaccination notes.', words: ['препарат', 'лекарств', 'таблет', 'дозиров', 'мг', 'вакцин', 'привив', 'лечение', 'prescription', 'medication', 'medicine', 'dosage', 'vaccine', 'vaccination', 'treatment'] },
  { id: 'mind', name: 'Mental wellbeing', icon: 'sun', color: 'amber', description: 'Notes on mood, sleep, and mental health.', words: ['депрес', 'тревог', 'псих', 'настроен', 'сдвг', 'adhd', 'anxiety', 'depression', 'therap', 'mental', 'mood', 'sleep', 'сон', 'сна', 'выгоран'] },
  { id: 'everyday', name: 'Everyday health', icon: 'leaf', color: 'green', description: 'Movement, nutrition, and everyday observations.', words: ['питани', 'трениров', 'спорт', 'упражнен', 'витамин', 'самочувств', 'nutrition', 'exercise', 'workout', 'fitness', 'symptom', 'симптом', 'болит', 'боль', 'состояни'] },
  { id: 'reading', name: 'Reading & resources', icon: 'book', color: 'blue', description: 'Articles, research, and things to come back to.', words: ['исследован', 'статья', 'статьи', 'книга', 'рекомендац', 'памятка', 'research', 'study', 'article', 'guideline', 'resource', 'https://', 'http://'] },
  { id: 'other', name: 'Unsorted', icon: 'folder', color: 'slate', description: 'Records ready for a closer look.', words: [] },
];

export const topicById = id => TOPICS.find(topic => topic.id === id) || TOPICS.at(-1);
export const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replaceAll('ё', 'е');
export function flattenText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (value && typeof value === 'object') return flattenText(value.text);
  return '';
}
export function cleanTitle(text, fallback = 'Untitled record') {
  const line = String(text).split('\n').map(item => item.trim()).find(Boolean) || fallback;
  return line.length > 100 ? `${line.slice(0, 97).trim()}…` : line;
}
export function inferTopics(text) {
  const normalized = normalize(text);
  const scores = TOPICS.filter(topic => topic.id !== 'other').map(topic => ({
    id: topic.id, score: topic.words.reduce((sum, word) => sum + (normalized.includes(normalize(word)) ? 1 : 0), 0),
  })).filter(topic => topic.score > 0).sort((a, b) => b.score - a.score);
  return scores.length ? scores.map(topic => topic.id) : ['other'];
}
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function safeAssetPath(value) {
  return typeof value === 'string' && /^media\/[a-z0-9][a-z0-9._-]*$/i.test(value) && !value.includes('..') ? value : null;
}
export function safeLocalImageData(value) {
  if(typeof value!=='string'||value.length>11200000)return null;
  return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:null;
}
export function normalizeClinical(input) {
  const result={};if(!input||typeof input!=='object'||Array.isArray(input))return result;
  for(const key of ['date','clinic','clinician','specialty','sourceKind'])if(typeof input[key]==='string')result[key]=input[key].slice(0,200);
  for(const key of ['findings','assessments','recommendations','prescriptions','procedures','uncertain'])if(Array.isArray(input[key]))result[key]=input[key].filter(value=>typeof value==='string').slice(0,60).map(value=>value.slice(0,4000));
  return result;
}
export function parseExportDate(value) {
  const numeric = String(value).match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\s+UTC([+-]\d{2}:?\d{2}))?/);
  if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}T${numeric[4]}:${numeric[5]}:${numeric[6]}${numeric[7] || ''}`;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const named = String(value).match(/^(\d{1,2}) ([A-Za-z]+) (\d{4}), (\d{2}):(\d{2}):(\d{2})$/);
  if (!named) return null;
  const month = months.findIndex(item => item.toLowerCase() === named[2].toLowerCase());
  if (month < 0) return null;
  return `${named[3]}-${String(month+1).padStart(2,'0')}-${named[1].padStart(2,'0')}T${named[4]}:${named[5]}:${named[6]}`;
}
export function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
export function normalizeRecord(record, channel = {}) {
  const text = flattenText(record.text ?? record.body ?? '').trim();
  const unixTime = record.date_unixtime ? Number(record.date_unixtime) * 1000 : NaN;
  const dateValue = Number.isFinite(unixTime) && !Number.isNaN(new Date(unixTime).getTime()) ? new Date(unixTime).toISOString() : record.date;
  const date = dateValue && Number.isFinite(Date.parse(dateValue)) ? String(dateValue) : null;
  const topics = inferTopics(text);
  const topic = TOPICS.some(item => item.id === record.topic) ? record.topic : topics[0];
  const sourceId = record.messageId ?? record.id ?? hashText(`${date}:${text}`);
  const channelId = String(channel.id ?? '').replace(/^-100/, '');
  const sourceUrl = safeUrl(record.sourceUrl || record.link) || (/^\d+$/.test(channelId) && /^\d+$/.test(String(sourceId)) && /channel|supergroup/i.test(channel.type || '') ? `https://t.me/c/${channelId}/${sourceId}` : null);
  const attachments = Array.isArray(record.attachments) ? record.attachments.filter(item => item && typeof item.name === 'string').map(item => ({ name: item.name, type: String(item.type || 'file'), url: safeAssetPath(item.url), thumbnail: safeAssetPath(item.thumbnail), text: typeof item.text === 'string' ? item.text : '', imageData:safeLocalImageData(item.imageData), status: String(item.status || 'reference_only'), protected: Boolean(item.protected), label: typeof item.label === 'string' ? item.label : item.name })) : [];
  for (const key of ['photo', 'file']) if (typeof record[key] === 'string' && !attachments.some(item => item.name === record[key])) attachments.push({ name: record[key], type: key === 'photo' ? 'photo' : record.media_type || record.mime_type || 'file', url:null,thumbnail:null,text:'',imageData:null,status:'reference_only',protected:false,label:record[key] });
  return {
    id: String(record.libraryId || (record.schemaRecord && record.id != null ? record.id : `${hashText(channelId || channel.name || 'telegram')}:${sourceId}`)),
    messageId: String(record.messageId ?? sourceId), origin:record.origin==='manual'?'manual':'telegram',
    text, title: typeof record.title === 'string' ? record.title.slice(0, 160) : cleanTitle(text, attachments.length ? 'Attachment' : 'Untitled record'),
    date, topic, suggestedTopics: topics, saved: Boolean(record.saved), notes: typeof record.notes === 'string' ? record.notes : '',
    sourceUrl, channelName: typeof record.channelName === 'string' ? record.channelName : String(channel.name || 'Telegram archive'),
    attachments, clinical:normalizeClinical(record.clinical), summary: typeof record.summary === 'string' ? record.summary : '',
    eventDate: typeof record.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.eventDate) && Number.isFinite(Date.parse(record.eventDate)) ? record.eventDate : null,
    dateNote: typeof record.dateNote === 'string' ? record.dateNote : '',
    originalDate: typeof record.originalDate === 'string' ? record.originalDate : '',
    replyTo: record.replyTo != null ? String(record.replyTo) : null,
    relatedIds: Array.isArray(record.relatedIds) ? record.relatedIds.map(String) : [],
    kind: typeof record.kind === 'string' ? record.kind : 'note',
    annotation: typeof record.annotation === 'string' ? record.annotation : '',
  };
}
export function parseTelegramJSON(input) {
  if (!input || typeof input !== 'object') throw new Error('This file does not contain a Telegram export.');
  if (Array.isArray(input.records) && input.schemaVersion === 1) {
    const channel = { name: input.channel?.name || 'Telegram archive', id: input.channel?.id, type: input.channel?.type, inviteUrl: safeUrl(input.channel?.inviteUrl) };
    return { channel, records: input.records.map(record => normalizeRecord({ ...record, schemaRecord: true }, channel)) };
  }
  const chats = input.chats?.list || input.chats || (Array.isArray(input) ? input : [input]);
  if (!Array.isArray(chats)) throw new Error('Expected messages in a Telegram JSON export.');
  if (chats.filter(chat => Array.isArray(chat?.messages)).length > 1) throw new Error('This contains several chats. Export only the channel you want to organize.');
  const records = [];
  const channels = [];
  for (const chat of chats) {
    if (!chat || !Array.isArray(chat.messages)) continue;
    const channel = { name: chat.name || chat.title || 'Telegram archive', id: chat.id, type: chat.type || '' };
    channels.push(channel);
    for (const message of chat.messages) {
      if (message.type && message.type !== 'message') continue;
      const record = normalizeRecord(message, channel);
      if (record.text || record.attachments.length) records.push(record);
    }
  }
  if (!channels.length) throw new Error('No message list was found. Choose result.json from the channel export.');
  return { channel: channels[0], records };
}
export function mergeRecords(existing, incoming) {
  const records = new Map(existing.map(record => [record.id, record]));
  let added = 0;
  for (const record of incoming) {
    if (!records.has(record.id)) { records.set(record.id, record); added++; }
  }
  return { records: [...records.values()], added };
}
export function filterRecords(records, { query = '', topic = 'all', savedOnly = false, sort = 'newest' } = {}) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const result = records.filter(record => {
    if (savedOnly && !record.saved) return false;
    if (topic !== 'all' && record.topic !== topic) return false;
    const haystack = normalize([record.title, record.text, record.summary, record.notes, record.kind, record.date, record.eventDate, topicById(record.topic).name, ...Object.values(record.clinical||{}).flat(), ...(record.attachments || []).map(item => `${item.name} ${item.label || ''} ${item.text || ''}`)].join(' '));
    return words.every(word => haystack.includes(word));
  });
  result.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : (Date.parse(a.eventDate || a.date) || 0) - (Date.parse(b.eventDate || b.date) || 0));
  return sort === 'newest' ? result.reverse() : result;
}
