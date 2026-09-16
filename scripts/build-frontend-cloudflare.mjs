import {cp,copyFile,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const out=resolve(root,'dist/frontend');

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const file of ['index.html','privacy.html','terms.html']){
  await copyFile(resolve(root,file),resolve(out,file));
}
await cp(resolve(root,'assets'),resolve(out,'assets'),{recursive:true});

console.log(`Cloudflare frontend prepared at ${out}`);
