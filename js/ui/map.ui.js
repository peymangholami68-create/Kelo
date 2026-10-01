/**
 * KELO — Map / geo / offers map UI (Phase 10b)
 */
(function (global) {
  'use strict';

  function qdb() {
    var Q = global.KeloService && global.KeloService.query;
    if (Q) {
      return {
        requests: Q.requests(),
        deals: Q.deals(),
        requestRecipients: Q.recipients(),
        machines: Q.machines(),
        listings: Q.listings()
      };
    }
    return global.db || { requests: [], deals: [], requestRecipients: [], machines: [], listings: [] };
  }


  function nearestCityFromCoords(lat, lng, maxDistKm){
      if(lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
      const limit = (maxDistKm == null || maxDistKm === undefined) ? KELO_CITY_MAX_DIST_KM : maxDistKm;
      let best = null, bestDist = Infinity;
      for(const [name, coords] of Object.entries(KELO_CITY_COORDS)){
          const d = geoDistanceKm([Number(lat), Number(lng)], coords);
          if(d < bestDist){ bestDist = d; best = name; }
      }
      if(!best) return '';
      if(limit > 0 && bestDist > limit) return '';
      return best;
  }

  global.nearestCityFromCoords = nearestCityFromCoords;

  function provinceFromCity(city){
      if(!city) return '';
      for(const [prov, cities] of Object.entries(KELO_GEOGRAPHY)){ if(cities.includes(city)) return prov; }
      return '';
  }

  global.provinceFromCity = provinceFromCity;

  function coordForCity(city){
      if(city && KELO_CITY_COORDS[city]) return KELO_CITY_COORDS[city];
      return null;
  }

  global.coordForCity = coordForCity;

  function requestCityName(r){
      const loc = r?.data?.serviceLocation;
      if(loc){
          if(typeof loc.label === 'string' && loc.label.trim()) return loc.label.trim();
          if(typeof loc.city === 'string' && loc.city.trim()) return loc.city.trim();
          if(typeof loc.lat === 'number' && typeof loc.lng === 'number'){
              const city = nearestCityFromCoords(loc.lat, loc.lng);
              if(city) return city;
              return 'موقعیت روی نقشه';
          }
      }
      if(r?.data?.activityArea && Array.isArray(r.data.activityArea) && r.data.activityArea.length){
          return formatActivityArea(r.data.activityArea);
      }
      return r?.data?.city || r?.data?.province || '—';
  }

  global.requestCityName = requestCityName;

  function createKeloMap(el, options={}, center=null, zoom=null){
      if(!el || typeof L === 'undefined') return null;

      // Keep the existing map callers/options intact. Use the official OSM
      // raster tiles when the app is hosted normally, but provide a safe raster
      // fallback for local file:// testing and for environments that block the
      // OSM tile request before the page can render. Attribution stays visible.
      const opts = Object.assign({}, options || {}, { attributionControl: true });
      if(center){ opts.center = center; }
      if(zoom !== null && zoom !== undefined){ opts.zoom = zoom; }

      const map = L.map(el, opts);
      const osmUrl='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      const cartoUrl='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      const osmAttribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
      const cartoAttribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

      let layer;
      let fallbackStarted=false;
      let errorWindowStart=0;
      let errorCount=0;

      const addCartoFallback=function(){
          if(fallbackStarted) return;
          fallbackStarted=true;
          try{ if(layer) map.removeLayer(layer); }catch(e){}
          layer=L.tileLayer(cartoUrl,{
              maxZoom:19,
              subdomains:'abcd',
              detectRetina:true,
              attribution:cartoAttribution
          }).addTo(map);
      };

      const isLocalFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
      if(isLocalFile){
          addCartoFallback();
      }else{
          layer=L.tileLayer(osmUrl,{
              maxZoom:19,
              maxNativeZoom:19,
              detectRetina:true,
              attribution:osmAttribution,
              referrerPolicy:'strict-origin-when-cross-origin'
          }).addTo(map);
          layer.on('tileerror',function(){
              if(fallbackStarted) return;
              const now=Date.now();
              if(!errorWindowStart || now-errorWindowStart>2500){ errorWindowStart=now; errorCount=0; }
              errorCount++;
              if(errorCount>=3) addCartoFallback();
          });
      }
      return map;
  }

  global.createKeloMap = createKeloMap;


  function ensureKeloMapView(map, center, zoom){
      if(!map || !center) return;
      if(typeof map.setView === 'function') map.setView(center, zoom ?? map.getZoom?.() ?? 13);
  }

  global.ensureKeloMapView = ensureKeloMapView;

  function initializeKeloMap(){
      const el=document.getElementById('keloMap'); if(!el) return;
      if(typeof L==='undefined'){ el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#c0392b;font-weight:700;padding:20px;text-align:center">خطا در بارگذاری نقشه</div>'; return; }
      if(keloLocationWatch!==null && navigator.geolocation){ try{navigator.geolocation.clearWatch(keloLocationWatch);}catch(e){} }
      keloLocationWatch=null; keloUserMarker=null; keloAccuracy=null; keloPickMarker=null; window._keloUserCentered=false;
      if(keloMap){keloMap.remove();keloMap=null;}
      keloMap=createKeloMap(el,{zoomControl:true},[32.4279,53.6880],5);
      if(!keloMap) return;
      if(mapContext?.target?.lat)keloMap.setView([mapContext.target.lat,mapContext.target.lng],12);
      if(wizard.mapPickMode)keloMap.on('click',e=>useMapLocation(e.latlng.lat,e.latlng.lng));
      renderMapContextMarkers();
      if(!mapContext?.target?.lat && navigator.geolocation){
          navigator.geolocation.getCurrentPosition(function(pos){
              const lat=Number(pos.coords.latitude), lng=Number(pos.coords.longitude);
              if(!Number.isFinite(lat)||!Number.isFinite(lng)||!keloMap) return;
              if(keloUserMarker){try{keloUserMarker.remove();}catch(e){}}
              keloUserMarker=L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:3,fillColor:'#4A9DB8',fillOpacity:1}).addTo(keloMap)
                  .bindPopup('<div class="map-card-popup"><strong>📍 موقعیت شما</strong></div>');
              keloMap.setView([lat,lng],14,{animate:true});
              window._keloUserCentered=true;
          },function(err){ console.warn('Geolocation unavailable',err); },{enableHighAccuracy:true,timeout:8000,maximumAge:60000});
      }
      requestAnimationFrame(()=>{ try{keloMap.invalidateSize(true);}catch(e){} });
      setTimeout(()=>{ try{keloMap.invalidateSize(true);}catch(e){} },250);
  }

  global.initializeKeloMap = initializeKeloMap;

  function renderMapContextMarkers(){
      if(!keloMap)return;
      if(mapContext?.target?.lat)L.marker([mapContext.target.lat,mapContext.target.lng]).addTo(keloMap).bindPopup('<div class="map-card-popup"><strong>📍 محل خدمت</strong></div>').openPopup();
      if(mapContext?.type==='receive'){ qdb().machines.filter(m=>m.services&&m.services[mapContext.service]!==undefined).forEach((m)=>{const pos=coordForCity(m.location);L.marker(pos).addTo(keloMap).bindPopup('<div class="map-card-popup"><strong>🚜 '+escapeHtml(m.owner)+'</strong></div>');}); }
      else if(mapContext?.type==='provide'){ qdb().requests.filter(r=>r.status==='pending'&&r.service===mapContext.service&&r.userId!==currentUser.id&&requestMatchesActivityArea(r,mapContext.activityArea||[])).forEach(r=>{let pos=r.data?.serviceLocation?.lat?[r.data.serviceLocation.lat,r.data.serviceLocation.lng]:coordForCity(r.data?.city||'ساری');L.circleMarker(pos,{radius:8,color:'#fff',weight:3,fillColor:'#d7aa43',fillOpacity:1}).addTo(keloMap).bindPopup('<div class="map-card-popup"><strong>👨‍🌾 '+escapeHtml(serviceName(r.service))+'</strong></div>');}); }
  }

  global.renderMapContextMarkers = renderMapContextMarkers;

  function disposeOffersMap(){
      window._keloOffersMapToken = (window._keloOffersMapToken || 0) + 1;
      if(window._keloOffersMap){ try{ window._keloOffersMap.remove(); }catch(e){} window._keloOffersMap = null; }
      window._keloOffersMarkers = {};
  }

  global.disposeOffersMap = disposeOffersMap;

  function goBackFromOffersMap(){
      disposeOffersMap();
      window._keloOffersMarkers = {};
      const prev = window.__keloMobilePreviousTab || 'proposals';
      setMobileTab(prev === 'request-offers' ? 'proposals' : prev);
  }

  global.goBackFromOffersMap = goBackFromOffersMap;

  function toggleOffersMap(){
      const map = document.getElementById('keloOffersMap');
      const icon = document.getElementById('keloMapToggleIcon');
      const text = document.getElementById('keloMapToggleText');
      if(!map || !icon || !text) return;
      const isHidden = (map.style.opacity === '0' || map.style.opacity === '' || map.style.opacity === '0.0');
      if(isHidden){
          map.style.opacity = '1';
          map.style.pointerEvents = 'auto';
          icon.textContent = '\u2715';
          text.textContent = '\u0628\u0633\u062a\u0646 \u0646\u0642\u0634\u0647';
          setTimeout(function(){
              if(window._keloOffersMap){
                  try{ window._keloOffersMap.invalidateSize(true); }catch(e){}
                  try{
                      if(window._keloOffersMap._keloLastBounds){
                          window._keloOffersMap.fitBounds(window._keloOffersMap._keloLastBounds, {padding:[40,40], animate:false});
                      }
                  }catch(e){}
              }
          }, 100);
          setTimeout(function(){
              if(window._keloOffersMap){
                  try{ window._keloOffersMap.invalidateSize(true); }catch(e){}
              }
          }, 400);
      } else {
          map.style.opacity = '0';
          map.style.pointerEvents = 'none';
          icon.textContent = '\uD83D\uDDFA';
          text.textContent = '\u0646\u0645\u0627\u06cc\u0634 \u0646\u0642\u0634\u0647';
      }
  }

  global.toggleOffersMap = toggleOffersMap;

  function initOffersMap(req, offers){
      const token = window._keloOffersMapToken || 0;
      const el = document.getElementById('keloOffersMap');
      if(!el || typeof L === 'undefined') return;
      if(window._keloOffersMap){ try{ window._keloOffersMap.remove(); }catch(e){} }
      const reqLoc = req.data?.serviceLocation;
      const hasReqLoc = reqLoc && typeof reqLoc.lat === 'number' && typeof reqLoc.lng === 'number';
      const center = hasReqLoc ? [reqLoc.lat, reqLoc.lng] : [36.5659, 53.0586];
      const zoom = hasReqLoc ? 12 : 9;
      const map = createKeloMap(el, { zoomControl:false, attributionControl:false }, center, zoom);
      window._keloOffersMarkers = {};
      const reqIcon = L.divIcon({ className: 'kelo-req-marker', html: '<div style="width:34px;height:34px;background:#78a83f;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.3);position:relative;"><div style="position:absolute;inset:6px;background:#fff;border-radius:50%;"></div></div>', iconSize: [34, 34], iconAnchor: [17, 34] });
      L.marker(center, { icon: reqIcon }).addTo(map).bindPopup('<div class="map-card-popup"><strong>📍 محل درخواست</strong></div>');
      const points = [center];
      offers.forEach((o, idx) => {
          let pos = null;
          if(o.location){ const s = String(o.location).trim(); if(KELO_CITY_COORDS[s]){ pos = KELO_CITY_COORDS[s]; } else { const parts = s.split(/[:\s،,-]+/).map(x=>x.trim()).filter(Boolean); for(const p of parts){ if(KELO_CITY_COORDS[p]){ pos = KELO_CITY_COORDS[p]; break; } } } }
          if(!pos){ const ang = (idx / Math.max(offers.length, 1)) * Math.PI * 2; pos = [center[0] + Math.cos(ang) * 0.015, center[1] + Math.sin(ang) * 0.015]; }
          const offerIcon = L.divIcon({ className: 'kelo-offer-marker', html: '<div style="background:#5B9BB5;border:2.5px solid #fff;border-radius:50%;width:36px;height:36px;display:grid;place-items:center;font-weight:900;font-size:15px;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.3);">' + toPersianDigits(idx + 1) + '</div>', iconSize: [36, 36], iconAnchor: [18, 18] });
          const marker = L.marker(pos, { icon: offerIcon }).addTo(map);
          marker.bindPopup('<div class="map-card-popup"><strong>' + escapeHtml(o.provider || 'ارائه‌دهنده') + '</strong><small>' + escapeHtml(serviceName(o.service)) + '<br>' + (o.total ? formatMoney(o.total) : 'توافقی') + '</small></div>');
          const markerKey = String(o.providerId);
          marker.on('click', () => { const item = document.querySelector('.request-offers-list-item[data-offer-id="' + markerKey + '"]'); if(item){ item.scrollIntoView({behavior: 'smooth', block: 'center'}); document.querySelectorAll('.request-offers-list-item').forEach(x => x.classList.remove('active')); item.classList.add('active'); } });
          window._keloOffersMarkers[markerKey] = marker;
          points.push(pos);
      });
      if(mapToken !== (window._keloOffersMapToken || 0)){ try{ map.remove(); }catch(e){} return; }
      if(points.length > 1){ try { const b=L.latLngBounds(points).pad(0.25); map._keloLastBounds=b; map.fitBounds(b); } catch(e){} } else if(points.length === 1){ try { map._keloLastBounds=L.latLngBounds(points); } catch(e){} }
      window._keloOffersMap = map;
      requestAnimationFrame(() => { try{ map.invalidateSize(true); }catch(e){} });
      setTimeout(() => { if(mapToken !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 120);
      setTimeout(() => { if(mapToken !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 380);
  }

  global.initOffersMap = initOffersMap;

  function focusOfferOnMap(offerId){
      const marker = window._keloOffersMarkers && window._keloOffersMarkers[offerId];
      if(marker && window._keloOffersMap){ window._keloOffersMap.setView(marker.getLatLng(), Math.max(window._keloOffersMap.getZoom(), 14), { animate: true }); setTimeout(() => { marker.openPopup(); }, 400); }
      document.querySelectorAll('.request-offers-list-item').forEach(el => el.classList.remove('active'));
      const item = document.querySelector('.request-offers-list-item[data-offer-id="' + offerId + '"]');
      if(item) item.classList.add('active');
  }

  global.focusOfferOnMap = focusOfferOnMap;

  async function openRequestOffersMap(requestId){
      if(!currentUser) return;
      const req = qdb().requests.find(r => r.id === requestId && r.userId === currentUser.id);
      if(!req){ showToast('\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f', 'error'); return; }
      const _isProvideReq = (req.requestKind === 'provide');
      const _existingSheet = document.getElementById('keloRequestOffersSheet');
      const _existingContent = document.getElementById('keloRequestOffersContent');
      const _isSameRequest = !!(_existingSheet && _existingContent && _existingSheet.dataset.requestId === String(requestId));
      if(!_isSameRequest){ closeRequestOffersSheet(); }
          let candidates = getEligibleProvidersForRequest(req);
      const notifyApi = window.KeloService && window.KeloService.notifications;
      if (notifyApi && typeof notifyApi.getProviders === 'function') {
          try {
              const remoteResult = await notifyApi.getProviders({ requestId: req.id });
              if (remoteResult && remoteResult.ok && remoteResult.data && Array.isArray(remoteResult.data.providers)) {
                  // In server mode use remote list; in local, adapter returns eligible list too
                  if (window.KeloService.mode && window.KeloService.mode() === 'server') {
                      candidates = remoteResult.data.providers;
                  } else if (remoteResult.data.providers.length) {
                      candidates = remoteResult.data.providers;
                  }
              } else if (remoteResult && !remoteResult.ok && window.KeloService.mode && window.KeloService.mode() === 'server') {
                  showToast(remoteResult.message || 'دریافت پیشنهادهای قابل ارسال انجام نشد.','error');
                  return;
              }
          } catch (err) {
              if (window.KeloService.mode && window.KeloService.mode() === 'server') {
                  showToast('دریافت پیشنهادهای قابل ارسال انجام نشد.','error');
                  return;
              }
          }
      }
      const _myId = String(currentUser.id);
      // For a provider's own 'provide' ad, proposals are stored against the
      // farmer's 'need' request (not the ad), so match those by counterparty too.
      const currentRecipients = qdb().requestRecipients.filter(function(x){
          if(x.requestId===req.id) return true;
          if(!_isProvideReq) return false;
          const _px = String(x.proposerId || x.proposer_id || '');
          const _rx = String(x.recipientId || x.recipient_id || x.providerId || x.provider_id || '');
          if(_px !== _myId && _rx !== _myId) return false;
          const _rq = qdb().requests.find(function(q){ return q.id === x.requestId; });
          if(_rq && _rq.requestKind === 'provide') return false;
          return (_rq ? _rq.service : x.service) === req.service;
      });
      const recipientByProvider = {};
      currentRecipients.forEach(function(x){
          const _p = String(x.proposerId || x.proposer_id || '');
          const _r = String(x.recipientId || x.recipient_id || x.providerId || x.provider_id || '');
          const _o = _p === _myId ? _r : _p;
          if(!_o || _o === _myId) return;
          const existing = recipientByProvider[_o];
          const xActive  = (x.status === 'pending' || x.status === 'accepted');
          const exActive = existing && (existing.status === 'pending' || existing.status === 'accepted');
          if(xActive && !exActive){
              recipientByProvider[_o] = x;
          } else if(!existing){
              recipientByProvider[_o] = x;
          }
      });
      const providersHtml = candidates.length ? candidates.map(o=>{
          const rec=recipientByProvider[o.providerId];
          let action='';
          if(rec && rec.status==='pending'){
              action='<button type="button" class="btn offer-item-btn btn-reject" onclick="event.stopPropagation();cancelRecipient(\''+rec.id+'\',\''+req.id+'\')">\u0644\u063a\u0648 \u0627\u0631\u0633\u0627\u0644</button>';
          }else if(rec && rec.status==='rejected'){
              action='<button class="btn btn-brand offer-item-btn" onclick="event.stopPropagation();sendRequestToProvider(\''+o.providerId+'\',\''+req.id+'\')">\u0627\u0631\u0633\u0627\u0644 \u0645\u062c\u062f\u062f</button>';
          }else if(req.status==='accepted' || req.status==='agreed' || req.status==='in_progress' || req.status==='completed'){
              action='<button class="btn offer-item-btn offer-item-btn-closed" disabled>\u062a\u0648\u0627\u0641\u0642 \u0634\u062f\u0647</button>';
          }else{
              action='<button class="btn btn-brand offer-item-btn" onclick="event.stopPropagation();sendRequestToProvider(\''+o.providerId+'\',\''+req.id+'\')">\u0627\u0631\u0633\u0627\u0644 \u06a9\u0627\u0631</button>';
          }
          const service = o.service || req.service;
          let _subOpt = '';
          if (o.data) {
              if (Array.isArray(o.data.landType) && o.data.landType.length) _subOpt = o.data.landType[0];
              else if (Array.isArray(o.data.crop) && o.data.crop.length) _subOpt = o.data.crop[0];
              else if (typeof o.data.landType === 'string' && o.data.landType) _subOpt = o.data.landType;
              else if (typeof o.data.crop === 'string' && o.data.crop) _subOpt = o.data.crop;
          }
          const _serviceDisplay = serviceName(service) + (_subOpt ? ' ' + _subOpt : '');
          const _rating = getUserRating(o.providerId);
          const _ratingHtml = (_rating && _rating.count > 0) ? ' <span class="kelo-rating-badge"><svg class="kelo-rating-star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg><span class="kelo-rating-num">' + toPersianDigits(_rating.average.toFixed(1)) + '</span></span>' : '';
          let _infoHtml = '';
          if(_isProvideReq){
              const _area = (o.data && (o.data.area || o.data.amount)) ? (o.data.area || o.data.amount) : null;
              let _locDisplay = o.location || '';
              if (!_locDisplay && o.data && o.data.serviceLocation && typeof o.data.serviceLocation.lat === 'number') {
                  _locDisplay = nearestCityFromCoords(o.data.serviceLocation.lat, o.data.serviceLocation.lng) || '';
              }
              _infoHtml = '<div style="display:flex;align-items:center;gap:14px;font-size:13px;color:#1F1F1F;font-weight:700;padding:2px 0;flex-wrap:wrap">'
                  + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('area') + '</span>' + (_area ? (toPersianDigits(_area) + ' \u0647\u06a9\u062a\u0627\u0631') : '\u2014') + '</span>'
                  + '<span style="display:inline-flex;align-items:center;gap:5px"><span class="kelo-icon-inline">' + keloCardIcon('location') + '</span>' + escapeHtml(_locDisplay || '\u2014') + '</span>'
                  + '</div>';
          }else{
              const _mt = (o.data && o.data.machineType) ? o.data.machineType : '';
              _infoHtml = '<div style="display:flex;align-items:center;gap:7px;font-size:13px;color:#1F1F1F;font-weight:700;padding:2px 0">'
                  + '<span class="kelo-icon-inline">' + keloCardIcon('machine') + '</span>' + escapeHtml(_mt || '\u2014')
                  + '</div>';
          }
                  if(rec && rec.status==='pending'){
              const _rp = String(rec.proposerId || rec.proposer_id || '');
              if(_rp !== _myId){
                  action='<button type="button" class="btn offer-item-btn btn-reject" onclick="event.stopPropagation();rejectIncomingProposal(\''+rec.id+'\',\''+req.id+'\')">رد درخواست</button>';
              }
          }
          const priceLine = o.unitPrice ? fmtNum(o.unitPrice) + (o.priceUnit ? ' '+o.priceUnit : '') : '\u062a\u0648\u0627\u0641\u0642\u06cc';
          const _showPrice = !_isProvideReq;
          return '<div class="request-offers-list-item" data-offer-id="'+escapeHtml(o.providerId)+'" onclick="focusOfferOnMap(\''+escapeHtml(o.providerId)+'\')">'
              +'<div class="kelo-card-head"><span class="kelo-card-head-icon">'+serviceCardIconSvg(service)+'</span><strong>'+escapeHtml(_serviceDisplay)+_ratingHtml+'</strong></div>'
              +'<div class="kelo-card-info-list">'+_infoHtml+'</div>'
              +(_showPrice ? '<div class="offer-card-price">'+priceLine+'</div>' : '')
              +'<div class="offer-actions-row single">'+action+'</div>'
              +'</div>';
      }).join('') : '<div class="mobile-empty-state">'+(_isProvideReq?'\u06a9\u0634\u0627\u0648\u0631\u0632 \u0648\u0627\u062c\u062f \u0634\u0631\u0627\u06cc\u0637\u06cc \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.':'\u0627\u0631\u0627\u0626\u0647\u200c\u062f\u0647\u0646\u062f\u0647 \u0648\u0627\u062c\u062f \u0634\u0631\u0627\u06cc\u0637\u06cc \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.')+'</div>';
      let _statPending = 0, _statRejected = 0;
      currentRecipients.forEach(function(x){ if(x.status==='pending') _statPending++; else if(x.status==='rejected') _statRejected++; });
      const _firstLabel = _isProvideReq ? '\u06a9\u0634\u0627\u0648\u0631\u0632' : '\u0627\u0631\u0627\u0626\u0647\u200c\u062f\u0647\u0646\u062f\u0647';
      const _statsHtml = '<div class="kelo-stats-row">'
          + '<div class="kelo-stat-cell"><div class="kelo-stat-num">' + toPersianDigits(candidates.length) + '</div><div class="kelo-stat-lbl">' + _firstLabel + '</div></div>'
          + '<div class="kelo-stat-cell"><div class="kelo-stat-num">' + toPersianDigits(_statPending) + '</div><div class="kelo-stat-lbl">\u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631</div></div>'
          + '<div class="kelo-stat-cell"><div class="kelo-stat-num">' + toPersianDigits(_statRejected) + '</div><div class="kelo-stat-lbl">\u0631\u062f \u0634\u062f\u0647</div></div>'
          + '</div>';
      if(_isSameRequest){
          _existingContent.innerHTML = _statsHtml + providersHtml;
          requestAnimationFrame(function(){ try{ initOffersMap(req, candidates); }catch(e){ console.warn('initOffersMap refresh failed', e); } });
          return;
      }
      const backdrop = document.createElement('div');
      backdrop.id = 'keloRequestOffersSheet';
      backdrop.className = 'mobile-sheet-backdrop';
      backdrop.dataset.requestId = String(requestId);
      backdrop.innerHTML = '<div class="mobile-sheet" style="position:relative">'
          + '<button type="button" class="mobile-sheet-handle"></button>'
          + '<div class="mobile-sheet-header">'
          + '<button type="button" class="mobile-sheet-back-btn" onclick="closeRequestOffersSheet()" aria-label="\u0628\u0633\u062a\u0646">'+KELO_BACK_CHEVRON_SVG+'</button>'
          + '<h2>\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0647\u0627</h2>'
          + '<span></span>'
          + '</div>'
          + '<div class="mobile-sheet-body" style="position:relative">'
          + '<div id="keloRequestOffersContent">'
          + _statsHtml
          + providersHtml
          + '</div>'
          + '<div id="keloOffersMap" style="position:absolute;top:0;left:0;right:0;bottom:0;opacity:0;pointer-events:none;z-index:5;background:#dfe7cc;transition:opacity .2s ease"></div>'
          + '</div>'
          + '</div>'
          + '<button type="button" class="kelo-map-toggle-btn" id="keloMapToggleBtn" onclick="toggleOffersMap()">'
          + '<span id="keloMapToggleIcon">\uD83D\uDDFA</span>'
          + '<span id="keloMapToggleText">\u0646\u0645\u0627\u06cc\u0634 \u0646\u0642\u0634\u0647</span>'
          + '</button>';
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      const mapToken = window._keloOffersMapToken || 0;
      requestAnimationFrame(() => {
          if(mapToken !== (window._keloOffersMapToken || 0)) return;
          initOffersMap(req, candidates);
      });
  }

  global.openRequestOffersMap = openRequestOffersMap;

  function openRequestLocationMap(requestId){
      if(!currentUser) return;
      const req = qdb().requests.find(r => r.id === requestId);
      if(!req){ showToast('درخواست پیدا نشد', 'error'); return; }
      disposeOffersMap();
      const mapToken = window._keloOffersMapToken || 0;
      const app = document.getElementById('app');
      if(app){ app.classList.remove('mobile-tab-home','mobile-tab-request','mobile-tab-proposals','mobile-tab-request-offers'); app.classList.add('mobile-tab-request-offers');
      const nav = document.getElementById('mobileBottomNav'); if(nav) nav.classList.add('hidden'); }
      window.__keloMobilePreviousTab = window.__keloMobileTab || 'proposals';
      window.__keloMobileTab = 'request-offers';
      const sb = document.getElementById('sidebar'); if(sb){ sb.innerHTML = ''; }
      const c = document.getElementById('appContent'); if(!c) return;
      c.className = 'content';
      c.innerHTML = '<div class="request-offers-view"><div id="keloOffersMap" class="request-offers-map"></div><button type="button" class="request-offers-back-btn" onclick="goBackFromOffersMap()" aria-label="بازگشت">'+KELO_BACK_CHEVRON_SVG+'</button></div>';
      updateMobileHeader('موقعیت درخواست');
      requestAnimationFrame(() => {
          if(mapToken !== (window._keloOffersMapToken || 0)) return;
          initRequestLocationMap(req);
      });
  }

  global.openRequestLocationMap = openRequestLocationMap;

  function initRequestLocationMap(req){
      const token = window._keloOffersMapToken || 0;
      const el = document.getElementById('keloOffersMap');
      if(!el || typeof L === 'undefined'){ if(el) el.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#c0392b;font-weight:700;padding:20px;text-align:center">خطا در بارگذاری نقشه.</div>'; return; }
      if(window._keloOffersMap){ try{ window._keloOffersMap.remove(); }catch(e){} }
      const reqLoc = req.data?.serviceLocation;
      const hasReqLoc = reqLoc && typeof reqLoc.lat === 'number' && typeof reqLoc.lng === 'number';
      const center = hasReqLoc ? [reqLoc.lat, reqLoc.lng] : [36.5659, 53.0586];
      const map = createKeloMap(el, { zoomControl:false, attributionControl:false }, center, 13);
      if(hasReqLoc){ const reqIcon = L.divIcon({ className: 'kelo-req-marker', html: '<div style="width:38px;height:38px;background:#78a83f;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.3);position:relative;"><div style="position:absolute;inset:7px;background:#fff;border-radius:50%;"></div></div>', iconSize: [38, 38], iconAnchor: [19, 38] }); L.marker(center, { icon: reqIcon }).addTo(map).bindPopup('<div class="map-card-popup"><strong>📍 موقعیت درخواست</strong><small>'+escapeHtml(serviceName(req.service))+'<br>'+escapeHtml(requestDate(req))+'</small></div>').openPopup(); }
      if(token !== (window._keloOffersMapToken || 0)){ try{ map.remove(); }catch(e){} return; }
      window._keloOffersMap = map;
      requestAnimationFrame(() => { try{ map.invalidateSize(true); }catch(e){} });
      setTimeout(() => { if(token !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 120);
      setTimeout(() => { if(token !== (window._keloOffersMapToken || 0)) return; try{ map.invalidateSize(true); }catch(e){} }, 380);
  }

  global.initRequestLocationMap = initRequestLocationMap;

  function renderMapLocationField(id,label,req,help,mobile){
      const loc=wizard.data[id]; const has=loc && typeof loc.lat==='number' && typeof loc.lng==='number';
      if(mobile){
          const inner = has
              ? '<div class="mobile-inline-map-preview" id="inlineMap_'+escapeHtml(id)+'"><div class="kelo-map-city-chip" id="inlineMapCityChip"></div></div>'
              : '<div class="mobile-inline-map-inner"><svg viewBox="0 0 24 24"><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg><span class="mobile-inline-map-text">انتخاب موقعیت روی نقشه</span></div>';
          return '<div class="sidebar-field map-location-field-mobile"><label>'+escapeHtml(label)+(req?' <span style="color:red">*</span>':'')+'</label><button type="button" class="mobile-inline-map" onclick="activateMapPicker()" aria-label="باز کردن نقشه">'+inner+'</button><div class="mobile-inline-map-value">'+(has?'✓ موقعیت زمین انتخاب شد':'روی نقشه ضربه بزنید و موقعیت زمین را مشخص کنید')+'</div></div>';
      }
      return '<div class="sidebar-field"><label>'+label+(req?' <span style="color:red">*</span>':'')+'</label><div class="sidebar-map-action"><div><strong>'+(has?'✓ انتخاب شده':'📍 محل زمین')+'</strong></div><button type="button" class="btn btn-outline" onclick="activateMapPicker()">'+(has?'تغییر':'انتخاب')+'</button></div></div>';
  }

  global.renderMapLocationField = renderMapLocationField;

  function initializeInlineLocationMap(){
      const el=document.getElementById('inlineMap_serviceLocation');
      if(!el || typeof L==='undefined') return;
      if(window._keloInlineMap){ try{window._keloInlineMap.remove();}catch(e){} }
      const loc=wizard.data.serviceLocation;
      const center=loc&&typeof loc.lat==='number' ? [loc.lat,loc.lng] : [36.5659,53.0586];
      const zoom=loc&&typeof loc.lat==='number' ? 14 : 9;
      const map=createKeloMap(el,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,touchZoom:false},center,zoom);
      if(loc&&typeof loc.lat==='number'){ L.marker([loc.lat,loc.lng]).addTo(map); var _ch=document.getElementById('inlineMapCityChip'); if(_ch){ _ch.textContent=locationLabelFromCoords(loc.lat,loc.lng); _ch.style.display='inline-flex'; } }
      window._keloInlineMap=map;
      setTimeout(()=>map.invalidateSize(),50);
  }

  global.initializeInlineLocationMap = initializeInlineLocationMap;

  function openMobileMapPickerOverlay(){
      clearKeloPickerGpsVisuals();
      const existing = document.getElementById('keloMobileMapPickerOverlay');
      if(existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.id = 'keloMobileMapPickerOverlay';
      overlay.className = 'mobile-location-picker-backdrop';
      const pinSvg = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s-8-7.5-8-13a8 8 0 1 1 16 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg>';
      const gpsSvg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>';
      const isBrandMode = !!wizard._profileMapMode;
      const confirmBtnClass = isBrandMode ? 'btn is-brand' : 'btn';
      overlay.innerHTML = '<div class="mobile-location-picker-sheet"><div class="mobile-location-picker-head"><button type="button" id="keloMapPickerClose" aria-label="بازگشت" style="justify-self:end">'+KELO_BACK_CHEVRON_SVG+'</button><strong>انتخاب موقعیت زمین</strong><span></span></div><div class="mobile-location-picker-map-wrap"><div id="mobileLocationPickerMap"></div><div class="kelo-map-search-wrap"><div class="kelo-map-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="keloMapSearchInput" placeholder="جستجوی شهر یا آدرس..."></div></div><div class="kelo-map-center-pin">'+pinSvg+'</div><button type="button" class="kelo-map-gps-btn" id="keloMapGpsBtn" aria-label="موقعیت من">'+gpsSvg+'</button></div><div class="mobile-location-picker-footer"><button type="button" class="'+confirmBtnClass+'" id="keloMapPickerConfirmBtn">'+pinSvg+'<span>تأیید موقعیت</span></button></div></div>';
      document.body.appendChild(overlay);
      document.getElementById('keloMapPickerClose').addEventListener('click', closeMobileLocationPicker);
      document.getElementById('keloMapPickerConfirmBtn').addEventListener('click', confirmMobileLocationPicker);
      document.getElementById('keloMapGpsBtn').addEventListener('click', useMyLocationForPicker);
      const searchInput = document.getElementById('keloMapSearchInput');
      if(searchInput){
          let searchTimer = null;
          searchInput.addEventListener('input', function(){
              clearTimeout(searchTimer);
              const q = this.value.trim();
              if(q.length < 3) return;
              searchTimer = setTimeout(() => geocodeMapSearch(q), 600);
          });
      }
      document.body.style.overflow = 'hidden';
      setTimeout(function(){ initializeMobileLocationPicker(); }, 80);
  }

  global.openMobileMapPickerOverlay = openMobileMapPickerOverlay;

  function closeMobileMapPickerOverlay(){
      if(keloNominatimQueueTimer){ clearTimeout(keloNominatimQueueTimer); keloNominatimQueueTimer=null; }
      if(keloNominatimController){ try{ keloNominatimController.abort(); }catch(e){} keloNominatimController=null; }
      const overlay = document.getElementById('keloMobileMapPickerOverlay');
      if(overlay) overlay.remove();
      if(window._keloMobilePickerMap){ try{ window._keloMobilePickerMap.remove(); }catch(e){} window._keloMobilePickerMap = null; }
      clearKeloPickerGpsVisuals();
      document.body.style.overflow = '';
  }

  global.closeMobileMapPickerOverlay = closeMobileMapPickerOverlay;

  function geocodeMapSearch(query){
      if(!window._keloMobilePickerMap) return;
      const normalized = String(query || '').trim();
      if(normalized.length < 3) return;
      const cacheKey = 'kelo_nominatim_' + normalized.toLowerCase();
      try{
          const cached = localStorage.getItem(cacheKey);
          if(cached){
              const data = JSON.parse(cached);
              if(data && data.length){
                  const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
                  if(Number.isFinite(lat) && Number.isFinite(lng) && window._keloMobilePickerMap){
                      window._keloMobilePickerMap.setView([lat, lng], 15);
                      wizard._pendingMapPoint = { lat: lat, lng: lng };
                      updateMobilePickerFooter();
                      return;
                  }
              }
          }
      }catch(e){}

      const wait = Math.max(0, 1100 - (Date.now() - keloNominatimLastRequestAt));
      clearTimeout(keloNominatimQueueTimer);
      keloNominatimQueueTimer = setTimeout(function(){
          if(!window._keloMobilePickerMap) return;
          keloNominatimLastRequestAt = Date.now();
          if(keloNominatimController){ try{ keloNominatimController.abort(); }catch(e){} }
          keloNominatimController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
          const url='https://nominatim.openstreetmap.org/search?format=json&accept-language=fa&limit=1&q=' + encodeURIComponent(normalized);
          fetch(url, keloNominatimController ? {signal:keloNominatimController.signal} : undefined)
              .then(r => { if(!r.ok) throw new Error('Nominatim HTTP '+r.status); return r.json(); })
              .then(data => {
                  if(data && data.length){
                      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
                      if(Number.isFinite(lat) && Number.isFinite(lng) && window._keloMobilePickerMap){
                          try{ localStorage.setItem(cacheKey, JSON.stringify(data)); }catch(e){}
                          window._keloMobilePickerMap.setView([lat, lng], 15);
                          wizard._pendingMapPoint = { lat: lat, lng: lng };
                          updateMobilePickerFooter();
                      }
                  }
              })
              .catch(err => { if(err && err.name !== 'AbortError') console.warn('KELO geocode failed:', err); });
      }, wait);
  }

  global.geocodeMapSearch = geocodeMapSearch;

  function clearKeloPickerGpsVisuals(){
      if(window._keloPickerGpsMarker){ try{ window._keloPickerGpsMarker.remove(); }catch(e){} window._keloPickerGpsMarker=null; }
      if(window._keloPickerGpsAccuracy){ try{ window._keloPickerGpsAccuracy.remove(); }catch(e){} window._keloPickerGpsAccuracy=null; }
  }

  global.clearKeloPickerGpsVisuals = clearKeloPickerGpsVisuals;

  function updateKeloPickerCityChip(lat,lng){
      const chip=document.getElementById('keloMapCityChip');
      if(!chip) return;
      const label = locationLabelFromCoords(Number(lat), Number(lng));
      chip.textContent = label;
      chip.style.display = 'inline-flex';
  }

  global.updateKeloPickerCityChip = updateKeloPickerCityChip;

  function useMyLocationForPicker(){
      if(!window._keloMobilePickerMap || !navigator.geolocation){
          showToast('مرورگر شما از موقعیت مکانی پشتیبانی نمی‌کند.','error');
          return;
      }
      const btn=document.getElementById('keloMapGpsBtn');
      const restoreButton=function(){ if(btn){ btn.disabled=false; btn.style.opacity=''; } };
      if(btn){ btn.disabled=true; btn.style.opacity='.55'; }
      getKeloCurrentPosition(function(pos){
          restoreButton();
          const lat=Number(pos.coords.latitude), lng=Number(pos.coords.longitude);
          const accuracy=Number(pos.coords.accuracy)||0;
          if(!Number.isFinite(lat)||!Number.isFinite(lng)||!window._keloMobilePickerMap) return;
          clearKeloPickerGpsVisuals();
          window._keloPickerGpsAccuracy=L.circle([lat,lng],{radius:accuracy||35,color:'#4A9DB8',weight:1,fillColor:'#4A9DB8',fillOpacity:.12}).addTo(window._keloMobilePickerMap);
          window._keloPickerGpsMarker=L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:3,fillColor:'#4A9DB8',fillOpacity:1}).addTo(window._keloMobilePickerMap).bindPopup('<div class="map-card-popup"><strong>📍 موقعیت فعلی شما</strong></div>');
          window._keloMobilePickerMap.setView([lat,lng],16,{animate:true});
          wizard._pendingMapPoint={lat,lng};
          updateKeloPickerCityChip(lat,lng);
          updateMobilePickerFooter();
      },function(err){
          restoreButton();
          let msg='دسترسی به موقعیت ممکن نبود.';
          if(err && err.code===1) msg='دسترسی موقعیت مکانی رد شده است؛ مجوز Location را برای سایت فعال کنید.';
          else if(err && err.code===2) msg='موقعیت مکانی قابل تشخیص نیست. GPS یا Location را روشن کنید.';
          else if(err && err.code===3) msg='دریافت موقعیت بیش از حد طول کشید. دوباره امتحان کنید.';
          showToast(msg,'error');
      });
  }

  global.useMyLocationForPicker = useMyLocationForPicker;

  function updateMobilePickerFooter(){
      const btn = document.getElementById('keloMapPickerConfirmBtn');
      if(!btn) return;
      btn.disabled = !wizard._pendingMapPoint;
  }

  global.updateMobilePickerFooter = updateMobilePickerFooter;

  function initializeMobileLocationPicker(){
      const el = document.getElementById('mobileLocationPickerMap');
      if(!el || typeof L === 'undefined') return;
      if(window._keloMobilePickerMap){ try{ window._keloMobilePickerMap.remove(); }catch(e){} window._keloMobilePickerMap = null; }
      const loc = wizard._pendingMapPoint || wizard.data.serviceLocation;
      const hasLoc = loc && typeof loc.lat === 'number' && typeof loc.lng === 'number';
      const center = hasLoc ? [loc.lat, loc.lng] : [36.5659, 53.0586];
      const zoom = hasLoc ? 15 : 10;
      const map = createKeloMap(el, { zoomControl:false, attributionControl:false }, center, zoom);
      if(hasLoc) wizard._pendingMapPoint = { lat: loc.lat, lng: loc.lng };
      else wizard._pendingMapPoint = { lat: center[0], lng: center[1] };
      map.on('move', function(){ const c = map.getCenter(); wizard._pendingMapPoint = { lat: c.lat, lng: c.lng }; updateKeloPickerCityChip(c.lat,c.lng); });
      map.on('moveend', updateMobilePickerFooter);
      map.whenReady(function(){
          const c = map.getCenter();
          wizard._pendingMapPoint = { lat: c.lat, lng: c.lng };
          updateKeloPickerCityChip(c.lat,c.lng);
          updateMobilePickerFooter();
      });
      window._keloMobilePickerMap = map;
      setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 100);
      setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 350);
      updateMobilePickerFooter();
  }

  global.initializeMobileLocationPicker = initializeMobileLocationPicker;

  function activateMapPicker(){
      wizard.mapPickMode = true;
      wizard._pendingMapPoint = wizard.data.serviceLocation ? cloneObject(wizard.data.serviceLocation) : null;
      openMobileMapPickerOverlay();
  }

  global.activateMapPicker = activateMapPicker;

  function closeMobileLocationPicker(){
      wizard.mapPickMode = false;
      wizard._profileMapMode = false;
      wizard._pendingMapPoint = null;
      closeMobileMapPickerOverlay();
      if(wizard.formSheetOpen){ renderMobileFormSheet(); } else { renderWizard(); }
  }

  global.closeMobileLocationPicker = closeMobileLocationPicker;

  function confirmMobileLocationPicker(){
      if(wizard._pendingMapPoint && typeof wizard._pendingMapPoint.lat === 'number'){
          if(wizard._profileMapMode){
              const mode = wizard._profileMapMode;
              const nearest = nearestCityFromCoords(wizard._pendingMapPoint.lat, wizard._pendingMapPoint.lng);
              const province = provinceFromCity(nearest);
              wizard._pendingProfileLocation = Object.assign({}, wizard._pendingMapPoint, { city: nearest, province: province });
              wizard._profileMapMode = false;
              wizard._pendingMapPoint = null;
              closeMobileMapPickerOverlay();
              if(mode === 'first'){
                  showCompleteProfile();
              } else if(document.getElementById('mobileAccountSheet')){
                  renderMobileAccountSection('edit');
              }
              return;
          } else {
              var _pt = wizard._pendingMapPoint;
              var _city = nearestCityFromCoords(_pt.lat, _pt.lng);
              wizard.data.serviceLocation = Object.assign({}, _pt, {
                  source: 'map',
                  city: _city || null,
                  province: _city ? provinceFromCity(_city) : null,
                  label: locationLabelFromCoords(_pt.lat, _pt.lng)
              });
          }
      }
      wizard.mapPickMode = false;
      wizard._pendingMapPoint = null;
      closeMobileMapPickerOverlay();
      clearFieldError('serviceLocation');
      saveWizardDraft();
      if(wizard.formSheetOpen){ renderMobileFormSheet(); } else { renderWizard(); }
  }

  global.confirmMobileLocationPicker = confirmMobileLocationPicker;

  function useMapLocation(lat,lng){wizard.data.serviceLocation={lat:Number(lat),lng:Number(lng),source:'map'};wizard.mapPickMode=false;wizard._pendingMapPoint=null;renderWizard();}

  global.useMapLocation = useMapLocation;

  function sendOfferMapHeader(request){
      return request && request.requestKind === 'provide' ? 'کشاورزان' : 'ارائه‌دهندگان خدمت';
  }

  global.sendOfferMapHeader = sendOfferMapHeader;

})(typeof window !== 'undefined' ? window : globalThis);
