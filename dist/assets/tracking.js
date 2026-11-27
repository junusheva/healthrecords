export const GUIDANCE_REVIEWED = '2026-11-27';
export const WHO_GUIDANCE = {
  general:{status:'not_found',title:'No universal WHO interval found',titleRu:'Универсальный интервал ВОЗ не найден',text:'The WHO sources reviewed do not specify one repeat interval for this test or visit for everyone. A personal follow-up date can be recorded from your clinician’s plan.',textRu:'В проверенных источниках ВОЗ не найден единый интервал повторения этого анализа или визита для всех. Дату личного контроля можно записать из плана врача.',url:'https://www.who.int/publications/i/item/9789289054782',source:'WHO · principles of screening',sourceRu:'ВОЗ · принципы скрининга',contextOnly:true},
  ferritin:{status:'individual',title:'Depends on the iron intervention',titleRu:'Зависит от лечения препаратами железа',text:'WHO says the timing of ferritin monitoring depends on the type of iron intervention and the amount of iron given. It recommends using the same method for follow-up to reduce measurement variability.',textRu:'По ВОЗ, срок контроля ферритина зависит от вида вмешательства и количества получаемого железа. Для наблюдения ВОЗ рекомендует использовать один метод измерения, чтобы уменьшить вариабельность результатов.',url:'https://www.who.int/publications/i/item/9789240000124',source:'WHO · ferritin guideline, 2020',sourceRu:'ВОЗ · руководство по ферритину, 2020',detailUrl:'https://cdn.who.int/media/docs/default-source/micronutrients/ferritin-guideline/ferritin-guidelines-executivesummary.pdf?sfvrsn=8c98babb_2'},
  tuberculosis:{status:'risk_based',title:'Screening depends on TB risk and setting',titleRu:'Скрининг зависит от риска туберкулёза и условий',text:'WHO describes repeated TB screening for specific risk groups and some high-burden communities. Annual or twice-yearly workplace screening may apply to higher-risk occupations. This is not a universal annual chest X-ray schedule for every adult.',textRu:'ВОЗ описывает повторный скрининг туберкулёза для определённых групп риска и некоторых территорий с высокой распространённостью. Ежегодные или полугодовые проверки могут применяться в профессиях высокого риска. Это не единый ежегодный график флюорографии для каждого взрослого.',url:'https://www.who.int/news-room/questions-and-answers/item/systematic-screening-for-tb',source:'WHO · systematic screening for TB',sourceRu:'ВОЗ · систематический скрининг туберкулёза'},
  gynecology:{status:'not_found',title:'Visits and cervical screening have separate schedules',titleRu:'Приёмы и скрининг шейки матки учитываются отдельно',text:'A universal interval for gynecology visits was not found in the WHO sources reviewed. WHO does give intervals for specific cervical screening tests; those are listed in the HPV and cytology cards.',textRu:'В проверенных источниках ВОЗ не найден универсальный интервал посещений гинеколога. Для конкретных тестов скрининга шейки матки интервалы есть — они приведены в карточках ВПЧ и цитологии.',url:'https://www.who.int/news-room/fact-sheets/detail/cervical-cancer/',source:'WHO · cervical cancer',sourceRu:'ВОЗ · рак шейки матки'},
  hpv:{status:'population_guideline',title:'Primary HPV screening: every 5–10 years, from age 30',titleRu:'Первичный ВПЧ-скрининг: раз в 5–10 лет с 30 лет',text:'This WHO population recommendation concerns routine cervical screening with a high-performance test. For women living with HIV, WHO gives a different starting age and interval. No personal next-test date is calculated automatically.',textRu:'Общая рекомендация ВОЗ относится к регулярному скринингу шейки матки высокоэффективным тестом. Для женщин, живущих с ВИЧ, возраст начала и интервал отличаются. Личная дата следующего теста автоматически не рассчитывается.',url:'https://www.who.int/news-room/fact-sheets/detail/cervical-cancer/',source:'WHO · cervical screening recommendations',sourceRu:'ВОЗ · рекомендации по скринингу шейки матки'},
  cytology:{status:'conditional_guideline',title:'Cytology: every 3 years where primary HPV testing is not operational',titleRu:'Цитология: раз в 3 года, если первичный ВПЧ-скрининг ещё не внедрён',text:'The WHO 2021 guideline gives this interval for cytology or VIA used as the primary screening test, with routine screening starting at 30 in the general population. Your dated clinician’s plan remains visible separately.',textRu:'Руководство ВОЗ 2021 года указывает этот интервал для цитологии или VIA как первичного скрининга; для общей популяции регулярный скрининг начинается с 30 лет. Датированный личный план врача показан отдельно.',url:'https://www.ncbi.nlm.nih.gov/books/NBK572318/',source:'WHO guideline, 2021 · NCBI edition',sourceRu:'Руководство ВОЗ, 2021 · версия на NCBI'}
};

