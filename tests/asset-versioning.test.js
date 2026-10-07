import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const shell=process.platform==='win32'?join(process.env.ProgramFiles,'Git/bin/bash.exe'):'sh';
const script=fileURLToPath(new URL('../docker/version-assets.sh',import.meta.url));

function build(dependency){
 const root=mkdtempSync(join(tmpdir(),'fayitw-assets-'));
 try{
  mkdirSync(join(root,'css'));mkdirSync(join(root,'js'));
  writeFileSync(join(root,'css/farm.css'),'body { margin: 0; }');
  writeFileSync(join(root,'farm.html'),`<link href="css/farm.css"><script src="js/header.js"></script>
<script type="module">import './js/loading.js'; import('./js/farm.js');</script>
<script type="importmap">{"imports":{"three":"./js/vendor/three.js"}}</script>`);
  writeFileSync(join(root,'js/farm.js'),`import { sway } from './crops.js'; import("./loading.js");`);
  writeFileSync(join(root,'js/crops.js'),dependency);
  writeFileSync(join(root,'js/loading.js'),'export const loading = true;');
  writeFileSync(join(root,'js/header.js'),'export const header = true;');
  execFileSync(shell,[script.replaceAll('\\','/'),root.replaceAll('\\','/')]);
  const html=readFileSync(join(root,'farm.html'),'utf8'),js=readFileSync(join(root,'js/farm.js'),'utf8');
  return {html,js,version:html.match(/farm\.js\?v=([a-f0-9]{12})/)[1]};
 }finally{rmSync(root,{recursive:true,force:true});}
}

test('versioned HTML entry points and their imports use the same release URL',()=>{
 const {html,js,version}=build('export const sway = .21;');
 for(const path of ['css/farm.css','js/header.js','./js/loading.js','./js/farm.js']){
  assert.ok(html.includes(`${path}?v=${version}`),path);
 }
 for(const path of ['./crops.js','./loading.js'])assert.ok(js.includes(`${path}?v=${version}`),path);
 assert.ok(html.includes('"three":"./js/vendor/three.js"'),'vendor identity is unchanged');
});

test('a dependency-only change invalidates the otherwise unchanged entry point',()=>{
 const first=build('export const sway = .05;'),second=build('export const sway = .21;');
 assert.notEqual(first.version,second.version);
 assert.equal(first.version,build('export const sway = .05;').version,'identical builds have stable URLs');
});
