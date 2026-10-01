/**
 * KELO — Request UI handlers (Phase 10)
 * Event handlers + orchestration. Rendering still primarily in app.js.
 */
(function (global) {
  'use strict';

  async function finalizeMobileForm(){
      if (!currentUser) return;
      const savedType = wizard.type, savedService = wizard.service;
      let newId = null;
      const fields = mobileL2Fields();
      const data = cloneObject(wizard.data || {});
      fields.forEach(function(f){
          const id = f[0], type = f[2];
          if (type === 'areaSlider') {
              const range = document.querySelector('input[type=range][data-slider-id="' + id + '"]');
              if (range) data[id] = Number(range.value) || 0;
              return;
          }
          const el = document.getElementById('wf_' + id);
          if (!el) return;
          if (type === 'file') {
              data[id] = Array.from(el.files || []).map(function(x){ return x.name; });
          } else if (type === 'number') {
              data[id] = el.value === '' ? '' : Number(el.value);
          } else {
              data[id] = el.value;
          }
      });
      if (data.dateStart) data.date = data.dateStart;

      const requestApi = window.KeloService && window.KeloService.requests;
      if (!requestApi) { showToast('سرویس درخواست در دسترس نیست.','error'); return; }

      const wasEdit = !!wizard.editRequestId;
      let result;

      if (savedType === 'receive' || savedType === 'provide') {
          if (wasEdit) {
              result = await requestApi.update({
                  id: wizard.editRequestId,
                  userId: currentUser.id,
                  service: savedService,
                  data: data,
                  requesterName: currentUser.name
              });
          } else {
              result = await requestApi.create({
                  userId: currentUser.id,
                  requesterName: currentUser.name,
                  service: savedService,
                  data: data,
                  requestKind: savedType === 'provide' ? 'provide' : 'need'
              });
          }
      } else {
          result = await requestApi.createListing({
              userId: currentUser.id,
              providerName: currentUser.name,
              service: savedService,
              data: data
          });
      }

      if (!result || !result.ok) {
          showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.','error');
          return;
      }

      if (result.data && result.data.snapshot) {
          applyServerSnapshot(result.data.snapshot);
      }
      newId = (result.data && result.data.id) || null;

      clearWizardDraft(); closeMobileFormSheet();
      if (wasEdit) {
          mobileRequestSuccess = false;
          mobileSuccessData = null;
          try { sessionStorage.removeItem('kelo_mobile_success'); } catch (e) {}
          resetMobileWizardFlow();
          showToast((result.message) || 'درخواست به‌روزرسانی شد', 'success');
          mobileOrdersSubTab = 'requests';
          setMobileTab('proposals');
          return;
      }
      mobileRequestSuccess = true;
      mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now(), updated: false };
      try { sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); } catch (e) {}
      resetMobileWizardFlow();
      setMobileTab('request');
  }

  global.finalizeMobileForm = finalizeMobileForm;

  async function finalizeWizard(){
      if (!currentUser) return;
      let savedType = wizard.type, savedService = wizard.service, newId = null;
      const data = cloneObject(wizard.data);
      if (data.dateStart) data.date = data.dateStart;
      const requestKind = savedType === 'provide' ? 'provide' : 'need';

      const requestApi = window.KeloService && window.KeloService.requests;
      if (!requestApi) { showToast('سرویس درخواست در دسترس نیست.','error'); return; }

      const result = await requestApi.create({
          userId: currentUser.id,
          requesterName: currentUser.name,
          service: savedService,
          data: data,
          requestKind: requestKind
      });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'ذخیره اطلاعات انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) {
          applyServerSnapshot(result.data.snapshot);
      }
      newId = (result.data && result.data.id) || null;
      if (!newId && result.data && result.data.request) newId = result.data.request.id;

      // Local map context (server path also sets requestId when available)
      if (newId) {
          mapContext = {
              type: savedType,
              service: savedService,
              target: savedType === 'receive' ? (wizard.data.serviceLocation || null) : null,
              activityArea: savedType === 'provide' ? (wizard.data.activityArea || []) : undefined,
              requestId: newId
          };
      }

      clearWizardDraft();
      mobileRequestSuccess = true;
      mobileSuccessData = { type: savedType, service: savedService, id: newId, ts: Date.now() };
      try { sessionStorage.setItem('kelo_mobile_success', JSON.stringify(mobileSuccessData)); } catch (e) {}
      setMobileTab('request');
      resetMobileWizardFlow();
  }

  global.finalizeWizard = finalizeWizard;

  async function deleteRequest(requestId){
      if (!currentUser) return;
      if (!confirm('این درخواست حذف شود؟')) return;

      const requestApi = window.KeloService && window.KeloService.requests;
      if (!requestApi) { showToast('سرویس درخواست در دسترس نیست.','error'); return; }

      const result = await requestApi.remove({ id: requestId, userId: currentUser.id });
      if (!result || !result.ok) {
          showToast((result && result.message) || 'حذف درخواست انجام نشد.','error');
          return;
      }
      if (result.data && result.data.snapshot) {
          applyServerSnapshot(result.data.snapshot);
      }
      showToast((result.message) || 'درخواست حذف شد','success');
      renderMobileProposals();
  }

  global.deleteRequest = deleteRequest;

  function editRequest(requestId){
      const req=(window.KeloService && window.KeloService.query)
        ? window.KeloService.query.getMyRequest(requestId)
        : db.requests.find(r=>r.id===requestId && r.userId===currentUser.id);
      if(!req || req.status==='accepted' || req.status==='agreed' || req.status==='in_progress' || req.status==='completed'){
          showToast('این درخواست دیگر قابل ویرایش نیست','error'); return;
      }
      wizard=makeEmptyWizard();
      wizard.type=(req.requestKind==='provide')?'provide':'receive';
      wizard.formSheetOpen=true;
      wizard.service=req.service;
      wizard.data=cloneObject(req.data || {});
      wizard.serviceOptions={};
      // Only service sub-options belong in serviceOptions (not area/dates/price/...)
      const l3 = (SERVICE_L3_FIELDS && SERVICE_L3_FIELDS[req.service]) || [];
      l3.forEach(function(sf){
          if (req.data && req.data[sf.id] !== undefined) wizard.serviceOptions[sf.id] = cloneObject(req.data[sf.id]);
      });
      wizard.editRequestId=req.id;
      if(!wizard.data.dateStart) wizard.data.dateStart=wizard.data.date||localDateToIso(new Date());
      document.documentElement.setAttribute('data-form-theme', wizard.type === 'provide' ? 'orange' : 'blue');
      renderMobileFormSheet();
  }

  global.editRequest = editRequest;

})(typeof window !== 'undefined' ? window : globalThis);
