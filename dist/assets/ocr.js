import {INTAKE_MAX_IMAGE_BYTES,INTAKE_MAX_IMAGES} from './intake.js';
export const OCR_RESOURCES={
 script:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js',
 worker:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
 core:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0'
};
let ocrScriptPromise;
export function imageMimeFromBytes(bytes) {
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function intakeImageFile(file) {
 if(file.size>INTAKE_MAX_IMAGE_BYTES||!file.size)throw new Error('Choose a PNG, JPEG, or WebP image smaller than 8 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),type=imageMimeFromBytes(bytes);
 if(!type)throw new Error('Choose a PNG, JPEG, or WebP image smaller than 8 MB.');
 const imageData=await new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The image could not be read.'));
  reader.readAsDataURL(new Blob([bytes],{type}));
 });
 return {name:String(file.name||'image').slice(0,180),imageData,text:''};
}
async function loadOCRScript() {
 if(globalThis.Tesseract?.createWorker)return globalThis.Tesseract;
 if(!ocrScriptPromise)ocrScriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=OCR_RESOURCES.script;script.crossOrigin='anonymous';
  let timeout=setTimeout(()=>{script.remove();reject(new Error('Image recognition needs an internet connection to load its language files.'));},20000);
  script.onload=()=>{clearTimeout(timeout);if(globalThis.Tesseract?.createWorker)resolve(globalThis.Tesseract);else reject(new Error('Image recognition could not start.'));};
  script.onerror=()=>{clearTimeout(timeout);script.remove();reject(new Error('Image recognition needs an internet connection to load its language files.'));};
  document.head.append(script);
 }).catch(error=>{ocrScriptPromise=null;throw error;});
 return ocrScriptPromise;
}
export async function recognizeIntakeImages(images,{signal,onProgress=()=>{},createWorker}={}) {
 if(images.length>INTAKE_MAX_IMAGES)throw new Error('Choose up to three images.');
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const factory=createWorker||(await loadOCRScript()).createWorker;
 let activeIndex=0;
 const worker=await factory(['rus','eng'],1,{workerPath:OCR_RESOURCES.worker,corePath:OCR_RESOURCES.core,logger:event=>onProgress({index:activeIndex,total:images.length,status:event.status,progress:event.progress||0})});
 let terminated=false;
 const stop=()=>{if(!terminated){terminated=true;Promise.resolve(worker.terminate()).catch(()=>{});}};
 signal?.addEventListener('abort',stop,{once:true});
 try{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const output=[];
  for(const [index,image]of images.entries()){
   activeIndex=index;
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   if(image.text){output.push(image);continue;}
   const result=await worker.recognize(image.imageData);
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   output.push({...image,text:String(result.data?.text||'').trim(),confidence:Number(result.data?.confidence)||0});
  }
  return output;
 }finally{signal?.removeEventListener('abort',stop);if(!terminated){terminated=true;await worker.terminate();}}
}

