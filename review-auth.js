(() => {
    'use strict';
    const config = window.REVIEWS_CONFIG || {};
    const panel = document.getElementById('reviewAccount');
    const login = document.getElementById('reviewGoogleLogin');
    const logout = document.getElementById('reviewGoogleLogout');
    const status = document.getElementById('reviewAccountStatus');
    const auth = window.reviewAuth = { session: null, ready: Promise.resolve(), client: null };
    if (!config.googleEnabled) return;
    panel.hidden = false;
    document.getElementById('reviewAccountNote').textContent = 'Comparte tu experiencia con tu cuenta de Google.';
    document.getElementById('reviewOwnershipHint').textContent = 'Podrás editar o eliminar tu reseña iniciando sesión con la misma cuenta otro día o desde otro dispositivo.';
    const writer = document.querySelector('.reviewWrite');
    writer.hidden = true;
    function showSession(session) {
        auth.session = session;
        login.hidden = !!session; logout.hidden = !session; writer.hidden = !session;
        status.textContent = session ? `Sesión iniciada como ${session.user.user_metadata?.full_name || session.user.email || 'cliente'}.` : 'Inicia sesión para publicar y gestionar tus reseñas.';
        setTimeout(() => document.dispatchEvent(new CustomEvent('review-auth-changed')), 0);
    }
    auth.ready = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/supabase-2.117.3.js'; script.onload = resolve; script.onerror = reject;
        document.head.append(script);
    }).then(async () => {
        auth.client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
            auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        auth.client.auth.onAuthStateChange((_event, session) => showSession(session));
        const { data, error } = await auth.client.auth.getSession();
        if (error) throw error;
        showSession(data.session); login.disabled = false;
    }).catch(() => {
        status.textContent = 'No se pudo iniciar la conexión con Google. Recarga la página para volver a intentarlo.';
    });
    login.addEventListener('click', async () => {
        if (window.location.protocol === 'file:') {
            window.showNoticePopup?.('Abre la web publicada', 'Para iniciar sesión con Google, abre https://neizanphoto26.github.io/ o la web mediante Live Server.'); return;
        }
        login.disabled = true;
        try {
            await auth.ready;
            const redirect = new URL('Resenas.html', window.location.href);
            redirect.hash = ''; redirect.search = '';
            const { error } = await auth.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect.href, queryParams: { prompt: 'select_account' } } });
            if (error) throw error;
        } catch {
            window.showNoticePopup?.('No se pudo conectar con Google', 'Inténtalo de nuevo en unos momentos.'); login.disabled = false;
        }
    });
    logout.addEventListener('click', async () => {
        logout.disabled = true;
        const { error } = await auth.client.auth.signOut({ scope: 'local' });
        if (error) window.showNoticePopup?.('No se pudo cerrar sesión', 'Vuelve a intentarlo.');
        else showSession(null);
        logout.disabled = false;
    });
})();