export const METRIC_SPECS = [
 {id:'ferritin',name:'Ferritin',nameRu:'Ферритин',unit:'µg/L',units:['µg/L','ng/mL','мкг/л','нг/мл'],featured:true,guidance:'ferritin'},
 {id:'tsh',name:'TSH',nameRu:'ТТГ',unit:'mIU/L',units:['mIU/L','µIU/mL','мМЕ/л','мкМЕ/мл'],featured:true},
 {id:'hemoglobin',name:'Hemoglobin',nameRu:'Гемоглобин',unit:'g/L',units:['g/L','g/dL','г/л'],featured:true},
 {id:'iron',name:'Serum iron',nameRu:'Сывороточное железо',unit:'µmol/L',units:['µmol/L','мкмоль/л'],featured:true},
 {id:'free-t4',name:'Free T4',nameRu:'Т4 свободный',unit:'pmol/L',units:['pmol/L','пмоль/л'],featured:true},
 {id:'free-t3',name:'Free T3',nameRu:'Т3 свободный',unit:'pmol/L',units:['pmol/L','пмоль/л'],featured:true},
 {id:'hematocrit',name:'Hematocrit',nameRu:'Гематокрит',unit:'%',units:['%']},
 {id:'rbc',name:'Red blood cells',nameRu:'Эритроциты',unit:'10^12/L',units:['10^12/L','10^12/л']},
 {id:'mcv',name:'MCV',nameRu:'Средний объём эритроцита · MCV',unit:'fL',units:['fL','фл']},
 {id:'mch',name:'MCH',nameRu:'Среднее содержание Hb · MCH',unit:'pg',units:['pg','пг']},
 {id:'mchc',name:'MCHC',nameRu:'Средняя концентрация Hb · MCHC',unit:'g/L',units:['g/L','г/л']},
 {id:'rdw-cv',name:'RDW-CV',nameRu:'Ширина распределения эритроцитов · RDW-CV',unit:'%',units:['%']},
 {id:'rdw-sd',name:'RDW-SD',nameRu:'Ширина распределения эритроцитов · RDW-SD',unit:'fL',units:['fL','фл']},
 {id:'wbc',name:'White blood cells',nameRu:'Лейкоциты',unit:'10^9/L',units:['10^9/L','10^9/л']},
 {id:'neutrophils',name:'Neutrophils, absolute',nameRu:'Нейтрофилы · абсолютное число',unit:'10^9/L',units:['10^9/L','10^9/л']},
 {id:'lymphocytes',name:'Lymphocytes, absolute',nameRu:'Лимфоциты · абсолютное число',unit:'10^9/L',units:['10^9/L','10^9/л']},
 {id:'monocytes',name:'Monocytes, absolute',nameRu:'Моноциты · абсолютное число',unit:'10^9/L',units:['10^9/L','10^9/л']},
 {id:'eosinophils',name:'Eosinophils, absolute',nameRu:'Эозинофилы · абсолютное число',unit:'10^9/L',units:['10^9/L','10^9/л']},
 {id:'basophils',name:'Basophils, absolute',nameRu:'Базофилы · абсолютное число',unit:'10^9/L',units:['10^9/L','10^9/л']},
 {id:'neutrophils-pct',name:'Neutrophils, %',nameRu:'Нейтрофилы, %',unit:'%',units:['%']},
 {id:'lymphocytes-pct',name:'Lymphocytes, %',nameRu:'Лимфоциты, %',unit:'%',units:['%']},
 {id:'monocytes-pct',name:'Monocytes, %',nameRu:'Моноциты, %',unit:'%',units:['%']},
 {id:'eosinophils-pct',name:'Eosinophils, %',nameRu:'Эозинофилы, %',unit:'%',units:['%']},
 {id:'basophils-pct',name:'Basophils, %',nameRu:'Базофилы, %',unit:'%',units:['%']},
 {id:'platelets',name:'Platelets',nameRu:'Тромбоциты',unit:'10^9/L',units:['10^9/L','10^9/л']},
 {id:'mpv',name:'MPV',nameRu:'Средний объём тромбоцитов · MPV',unit:'fL',units:['fL','фл']},
 {id:'pdw',name:'PDW',nameRu:'Ширина распределения тромбоцитов · PDW',unit:'fL',units:['fL','фл']},
 {id:'pct',name:'Plateletcrit',nameRu:'Тромбокрит',unit:'%',units:['%']},
 {id:'p-lcr',name:'P-LCR',nameRu:'Коэффициент крупных тромбоцитов · P-LCR',unit:'%',units:['%']},
 {id:'esr',name:'ESR',nameRu:'СОЭ',unit:'mm/h',units:['mm/h','мм/ч']},
 {id:'weight',name:'Weight',nameRu:'Вес',unit:'kg',units:['kg','кг'],featured:true},
 {id:'height',name:'Height',nameRu:'Рост',unit:'cm',units:['cm','см']},
 {id:'bmi',name:'Body mass index',nameRu:'Индекс массы тела',unit:'kg/m²',units:['kg/m²','кг/м²']},
 {id:'systolic',name:'Systolic blood pressure',nameRu:'Систолическое давление',unit:'mmHg',units:['mmHg','мм рт. ст.'],featured:true},
 {id:'diastolic',name:'Diastolic blood pressure',nameRu:'Диастолическое давление',unit:'mmHg',units:['mmHg','мм рт. ст.']},
 {id:'pulse',name:'Heart rate',nameRu:'Пульс',unit:'bpm',units:['bpm','уд/мин']},
 {id:'gad7',name:'GAD-7 score',nameRu:'GAD-7 · баллы',unit:'points',units:['points','баллы']},
 {id:'phq9',name:'PHQ-9 score',nameRu:'PHQ-9 · баллы',unit:'points',units:['points','баллы']},
 {id:'bai',name:'Beck Anxiety Inventory',nameRu:'Шкала тревоги Бека',unit:'points',units:['points','баллы']},
 {id:'hads-a',name:'HADS · anxiety',nameRu:'HADS · тревога',unit:'points',units:['points','баллы']},
 {id:'hads-d',name:'HADS · depression',nameRu:'HADS · депрессия',unit:'points',units:['points','баллы']}
];

