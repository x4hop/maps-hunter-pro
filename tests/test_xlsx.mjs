import vm from 'node:vm';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const context=vm.createContext({Blob,TextEncoder,Uint8Array,Uint32Array,DataView,setTimeout,URL:{createObjectURL(){},revokeObjectURL(){}},document:{createElement(){return {click(){}}}}});
vm.runInContext(await readFile('extension/xlsx-export.js','utf8'),context);
const blob=vm.runInContext("MHPExport.workbook([{name:'=unsafe',phone:'+218912345678',website:'https://example.com'}])",context);
const bytes=new Uint8Array(await blob.arrayBuffer());assert.equal(String.fromCharCode(...bytes.slice(0,2)),'PK');await writeFile('dist/test.xlsx',bytes);console.log('Real XLSX ZIP generated',bytes.length);
