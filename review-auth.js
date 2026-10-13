(() => {
    'use strict';
    const config = window.REVIEWS_CONFIG || {};
    if (!config.googleEnabled) return;

    const panel = document.getElementById('reviewAccount');
    const writer = document.querySelector('.reviewWrite');
    if (!panel || !writer) return;

    panel.innerHTML = `
        <div class="reviewAccountIdentity">
            <div id="reviewGoogleAvatarWrap" class="reviewAccountAvatar" hidden>
                <img id="reviewGoogleAvatar" alt="" referrerpolicy="no-referrer">
                <span id="reviewGoogleInitial" aria-hidden="true"></span>
            </div>
            <div class="reviewAccountDetails">
                <p id="reviewAccountLabel" class="reviewAccountLabel">Publica tu reseña</p>
                <p id="reviewAccountStatus" class="reviewAccountStatus">Inicia sesión para gestionar tus reseñas.</p>
                <p id="reviewAccountEmail" class="reviewAccountEmail" hidden></p>
            </div>
        </div>
        <button id="reviewGoogleLogin" type="button" class="heroBoton" disabled>Continuar con Google</button>
        <button id="reviewGoogleLogout" type="button" class="reviewAccountLogout" hidden>Cerrar sesión</button>`;
    writer.after(panel);

    const style = document.createElement('style');
    style.textContent = `.reviewAccount{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px;padding:18px 20px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:linear-gradient(120deg,rgba(27,7,39,.95),rgba(12,2,20,.95));text-align:left}.reviewAccountIdentity{display:flex;align-items:center;gap:13px;min-width:0}.reviewAccountAvatar{display:grid;place-items:center;width:48px;height:48px;flex:0 0 48px;overflow:hidden;border:1px solid rgba(255,181,255,.45);border-radius:50%;background:#790089;color:#fff;font-weight:700}.reviewAccountAvatar[hidden],.reviewAccountAvatar>[hidden],.reviewAccountEmail[hidden]{display:none}.reviewAccountAvatar img{width:100%;height:100%;object-fit:cover}.reviewAccountDetails{min-width:0}.reviewAccount p{margin:0}.reviewAccountLabel{color:#d783df;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase}.reviewAccountStatus{color:#fff;font-size:16px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}.reviewAccountEmail{color:#c7b8ca;font-size:13px;line-height:1.4;overflow-wrap:anywhere}.reviewAccount .heroBoton,.reviewAccountLogout{flex:0 0 auto;margin:0}.reviewAccountLogout{padding:9px 13px;border:1px solid rgba(255,255,255,.22);border-radius:20px;background:transparent;color:#e9d9ed;font-size:12px;cursor:pointer}.reviewAccountLogout:hover{border-color:#ff8fff;color:#fff}@media(max-width:767px){.reviewAccount{align-items:flex-start;flex-direction:column}.reviewAccount .heroBoton,.reviewAccountLogout{width:100%}}`;
    document.head.append(style);

    const login = document.getElementById('reviewGoogleLogin');
    const logout = document.getElementById('reviewGoogleLogout');
    const status = document.getElementById('reviewAccountStatus');
    const accountLabel = document.getElementById('reviewAccountLabel');
    const accountEmail = document.getElementById('reviewAccountEmail');
    const avatarWrap = document.getElementById('reviewGoogleAvatarWrap');
    const avatar = document.getElementById('reviewGoogleAvatar');
    const avatarInitial = document.getElementById('reviewGoogleInitial');
    const auth = window.reviewAuth = { session: null, ready: Promise.resolve(), client: null };

    panel.hidden = false;
    document.getElementById('reviewAccountNote').textContent = 'Comparte tu experiencia con tu cuenta de Google.';
    document.getElementById('reviewOwnershipHint').textContent = 'Podrás editar o eliminar tu reseña iniciando sesión con la misma cuenta otro día o desde otro dispositivo.';
    writer.hidden = true;

    function showSession(session) {
        auth.session = session;
        login.hidden = !!session;
        logout.hidden = !session;
        writer.hidden = !session;
        if (session) {
            const metadata = session.user.user_metadata || {};
            const googleIdentity = session.user.identities?.find(identity => identity.provider === 'google')?.identity_data || {};
            const name = metadata.full_name || metadata.name || googleIdentity.full_name || googleIdentity.name || session.user.email || 'Cliente';
            const imageUrl = metadata.avatar_url || metadata.picture || googleIdentity.avatar_url || googleIdentity.picture || '';
            accountLabel.textContent = 'Cuenta de Google conectada';
            status.textContent = name;
            accountEmail.textContent = session.user.email || '';
            accountEmail.hidden = !session.user.email;
            avatarInitial.textContent = Array.from(name.trim())[0]?.toLocaleUpperCase('es') || '•';
            avatarWrap.hidden = false;
            avatar.hidden = !imageUrl;
            avatarInitial.hidden = !!imageUrl;
            if (imageUrl) avatar.src = imageUrl;
        } else {
            accountLabel.textContent = 'Publica tu reseña';
            status.textContent = 'Inicia sesión con Google para publicar y gestionar tus reseñas.';
            accountEmail.hidden = true;
            avatar.removeAttribute('src');
            avatar.hidden = true;
            avatarInitial.hidden = false;
            avatarWrap.hidden = true;
        }
        setTimeout(() => document.dispatchEvent(new CustomEvent('review-auth-changed')), 0);
    }

    avatar.addEventListener('error', () => {
        avatar.hidden = true;
        avatarInitial.hidden = false;
        avatar.removeAttribute('src');
    });

    auth.ready = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/supabase-2.117.3.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
    }).then(async () => {
        auth.client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
            auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        auth.client.auth.onAuthStateChange((_event, session) => showSession(session));
        const callbackUrl = new URL(window.location.href);
        const code = callbackUrl.searchParams.get('code');
        const callbackError = callbackUrl.searchParams.get('error');
        if (callbackError) throw new Error('OAuth callback rejected');

        let session;
        if (code) {
            status.textContent = 'Completando el inicio de sesión…';
            const { data, error } = await auth.client.auth.exchangeCodeForSession(code);
            if (error || !data.session) throw new Error('OAuth exchange failed');
            session = data.session;
        } else {
            const { data, error } = await auth.client.auth.getSession();
            if (error) throw error;
            session = data.session;
        }
        for (const parameter of ['code', 'sb_flow_id', 'error', 'error_code', 'error_description']) callbackUrl.searchParams.delete(parameter);
        window.history.replaceState(null, '', callbackUrl.href);
        showSession(session);
        login.disabled = false;
    }).catch(() => {
        login.disabled = false;
        status.textContent = 'No se pudo completar el acceso. Pulsa Continuar con Google para volver a intentarlo desde esta página.';
    });

    login.addEventListener('click', async () => {
        if (window.location.protocol === 'file:') {
            window.showNoticePopup?.('Abre la web publicada', 'Para iniciar sesión con Google, abre https://neizanphoto26.github.io/ o la web mediante Live Server.');
            return;
        }
        login.disabled = true;
        try {
            await auth.ready;
            const redirect = new URL('Resenas.html', window.location.href);
            redirect.hash = '';
            redirect.search = '';
            const { error } = await auth.client.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirect.href, queryParams: { prompt: 'select_account' } }
            });
            if (error) throw error;
        } catch {
            window.showNoticePopup?.('No se pudo conectar con Google', 'Inténtalo de nuevo en unos momentos.');
            login.disabled = false;
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
