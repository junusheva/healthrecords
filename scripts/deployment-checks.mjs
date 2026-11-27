import {createHash} from 'node:crypto';
export async function verifyPrivateDeployment(details,{fetcher=fetch,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=7,storagePaths=[],requireR2=false}={}) {
 const paths=['/data.js','/data.json',...(requireR2?['/api/archive',...storagePaths]:[])];
 let lastStatus;
 for(let attempt=0;attempt<attempts;attempt++){
  let ready=true;
  for(const path of paths){
   const response=await fetcher(details.site+path,{method:'HEAD',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000)});
   lastStatus=response.status;
   if(response.status!==401||response.headers.get('X-Archive-Auth')!=='session'){
    ready=false;
    if(response.status!==503)throw new Error('Закрытый вход пока не подтверждён. HTTP '+response.status+'. Пароль не отправлялся.');
    break;
   }
  }
  if(ready){
   const configResponse=await fetcher(details.site+'/auth/config',{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(configResponse.status===503&&attempt<attempts-1){await delay(2500);continue;}
   if(configResponse.status!==200)throw new Error('Не удалось проверить настройку входа. Пароль не отправлялся.');
   const config=await configResponse.json();
   if(config.mode==='pbkdf2')return {ownerVerified:false,customPassword:true};
   if(config.mode!=='bootstrap')throw new Error('Неизвестный способ входа. Пароль не отправлялся.');
   const proof=createHash('sha256').update(details.password.normalize('NFC'),'utf8').digest('hex');
   const signedIn=await fetcher(details.site+'/auth/login',{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Origin:new URL(details.site).origin},body:JSON.stringify({proof})});
   if(signedIn.status===503&&attempt<attempts-1){await delay(2500);continue;}
   if(signedIn.status!==200)throw new Error('Первоначальный пароль не подошёл. Проверь текущий файл .archive-login.json.');
   const cookie=(signedIn.headers.get('Set-Cookie')||'').split(';')[0];
   if(!cookie.startsWith('__Host-healthrecords='))throw new Error('Сеанс входа не подтверждён.');
   const response=await fetcher(details.site+(requireR2?'/api/archive':'/'),{method:'HEAD',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Cookie:cookie}});
   if(response.status!==200)throw new Error('Вход владельца не подтверждён. HTTP '+response.status+'.');
   if(response.headers.get('Cache-Control')!=='private, no-store')throw new Error('Не подтверждены настройки приватного кеширования.');
   if(requireR2){
    for(const path of ['/api/archive',...storagePaths]){
     const stored=await fetcher(details.site+path,{method:'HEAD',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Cookie:cookie}});
     if(stored.status!==200||stored.headers.get('X-Archive-Storage')!=='r2')throw new Error('Не удалось подтвердить сохранение в R2. Проверь bindings ARCHIVE_FILES и ARCHIVE_DATA.');
    }
   }
   return {ownerVerified:true,customPassword:false};
  }
  if(attempt<attempts-1)await delay(2500);
 }
 if(lastStatus===503)throw new Error('Сайт продолжает отвечать HTTP 503 после ожидания обновления. Проверь binding ARCHIVE_AUTH и начальный секрет ARCHIVE_PASSWORD_SHA256 у Worker healthrecords. Пароль не отправлялся.');
 throw new Error('Проверка закрытого доступа не завершена. HTTP '+lastStatus+'. Пароль не отправлялся.');
}

