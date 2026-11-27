export const CARE_REVIEWED='2026-11-27';
export const CARE_ITEMS=[
 {id:'influenza',kind:'vaccine',name:'Influenza',nameRu:'Грипп',recurring:true,source:'https://www.who.int/teams/global-influenza-programme/vaccines/vaccine-use',authority:'WHO',authorityRu:'ВОЗ',guidance:'Annual vaccination is a WHO priority for health workers, older adults, pregnant women and people with certain chronic conditions. Timing follows the local influenza season.',guidanceRu:'Ежегодная вакцинация — приоритет ВОЗ для медработников, пожилых людей, беременных и людей с некоторыми хроническими заболеваниями. Срок выбирают с учётом местного сезона гриппа.',interval:{amount:1,unit:'years'}},
 {id:'td',kind:'vaccine',name:'Tetanus / diphtheria · Td / Tdap',nameRu:'Столбняк и дифтерия · АДС-М / Tdap',source:'https://www.who.int/news-room/fact-sheets/detail/tetanus',authority:'WHO',authorityRu:'ВОЗ',guidance:'WHO recommends six tetanus-containing doses from childhood through adolescence for lifelong protection. An adult catch-up or booster plan depends on documented prior doses and the national schedule; no automatic ten-year rule is applied here.',guidanceRu:'ВОЗ рекомендует шесть доз против столбняка от детства до подросткового возраста для длительной защиты. Догоняющая схема и ревакцинация взрослого зависят от прошлых доз и национального календаря; автоматический срок «раз в 10 лет» здесь не назначается.'},
 {id:'hpv-vaccine',kind:'vaccine',name:'HPV vaccination',nameRu:'Вакцинация против ВПЧ',source:'https://www.who.int/news/item/29-10-2026-message-by-the-director-of-the-department-of-immunization--vaccines-and-biologicals-at-who---october-2026',authority:'WHO · October 2026',authorityRu:'ВОЗ · октябрь 2026',guidance:'In October 2026, SAGE supported expanding a single-dose approach up to age 30 where appropriate. Immunocompromised people need a different schedule. The updated position paper is expected in 2027; record your clinician-confirmed plan instead of assuming a repeating interval.',guidanceRu:'В октябре 2026 SAGE поддержала расширение однодозового подхода до 30 лет при соответствующих условиях. При снижении иммунитета схема другая. Новая позиционная статья ожидается в 2027 году; здесь сохраняется подтверждённый врачом план, а не назначается повторяющийся интервал.'},
 ...[['hepatitis-b','Hepatitis B','Гепатит B'],['mmr','Measles / mumps / rubella','Корь, паротит и краснуха · КПК'],['covid','COVID-19','COVID-19'],['other-vaccine','Other vaccination','Другая прививка']].map(([id,name,nameRu])=>({id,name,nameRu,kind:'vaccine',guidance:'Record documented doses and the next date agreed with your clinician. No universal repeating interval is prefilled.',guidanceRu:'Добавь проведённые дозы и следующую дату по своему плану с врачом. Универсальный повторяющийся интервал не задан.'})),
 {id:'toothbrush',kind:'hygiene',name:'Toothbrush / electric brush head',nameRu:'Зубная щётка / насадка',source:'https://www.mouthhealthy.org/all-topics-a-z/brushing-your-teeth',authority:'American Dental Association',authorityRu:'Американская стоматологическая ассоциация · ADA',guidance:'ADA recommends replacement every three to four months, sooner when bristles are worn. The calendar starts at three months; you can change it.',guidanceRu:'ADA рекомендует менять щётку каждые 3–4 месяца, раньше при износе щетинок. В календаре по умолчанию 3 месяца; срок можно изменить.',interval:{amount:3,unit:'months'}},
 {id:'loofah',kind:'hygiene',name:'Loofah / body scrubber',nameRu:'Мочалка',source:'https://health.clevelandclinic.org/loofahs-can-double-as-bacterial-breeding-grounds',authority:'Cleveland Clinic',authorityRu:'Cleveland Clinic',guidance:'Choose a material. Cleveland Clinic suggests three to four weeks for natural loofahs and two months for plastic ones, with regular cleaning and complete drying. Replace earlier if mold or a musty odor develops. These are clinical hygiene suggestions, not a WHO interval.',guidanceRu:'Выбери материал. Cleveland Clinic предлагает менять натуральную мочалку через 3–4 недели, пластиковую — через 2 месяца, регулярно очищать и полностью высушивать. При плесени или затхлом запахе заменить раньше. Это клинический ориентир по гигиене, а не срок ВОЗ.'}
];
export const CARE_MATERIALS=[{id:'unknown',name:'Choose the material',nameRu:'Материал пока не выбран'},{id:'natural',name:'Natural loofah',nameRu:'Натуральная люфа'},{id:'plastic',name:'Plastic / mesh',nameRu:'Пластиковая / сетчатая'},{id:'textile',name:'Textile washcloth',nameRu:'Тканевая'},{id:'silicone',name:'Silicone',nameRu:'Силиконовая'}];
export function careDateValid(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const parsed=new Date(value+'T12:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2199-12-31';}
export function validateCareInterval(value){if(value===null)return null;if(!value||!Number.isInteger(Number(value.amount))||Number(value.amount)<1||Number(value.amount)>1200||!['days','months','years'].includes(value.unit)||value.unit==='years'&&Number(value.amount)>100)throw Error('Укажи положительный интервал и единицу времени. / Enter a valid interval.');return {amount:Number(value.amount),unit:value.unit};}
export function addCareInterval(date,interval){
 if(!careDateValid(date)||!interval)return null;const value=validateCareInterval(interval),start=new Date(date+'T12:00:00Z');
 if(value.unit==='days')start.setUTCDate(start.getUTCDate()+value.amount);
 else{const day=start.getUTCDate();start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()+value.amount*(value.unit==='years'?12:1));const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();start.setUTCDate(Math.min(day,end));}
 const result=start.toISOString().slice(0,10);return careDateValid(result)?result:null;
}
export function validateCareEvent(input,today){
 const item=CARE_ITEMS.find(spec=>spec.id===input.item);if(!item)throw Error('Выбери прививку или предмет. / Choose an item.');
 if(!['done','planned'].includes(input.status)||!careDateValid(input.date)||input.status==='done'&&input.date>today)throw Error('Проверь дату: выполненное событие не может быть в будущем. / Check the event date.');
 const value={id:String(input.id||''),item:item.id,status:input.status,date:input.date,note:String(input.note||'').trim().slice(0,2000),label:String(input.label||'').trim().slice(0,120),dose:String(input.dose||'').trim().slice(0,30),courseComplete:input.courseComplete===true};
 if(!value.id||value.id.length>200)throw Error('Некорректный идентификатор записи. / Invalid event ID.');
 if(input.sourceId)value.sourceId=String(input.sourceId).slice(0,200);
 return value;
}
export function careEvents(archive,item){return (archive.careEvents||[]).filter(event=>CARE_ITEMS.some(spec=>spec.id===event.item)&&careDateValid(event.date)&&['done','planned'].includes(event.status)&&(!item||event.item===item)).sort((a,b)=>b.date.localeCompare(a.date));}
export function careLastDone(archive,item){return careEvents(archive,item).find(event=>event.status==='done')||null;}
export function careInterval(archive,item){
 const overrides=archive.careCadenceOverrides||{};
 if(Object.hasOwn(overrides,item))return {custom:true,value:validateCareInterval(overrides[item])};
 const spec=CARE_ITEMS.find(value=>value.id===item);let value=spec?.interval||null;
 if(item==='loofah'){const material=archive.carePreferences?.loofahMaterial;value=material==='natural'?{amount:28,unit:'days'}:material==='plastic'?{amount:2,unit:'months'}:null;}
 return {custom:false,value};
}
export function careNextTasks(archive,kind){
 const result=[];
 for(const spec of CARE_ITEMS.filter(item=>!kind||item.kind===kind)){
  const history=careEvents(archive,spec.id),plans=history.filter(event=>event.status==='planned');
  result.push(...plans.map(event=>({...event,projected:false})));
  const last=history.find(event=>event.status==='done'),interval=careInterval(archive,spec.id);
  if(plans.length||!last||last.courseComplete)continue;
  const date=addCareInterval(last.date,interval.value);
  if(date)result.push({id:'projected:'+spec.id,item:spec.id,status:'planned',date,projected:true,label:last.label,dose:'',customInterval:interval.custom});
 }
 return result.sort((a,b)=>a.date.localeCompare(b.date));
}
export function careMonthCells(month){
 if(!/^\d{4}-\d{2}$/.test(month)||!careDateValid(month+'-01'))throw Error('Invalid calendar month');
 const first=new Date(month+'-01T12:00:00Z'),offset=(first.getUTCDay()+6)%7;first.setUTCDate(first.getUTCDate()-offset);
 return Array.from({length:42},(_,index)=>{const date=new Date(first);date.setUTCDate(first.getUTCDate()+index);return date.toISOString().slice(0,10);});
}
export function mergeCareData(current,incoming,today){
 const merged=new Map();
 for(const value of [...(incoming.careEvents||[]),...(current.careEvents||[])]){const entry=validateCareEvent(value,today);merged.set(entry.id,entry);}
 const preferences={...incoming.carePreferences,...current.carePreferences};
 if(preferences.loofahMaterial&&!CARE_MATERIALS.some(item=>item.id===preferences.loofahMaterial))throw Error('Unknown loofah material');
 const overrides={...incoming.careCadenceOverrides,...current.careCadenceOverrides};
 for(const [id,value]of Object.entries(overrides)){if(!CARE_ITEMS.some(item=>item.id===id))throw Error('Unknown care item');overrides[id]=validateCareInterval(value);}
 return {careEvents:[...merged.values()],carePreferences:preferences,careCadenceOverrides:overrides};
}
export function extractCareCandidates(text,fallbackDate,today){
 const candidates=[],aliases={influenza:/грипп|influenza|\bflu\b/i,td:/адс[ -]?м|tdap|\btd\b|tetanus|столбняк/i,'hpv-vaccine':/впч|hpv/i,'hepatitis-b':/гепатит[а-я ]*b|гепатит[а-я ]*в\b|hepatitis b/i,mmr:/кпк|mmr|кор[ьи]/i,covid:/covid|ковид|коронавирус/i,toothbrush:/зубн[а-я ]*щ[её]тк|toothbrush|brush head/i,loofah:/мочал|люф[ауы]|loofah|body scrubber/i};
 for(const line of String(text).split('\n')){
  if(/не\s+(?:сделал|делал|получ|привит|вакцинир|менял|поменял|замен)|not\s+(?:vaccinated|received|replaced)|дата\s*рожд|birth|\bdob\b/i.test(line))continue;
  const planned=/планир|заплан|предстоит|назначен|рекоменд|нужно|надо|следующ|scheduled|planned|next dose|need to/i.test(line);
  const raw=line.match(/\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/);
  const year=raw?.[6]?.length===2?'20'+raw[6]:raw?.[6];
  const explicit=raw?(raw[1]?raw[1]+'-'+raw[2]+'-'+raw[3]:year+'-'+raw[5].padStart(2,'0')+'-'+raw[4].padStart(2,'0')):'';
  const date=careDateValid(explicit)?explicit:planned?'':fallbackDate||'';
  for(const [item,alias]of Object.entries(aliases)){
   if(!alias.test(line))continue;
   const vaccine=CARE_ITEMS.find(spec=>spec.id===item).kind==='vaccine';
   if(vaccine&&!/привив|вакцин|ревакцин|vaccin|\bshot\b|booster/i.test(line))continue;
   if(!planned&&!(vaccine?/сделал|получил|введен|введён|вакциниров|received|given|administered|vaccinated|дата вакцинации/i:/поменял|заменил|нов[а-я ]+(?:мочал|зубн)|replaced|changed/i).test(line)&&!(vaccine&&explicit))continue;
   candidates.push({item,status:planned?'planned':'done',date,evidence:line.trim(),selected:Boolean(date&&(planned||date<=today)),dose:'',note:''});
  }
 }
 return candidates;
}
