import {TOPICS,inferTopics,cleanTitle,normalizeRecord,normalize,normalizeClinical,safeAssetPath} from './core.js';
import {METRIC_SPECS,CHECKUP_SPECS,daysSince,validateMeasurement,validateCheckup} from './tracking.js';
import {extractCareCandidates,validateCareEvent} from './care.js';

export const INTAKE_MAX_IMAGE_BYTES=8*1024*1024;
export const INTAKE_MAX_IMAGES=3;
const INTAKE_ALIASES={
 ferritin:'ферритин|ferritin',tsh:'ттг|tsh',hemoglobin:'гемоглобин|ha?emoglobin|hgb|hb',iron:'сывороточное железо|железо|serum iron',
 'free-t4':'т[4ч]\\s*свободн[а-я]*|свободн[а-я]*\\s*т4|free\\s*t4|ft4|т4\\s*св\\.?','free-t3':'т3\\s*свободн[а-я]*|свободн[а-я]*\\s*т3|free\\s*t3|ft3|т3\\s*св\\.?',
 hematocrit:'гематокрит|hematocrit|hct',rbc:'эритроциты|red blood cells|rbc',mcv:'mcv',mchc:'mchc',mch:'mch',
 'rdw-cv':'rdw[ -]?cv','rdw-sd':'rdw[ -]?sd',wbc:'лейкоциты|white blood cells|wbc',platelets:'тромбоциты|platelets|plt',
 neutrophils:'нейтрофилы|neutrophils|neut',lymphocytes:'лимфоциты|lymphocytes|lymph',monocytes:'моноциты|monocytes|mono',eosinophils:'эозинофилы|eosinophils|eos',basophils:'базофилы|basophils|baso',
 mpv:'mpv',pdw:'pdw',pct:'тромбокрит|plateletcrit|pct','p-lcr':'p[ -]?lcr',esr:'соэ|esr',
 weight:'вес|масса тела|weight',height:'рост|height',bmi:'имт|bmi',pulse:'пульс|чсс|pulse|heart rate',gad7:'gad[ -]?7',phq9:'phq[ -]?9',bai:'шкала тревоги бека|beck anxiety inventory'
};
const INTAKE_VISITS={
 fluorography:'фл[юу]орограф|рентген.*(?:груд|л[её]гк)|chest x.ray',
 dermatologist:'дерматолог|dermatologist',moles:'дерматоскоп|осмотр.*родин|mole (?:check|examination)',
 gynecologist:'гинеколог|gyn[ae]*cologist',pap:'пап[ -]?тест|цитолог.*шейк|pap (?:test|smear)|cervical cytology',
 hpv:'впч|hpv', 'pelvic-rehab':'реабилитолог.*тазов|pelvic rehabilitation',psychiatrist:'психиатр|psychiatrist',neurologist:'невролог|невропатолог|neurologist'
};
export function intakeDateCandidates(text,today) {
 const found=[];
 for(const line of String(text).split('\n')){
  if(/дата\s*рожд|родилась|birth|dob|следующ|повторить|записан[аы]? на|заплан|планир|next visit/i.test(line))continue;
  for(const match of line.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b|(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/g)){
   const year=match[6]?.length===2?'20'+match[6]:match[6];
   const date=match[1]?match[1]+'-'+match[2]+'-'+match[3]:year+'-'+match[5].padStart(2,'0')+'-'+match[4].padStart(2,'0');
   if(daysSince(date,today)!==null&&daysSince(date,today)>=0)found.push({date,priority:/дата.*(?:анализ|взят|забор|исследован|при[её]м|осмотр)|sample date|collection date|examination date/i.test(line)?1:0});
  }
 }
 const best=found.some(item=>item.priority)?found.filter(item=>item.priority):found;
 return [...new Set(best.map(item=>item.date))];
}
function intakeUnit(line,spec) {
 const n=normalize(line).replace(/μ/g,'µ').replace(/\s/g,'');
 const aliases={
  'ng/mL':/нг\/мл|ng\/ml/,'нг/мл':/нг\/мл|ng\/ml/,'µg/L':/мкг\/л|µg\/l|ug\/l/,
  'mIU/L':/мме\/л|miu\/l/,'µIU/mL':/мкме\/мл|µiu\/ml|uiu\/ml/,'мкМЕ/мл':/мкме\/мл|µiu\/ml|uiu\/ml/,
  'г/л':/г\/л|g\/l/,'g/L':/г\/л|g\/l/,'g/dL':/г\/дл|g\/dl/,
  'µmol/L':/мкмоль\/л|µmol\/l|umol\/l/,'мкмоль/л':/мкмоль\/л|µmol\/l|umol\/l/,
  'pmol/L':/пмоль\/л|pmol\/l/,'пмоль/л':/пмоль\/л|pmol\/l/,
  '%':/%/,'fL':/фл|fl/,'фл':/фл|fl/,'pg':/пг|pg/,'пг':/пг|pg/,
  '10^9/L':/10(?:\^|х|x|\*)?9\/[лl]/,'10^9/л':/10(?:\^|х|x|\*)?9\/[лl]/,
  '10^12/L':/10(?:\^|х|x|\*)?12\/[лl]/,'10^12/л':/10(?:\^|х|x|\*)?12\/[лl]/,
  'mm/h':/мм\/ч|mm\/h/,'мм/ч':/мм\/ч|mm\/h/,
  'kg':/кг|kg/,'кг':/кг|kg/,'cm':/см|cm/,'см':/см|cm/,'kg/m²':/кг\/м²|kg\/m²/,'кг/м²':/кг\/м²|kg\/m²/,
  'bpm':/уд\/мин|bpm/,'уд/мин':/уд\/мин|bpm/,'points':/балл|points|score/,'баллы':/балл|points|score/,'mmHg':/ммрт\.?ст\.?|mmhg/,'мм рт. ст.':/ммрт\.?ст\.?|mmhg/
 };
 return spec.units.find(unit=>aliases[unit]?.test(n))||'';
}
export function extractClinicalText(text){
 const result={};let section;
 const headings=[['findings',/^(?:жалобы|анамнез(?: заболевания)?|результаты(?: исследований)?|заключение исследования|complaints|findings|results)\s*[:—-]?\s*/i],['assessments',/^(?:предварительный диагноз|диагнозы?|diagnosis|diagnoses|assessment)\s*[:—-]?\s*/i],['prescriptions',/^(?:медикаментозное лечение|лекарства|препараты|лечение|назначения|prescriptions?|medications?|treatment)\s*[:—-]?\s*/i],['recommendations',/^(?:рекомендовано|рекомендации|план|recommendations?|plan)\s*[:—-]?\s*/i],['procedures',/^(?:выполненные манипуляции|выполнено|процедуры|procedures?)\s*[:—-]?\s*/i]];
 for(let line of String(text).split('\n')){
  line=line.trim();if(!line){section=undefined;continue;}
  const metadata=/^(клиника|clinic|врач|доктор|doctor|clinician)\s*:\s*(.+)/i.exec(line);
  if(metadata){result[/клиника|clinic/i.test(metadata[1])?'clinic':'clinician']=metadata[2];section=undefined;continue;}
  const heading=headings.find(([,pattern])=>pattern.test(line));
  if(heading){section=heading[0];line=line.replace(heading[1],'').trim();}
  if(section&&line)(result[section]||=[]).push(line.replace(/^[•*-]\s*/,''));
 }
 return normalizeClinical(result);
}
export function analyzeIntakeText(text,today) {
 text=String(text||'').replace(/\r/g,'').trim().slice(0,30000);
 const dates=intakeDateCandidates(text,today),date=dates.length===1?dates[0]:'';
 const measurements=[],visits=[],warnings=[];
 let planSection=false;
 for(const line of text.split('\n')){
  if(/^\s*(?:рекомендации|рекомендовано|направления|план(?: обследования| лечения)?|назначения|лечение|recommendations?|referrals?|plan|prescriptions?|treatment)\s*[:—-]?\s*$/i.test(line))planSection=true;
  if(/^\s*(?:результаты|жалобы|объективный осмотр|выполнено|results|findings|completed procedures)\s*[:—-]/i.test(line))planSection=false;
  if(planSection)continue;
  if(/(?:^|\s)(?:норма|референс|reference range)\s*[:=]/i.test(line))continue;
  if(/сдать|проверить|рекоменд|назнач[а-я]* анализ|планир|нужно|надо|to check|recommend|schedule/i.test(line))continue;
  for(const [base,alias]of Object.entries(INTAKE_ALIASES)){
   const match=new RegExp('(?:^|[\\s(|;,])('+alias+')(?=$|[\\s):=|;,])','iu').exec(line);
   if(!match)continue;
   let tail=line.slice(match.index+match[0].length).replace(/^\s*\([^)]*\)\s*/,'');
   if(/^\s*[:=|]?\s*[<>≤≥]/.test(tail)){warnings.push('qualified-result');continue;}
   const valueMatch=/^\s*[:=|]?\s*(\d+(?:[.,]\d+)?)(?![\d.,])/.exec(tail);
   if(!valueMatch)continue;
   let metric=base;
   if(['neutrophils','lymphocytes','monocytes','eosinophils','basophils'].includes(base)&&line.includes('%'))metric=base+'-pct';
   const spec=METRIC_SPECS.find(item=>item.id===metric);if(!spec)continue;
   const unit=intakeUnit(tail,spec),value=Number(valueMatch[1].replace(',','.'));
   const range=tail.slice(valueMatch[0].length).match(/(?:^|[^\d])(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/);
   const item={metric,value,unit,date,refLow:range?Number(range[1].replace(',','.')):'',refHigh:range?Number(range[2].replace(',','.')):'',evidence:line.trim(),selected:Boolean(date&&unit)};
   if(!measurements.some(old=>old.metric===metric&&old.value===value&&old.unit===unit))measurements.push(item);
  }
  const pressure=/(?:^|\s)(?:ад|давление|blood pressure|bp)\s*[:=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i.exec(line);
  if(pressure){const unit=intakeUnit(line,METRIC_SPECS.find(spec=>spec.id==='systolic'));for(const [index,metric]of ['systolic','diastolic'].entries())measurements.push({metric,value:Number(pressure[index+1]),unit,date,refLow:'',refHigh:'',evidence:line.trim(),selected:Boolean(date&&unit)});}
  if(/не\s+(?:была|был|ходила|посещала|делала|сдавала)|не\s+проводил|не\s+выполн|не\s+делал|планир|записал|предстоит|направлен|следующ|рекоменд|нужно|надо|посовет|наблюдае|ранее|раньше|анамнез|по назначению|scheduled|planning|not (?:done|visited)|referred|how often|previously/i.test(line))continue;
  for(const [checkup,alias]of Object.entries(INTAKE_VISITS)){
   if(!new RegExp(alias,'iu').test(line))continue;
   if(['pap','hpv'].includes(checkup)&&/привив|вакцин|vaccin/i.test(line))continue;
   const dated=intakeDateCandidates(line,today),visitDate=dated.length===1?dated[0]:date;
   if(!visitDate)continue;
   if(!visits.some(item=>item.checkup===checkup))visits.push({checkup,date:visitDate,nextDate:'',evidence:line.trim(),selected:true});
  }
 }
 const suggestedTopics=inferTopics(text);
 const topic=measurements.length?'tests':suggestedTopics[0];
 const kind=measurements.length?'test':visits.length?'appointment':/назначен|принимать|дозиров|prescription|prescribed/i.test(text)?'prescription':'note';
 const clinical=extractClinicalText(text);
 return {text,title:cleanTitle(text,'New record'),topic,kind:clinical.prescriptions?.length?'prescription':kind,date,dates,clinical,measurements,visits,careCandidates:extractCareCandidates(text,date,today),warnings:[...new Set(warnings)]};
}
export function buildIntakeUpdate(current,input,today,uuid,createdAt) {
 const text=String(input.text||'').trim(),images=input.images||[];
 if(!text&&!images.length)throw new Error('Add text or an image.');
 if(text.length>30000)throw new Error('Keep the entry below 30,000 characters.');
 if(images.length>INTAKE_MAX_IMAGES)throw new Error('Choose up to three images.');
 if(!String(input.title||'').trim())throw new Error('Add a title.');
 if(!TOPICS.some(item=>item.id===input.topic))throw new Error('Choose a topic.');
 if(input.date&&(daysSince(input.date,today)===null||daysSince(input.date,today)<0))throw new Error('Choose a valid record date.');
 const id='manual:'+uuid;
 if(images.some(image=>!safeAssetPath(image.url)||image.imageData))throw new Error('Upload the original files to R2 before saving.');
 const record=normalizeRecord({id,schemaRecord:true,messageId:'manual-'+uuid,origin:'manual',title:input.title,text,topic:input.topic,kind:input.kind,clinical:input.clinical,date:createdAt,eventDate:input.date||null,channelName:'My additions',attachments:images.map(image=>({...image,imageData:null,text:image.text||'',status:'cloud_file'})),dateNote:'Date entered or confirmed when adding the record',summary:text.slice(0,240)});
 const manualMeasurements=[...(current.manualMeasurements||[])],manualCheckups=[...(current.manualCheckups||[])];
 for(const [index,inputRow]of (input.measurements||[]).entries())if(inputRow.selected){
  const item=validateMeasurement(inputRow,today);
  manualMeasurements.push({...item,id:'manual:'+uuid+':measurement:'+index,sourceId:id,note:'Added from a reviewed record.'});
 }
 for(const [index,inputRow]of (input.visits||[]).entries())if(inputRow.selected){
  const item=validateCheckup(inputRow,today);
  manualCheckups.push({...item,id:'manual:'+uuid+':visit:'+index,sourceIds:[id],note:'Added from a reviewed record.'});
 }
 const careHistory=[...(current.careEvents||[])];
 for(const [index,row]of (input.careCandidates||[]).entries())if(row.selected)careHistory.push(validateCareEvent({...row,id:'manual:'+uuid+':care:'+index,sourceId:id},today));
 return {...current,records:[...(current.records||[]),record],manualMeasurements,manualCheckups,careEvents:careHistory};
}

