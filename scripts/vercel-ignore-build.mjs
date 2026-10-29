// Vercel: exit 0 skips, exit 1 builds. Unknown Git state always builds.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function requiresCheck(files){return files.length===0||files.some(file=>!(file.startsWith("docs/")||/\.md$/i.test(file)));}
export function requiresBuild(files){return files.length===0||files.some(file=>file==='scripts/vercel-ignore-build.mjs'||!(/^(docs\/|tests\/|\.github\/|scripts\/)/.test(file)||/\.md$/i.test(file)));}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  const previous=process.env.VERCEL_GIT_PREVIOUS_SHA;
  if(!previous||!/^[a-f0-9]{40}$/i.test(previous))throw new Error('No previous successful deployment');
  const base=previous;
  const files=execFileSync('git',['diff','--name-only','-z',base,'HEAD'],{encoding:'utf8',timeout:5000}).split('\0').filter(Boolean);
  const build=requiresBuild(files);console.log(build?'Application/configuration changed: build.':'Only docs/tests/tooling changed: skip deployment.');process.exit(build?1:0);
 }catch{console.log('Git comparison unavailable: build.');process.exit(1);}
}
