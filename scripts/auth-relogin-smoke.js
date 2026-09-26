/*
 * Auth regression smoke test.
 * Required env: BASE_URL, USER_PHONE, USER_NATIONAL_ID
 * The account may already exist; this test verifies login -> logout -> login.
 */
const BASE_URL = String(process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/,'');
for (const k of ['USER_PHONE','USER_NATIONAL_ID']) {
  if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(2); }
}

async function call(path, options={}, jar={}) {
  const headers={...(options.headers||{})};
  if (jar.cookie) headers.cookie=jar.cookie;
  if (options.body && !headers['content-type']) headers['content-type']='application/json';
  const r=await fetch(BASE_URL+path,{...options,headers});
  const set=r.headers.get('set-cookie');
  if(set) jar.cookie=set.split(';')[0];
  let body={}; try{body=await r.json();}catch(_){ }
  return {status:r.status,body};
}

async function main(){
  const jar={};
  const first=await call('/api/auth/login',{method:'POST',body:JSON.stringify({phone:process.env.USER_PHONE,nationalId:process.env.USER_NATIONAL_ID,authMode:'public'})},jar);
  if(first.status!==200) throw new Error(`first login -> ${first.status}: ${first.body.error||''}`);
  if(!first.body.user?.id) throw new Error('first login returned no user');

  const me=await call('/api/auth/me',{},jar);
  if(me.status!==200 || me.body.id!==first.body.user.id) throw new Error('session after first login is invalid');

  const logout=await call('/api/auth/logout',{method:'POST',body:'{}'},jar);
  if(logout.status!==200) throw new Error(`logout -> ${logout.status}: ${logout.body.error||''}`);

  const afterLogout=await call('/api/auth/me',{},jar);
  if(afterLogout.status!==401) throw new Error(`session survived logout: ${afterLogout.status}`);

  const second=await call('/api/auth/login',{method:'POST',body:JSON.stringify({phone:process.env.USER_PHONE,nationalId:process.env.USER_NATIONAL_ID,authMode:'public'})},jar);
  if(second.status!==200) throw new Error(`second login -> ${second.status}: ${second.body.error||''}`);
  if(second.body.user?.id!==first.body.user.id) throw new Error('second login resolved to a different user');

  console.log('PASS: login -> logout -> login', {userId:first.body.user.id});
}
main().catch(e=>{console.error('FAIL:',e.message);process.exit(1)});
