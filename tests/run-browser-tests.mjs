// Own Vite servers in this process: avoids Windows child-shell teardown hangs.
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
const owned=[]
async function ensure(port,definitions){
  try {const response=await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(800)});if(response.ok)return} catch{}
  const server=await createServer({define:definitions,server:{host:'127.0.0.1',port,strictPort:true}})
  await server.listen();owned.push(server)
}
try{
  const defs=(url,key,captcha)=>({'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(url),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(key),'import.meta.env.VITE_TURNSTILE_SITE_KEY':JSON.stringify(captcha)})
  await ensure(5173,defs('','',''))
  await ensure(5180,defs('https://supabase.example.invalid','sb_publishable_TEST_ONLY_NOT_A_CREDENTIAL','TEST_ONLY_INTERCEPTED_WIDGET'))
  const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,LLAVE_TEST_SERVERS_MANAGED:'1'}})
  const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1))})
  await Promise.all(owned.map(server=>server.close()))
  process.exitCode=exitCode
}catch(error){console.error(error.message);await Promise.allSettled(owned.map(server=>server.close()));process.exitCode=1}