export const CHECKUP_SPECS = [
 {id:'fluorography',name:'Fluorography / chest X-ray',nameRu:'Флюорография',guidance:'tuberculosis',icon:'file'},
 {id:'dermatologist',name:'Dermatologist',nameRu:'Дерматолог',guidance:'general',icon:'sun'},
 {id:'moles',name:'Mole examination',nameRu:'Осмотр родинок',guidance:'general',icon:'sun'},
 {id:'gynecologist',name:'Gynecologist',nameRu:'Гинеколог',guidance:'gynecology',icon:'heart'},
 {id:'pap',name:'Cervical cytology / Pap test',nameRu:'Цитология шейки матки · ПАП-тест',guidance:'cytology',icon:'flask'},
 {id:'hpv',name:'High-risk HPV test',nameRu:'Анализ на ВПЧ высокого риска',guidance:'hpv',icon:'flask'},
 {id:'pelvic-rehab',name:'Pelvic rehabilitation specialist',nameRu:'Реабилитолог тазового дна',guidance:'general',icon:'leaf'},
 {id:'psychiatrist',name:'Psychiatrist — last recorded contact',nameRu:'Психиатр · последний записанный контакт',guidance:'general',icon:'heart'},
 {id:'neurologist',name:'Neurologist',nameRu:'Невролог',guidance:'general',icon:'leaf'}
];

