import {TOPICS} from './core.js';
import {METRIC_SPECS,CHECKUP_SPECS} from './tracking.js';
import {CARE_ITEMS} from './care.js';
import {analyzeIntakeText,buildIntakeUpdate,INTAKE_MAX_IMAGES} from './intake.js';
import {intakeImageFile,recognizeIntakeImages} from './ocr.js';

export function configureIntake({getState,commit,uploadImages,openDialog,notify,getLanguage,todayDate,onSaved}) {
 const dialog=document.getElementById('intake-dialog');
 const t=(en,ru)=>getLanguage()==='ru'?ru:en;
 const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 let controller;
 function openNewRecord() {
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  let images=[],draft=null,busy=false,measurementRows=[],visitRows=[],careRows=[],clinicalFields={};
  dialog.replaceChildren();
  const heading=make('div','modal-heading');const title=make('h2','',t('Add a new record','Добавить новую запись'));title.id='intake-title';
  const close=make('button','icon-button','×');close.type='button';close.setAttribute('aria-label',t('Close','Закрыть'));close.addEventListener('click',()=>dialog.close());heading.append(title,close);
  const intro=make('p','modal-intro',t('Add a photo or text. Review what was found, then save it to your archive and trackers.','Добавь изображение или текст. Проверь найденные данные и сохрани запись в архив и историю здоровья.'));
  const rawLabel=make('label','intake-label',t('Text or notes','Текст или заметки'));
  const raw=make('textarea');raw.rows=7;raw.maxLength=30000;raw.placeholder=t('For example: 20.11.2026. Ferritin 32 ng/mL.','Например: 20.11.2026. Ферритин 32 нг/мл.');rawLabel.append(raw);
  const drop=make('div','intake-dropzone');
  const choose=make('label','button button-secondary',t('Add images','Добавить изображения'));
  const file=make('input','sr-only');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.multiple=true;choose.append(file);
  drop.append(choose,make('span','',t('Drop or paste images here · PNG, JPEG, WebP · up to 3 × 8 MB','Перетащи или вставь изображения · PNG, JPEG, WebP · до 3 по 8 МБ')));
  const previews=make('div','intake-images');
  const privacy=make('p','archive-note',t('Images are recognized on this device. The recognition engine and Russian/English language files load from jsDelivr when needed. Your images are not sent there.','Изображения распознаются на этом устройстве. Движок и языковые файлы загружаются с jsDelivr по мере необходимости. Сами изображения туда не отправляются.'));
  const controls=make('div','intake-controls');const analyze=make('button','button button-primary',t('Recognize and organize','Распознать и разобрать'));analyze.type='button';
  const textOnly=make('button','text-button',t('Organize text without image recognition','Разобрать текст без распознавания изображений'));textOnly.type='button';textOnly.hidden=true;controls.append(analyze,textOnly);
  const status=make('p','entry-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const preview=make('form','intake-review');preview.hidden=true;
  const save=make('button','button button-primary',t('Save record','Сохранить запись'));save.type='submit';
  const invalidate=()=>{draft=null;preview.hidden=true;save.disabled=true;status.textContent='';};
  const busyState=value=>{busy=value;analyze.disabled=value;textOnly.disabled=value;file.disabled=value;raw.readOnly=value;dialog.classList.toggle('intake-busy',value);};
  function renderImages(){
   previews.replaceChildren();textOnly.hidden=!images.length;
   images.forEach((image,index)=>{
    const card=make('div','intake-image');const img=make('img');img.src=image.imageData;img.alt=image.name;
    const name=make('span','',image.name);name.dataset.noTranslate='';
    const remove=make('button','text-button',t('Remove','Убрать'));remove.type='button';remove.addEventListener('click',()=>{if(busy)return;images.splice(index,1);renderImages();invalidate();});
    card.append(img,name,remove);previews.append(card);
   });
  }
  async function addFiles(files) {
   if(busy)return;
   const chosen=[...files];if(chosen.length+images.length>INTAKE_MAX_IMAGES){status.textContent=t('Choose up to three images.','Выбери не больше трёх изображений.');return;}
   busyState(true);const additions=[];
   try{for(const item of chosen)additions.push(await intakeImageFile(item));if(!signal.aborted){images.push(...additions);invalidate();renderImages();}}
   catch(error){status.textContent=t(error.message,'Не удалось добавить изображение. Подойдут PNG, JPEG и WebP размером до 8 МБ.');}
   finally{busyState(false);file.value='';}
  }
  file.addEventListener('change',()=>addFiles(file.files));
  for(const name of ['dragover','drop'])drop.addEventListener(name,event=>event.preventDefault());
  drop.addEventListener('drop',event=>addFiles(event.dataTransfer.files));
  dialog.addEventListener('paste',event=>{if(!dialog.open||signal.aborted)return;const pasted=[...(event.clipboardData?.files||[])];if(pasted.length){event.preventDefault();addFiles(pasted);}},{signal});
  raw.addEventListener('input',invalidate);
  const field=(parent,labelText,node)=>{const label=make('label','intake-label',labelText);label.append(node);parent.append(label);return node;};
  const textInput=(value,type='text')=>{const input=make('input');input.type=type;input.value=value??'';return input;};
  function showDraft() {
   draft=analyzeIntakeText(raw.value,todayDate());preview.replaceChildren();measurementRows=[];visitRows=[];careRows=[];clinicalFields={};
   preview.append(make('h3','',t('Review before saving','Проверь перед сохранением')));
   preview.append(make('p','archive-note',t('Check the dates, decimal separators and units against the original. Handwriting and blurred photos can be misread.','Сверь с оригиналом даты, десятичные знаки и единицы. Рукописный текст и нечёткие снимки могут распознаваться с ошибками.')));
   const titleInput=field(preview,t('Title','Заголовок'),textInput(draft.title));titleInput.name='title';titleInput.maxLength=160;titleInput.required=true;
   const topic=make('select');topic.name='topic';TOPICS.forEach(item=>{const option=make('option','',item.name);option.value=item.id;topic.append(option);});topic.value=draft.topic;field(preview,t('Care area','Направление'),topic);
   const date=field(preview,t('Date of the test or visit · optional','Дата анализа или визита · необязательно'),textInput(draft.date,'date'));date.name='date';date.max=todayDate();
   if(!draft.date)preview.append(make('p','archive-note',t('No single clear date was found. Enter it before adding results or visits to their histories.','Однозначная дата не найдена. Укажи её, чтобы добавить результаты или визиты в историю.')));
   if(draft.warnings.length)preview.append(make('p','archive-note',t('Results with “less than” or “greater than” were kept in the text, without converting them into an exact number.','Результаты со знаками «меньше» или «больше» сохранены в тексте и не превращены в точное число.')));
   const makeRow=(candidate,isVisit)=>{
    const spec=(isVisit?CHECKUP_SPECS:METRIC_SPECS).find(item=>item.id===(isVisit?candidate.checkup:candidate.metric));
    const row=make('fieldset','intake-extracted-row');const legend=make('legend','');const selected=textInput('','checkbox');selected.checked=candidate.selected;
    legend.append(selected,document.createTextNode(getLanguage()==='ru'?spec.nameRu:spec.name));row.append(legend);
    const evidence=make('p','intake-evidence',candidate.evidence);evidence.dataset.noTranslate='';row.append(evidence);
    const rowDate=field(row,t('Date','Дата'),textInput(candidate.date,'date'));rowDate.max=todayDate();
    const entry={candidate,selected,date:rowDate};
    if(!isVisit){
     entry.value=field(row,t('Value','Результат'),textInput(candidate.value));entry.value.inputMode='decimal';
     entry.unit=make('select');const blank=make('option','',t('Choose a unit','Выбери единицу'));blank.value='';entry.unit.append(blank);
     spec.units.forEach(unit=>{const option=make('option','',unit);option.value=unit;entry.unit.append(option);});entry.unit.value=candidate.unit;field(row,t('Unit','Единица'),entry.unit);
     entry.low=field(row,t('Lower reference · optional','Нижний референс · необязательно'),textInput(candidate.refLow));entry.low.inputMode='decimal';
     entry.high=field(row,t('Upper reference · optional','Верхний референс · необязательно'),textInput(candidate.refHigh));entry.high.inputMode='decimal';
     measurementRows.push(entry);
    }else visitRows.push(entry);
    preview.append(row);
   };
   if(draft.measurements.length){preview.append(make('h4','',t('Add to indicator history','Добавить в историю показателей')));draft.measurements.forEach(row=>makeRow(row,false));}
   if(draft.visits.length){preview.append(make('h4','',t('Add to visits and screenings','Добавить в визиты и обследования')));draft.visits.forEach(row=>makeRow(row,true));}
   if(draft.careCandidates.length){preview.append(make('h4','',t('Vaccinations and replacements','Прививки и замена предметов')));for(const candidate of draft.careCandidates){
    const spec=CARE_ITEMS.find(item=>item.id===candidate.item),row=make('fieldset','intake-extracted-row'),legend=make('legend'),selected=textInput('','checkbox');selected.checked=candidate.selected;legend.append(selected,document.createTextNode(getLanguage()==='ru'?spec.nameRu:spec.name));row.append(legend,make('p','intake-evidence',candidate.evidence));
    const status=make('select');for(const [value,en,ru]of [['done','Done','Выполнено'],['planned','Planned','Запланировано']]){const option=make('option','',t(en,ru));option.value=value;status.append(option);}status.value=candidate.status;field(row,t('Status','Статус'),status);
    const entryDate=field(row,t('Date','Дата'),textInput(candidate.date,'date'));entryDate.max=status.value==='done'?todayDate():'2199-12-31';status.addEventListener('change',()=>{entryDate.max=status.value==='done'?todayDate():'2199-12-31';});careRows.push({candidate,selected,status,date:entryDate});preview.append(row);
   }}
   if(!draft.measurements.length&&!draft.visits.length&&!draft.careCandidates.length)preview.append(make('p','archive-note',t('This will be saved as a searchable record with its original images. No numeric results or completed visits were identified.','Сохранится запись с текстом и оригинальными изображениями. Числовые результаты или состоявшиеся визиты не найдены.')));
   const medical=make('details','intake-clinical');medical.open=Object.values(draft.clinical).some(value=>Array.isArray(value)&&value.length);
   medical.append(make('summary','',t('Findings, prescriptions and care plan','Заключение, назначения и план')));
   for(const [key,en,ru]of [['clinic','Clinic','Клиника'],['clinician','Doctor','Врач'],['findings','Symptoms and findings','Жалобы и результаты'],['assessments','Diagnosis as written in the source','Диагноз как в источнике'],['prescriptions','Prescriptions as written in the source','Назначения как в источнике'],['recommendations','Recommendations and plans','Рекомендации и планы'],['procedures','Completed procedures','Выполненные процедуры'],['uncertain','Needs checking','Требует проверки']]){
    const value=draft.clinical[key],input=key==='clinic'||key==='clinician'?textInput(value||''):make('textarea');
    if(input.tagName==='TEXTAREA'){input.rows=3;input.maxLength=12000;input.value=(value||[]).join('\n');}
    field(medical,t(en,ru),input);clinicalFields[key]=input;
   }
   preview.append(medical);
   date.addEventListener('change',()=>{for(const row of [...measurementRows,...visitRows])if(!row.date.value)row.date.value=date.value;});
   const reviewed=make('label','intake-confirm');const check=textInput('','checkbox');check.required=true;reviewed.append(check,document.createTextNode(t('I checked the extracted information against the source.','Я проверила распознанные данные по источнику.')));preview.append(reviewed);
   const note=make('p','archive-note',t('Your record and original images will be saved in private Cloudflare R2 storage and available on your other devices after signing in.','Запись и оригиналы изображений сохранятся в закрытом Cloudflare R2 и будут доступны на других устройствах после входа.'));
   preview.append(note,save);save.disabled=false;preview.hidden=false;
  }
  async function organize(useOCR) {
   if(busy)return;
   if(!raw.value.trim()&&!images.length){status.textContent=t('Add text or an image.','Добавь текст или изображение.');return;}
   busyState(true);preview.hidden=true;
   try{
    if(useOCR&&images.length){
     images=await recognizeIntakeImages(images,{signal,onProgress:event=>{if(!signal.aborted)status.textContent=t('Recognizing image ','Распознаю изображение ')+(event.index+1)+'/'+event.total+' · '+Math.round(event.progress*100)+'%';}});
     const chunks=images.map(image=>image.text).filter(text=>text&&!raw.value.includes(text));
     if(chunks.length)raw.value=[raw.value.trim(),...chunks].filter(Boolean).join('\n\n');
    }
    if(signal.aborted)return;
    renderImages();showDraft();
    status.textContent=useOCR&&images.some(image=>!image.text)?t('Some images had no readable text. You can add a transcription above or save the original.','На части изображений текст не распознан. Можно дописать его выше или сохранить оригинал.'):t('Ready to review.','Можно проверить и сохранить.');
   }catch(error){if(!signal.aborted)status.textContent=t('Recognition did not finish. Check your connection, or use “Organize text without image recognition”.','Распознавание не завершилось. Проверь интернет или нажми «Разобрать текст без распознавания изображений».');}
   finally{if(!signal.aborted)busyState(false);}
  }
  analyze.addEventListener('click',()=>organize(true));textOnly.addEventListener('click',()=>organize(false));
  preview.addEventListener('submit',async event=>{
   event.preventDefault();if(!draft||busy)return;save.disabled=true;busyState(true);status.textContent=t('Saving the originals and record to Cloudflare…','Сохраняю оригиналы и запись в Cloudflare…');
   try{
    const values=new FormData(preview);
    const measurements=measurementRows.map(row=>({...row.candidate,selected:row.selected.checked,value:row.value.value,unit:row.unit.value,date:row.date.value,refLow:row.low.value,refHigh:row.high.value}));
    const visits=visitRows.map(row=>({...row.candidate,selected:row.selected.checked,date:row.date.value}));
    const careCandidates=careRows.map(row=>({...row.candidate,selected:row.selected.checked,date:row.date.value,status:row.status.value}));
    const clinical=Object.fromEntries(Object.entries(clinicalFields).map(([key,input])=>[key,key==='clinic'||key==='clinician'?input.value:input.value.split('\n').map(line=>line.trim()).filter(Boolean)]));
    const uuid=crypto.randomUUID(),createdAt=new Date().toISOString(),input={text:raw.value,title:values.get('title'),topic:values.get('topic'),date:values.get('date'),kind:draft.kind,clinical,measurements,visits,careCandidates};
    // Validate the selected observations before uploading any originals.
    buildIntakeUpdate(getState(),{...input,images:images.map(image=>({name:image.name,url:'media/pending.jpg'}))},todayDate(),uuid,createdAt);
    const uploaded=await uploadImages(images);if(signal.aborted)return;
    const next=buildIntakeUpdate(getState(),{...input,images:uploaded},todayDate(),uuid,createdAt);
    await commit(next);dialog.close();notify(t('Record added.','Запись добавлена.'));onSaved('manual:'+uuid);
   }catch(error){status.textContent=error.message;save.disabled=false;}
   finally{if(!signal.aborted)busyState(false);}
  });
  dialog.append(heading,intro,rawLabel,drop,previews,privacy,controls,status,preview);
  dialog.addEventListener('close',()=>controller?.abort(),{once:true});openDialog(dialog);raw.focus();
 }
 document.querySelectorAll('[data-new-record]').forEach(button=>button.addEventListener('click',openNewRecord));
 return {open:openNewRecord};
}

