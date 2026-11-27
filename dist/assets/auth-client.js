'use strict';
(() => {
 const language=()=>{try{return localStorage.getItem('health-records-language')==='en'?'en':'ru';}catch{return 'ru';}};
 const t=(en,ru)=>language()==='ru'?ru:en;
 const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
 const hex=bytes=>[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
 const bytes=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));
 const salt=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 async function api(path,body){
  const response=await fetch('/auth/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  let result;try{result=await response.json();}catch{throw new Error(t('The sign-in service is temporarily unavailable.','Вход временно недоступен. Попробуй позже.'));}
  if(!response.ok){
   if(response.status===429)throw new Error(t('Too many attempts. Try again in 10 minutes.','Слишком много попыток. Попробуй через 10 минут.'));
   if(response.status===401)throw new Error(t('Incorrect current password, or the session has expired.','Неверный текущий пароль или срок входа истёк.'));
   throw new Error(t('The change could not be saved. Try again.','Не удалось сохранить изменение. Попробуй ещё раз.'));
  }
  return result;
 }
 async function proof(password,config){
  const normalized=password.normalize('NFC');
  if(config.mode==='bootstrap')return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized)));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(normalized),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(config.salt),iterations:600000},key,256));
 }
 function passwordField(form,text,autocomplete){
  const label=make('label','intake-label',text);const input=make('input');input.type='password';input.required=true;input.maxLength=128;input.autocomplete=autocomplete;label.append(input);form.append(label);return input;
 }
 function openPasswordDialog(){
  const prior=document.activeElement;const dialog=make('dialog','modal intake-modal password-modal');
  const heading=make('div','modal-heading'),title=make('h2','',t('Change password','Сменить пароль')),close=make('button','icon-button','×');close.type='button';close.setAttribute('aria-label',t('Close','Закрыть'));close.addEventListener('click',()=>dialog.close());heading.append(title,close);dialog.append(heading);
  if(location.protocol!=='https:'){
   dialog.append(make('p','',t('Password changes are available on the published website.','Пароль можно менять на опубликованном сайте.')));
   const link=make('a','button button-primary',t('Open the website','Открыть сайт'));link.href='https://healthrecords.ayaijan.com';link.target='_blank';link.rel='noopener noreferrer';dialog.append(link);
  }else{
   dialog.append(make('p','archive-note',t('Choose a password of at least 15 characters. Changing it signs out previous sessions on every device.','Придумай пароль длиной от 15 символов. После смены прежние сеансы на всех устройствах завершатся.')));
   const form=make('form','password-form');const current=passwordField(form,t('Current password','Текущий пароль'),'current-password');
   const next=passwordField(form,t('New password','Новый пароль'),'new-password');next.minLength=15;
   const confirm=passwordField(form,t('Confirm new password','Повтори новый пароль'),'new-password');confirm.minLength=15;
   const status=make('p','entry-status');status.setAttribute('role','status');const save=make('button','button button-primary',t('Save new password','Сохранить новый пароль'));save.type='submit';form.append(status,save);dialog.append(form);
   let busy=false;form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    if(next.value.normalize('NFC').length<15){status.textContent=t('Use at least 15 characters.','Используй не меньше 15 символов.');return;}
    if(next.value!==confirm.value){status.textContent=t('The new passwords do not match.','Новые пароли не совпадают.');return;}
    if(next.value===current.value){status.textContent=t('Choose a different new password.','Выбери другой новый пароль.');return;}
    busy=true;save.disabled=true;close.disabled=true;current.readOnly=next.readOnly=confirm.readOnly=true;
    status.textContent=t('Saving the new password…','Сохраняю новый пароль…');
    try{
     const config=await api('config'),newSalt=salt();
     const currentProof=await proof(current.value,config);
     const newProof=await proof(next.value,{mode:'pbkdf2',salt:newSalt});
     await api('change-password',{currentProof,newProof,newSalt});
     current.value=next.value=confirm.value='';
     form.replaceChildren(make('p','',t('Password changed. Use your new password for future sign-ins. The initial password file is no longer valid.','Пароль изменён. Для следующего входа используй новый пароль. Начальный пароль из файла больше не действует.')));
    }catch(error){status.textContent=error.message;save.disabled=false;current.readOnly=next.readOnly=confirm.readOnly=false;}
    finally{busy=false;close.disabled=false;}
   });
   dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  }
  dialog.addEventListener('close',()=>{dialog.remove();prior?.focus();},{once:true});document.body.append(dialog);dialog.showModal();dialog.querySelector('input')?.focus();
 }
 async function logout(){
  if(location.protocol!=='https:')return;
  try{await api('logout',{});location.assign('/');}catch(error){alert(error.message);}
 }
 async function startLogin(){
  const root=document.getElementById('auth-root');if(!root)return;
  root.replaceChildren(make('div','auth-eyebrow',t('Private archive','Личный архив')),make('h1','',t('Welcome back','Вход в архив')));
  const form=make('form');const password=passwordField(form,t('Password','Пароль'),'current-password');password.autofocus=true;
  const help=make('small','',t('For your first sign-in, use the password saved by the deployment script.','Для первого входа используй пароль, сохранённый сценарием публикации.'));
  const status=make('p','auth-status');status.setAttribute('role','status');const submit=make('button','',t('Sign in','Войти'));submit.type='submit';form.append(help,status,submit);root.append(form);
  try{const config=await api('config');if(config.mode!=='bootstrap')help.textContent=t('Use your current archive password.','Введи текущий пароль от архива.');}catch(error){status.textContent=error.message;}
  form.addEventListener('submit',async event=>{
   event.preventDefault();submit.disabled=true;password.readOnly=true;status.textContent=t('Signing in…','Вхожу…');
   try{const config=await api('config');await api('login',{proof:await proof(password.value,config)});password.value='';location.replace('/');}
   catch(error){status.textContent=error.message;submit.disabled=false;password.readOnly=false;password.focus();}
  });
 }
 window.HealthAuth={openPasswordDialog,logout};
 document.querySelectorAll('[data-password]').forEach(button=>button.addEventListener('click',openPasswordDialog));
 document.querySelectorAll('[data-logout]').forEach(button=>{button.hidden=location.protocol!=='https:';button.addEventListener('click',logout);});
 startLogin();
})();