export function parseMeasurementNumber(value) {
 const text=String(value??'').trim().replace(',','.');
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return null;
 const number=Number(text);return Number.isFinite(number)?number:null;
}
export function canonicalMeasurement(metricId,value,unit) {
 const spec=METRIC_SPECS.find(item=>item.id===metricId);
 if(!spec||!spec.units.includes(unit)||!Number.isFinite(Number(value))||Number(value)<0)return null;
 return {value:Number(value)*(unit==='g/dL'?10:1),unit:spec.unit};
}
export function daysSince(date,today) {
 const parse=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;const [y,m,d]=value.split('-').map(Number);const stamp=Date.UTC(y,m-1,d);return new Date(stamp).toISOString().slice(0,10)===value?stamp:NaN;};
 const start=parse(date),end=parse(today);return Number.isFinite(start)&&Number.isFinite(end)?Math.floor((end-start)/86400000):null;
}
export function validateMeasurement(input,today) {
 const spec=METRIC_SPECS.find(item=>item.id===input.metric);
 if(!spec)throw new Error('Choose a health indicator.');
 const value=parseMeasurementNumber(input.value);
 if(value===null)throw new Error('Enter a non-negative numeric result.');
 if(!canonicalMeasurement(spec.id,value,input.unit))throw new Error('Choose a supported unit for this indicator.');
 if(daysSince(input.date,today)===null||daysSince(input.date,today)<0)throw new Error('Enter a valid sample date that is not in the future.');
 const low=input.refLow===''||input.refLow==null?null:parseMeasurementNumber(input.refLow);
 const high=input.refHigh===''||input.refHigh==null?null:parseMeasurementNumber(input.refHigh);
 if((input.refLow!==''&&input.refLow!=null&&low===null)||(input.refHigh!==''&&input.refHigh!=null&&high===null)||(low!==null&&high!==null&&low>high))throw new Error('Check the lower and upper reference values.');
 return {metric:spec.id,date:input.date,value,unit:input.unit,refLow:low,refHigh:high,sourceId:null,note:String(input.note||'').slice(0,2000),manual:true};
}
export function validateCheckup(input,today) {
 if(!CHECKUP_SPECS.some(item=>item.id===input.checkup))throw new Error('Choose a visit or examination type.');
 if(daysSince(input.date,today)===null||daysSince(input.date,today)<0)throw new Error('Enter a valid visit date that is not in the future.');
 if(input.nextDate&&(daysSince(input.date,input.nextDate)===null||daysSince(input.date,input.nextDate)<0))throw new Error('The planned next date must not be before this visit.');
 return {checkup:input.checkup,date:input.date,nextDate:input.nextDate||null,note:String(input.note||'').slice(0,2000),sourceIds:[],manual:true};
}
export function measurementSeries(state,metricId) {
 return [...(state.measurements||[]),...(state.manualMeasurements||[])].filter(item=>item.metric===metricId&&canonicalMeasurement(item.metric,item.value,item.unit)&&daysSince(item.date,item.date)!==null).map(item=>({...item,canonical:canonicalMeasurement(item.metric,item.value,item.unit)})).sort((a,b)=>a.date.localeCompare(b.date));
}
export function checkupHistory(state,checkupId) {
 return [...(state.checkups||[]),...(state.manualCheckups||[])].filter(item=>item.checkup===checkupId&&daysSince(item.date,item.date)!==null).sort((a,b)=>b.date.localeCompare(a.date));
}
export function cadenceSetting(state,scope,id,guidanceId,language='ru') {
 const defaults={
  hpv:{ru:'Раз в 5–10 лет: первичный ВПЧ-скрининг с 30 лет',en:'Every 5–10 years: primary HPV screening from age 30'},
  cytology:{ru:'Раз в 3 года с 30 лет: первичная цитология/VIA, если ВПЧ-скрининг не внедрён',en:'Every 3 years from age 30: primary cytology/VIA where HPV screening is not operational'}
 };
 const key=`${scope}:${id}`;
 const fallback=defaults[guidanceId]?.[language]||'';
 const custom=Object.hasOwn(state.cadenceOverrides||{},key)&&typeof state.cadenceOverrides[key]==='string';
 return {key,value:custom?state.cadenceOverrides[key]:fallback,custom,defaultValue:fallback,whoIntervalAvailable:Boolean(fallback)};
}
export function updateCadenceOverrides(existing,scope,id,value) {
 const specs=scope==='metric'?METRIC_SPECS:scope==='checkup'?CHECKUP_SPECS:[];
 if(!specs.some(item=>item.id===id))throw new Error('Choose a valid indicator or visit type.');
 const next={...(existing||{})},key=`${scope}:${id}`;
 if(value===null){delete next[key];return next;}
 if(typeof value!=='string'||value.trim().length>200)throw new Error('Frequency must be text up to 200 characters.');
 next[key]=value.trim();return next;
}
export function mergeCadenceOverrides(current,incoming) {
 let result={};
 for(const source of [incoming||{},current||{}]){
  if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Invalid frequency settings in the backup.');
  for(const [key,value]of Object.entries(source)){
   const parts=key.split(':');if(parts.length!==2)throw new Error('Invalid frequency settings in the backup.');
   result=updateCadenceOverrides(result,parts[0],parts[1],value);
  }
 }
 return result;
}
export function mergeUserTracking(current,backup,today) {
 const result={};
 for(const [key,validator] of [['manualMeasurements',validateMeasurement],['manualCheckups',validateCheckup]]) {
  const existing=new Map((current[key]||[]).map(item=>[item.id,item]));
  if(backup[key]!==undefined&&!Array.isArray(backup[key]))throw new Error('Invalid tracking data in the backup.');
  for(const input of backup[key]||[]) {
   const item=validator(input,today);
   if(typeof input.sourceId==='string'&&input.sourceId.length<=180)item.sourceId=input.sourceId;
   if(Array.isArray(input.sourceIds))item.sourceIds=input.sourceIds.filter(id=>typeof id==='string'&&id.length<=180).slice(0,20);
   const id=typeof input.id==='string'&&input.id.startsWith('manual:')?input.id:`manual:${input.metric||input.checkup}:${input.date}:${input.value??''}`;
   if(!existing.has(id))existing.set(id,{...item,id});
  }
  result[key]=[...existing.values()];
 }
 result.cadenceOverrides=mergeCadenceOverrides(current.cadenceOverrides,backup.cadenceOverrides);
 return result;
}
