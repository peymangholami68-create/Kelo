/** Same-origin bridge between the Kelo UI and the production Express API. */
(function () {
  const cfg = window.KELO_CONFIG || {};
  const state = { requestedMode: cfg.mode || 'auto', mode: 'local', apiBase: String(cfg.apiBase || '/api').replace(/\/$/, ''), initPromise: null, lastError: null };

  async function parseResponse(res) {
    let body = null; try { body = await res.json(); } catch (_) {}
    if (!res.ok) { const err = new Error(body?.error || `HTTP ${res.status}`); err.status=res.status; err.body=body; throw err; }
    return body || {};
  }
  async function request(path, options) {
    const opts=Object.assign({credentials:'same-origin',headers:{}},options||{});
    opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
    return parseResponse(await fetch(state.apiBase+path,opts));
  }
  async function init(){
    if(state.initPromise)return state.initPromise;
    state.initPromise=(async()=>{
      if(state.requestedMode==='local'){state.mode='local';return state.mode;}
      try{const res=await fetch(state.apiBase+'/health',{credentials:'same-origin',cache:'no-store'}); if(res.status===404){state.mode='local';return state.mode;} if(res.ok){state.mode='server';return state.mode;} state.mode='server-error';state.lastError=new Error(`KELO API health check failed (${res.status})`);return state.mode;}
      catch(e){if(state.requestedMode==='server'){state.mode='server-error';state.lastError=e;return state.mode;}state.mode='local';state.lastError=e;return state.mode;}
    })(); return state.initPromise;
  }
  async function mutate(path, method, payload){ await init(); if(state.mode!=='server')throw new Error('KELO server API is not active.'); const o={method}; if(method!=='GET'&&method!=='HEAD') o.body=JSON.stringify(payload||{}); return request(path,o); }

  window.KeloBackend={
    async init(){return init();}, isServerMode(){return state.mode==='server';}, isServerError(){return state.mode==='server-error';}, getMode(){return state.mode;}, getApiBase(){return state.apiBase;},
    async login(phone,nationalId,authMode){await init();return request('/auth/login',{method:'POST',body:JSON.stringify({phone,nationalId,authMode:authMode||'public'})});},
    async me(){await init();if(state.mode!=='server')return null;try{return await request('/auth/me')}catch(e){if(e.status===401)return null;throw e;}},
    async logout(){await init();if(state.mode!=='server')return {ok:true,local:true};return request('/auth/logout',{method:'POST',body:'{}'});},
    async updateProfile(payload){return mutate('/profile','PUT',payload);},
    async bootstrap(){return mutate('/bootstrap','GET',{});},
    async createRequest(service,data,requestKind){return mutate('/requests','POST',{service,data,requestKind:requestKind||'need'});},
    async updateRequest(id,service,data){return mutate('/requests/'+encodeURIComponent(id),'PATCH',{service,data});},
    async deleteRequest(id){return mutate('/requests/'+encodeURIComponent(id),'DELETE',{});},
    async createListing(service,data){return mutate('/listings','POST',{service,data});},
    async updateListing(id,service,data){return mutate('/listings/'+encodeURIComponent(id),'PATCH',{service,data});},
    async deleteListing(id){return mutate('/listings/'+encodeURIComponent(id),'DELETE',{});},
    async getProviders(requestId){await init();return request('/requests/'+encodeURIComponent(requestId)+'/providers',{method:'GET'});},
    async getTopProviders(opts){await init(); opts=opts||{}; var q='?minReviews='+encodeURIComponent(opts.minReviews||1)+'&limit='+encodeURIComponent(opts.limit||12); if(opts.service) q+='&service='+encodeURIComponent(opts.service); return request('/providers/top'+q,{method:'GET'});},
    async sendRecipient(requestId,payload){return mutate('/requests/'+encodeURIComponent(requestId)+'/recipients','POST',payload);},
    async acceptRecipient(id){return mutate('/request-recipients/'+encodeURIComponent(id)+'/accept','POST',{});},
    async createReview(payload){return mutate('/reviews','POST',payload);},
    async reportProblem(payload){return mutate('/deal-problems','POST',payload||{});},
    async rejectRecipient(id){return mutate('/request-recipients/'+encodeURIComponent(id)+'/reject','POST',{});},
    async cancelRecipient(id){return mutate('/request-recipients/'+encodeURIComponent(id),'DELETE',{});},
    async payDeal(id){return mutate('/deals/'+encodeURIComponent(id)+'/pay','POST',{});},
    async cancelDeal(id){return mutate('/deals/'+encodeURIComponent(id)+'/cancel','POST',{});},
    async completeDeal(id){return mutate('/deals/'+encodeURIComponent(id)+'/complete','POST',{});},
    async markNotificationsRead(ids){return mutate('/notifications/read','POST',{ids:ids||null});},
    async updateDealLocation(dealId,payload){return mutate('/deals/'+encodeURIComponent(dealId)+'/location','PUT',payload||{});},
    async getDealLocation(dealId){await init(); const body=await request('/deals/'+encodeURIComponent(dealId)+'/location',{method:'GET'}); return body && body.location ? body.location : null;}
  };
})();
