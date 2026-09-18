import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync('assets/app.js','utf8');

assert.match(source,/lifetime:\{id:'lifetime',price:100/,'Lifetime fallback price must remain $100');
assert.match(source,/nodeValue=`\$\$\{monthly\.price\} `/,'Monthly dynamic price must keep the dollar sign');
assert.match(source,/nodeValue=`\$\$\{lifetime\.price\} `/,'Lifetime dynamic price must keep the dollar sign');
assert.match(source,/ — \$\$\{p\.price\}/,'Selected-plan label must keep the dollar sign');
assert.match(source,/plan \(\$\$\{p\.price\}\)/,'WhatsApp payment message must keep the dollar sign');
assert.match(source,/legacyCopyText\(text\)/,'Clipboard failures must fall back to legacy browser copy');
assert.match(source,/flashCopyFailure\(btn,targetId\)/,'Copy failure must visibly select the target instead of silently failing');
assert.match(source,/redot:'Paga con tu RedotPay ID\.'/,'Spanish RedotPay helper text must remain localized');

let clipboardCalls=0;
let execCalls=0;
const textarea={value:'',style:{},setAttribute(){},focus(){},select(){},setSelectionRange(){},remove(){}};
const documentStub={
  documentElement:{lang:'en',classList:{add(){}}},
  activeElement:null,
  body:{appendChild(){},prepend(){}},
  createElement(){return textarea},
  execCommand(command){execCalls+=1;return command==='copy'},
  addEventListener(){},
  querySelector(){return null},
  querySelectorAll(){return []},
  getElementById(){return null},
  createRange(){return {selectNodeContents(){}}}
};
const windowStub={MHP_API_BASE:'',isSecureContext:true,addEventListener(){},getSelection(){return {removeAllRanges(){},addRange(){}}}};
const context=vm.createContext({
  window:windowStub,document:documentStub,
  navigator:{clipboard:{writeText:async()=>{clipboardCalls+=1;throw new Error('permission denied')}}},
  console,setTimeout(){return 1},clearTimeout(){},addEventListener(){},innerHeight:900,scrollY:0,
  fetch:async()=>({ok:false,json:async()=>({})})
});
vm.runInContext(source,context);
const result=await vm.runInContext("copyText('752783284')",context);
assert.equal(result,true,'Fallback copy path must report success when execCommand(copy) succeeds');
assert.equal(clipboardCalls,1,'Clipboard API should be attempted first');
assert.equal(execCalls,1,'Legacy copy must run after Clipboard API rejection');

for(const [lang,expected] of Object.entries({en:'Lifetime',ar:'مدى الحياة',de:'Lifetime',es:'De por vida',ru:'Навсегда'})){
  const text=readFileSync(`assets/locales/${lang}.js`,'utf8');
  const m=text.match(/window\.MHP_LOCALES\[[^\]]+\]=(\{.*\});?\s*$/s);
  assert.ok(m,`Unable to parse locale ${lang}`);
  const dict=JSON.parse(m[1]);
  assert.equal(dict.annual_plan,expected,`${lang} pricing label must describe Lifetime`);
}

console.log('Frontend payment copy, currency and Lifetime regression checks passed');
