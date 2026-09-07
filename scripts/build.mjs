import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const read=p=>readFile(resolve(root,p),'utf8');
const inline=async (html,base='')=>{
  html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,src)=>`@@STYLE:${src}@@`);
  html=html.replace(/<script src="([^"]+)" defer><\/script>/g,(_,src)=>`@@SCRIPT:${src}@@`);
  for(const match of [...html.matchAll(/@@STYLE:([^@]+)@@/g)])html=html.replace(match[0],`<style>${await read(base+match[1].replace(/^\//,''))}</style>`);
  for(const match of [...html.matchAll(/@@SCRIPT:([^@]+)@@/g)])html=html.replace(match[0],`<script>${(await read(base+match[1].replace(/^\//,''))).replace(/<\/script/gi,'<\\/script')}</script>`);
  return html;
};
const landing=await inline(await read('index.html'));
const privacy=await inline(await read('privacy.html'));
const terms=await inline(await read('terms.html'));
let admin=await read('admin/index.html');
admin=admin.replace('<script src="./admin.js"></script>',`<script>${(await read('admin/admin.js')).replace(/<\/script/gi,'<\\/script')}</script>`).replace("window.MHP_API_BASE='https://maps-hunter-pro-api.anas98gha.workers.dev'","window.MHP_API_BASE=''");
await mkdir(resolve(root,'dist'),{recursive:true});
for(const [name,text] of Object.entries({landing,privacy,terms,admin})){
  await writeFile(resolve(root,`dist/${name}.html`),text);
  const gz=gzipSync(text,{level:9}).toString('base64');
  await writeFile(resolve(root,`dist/${name}.b64`),gz);
}
console.log(JSON.stringify({landing:landing.length,privacy:privacy.length,terms:terms.length,admin:admin.length}));
