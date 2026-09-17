(function(){
    try{
        var cfg = window.KELO_CONFIG || {};
        if((cfg.backendMode || 'auto') === 'local' && localStorage.getItem('kelo_session_user_id')){
            var s = document.createElement('style');
            s.id = 'keloPreloadHideLanding';
            s.textContent = '#landing{display:none!important}';
            document.head.appendChild(s);
        }
    }catch(e){}
})();
