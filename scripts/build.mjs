import {readFile,writeFile} from 'node:fs/promises';

// Build the interface only. Medical source exports are never build inputs.
const root=new URL('../',import.meta.url);
const names=['core','tracking','i18n','cloud','intake','ocr','intake-ui','app'];
const modules=[];
for(const name of names){
 const source=await readFile(new URL('dist/assets/'+name+'.js',root),'utf8');
 modules.push(source.replace(/^import .*?;\s*$/gm,'').replace(/^export\s+/gm,''));
}
await writeFile(new URL('dist/assets/app.bundle.js',root),"'use strict';\n(() => {\n"+modules.join('\n\n')+'\n})();\n');
console.log('Built the interface. Private records are loaded from R2 after sign-in.');
