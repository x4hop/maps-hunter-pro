import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('assets/i18n.js','utf8');
assert.doesNotMatch(source,/document\.body\.appendChild\(menu\)/,'Language menu must stay inside its switcher; reparenting caused RTL regressions');
assert.doesNotMatch(source,/positionLanguageMenu/,'Language switching must not inject viewport-fixed popup positioning');
assert.match(source,/menu\.querySelectorAll\('\[data-lang\]'\)\.forEach/,'Each language option must receive a direct click handler');
assert.match(source,/location\.assign\(next\)/,'Language option must navigate to localized route');

const context=vm.createContext({
  window:{dispatchEvent(){}},
  document:{addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},documentElement:{}},
  localStorage:{setItem(){}},
  CustomEvent:function(){},URL,
  location:{href:'https://mapshunterpro.com/en?utm_source=test#pricing',pathname:'/en',search:'?utm_source=test',hash:'#pricing'},
  console
});
vm.runInContext(source,context);
assert.equal(vm.runInContext("languageTargetUrl('ar')",context),'/ar?utm_source=test#pricing');
assert.equal(vm.runInContext("languageTargetUrl('de')",context),'/de?utm_source=test#pricing');
context.location.href='https://mapshunterpro.com/ar?ref=menu#top';
context.location.pathname='/ar';context.location.search='?ref=menu';context.location.hash='#top';
assert.equal(vm.runInContext("languageTargetUrl('en')",context),'/en?ref=menu#top');
console.log('Language switcher route and RTL-safe structure checks passed');
assert.match(source,/MHP_LANG_ARIA/,'Language switcher must localize its accessible label');
assert.match(source,/meta\[property="og:title"\]/,'Language changes must keep Open Graph metadata synchronized');
assert.match(source,/link\[rel="canonical"\]/,'Language changes must keep canonical URL synchronized');
