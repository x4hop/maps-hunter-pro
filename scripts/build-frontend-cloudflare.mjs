import {createHash} from 'node:crypto';
import {cp,copyFile,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {relative,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(new URL('..',import.meta.url).pathname);
const out=resolve(root,'dist/frontend');
const langs=['en','ar','ru','de','es'];
const PUBLIC_ORIGIN='https://mapshunterpro.com';
const GOOGLE_SITE_VERIFICATION='Rwt2LxDLsZnhc4H7unz17utjAmod8mHZ5AqVVtZCUoI';
const CRITICAL_CSS_FILES=['styles.css','manual.css','payment-icon-clean.css','ui-polish.css','layout-polish.css'];

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

async function seoLocales(){
  const source=await readFile(resolve(root,'assets/seo-i18n.js'),'utf8');
  const start=source.indexOf('const SEO=');
  const end=source.indexOf(';\nfor(const [lang,vals]',start);
  if(start<0||end<0)throw new Error('Unable to parse seo-i18n overrides');
  const literal=source.slice(start+'const SEO='.length,end);
  return runInNewContext(`(${literal})`,Object.create(null),{timeout:1000});
}

async function criticalCss(){
  const chunks=await Promise.all(CRITICAL_CSS_FILES.map(file=>readFile(resolve(root,'assets',file),'utf8')));
  return chunks.join('\n\n').replace(/<\/style/gi,'<\\/style');
}

function renderLocalizedHtml(source,lang,dictionary,criticalStyles){
  const dir=lang==='ar'?'rtl':'ltr';
  let html=source.replace('<html lang="en" dir="ltr">',`<html lang="${lang}" dir="${dir}">`);
  html=html.replace(/(<([a-z][a-z0-9-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi,(full,open,tag,key,inner,close)=>{
    const value=dictionary[key];
    if(typeof value!=='string'||/<[a-z][\s\S]*>/i.test(inner))return full;
    return `${open}${escapeHtml(value)}${close}`;
  });
  if(!html.includes('name="google-site-verification"'))html=html.replace('</head>',`<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}" /></head>`);
  if(!html.includes('data-mhp-critical-css'))html=html.replace('</head>',`<style data-mhp-critical-css>\n${criticalStyles}\n</style></head>`);
  if(!html.includes('/assets/payment-language-fix.js'))html=html.replace('</body>','<script src="/assets/payment-language-fix.js" defer></script></body>');
  return html;
}

const crcTable=(()=>{
  const table=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
    table[n]=c>>>0;
  }
  return table;
})();

function crc32(data){
  let c=0xffffffff;
  for(const b of data)c=crcTable[(c^b)&0xff]^(c>>>8);
  return (c^0xffffffff)>>>0;
}

function zipDateTime(){
  const year=2026,month=9,day=18,hour=0,minute=0,second=0;
  return {time:(hour<<11)|(minute<<5)|(second>>1),date:((year-1980)<<9)|(month<<5)|day};
}

function createZip(entries){
  const localParts=[];
  const centralParts=[];
  let offset=0;
  const dt=zipDateTime();
  for(const entry of entries){
    const name=Buffer.from(entry.name.replace(/\\/g,'/'),'utf8');
    const data=Buffer.from(entry.data);
    const crc=crc32(data);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(20,4);
    local.writeUInt16LE(0x0800,6);
    local.writeUInt16LE(0,8);
    local.writeUInt16LE(dt.time,10);
    local.writeUInt16LE(dt.date,12);
    local.writeUInt32LE(crc,14);
    local.writeUInt32LE(data.length,18);
    local.writeUInt32LE(data.length,22);
    local.writeUInt16LE(name.length,26);
    local.writeUInt16LE(0,28);
    localParts.push(local,name,data);

    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0);
    central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6);
    central.writeUInt16LE(0x0800,8);
    central.writeUInt16LE(0,10);
    central.writeUInt16LE(dt.time,12);
    central.writeUInt16LE(dt.date,14);
    central.writeUInt32LE(crc,16);
    central.writeUInt32LE(data.length,20);
    central.writeUInt32LE(data.length,24);
    central.writeUInt16LE(name.length,28);
    central.writeUInt16LE(0,30);
    central.writeUInt16LE(0,32);
    central.writeUInt16LE(0,34);
    central.writeUInt16LE(0,36);
    central.writeUInt32LE(0,38);
    central.writeUInt32LE(offset,42);
    centralParts.push(central,name);
    offset+=local.length+name.length+data.length;
  }
  const centralDirectory=Buffer.concat(centralParts);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(0,4);
  end.writeUInt16LE(0,6);
  end.writeUInt16LE(entries.length,8);
  end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(centralDirectory.length,12);
  end.writeUInt32LE(offset,16);
  end.writeUInt16LE(0,20);
  return Buffer.concat([...localParts,centralDirectory,end]);
}

async function walkFiles(dir){
  const files=[];
  for(const item of await readdir(dir,{withFileTypes:true})){
    const full=resolve(dir,item.name);
    if(item.isDirectory())files.push(...await walkFiles(full));
    else if(item.isFile())files.push(full);
  }
  return files;
}

async function buildExtensionRelease(){
  const extensionDir=resolve(root,'extension');
  const manifest=JSON.parse(await readFile(resolve(extensionDir,'manifest.json'),'utf8'));
  const files=await walkFiles(extensionDir);
  const entries=[];
  for(const file of files){
    entries.push({name:relative(extensionDir,file).replace(/\\/g,'/'),data:await readFile(file)});
  }
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  const zip=createZip(entries);
  const sha256=createHash('sha256').update(zip).digest('hex');
  const downloadsDir=resolve(out,'downloads');
  await mkdir(downloadsDir,{recursive:true});
  const primaryName=`Maps-Hunter-Pro-v${manifest.version}-EMAIL-FIRST-FINAL.zip`;
  const canonicalName=`maps-hunter-pro-extension-${manifest.version}.zip`;
  await writeFile(resolve(downloadsDir,primaryName),zip);
  await writeFile(resolve(downloadsDir,canonicalName),zip);
  await writeFile(resolve(downloadsDir,`${canonicalName}.sha256`),`${sha256}  ${canonicalName}\n`,'utf8');
  const release={
    version:manifest.version,
    download_url:`${PUBLIC_ORIGIN}/downloads/${primaryName}`,
    canonical_download_url:`${PUBLIC_ORIGIN}/downloads/${canonicalName}`,
    sha256
  };
  await writeFile(resolve(out,'release.json'),JSON.stringify(release,null,2)+'\n','utf8');
  return {version:manifest.version,primaryName,canonicalName,sha256,files:entries.length,size:zip.length};
}

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const file of ['index.html','privacy.html','terms.html']){
  await copyFile(resolve(root,file),resolve(out,file));
}
await cp(resolve(root,'assets'),resolve(out,'assets'),{recursive:true});
await cp(resolve(root,'admin'),resolve(out,'admin'),{recursive:true});
await cp(resolve(root,'blog'),resolve(out,'blog'),{recursive:true});

const source=await readFile(resolve(root,'index.html'),'utf8');
const overrides=await manualLocales();
const seoOverrides=await seoLocales();
const criticalStyles=await criticalCss();
for(const lang of langs){
  const dictionary={...(await baseLocale(lang)),...(overrides[lang]||{}),...(seoOverrides[lang]||{})};
  const localized=renderLocalizedHtml(source,lang,dictionary,criticalStyles);
  const dir=resolve(out,lang);
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,'index.html'),localized,'utf8');
}

const release=await buildExtensionRelease();
console.log(`Cloudflare production assets prepared at ${out} with localized HTML, blog, admin console and extension ${release.version} (${release.files} files, ${release.size} bytes, sha256 ${release.sha256})`);
