/*
 * Production smoke test for the Marketplace API.
 * Required env: BASE_URL, USER_A_PHONE, USER_A_NATIONAL_ID, USER_B_PHONE, USER_B_NATIONAL_ID
 * The users may be new; /api/auth/login creates public users when needed.
 */
const BASE_URL = String(process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/,'');
const required=['USER_A_PHONE','USER_A_NATIONAL_ID','USER_B_PHONE','USER_B_NATIONAL_ID'];
for(const k of required) if(!process.env[k]) { console.error(`Missing ${k}`); process.exit(2); }

async function call(path, options={}, jar={}) {
  const headers={...(options.headers||{})};
  if(jar.cookie) headers.cookie=jar.cookie;
  if(options.body && !headers['content-type']) headers['content-type']='application/json';
  const r=await fetch(BASE_URL+path,{...options,headers});
  const set=r.headers.get('set-cookie');
  if(set) jar.cookie=set.split(';')[0];
  let body={}; try{body=await r.json();}catch(_){ }
  if(!r.ok) throw new Error(`${options.method||'GET'} ${path} -> ${r.status}: ${body.error||'unknown error'}`);
  return body;
}
async function login(phone,nationalId){const jar={};const x=await call('/api/auth/login',{method:'POST',body:JSON.stringify({phone,nationalId,authMode:'public'})},jar);return {jar,user:x.user};}
async function main(){
  const health=await call('/api/health'); if(!health.ok) throw new Error('API health failed');
  const a=await login(process.env.USER_A_PHONE,process.env.USER_A_NATIONAL_ID);
  const b=await login(process.env.USER_B_PHONE,process.env.USER_B_NATIONAL_ID);
  await call('/api/auth/me',{method:'GET'},a.jar); await call('/api/auth/me',{method:'GET'},b.jar);
  const services=await call('/api/services'); const service=services.services.find(x=>x.slug==='tractor')||services.services[0]; if(!service)throw new Error('No service types seeded');
  const listing=await call('/api/listings',{method:'POST',body:JSON.stringify({service:service.slug,data:{machineType:'Smoke Test Tractor',price:1000000,priceUnit:'تومان / هکتار',activityArea:[],dateStart:'2026-09-18',dateEnd:'2026-12-31',note:'smoke-test'}})},b.jar);
  const request=await call('/api/requests',{method:'POST',body:JSON.stringify({service:service.slug,data:{area:2,dateStart:'2026-10-01',dateEnd:'2026-10-02',note:'smoke-test'}})},a.jar);
  const providers=await call(`/api/requests/${request.id||request.data.requests[0]?.id}/providers`,{method:'GET'},a.jar);
  const rid=request.id||request.data.requests[0]?.id; const candidate=providers.providers.find(x=>x.providerId===b.user.id && x.listingId===listing.id);
  if(!candidate) throw new Error('Provider matching did not return Browser B listing');
  await call(`/api/requests/${rid}/recipients`,{method:'POST',body:JSON.stringify({providerId:b.user.id,listingId:listing.id,machineId:null})},a.jar);
  const bs=await call('/api/bootstrap',{method:'GET'},b.jar); const rec=bs.data.requestRecipients.find(x=>x.requestId===rid && x.providerId===b.user.id && x.status==='pending');
  if(!rec) throw new Error('Browser B did not receive pending recipient');
  const accepted=await call(`/api/request-recipients/${rec.id}/accept`,{method:'POST',body:'{}'},b.jar);
  if(!accepted.dealId||!accepted.bookingId)throw new Error('Atomic accept did not create booking/deal');
  const a2=await call('/api/bootstrap',{method:'GET'},a.jar); const deal=a2.data.deals.find(x=>x.id===accepted.dealId); if(!deal||deal.status!=='agreed')throw new Error('Browser A did not see agreed deal');
  console.log('PASS: two-browser marketplace flow', {requestId:rid,listingId:listing.id,recipientId:rec.id,bookingId:accepted.bookingId,dealId:accepted.dealId});
}
main().catch(e=>{console.error('FAIL:',e.message);process.exit(1)});
