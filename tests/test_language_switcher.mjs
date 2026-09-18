import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('assets/i18n.js','utf8');

assert.match(source,/if\(menu\.parentElement!==document\.body\)document\.body\.appendChild\(menu\)/,
  'Language menu must escape the sticky-header stacking context');
assert.match(source,/querySelectorAll\('#languageMenu \[data-lang\]'\)\.forEach/,
  'Each language option must receive a direct click handler');
assert.match(source,/location\.assign\(next\)/,
  'Language option must navigate to the localized route');

const context=vm.createContext({
  window:{addEventListener(){},dispatchEvent(){}},
  document:{addEventListener(){}},
  localStorage:{setItem(){}},
  CustomEvent:function(){},
  URL,
  location:{
    href:'https://mapshunterpro.com/en?utm_source=test#pricing',
    pathname:'/en',
    search:'?utm_source=test',
    hash:'#pricing'
  },
  requestAnimationFrame(fn){fn()},
  console
});

vm.runInContext(source,context);

assert.equal(
  vm.runInContext("languageTargetUrl('ar')",context),
  '/ar?utm_source=test#pricing',
  'English must be able to navigate to Arabic while preserving query/hash'
);
assert.equal(
  vm.runInContext("languageTargetUrl('de')",context),
  '/de?utm_source=test#pricing',
  'English must be able to navigate to German'
);
assert.equal(
  vm.runInContext("languageTargetUrl('en')",context),
  '/en?utm_source=test#pricing',
  'English self-route must remain valid'
);
assert.equal(
  vm.runInContext("languageTargetUrl('xx')",context),
  null,
  'Unsupported language must not generate a route'
);

context.location.href='https://mapshunterpro.com/ar?ref=menu#top';
context.location.pathname='/ar';
context.location.search='?ref=menu';
context.location.hash='#top';
assert.equal(
  vm.runInContext("languageTargetUrl('en')",context),
  '/en?ref=menu#top',
  'Arabic must continue to navigate back to English'
);

console.log('Language switcher route and click-binding regression checks passed');