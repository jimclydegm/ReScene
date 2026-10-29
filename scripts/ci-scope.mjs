import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {requiresCheck} from './vercel-ignore-build.mjs';
let suite=true;
try{const base=process.env.CHANGE_BASE_SHA;if(!base||!/^[a-f0-9]{40}$/i.test(base))throw new Error('Unknown base');const files=execFileSync('git',['diff','--name-only','-z',base,'HEAD'],{encoding:'utf8',timeout:5000}).split('\0').filter(Boolean);suite=requiresCheck(files);}catch{/* Conservative fallback runs the complete suite. */}
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`suite=${suite}\n`);
console.log(suite?'Run consolidated application checks.':'Docs-only change: retain required CI status without reinstall/build.');
