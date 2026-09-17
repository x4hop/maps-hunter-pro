import {cp,copyFile,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(new URL('..',import.meta.url).pathname);
const out=resolve(root,'dist/frontend');
const langs=['en','ar','ru','de','es'];

const escapeHtml=value=>String(value)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;');

async function baseLocale(lang){
  const source=await readFile(resolve(root,`assets/locales/${lang}.js`),'utf8');
  const match=source.match(/window\.MHP_LOCALES\[["']([^"']+)["']\]\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if(!match||match[1]!==lang)throw new Error(`Unable to parse locale: ${lang}`);
  return JSON.parse(match[2]);
}

async function manualLocales(){
  const source=await readFile(resolve(root,'assets/manual-i18n.js'),'utf8');
  const start=source.indexOf('const U=');
  const end=source.indexOf(';\nfor(const [lang,vals]',start);
  if(start<0||end<0)throw new Error('Unable to parse manual-i18n overrides');
  const literal=source.slice(start+'const U='.length,end);
  return runInNewContext(`(${literal})`,Object.create(null),{timeout:1000});
}

function renderLocalizedHtml(source,lang,dictionary){
  const dir=lang==='ar'?'rtl':'ltr';
  let html=source.replace('<html lang="en" dir="ltr">',`<html lang="${lang}" dir="${dir}">`);
  html=html.replace(/(<([a-z][a-z0-9-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi,(full,open,tag,key,inner,close)=>{
    const value=dictionary[key];
    if(typeof value!=='string'||/<[a-z][\s\S]*>/i.test(inner))return full;
    return `${open}${escapeHtml(value)}${close}`;
  });
  return html;
}

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const file of ['index.html','privacy.html','terms.html']){
  await copyFile(resolve(root,file),resolve(out,file));
}
await cp(resolve(root,'assets'),resolve(out,'assets'),{recursive:true});
await cp(resolve(root,'admin'),resolve(out,'admin'),{recursive:true});

const source=await readFile(resolve(root,'index.html'),'utf8');
const overrides=await manualLocales();
for(const lang of langs){
  const dictionary={...(await baseLocale(lang)),...(overrides[lang]||{})};
  const localized=renderLocalizedHtml(source,lang,dictionary);
  const dir=resolve(out,lang);
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,'index.html'),localized,'utf8');
}

console.log(`Cloudflare production assets prepared at ${out} with localized HTML and admin console`);
