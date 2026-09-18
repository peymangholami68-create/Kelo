(function(){
    try{
        // This is only a visual optimization for the legacy local prototype.
        // Production/VPS sessions are cookie-based and are resolved after the
        // real backend health/session check completes.
        if(localStorage.getItem('kelo_session_user_id')){
            var s = document.createElement('style');
            s.id = 'keloPreloadHideLanding';
            s.textContent = '#landing{display:none!important}';
            document.head.appendChild(s);
        }
    }catch(e){}
})();
