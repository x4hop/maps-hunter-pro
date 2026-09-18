import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('index.html','utf8');
const sprite=readFileSync('assets/mhp-icons.svg','utf8');
const styles=readFileSync('assets/styles.css','utf8');
const polish=readFileSync('assets/ui-polish.css','utf8');

const forbidden=['✓','⌕','⌖','☎','↗','★','∞','↔'];
for(const glyph of forbidden){
  assert.ok(!html.includes(glyph),`Homepage must not use text/emoji icon glyph ${glyph}`);
}
assert.ok(!styles.includes('content:"✓"'),'Pricing list must use an SVG check icon, not a text glyph');

const requiredIds=['check-circle','search','map-search','extract','review','export','business','phone','link','star','mail','social','smart-extract','global-phone','spreadsheet','infinity','gauge','key','agency','sales','local-seo','compare'];
for(const id of requiredIds){
  assert.match(sprite,new RegExp(`id="${id}"`),`SVG sprite must include ${id}`);
  assert.ok(html.includes(`/assets/mhp-icons.svg#${id}`),`Homepage must use the ${id} SVG icon`);
}

const cardIcons=[...html.matchAll(/<div class="icon"[^>]*>([\s\S]*?)<\/div>/g)];
assert.equal(cardIcons.length,20,'All 20 homepage card/workflow icons must use the brand icon system');
for(const [,inner] of cardIcons){
  assert.match(inner,/<svg class="mhp-icon-svg"/,'Card icon containers must contain SVG icons');
  assert.match(inner,/<use href="\/assets\/mhp-icons\.svg#/,'Card icons must reference the shared SVG sprite');
}

for(const lang of ['en','ar','ru','de','es']){
  const locale=readFileSync(`assets/locales/${lang}.js`,'utf8');
  assert.ok(!locale.includes('"trust_1":"✓ '),`${lang} trust_1 must not reintroduce a check glyph`);
  assert.ok(!locale.includes('"trust_2":"✓ '),`${lang} trust_2 must not reintroduce a check glyph`);
  assert.ok(!locale.includes('"trust_3":"✓ '),`${lang} trust_3 must not reintroduce a check glyph`);
}

assert.match(polish,/brand SVG icon system/,'Final UI CSS must include the brand SVG icon layer');
console.log('Homepage brand SVG icon regression checks passed');