import {createHash} from 'node:crypto';
import {cp,copyFile,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {relative,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(new URL('..',import.meta.url).pathname);
const out=resolve(root,'dist/frontend');
const langs=['en','ar','ru','de','es'];
const routes=['en','us','uk','ca','au','ar','ru','de','es'];
const ROUTE_LANG={us:'en',uk:'en',ca:'en',au:'en'};
const HTML_LANG={us:'en-US',uk:'en-GB',ca:'en-CA',au:'en-AU'};
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

async function regionalLocales(){
  const source=await readFile(resolve(root,'assets/region-i18n.js'),'utf8');
  const start=source.indexOf('const REGIONAL=');
  const end=source.indexOf(';\nwindow.MHP_REGIONAL_LOCALES',start);
  if(start<0||end<0)throw new Error('Unable to parse regional-i18n overrides');
  const literal=source.slice(start+'const REGIONAL='.length,end);
  return runInNewContext(`(${literal})`,Object.create(null),{timeout:1000});
}

const REGION_SECTIONS={
  us:`<section id="regional-market"><div class="wrap"><div class="section-title"><h2>Google Maps Lead Research for the United States</h2><p>Build location-specific US prospect lists without creating one giant, unfocused database.</p></div><div class="features"><div class="card"><h3>Search by city, metro and ZIP context</h3><p>Combine a business category with a city, metro area, neighbourhood or ZIP-code context. Examples include roofers in Dallas, dentists in Chicago, HVAC companies in Phoenix and marketing agencies in Austin.</p></div><div class="card"><h3>Keep US contact data structured</h3><p>Use business name, category, address, phone, website, rating, review count, Google Maps URL and available public website contact fields to qualify companies before outreach.</p></div><div class="card"><h3>Export for real sales workflows</h3><p>Move reviewed records into Excel, CSV or JSON for filtering, account research and CRM preparation. Maps Hunter Pro is designed for focused B2B prospecting rather than anonymous bulk lists.</p></div></div></div></section>`,
  uk:`<section id="regional-market"><div class="wrap"><div class="section-title"><h2>Google Maps Lead Research for the United Kingdom</h2><p>Create organised UK business lists using the locations and categories your team actually sells into.</p></div><div class="features"><div class="card"><h3>Search by city, town and postcode context</h3><p>Research plumbers in Manchester, estate agents in Leeds, dental practices in Birmingham or agencies in London. Use the geographic wording customers and sales teams use in the UK.</p></div><div class="card"><h3>Review the useful business fields</h3><p>Compare names, categories, addresses, phone numbers, websites, ratings, review counts and available public website contact details before deciding which businesses belong in a prospect list.</p></div><div class="card"><h3>Export an organised shortlist</h3><p>Export the records you want to keep to Excel, CSV or JSON so the next step is qualification and outreach rather than cleaning a mixed global dataset.</p></div></div></div></section>`,
  ca:`<section id="regional-market"><div class="wrap"><div class="section-title"><h2>Google Maps Lead Research for Canada</h2><p>Research Canadian businesses by market, province and local category, then turn the results into a structured B2B list.</p></div><div class="features"><div class="card"><h3>Work market by market</h3><p>Examples include dentists in Toronto, contractors in Calgary, accountants in Vancouver and local agencies in Ottawa. Province, city and postal-code context can keep searches relevant.</p></div><div class="card"><h3>Combine Maps and public website data</h3><p>Use Maps business fields together with available public email and social links discovered from the official website when one is provided by the listing.</p></div><div class="card"><h3>Prepare data for qualification</h3><p>Export to Excel, CSV or JSON, filter by category or location, and review the companies before adding them to a sales or agency workflow.</p></div></div></div></section>`,
  au:`<section id="regional-market"><div class="wrap"><div class="section-title"><h2>Google Maps Lead Research for Australia</h2><p>Build Australian prospect lists around the states, cities, suburbs and business categories that matter to your campaign.</p></div><div class="features"><div class="card"><h3>Use local search geography</h3><p>Research electricians in Sydney, clinics in Melbourne, builders in Brisbane or agencies in Perth. State, suburb and postcode context can help keep each research batch focused.</p></div><div class="card"><h3>Review business and contact signals</h3><p>Collect structured Maps fields and, when available, public email and social links from the official business website before deciding which records deserve follow-up.</p></div><div class="card"><h3>Export clean campaign inputs</h3><p>Move qualified results to Excel, CSV or JSON for filtering, account research and downstream sales work without mixing unrelated countries into the same list.</p></div></div></div></section>`,
  de:`<section id="regional-market"><div class="wrap"><div class="section-title"><h2>Google Maps Lead-Recherche für Deutschland</h2><p>Baue fokussierte B2B-Listen für deutsche Städte, Regionen und Branchen auf, ohne globale Datensätze mühsam bereinigen zu müssen.</p></div><div class="features"><div class="card"><h3>Nach Stadt, Region und PLZ-Kontext recherchieren</h3><p>Suche zum Beispiel nach Dachdeckern in München, Steuerberatern in Hamburg, Zahnärzten in Köln oder Agenturen in Berlin. Branche und Standort bleiben bei jeder Recherche klar definiert.</p></div><div class="card"><h3>Firmendaten und öffentliche Kontaktsignale kombinieren</h3><p>Nutze Name, Kategorie, Adresse, Telefonnummer, Website, Bewertung, Rezensionen und Google-Maps-URL. Wenn eine offizielle Website verknüpft ist, kann Maps Hunter Pro dort verfügbare öffentliche E-Mail- und Social-Links entdecken.</p></div><div class="card"><h3>Saubere Listen für Vertrieb und Agenturen exportieren</h3><p>Exportiere geprüfte Ergebnisse nach Excel, CSV oder JSON und filtere sie nach Markt, Kategorie und Kontaktqualität. Für Outreach gelten weiterhin die jeweils anwendbaren Datenschutz- und Marketingregeln.</p></div></div><p style="margin-top:22px"><strong>Mehr auf Deutsch:</strong> <a href="/blog/de/google-maps-scraper-deutschland/">Google Maps Scraper Deutschland Guide</a> · <a href="/blog/de/google-maps-daten-extrahieren/">Google-Maps-Daten extrahieren</a></p></div></section>`,
  es:`<section id="regional-market"><div class="wrap"><div class="section-title"><h2>Investigación de leads de Google Maps para España</h2><p>Crea listas B2B enfocadas por ciudad, provincia y categoría sin mezclar mercados que no pertenecen a tu campaña.</p></div><div class="features"><div class="card"><h3>Busca por ciudad, provincia y código postal</h3><p>Investiga dentistas en Madrid, reformas en Barcelona, inmobiliarias en Valencia o agencias en Sevilla utilizando el contexto local de cada campaña.</p></div><div class="card"><h3>Combina datos de Maps con contactos públicos</h3><p>Revisa nombre, categoría, dirección, teléfono, sitio web, valoración, reseñas y URL de Google Maps. Cuando existe un sitio web oficial, se pueden descubrir correos públicos y enlaces sociales disponibles.</p></div><div class="card"><h3>Exporta listas listas para cualificar</h3><p>Exporta a Excel, CSV o JSON y revisa los negocios antes de incorporarlos a un flujo de ventas, agencia o investigación de mercado.</p></div></div><p style="margin-top:22px"><strong>Recurso en español:</strong> <a href="/blog/es/google-maps-scraper-espana/">Guía de Google Maps Scraper para España</a></p></div></section>`
};

async function criticalCss(){
  const chunks=await Promise.all(CRITICAL_CSS_FILES.map(file=>readFile(resolve(root,'assets',file),'utf8')));
  return chunks.join('\n\n').replace(/<\/style/gi,'<\\/style');
}

function renderLocalizedHtml(source,route,lang,dictionary,criticalStyles){
  const dir=lang==='ar'?'rtl':'ltr';
  const htmlLang=HTML_LANG[route]||lang;
  let html=source.replace('<html lang="en" dir="ltr">',`<html lang="${htmlLang}" dir="${dir}">`);
  html=html.replace(/(<([a-z][a-z0-9-]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi,(full,open,tag,key,inner,close)=>{
    const value=dictionary[key];
    if(typeof value!=='string'||/<[a-z][\s\S]*>/i.test(inner))return full;
    return `${open}${escapeHtml(value)}${close}`;
  });
  if(REGION_SECTIONS[route]&&!html.includes('id="regional-market"'))html=html.replace('<section id="pricing">',REGION_SECTIONS[route]+'<section id="pricing">');
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
const regionalOverrides=await regionalLocales();
const criticalStyles=await criticalCss();
for(const route of routes){
  const lang=ROUTE_LANG[route]||route;
  const dictionary={...(await baseLocale(lang)),...(overrides[lang]||{}),...(seoOverrides[lang]||{}),...(regionalOverrides[route]||{})};
  const localized=renderLocalizedHtml(source,route,lang,dictionary,criticalStyles);
  const dir=resolve(out,route);
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,'index.html'),localized,'utf8');
}

const release=await buildExtensionRelease();
console.log(`Cloudflare production assets prepared at ${out} with localized HTML, blog, admin console and extension ${release.version} (${release.files} files, ${release.size} bytes, sha256 ${release.sha256})`);