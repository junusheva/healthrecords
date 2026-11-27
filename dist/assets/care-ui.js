import {CARE_ITEMS,CARE_MATERIALS,CARE_REVIEWED,careEvents,careLastDone,careInterval,careNextTasks,careMonthCells,validateCareEvent,validateCareInterval} from './care.js';

export function configureCareUI({getState,commit,notify,todayDate,getLanguage,openDialog,sourceButtons}){
 let shownMonth=todayDate().slice(0,7);
 const t=(ru,en)=>getLanguage()==='ru'?ru:en;
 const localizedCare=(item,key='name')=>getLanguage()==='ru'?item[key+'Ru']||item[key]:item[key];
 const node=(tag,css,text)=>{const value=document.createElement(tag);if(css)value.className=css;if(text!==undefined)value.textContent=text;return value;};
 const dateLabel=date=>date?new Date(date+'T12:00:00Z').toLocaleDateString(getLanguage()==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):t('Дата не записана','Date not recorded');
 const intervalLabel=value=>!value?t('По индивидуальному плану','Individual plan'):t(`Каждые ${value.amount} ${value.unit==='days'?'дн.':value.unit==='months'?'мес.':'г.'}`,`Every ${value.amount} ${value.unit}`);
 const button=(text,callback,css='button button-secondary')=>{const value=node('button',css,text);value.type='button';value.addEventListener('click',callback);return value;};
 async function saveEvent(input){const event=validateCareEvent({...input,id:input.id||'care:'+crypto.randomUUID()},todayDate());const state=getState();await commit({...state,careEvents:[...(state.careEvents||[]).filter(value=>value.id!==event.id),event]});notify(t('Сохранено в календаре','Saved to your calendar'));}
 function openEvent(kind,item,existing){
  const dialog=document.getElementById('entry-dialog');dialog.replaceChildren();
  const heading=node('div','modal-heading'),title=node('h2','',kind==='vaccine'?t('Запись о прививке','Vaccination entry'):t('Замена предмета','Replacement entry'));title.id='entry-title';heading.append(title,button('×',()=>dialog.close(),'icon-button'));dialog.append(heading);
  const form=node('form','tracking-form');
  const field=(label,name,input)=>{const wrap=node('label','',label);input.name=name;wrap.append(input);form.append(wrap);return input;};
  const select=node('select');for(const spec of CARE_ITEMS.filter(value=>value.kind===kind)){const option=node('option','',localizedCare(spec));option.value=spec.id;select.append(option);}select.value=item||select.options[0].value;field(t('Прививка или предмет','Vaccination or item'),'item',select);
  const status=node('select');for(const [value,ru,en]of [['done','Выполнено','Done'],['planned','Запланировано','Planned']]){const option=node('option','',t(ru,en));option.value=value;status.append(option);}status.value=existing?.status||'done';field(t('Статус','Status'),'status',status);
  const date=node('input');date.type='date';date.required=true;date.value=existing?.date||todayDate();date.min='1900-01-01';date.max=status.value==='done'?todayDate():'2199-12-31';status.addEventListener('change',()=>{date.max=status.value==='done'?todayDate():'2199-12-31';});field(t('Дата','Date'),'date',date);
  const label=node('input');label.maxLength=120;label.value=existing?.label||'';field(kind==='vaccine'?t('Название препарата · необязательно','Vaccine product · optional'):t('Название или модель · необязательно','Product or model · optional'),'label',label);
  let dose,complete;
  if(kind==='vaccine'){
   dose=node('input');dose.maxLength=30;dose.value=existing?.dose||'';dose.placeholder=t('Например, 1-я доза или ревакцинация','For example, dose 1 or booster');field(t('Доза · необязательно','Dose · optional'),'dose',dose);
   complete=node('input');complete.type='checkbox';complete.checked=existing?.courseComplete===true;field(t('Курс завершён: следующую дозу автоматически не рассчитывать','Course complete: do not calculate another dose'),'courseComplete',complete);
  }
  const note=node('textarea');note.rows=3;note.maxLength=2000;note.value=existing?.note||'';field(t('Заметка или план врача','Note or clinician’s plan'),'note',note);
  const error=node('p','entry-status');error.setAttribute('role','status');form.append(error);
  const actions=node('div','form-actions');actions.append(button(t('Отмена','Cancel'),()=>dialog.close()));const submit=node('button','button button-primary',t('Сохранить','Save'));submit.type='submit';actions.append(submit);form.append(actions);
  form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;error.textContent='';try{await saveEvent({id:existing?.projected?undefined:existing?.id,item:select.value,status:status.value,date:date.value,label:label.value,dose:dose?.value,courseComplete:complete?.checked,note:note.value,sourceId:existing?.sourceId});dialog.close();}catch(problem){error.textContent=problem.message;}finally{submit.disabled=false;}});
  if(existing?.id&&!existing.projected)form.append(button(t('Удалить эту запись','Delete this entry'),async event=>{const target=event.currentTarget;target.disabled=true;try{const state=getState();await commit({...state,careEvents:(state.careEvents||[]).filter(value=>value.id!==existing.id)});dialog.close();}catch(problem){error.textContent=problem.message;target.disabled=false;}},'text-button delete-entry'));
  dialog.append(form);openDialog(dialog);
 }
 function frequencyEditor(spec){
  const state=getState(),setting=careInterval(state,spec.id),details=node('details','care-frequency');details.append(node('summary','',t('Изменить частоту','Change frequency')));
  const form=node('form','tracking-form'),mode=node('select');mode.setAttribute('aria-label',t('Режим частоты','Frequency mode'));
  for(const [value,ru,en]of [['default','Ориентир источника','Source default'],['custom','Мой интервал','My interval'],['off','Без расчёта следующей даты','No automatic next date']]){const option=node('option','',t(ru,en));option.value=value;mode.append(option);}mode.value=setting.custom?(setting.value?'custom':'off'):'default';
  const amount=node('input');amount.type='number';amount.min=1;amount.max=1200;amount.value=setting.value?.amount||1;amount.setAttribute('aria-label',t('Число единиц времени','Number of time units'));
  const unit=node('select');unit.setAttribute('aria-label',t('Единица интервала','Interval unit'));for(const [value,ru,en]of [['days','Дней','Days'],['months','Месяцев','Months'],['years','Лет','Years']]){const option=node('option','',t(ru,en));option.value=value;unit.append(option);}unit.value=setting.value?.unit||'months';
  const sync=()=>{amount.disabled=unit.disabled=mode.value!=='custom';};sync();mode.addEventListener('change',sync);
  form.append(mode,amount,unit);if(spec.kind==='vaccine'&&!spec.recurring)form.append(node('p','archive-note',t('Для дозы из курса лучше указать подтверждённую дату. Собственный интервал применяется только пока курс не отмечен завершённым.','For a course dose, prefer a confirmed planned date. A custom interval applies until the course is marked complete.')));
  const message=node('p','entry-status');message.setAttribute('role','status');const save=node('button','button button-secondary',t('Сохранить частоту','Save frequency'));save.type='submit';form.append(message,save);
  form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{const current=getState(),overrides={...current.careCadenceOverrides};if(mode.value==='default')delete overrides[spec.id];else overrides[spec.id]=mode.value==='off'?null:validateCareInterval({amount:amount.value,unit:unit.value});await commit({...current,careCadenceOverrides:overrides});notify(t('Частота сохранена','Frequency saved'));}catch(problem){message.textContent=problem.message;save.disabled=false;}});details.append(form);return details;
 }
 function card(spec){
  const state=getState(),history=careEvents(state,spec.id),last=careLastDone(state,spec.id),next=careNextTasks(state).find(value=>value.item===spec.id),setting=careInterval(state,spec.id),article=node('article','checkup-card care-card');article.append(node('h3','',localizedCare(spec)));
  const lastBlock=node('div','checkup-recency');lastBlock.append(node('span','guidance-label',spec.kind==='vaccine'?t('Последняя проведённая доза','Last recorded dose'):t('Последняя замена','Last replacement')),node('strong','',dateLabel(last?.date)));if(last?.label)lastBlock.append(node('span','',last.label));if(last?.dose)lastBlock.append(node('span','',last.dose));article.append(lastBlock);
  if(spec.id==='loofah'){
   const label=node('label','care-material',t('Материал мочалки','Loofah material')),picker=node('select');for(const material of CARE_MATERIALS){const option=node('option','',localizedCare(material));option.value=material.id;picker.append(option);}picker.value=state.carePreferences?.loofahMaterial||'unknown';picker.addEventListener('change',async()=>{picker.disabled=true;try{const current=getState();await commit({...current,carePreferences:{...current.carePreferences,loofahMaterial:picker.value}});}catch(problem){notify(problem.message);picker.disabled=false;}});label.append(picker);article.append(label);
  }
  const nextBlock=node('div','care-next');nextBlock.append(node('span','guidance-label',t('Следующая дата','Next date')),node('strong','',next?dateLabel(next.date):t('Пока не задана','Not set yet')));if(next)nextBlock.append(node('span',next.date<todayDate()?'care-past-date':'archive-note',next.date<todayDate()?t('Плановая дата уже прошла','Planned date has passed'):next.projected?t('Расчёт по интервалу','Calculated from interval'):t('Добавленный план','Recorded plan')));article.append(nextBlock);
  article.append(node('p','care-interval',intervalLabel(setting.value)),node('span','subtle-label',setting.custom?t('Моя настройка','My setting'):spec.authority?localizedCare(spec,'authority'):t('Индивидуальный план','Individual plan')),node('p','archive-note',localizedCare(spec,'guidance')));
  if(spec.source){const link=node('a','text-link',t('Рекомендация и источник','Guidance and source'));link.href=spec.source;link.target='_blank';link.rel='noopener noreferrer';article.append(link);}
  article.append(frequencyEditor(spec));
  const actions=node('div','care-actions');actions.append(button(spec.kind==='vaccine'?t('Добавить дозу','Add a dose'):t('Указать дату замены','Record replacement date'),()=>openEvent(spec.kind,spec.id)));
  if(spec.kind==='hygiene')actions.append(button(t('Отметить замену сегодня','Replaced today'),async event=>{const target=event.currentTarget;target.disabled=true;try{await saveEvent({item:spec.id,status:'done',date:todayDate()});}catch(problem){target.disabled=false;notify(problem.message);}},'button button-primary'));
  else actions.append(button(t('Запланировать','Plan a dose'),()=>openEvent(spec.kind,spec.id,{status:'planned',date:todayDate()}),'text-link'));
  article.append(actions);
  if(history.length){const details=node('details','checkup-history');details.append(node('summary','',t('История','History')+` · ${history.length}`));for(const event of history){const row=node('div','care-history-row');row.append(button(`${dateLabel(event.date)} · ${event.status==='done'?t('Выполнено','Done'):t('План','Planned')}${event.dose?' · '+event.dose:''}`,()=>openEvent(spec.kind,spec.id,event),'text-button'));if(event.note)row.append(node('p','archive-note',event.note));if(event.sourceId)row.append(sourceButtons([event.sourceId]));details.append(row);}article.append(details);}
  return article;
 }
 function calendar(content){
  const state=getState(),section=node('section','care-calendar-panel'),heading=node('div','panel-heading');heading.append(node('h3','',t('Календарь прививок','Vaccination calendar')));
  const month=node('input');month.type='month';month.value=shownMonth;month.min='1900-01';month.max='2199-12';month.setAttribute('aria-label',t('Месяц календаря','Calendar month'));month.addEventListener('change',()=>{if(!/^\d{4}-\d{2}$/.test(month.value))return;shownMonth=month.value;section.replaceWith(calendarElement());});heading.append(month);section.append(heading);
  const weekdays=node('div','care-weekdays');for(const name of t(['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],['Mon','Tue','Wed','Thu','Fri','Sat','Sun']))weekdays.append(node('span','',name));section.append(weekdays);
  const entries=[...careEvents(state).filter(event=>event.status==='done'&&CARE_ITEMS.find(spec=>spec.id===event.item)?.kind==='vaccine'),...careNextTasks(state,'vaccine')];
  const grid=node('ol','care-calendar');for(const date of careMonthCells(shownMonth)){const cell=node('li','care-calendar-day'+(date.slice(0,7)!==shownMonth?' care-other-month':'')+(date===todayDate()?' care-today':'')),time=node('time','',String(Number(date.slice(-2))));time.dateTime=date;cell.append(time);for(const event of entries.filter(value=>value.date===date)){const spec=CARE_ITEMS.find(value=>value.id===event.item);const entry=button(localizedCare(spec)+(event.projected?' · '+t('расчёт','estimate'):event.status==='done'?' ✓':''),()=>openEvent('vaccine',spec.id,event),'care-calendar-event '+(event.status==='done'?'care-done':'care-planned'));entry.title=dateLabel(event.date)+' · '+localizedCare(spec);cell.append(entry);}grid.append(cell);}section.append(grid,node('p','archive-note',t('✓ Выполнено · Цветные записи — планы или расчёт по интервалу. Неизвестная история не означает отсутствие прививок.','✓ Done · Colored entries are plans or interval estimates. Missing history does not mean unvaccinated.')));
  return section;
  function calendarElement(){return calendar();}
 }
 function render(content,kind){
  const intro=node('div','tracking-heading');intro.append(node('p','',kind==='vaccine'?t('Проведённые дозы, планы и ориентиры из источников. Схема зависит от прошлых прививок и индивидуального плана.','Recorded doses, plans and source guidance. Your schedule depends on previous doses and your individual plan.'):t('Дата последней замены и следующий ориентир. Частоту можно менять; без даты замены отсчёт не начинается.','Your last replacement and next estimate. Frequencies are editable; no countdown starts without a recorded date.')),button(kind==='vaccine'?t('Добавить прививку','Add vaccination'):t('Добавить замену','Add replacement'),()=>openEvent(kind), 'button button-primary'));content.append(intro);
  const tasks=careNextTasks(getState(),kind);if(tasks.length){const agenda=node('section','care-agenda');agenda.append(node('h3','',t('Предстоящие и ожидающие отметки','Upcoming and pending')));for(const task of tasks.slice(0,12)){const spec=CARE_ITEMS.find(value=>value.id===task.item);agenda.append(button(`${dateLabel(task.date)} · ${localizedCare(spec)}${task.projected?' · '+t('расчёт','estimate'):''}`,()=>openEvent(kind,spec.id,task),'care-agenda-entry'));}content.append(agenda);}
  if(kind==='vaccine')content.append(calendar());
  const grid=node('div','checkup-grid');for(const spec of CARE_ITEMS.filter(value=>value.kind===kind))grid.append(card(spec));content.append(grid,node('p','guidance-footer',t('Источники проверены: ','Guidance checked: ')+dateLabel(CARE_REVIEWED)));
 }
 return {render,openEvent};
}
