(() => {
    'use strict';
    const form = document.getElementById('reviewForm');
    const list = document.getElementById('reviewsList');
    const status = document.getElementById('reviewsStatus');
    const feedback = document.getElementById('reviewFeedback');
    const submit = document.getElementById('reviewSubmit');
    const more = document.getElementById('reviewsMore');
    const summary = document.getElementById('reviewsSummary');
    const allLink = document.getElementById('reviewsAll');
    const isAllReviews = document.getElementById('resenas').dataset?.view === 'all';
    const photosInput = document.getElementById('reviewPhotos');
    const photosPreview = document.getElementById('reviewPhotoPreview');
    const deletePanel = document.getElementById('reviewDeletePanel');
    const deleteFeedback = document.getElementById('reviewDeleteFeedback');
    const deleteButton = document.getElementById('reviewConfirmDelete');
    const config = window.REVIEWS_CONFIG || {};
    const url = (config.supabaseUrl || '').replace(/\/$/, '');
    const key = config.publishableKey || '';
    let accountOwned = new Set();
    let authGeneration = 0;
    let currentAccountId = null;
    const storageKey = `neizan-review-links:${url}`;
    let owned = {};
    try { owned = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* El enlace también se puede copiar. */ }
    let selectedOwner = null;
    let pendingSubmission = null;
    let editingOwner = null;
    let selectedPhotos = [];
    let processingPhotos = false;
    const editCancel = document.getElementById('reviewEditCancel');
    const clearPhotos = document.getElementById('reviewClearPhotos');
    const writer = form.closest('.reviewWrite');
    const accountLimit = document.createElement('p');
    accountLimit.id = 'reviewAccountLimit';
    accountLimit.className = 'reviewAccountLimit';
    accountLimit.hidden = true;
    accountLimit.setAttribute('role', 'status');
    accountLimit.textContent = 'Ya has publicado una reseña con esta cuenta. Puedes editarla o eliminarla desde tu tarjeta.';
    writer.after(accountLimit);
    let accountReviewResolved = false;
    function updateReviewAccess() {
        if (!config.googleEnabled) return;
        const signedIn = !!window.reviewAuth?.session;
        const hasReview = signedIn && accountReviewResolved && accountOwned.size > 0;
        writer.hidden = !signedIn || !accountReviewResolved || (hasReview && !editingOwner);
        accountLimit.hidden = !hasReview || !!editingOwner;
    }
    function showPhotoPreview(images) {
        selectedPhotos = [...images];
        photosPreview.replaceChildren();
        images.forEach((src, index) => {
            const wrapper = document.createElement('div'); wrapper.className = 'reviewPreviewPhoto';
            const image = document.createElement('img'); image.src = src; image.alt = `Foto ${index + 1} de tu reseña`;
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'reviewRemovePhoto';
            remove.textContent = 'Quitar foto'; remove.setAttribute('aria-label', `Quitar foto ${index + 1}`);
            remove.addEventListener('click', () => {
                if (processingPhotos || submit.disabled) return;
                const remaining = selectedPhotos.filter((_, photoIndex) => photoIndex !== index);
                photosReady = Promise.resolve(remaining); photosInput.value = ''; showPhotoPreview(remaining);
            });
            wrapper.append(image, remove); photosPreview.append(wrapper);
        });
        clearPhotos.hidden = images.length === 0;
    }
    function resetEditor() {
        editingOwner = null; pendingSubmission = null; form.reset();
        photoSelection++; photosReady = Promise.resolve([]); showPhotoPreview([]);
        form.querySelector('h3').textContent = '¿Qué tal tu sesión?';
        editCancel.hidden = true; submit.textContent = 'Enviar mi reseña';
        document.querySelectorAll('.ratingSelected').forEach(label => label.classList.remove('ratingSelected'));
        document.getElementById('ratingHint').textContent = 'Elige de 1 a 5 estrellas';
        updateReviewAccess();
    }
    editCancel.addEventListener('click', () => { if (!submit.disabled) { resetEditor(); feedback.textContent = ''; } });
    clearPhotos.addEventListener('click', () => {
        photoSelection++; photosInput.value = ''; photosReady = Promise.resolve([]); showPhotoPreview([]);
    });
    async function openEditor(review, owner, button) {
        if (submit.disabled) return;
        button.disabled = true;
        try {
            const [current] = await request(`reviews?select=photos&id=eq.${review.id}&approved=eq.true`);
            if (!current) throw new Error('Missing review');
            resetEditor(); editingOwner = owner; updateReviewAccess();
            document.getElementById('reviewName').value = review.name;
            document.getElementById('reviewComment').value = review.comment;
            const selected = form.querySelector(`input[name="reviewRating"][value="${review.rating}"]`);
            selected.checked = true; selected.dispatchEvent(new Event('change'));
            const images = current.photos || [];
            photosReady = Promise.resolve(images); showPhotoPreview(images);
            form.querySelector('h3').textContent = 'Edita tu reseña';
            submit.textContent = 'Guardar cambios'; editCancel.hidden = false;
            feedback.textContent = 'Puedes cambiar el texto, las estrellas y añadir fotos. Quita solo las que quieras reemplazar.';
            form.closest('details').open = true;
            form.scrollIntoView({ behavior: 'auto', block: 'start' });
            document.getElementById('reviewComment').focus({ preventScroll: true });
        } catch { status.textContent = 'No se pudo abrir la edición. Vuelve a intentarlo.'; }
        finally { button.disabled = false; }
    }
    let photosReady = Promise.resolve([]);
    async function compressPhoto(file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
            throw new Error('Usa fotos JPG, PNG o WebP de hasta 15 MB cada una.');
        }
        const bitmap = await createImageBitmap(file);
        try {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            for (let quality = 0.8; quality >= 0.3; quality -= 0.1) {
                const src = canvas.toDataURL('image/jpeg', quality);
                if (src.length <= 165000) return src;
            }
            throw new Error('Esta foto pesa demasiado. Selecciona una versión más pequeña.');
        } finally { bitmap.close(); }
    }
    let photoSelection = 0;
    photosInput.addEventListener('change', () => {
        const files = Array.from(photosInput.files || []);
        if (!files.length) return;
        if (selectedPhotos.length + files.length > 3) {
            photosInput.value = '';
            feedback.textContent = 'MÁXIMO 3 FOTOS. Quita alguna de las actuales para añadir otras.';
            window.showNoticePopup?.('MÁXIMO 3 FOTOS', 'Puedes publicar hasta 3 fotos por reseña. Tus fotos actuales se conservan; quita alguna si quieres añadir otras.');
            return;
        }
        const selection = ++photoSelection;
        const previous = [...selectedPhotos];
        processingPhotos = true; photosInput.disabled = true; clearPhotos.disabled = true;
        photosReady = (async () => {
            try {
                const images = [...previous];
                // Procesar una a una evita decodificar varias fotos grandes simultáneamente.
                for (const file of files) images.push(await compressPhoto(file));
                if (selection === photoSelection) {
                    showPhotoPreview(images);
                    feedback.textContent = '';
                }
                return selection === photoSelection ? images : selectedPhotos;
            } catch (error) {
                if (selection === photoSelection) feedback.textContent = error.message;
                // Un archivo inválido no borra las fotos válidas anteriores.
                return previous;
            } finally {
                processingPhotos = false; photosInput.disabled = submit.disabled; clearPhotos.disabled = submit.disabled;
                photosInput.value = '';
            }
        })();
    });
    const photoDialog = document.getElementById('reviewPhotoViewer');
    const photoFull = document.getElementById('reviewPhotoFull');
    const photoPrev = document.getElementById('reviewPhotoPrev');
    const photoNext = document.getElementById('reviewPhotoNext');
    let viewerPhotos = [];
    let viewerIndex = 0;
    let viewerName = '';
    function renderReviewPhoto() {
        photoFull.src = viewerPhotos[viewerIndex];
        photoFull.alt = `Foto ${viewerIndex + 1} de ${viewerPhotos.length} de la reseña de ${viewerName}`;
        photoPrev.hidden = photoNext.hidden = viewerPhotos.length < 2;
    }
    function moveReviewPhoto(direction) {
        if (!viewerPhotos.length) return;
        viewerIndex = (viewerIndex + direction + viewerPhotos.length) % viewerPhotos.length;
        renderReviewPhoto();
    }
    function openReviewPhoto(images, index, name) {
        viewerPhotos = images; viewerIndex = index; viewerName = name;
        renderReviewPhoto();
        photoDialog.showModal();
        document.body.classList.add('lightboxActive');
    }
    photoPrev.addEventListener('click', () => moveReviewPhoto(-1));
    photoNext.addEventListener('click', () => moveReviewPhoto(1));
    photoDialog.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); moveReviewPhoto(-1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); moveReviewPhoto(1); }
    });
    let touchStart = null;
    photoFull.addEventListener('touchstart', event => { if (event.touches.length === 1) touchStart = event.touches[0].clientX; }, { passive: true });
    photoFull.addEventListener('touchend', event => {
        if (touchStart !== null && event.changedTouches.length === 1) {
            const distance = event.changedTouches[0].clientX - touchStart;
            if (Math.abs(distance) > 50) moveReviewPhoto(distance < 0 ? 1 : -1);
        }
        touchStart = null;
    }, { passive: true });
    document.getElementById('reviewPhotoClose').addEventListener('click', () => photoDialog.close());
    photoDialog.addEventListener('click', event => { if (event.target === photoDialog) photoDialog.close(); });
    photoDialog.addEventListener('close', () => { photoFull.src = ''; viewerPhotos = []; document.body.classList.remove('lightboxActive'); });
    const validOwner = owner => owner && /^[0-9a-f-]{36}$/.test(owner.id) && (accountOwned.has(owner.id) || (!config.googleEnabled && /^[a-f0-9]{64}$/.test(owner.token)));
    async function syncAccount() {
        const generation = ++authGeneration;
        accountOwned = new Set();
        accountReviewResolved = false;
        updateReviewAccess();
        if (!window.reviewAuth?.session) {
            accountReviewResolved = true;
            updateReviewAccess();
            if (config.googleEnabled) loadReviews(true);
            return;
        }
        try {
            // Solo vincular las reseñas que este navegador puede demostrar que publicó.
            for (const owner of Object.values(owned).slice(0, 50)) {
                if (!/^[0-9a-f-]{36}$/.test(owner.id) || !/^[a-f0-9]{64}$/.test(owner.token)) continue;
                if (generation !== authGeneration) return;
                await request('rpc/claim_my_review', { method: 'POST', body: JSON.stringify({ p_id: owner.id, p_token: owner.token }) });
            }
            const ids = await request('rpc/my_review_ids', { method: 'POST', body: '{}' });
            if (generation !== authGeneration) return;
            accountOwned = new Set(ids.map(row => row.id));
            accountReviewResolved = true;
            updateReviewAccess();
            loadReviews(true);
        } catch {
            accountReviewResolved = true;
            updateReviewAccess();
            document.getElementById('reviewAccountStatus').textContent = 'La sesión está iniciada, pero no se pudieron recuperar tus reseñas. Recarga para volver a intentarlo.';
        }
    }
    document.addEventListener('review-auth-changed', () => {
        const accountId = window.reviewAuth?.session?.user?.id || null;
        // Renovar el token no debe borrar una edición que esté escribiendo el cliente.
        if (accountId === currentAccountId) return;
        currentAccountId = accountId;
        if (!submit.disabled) { resetEditor(); feedback.textContent = ''; }
        syncAccount();
    });
    function remember(owner) {
        owned[owner.id] = owner;
        try { localStorage.setItem(storageKey, JSON.stringify(owned)); } catch { /* No impedir el envío si el navegador bloquea el almacenamiento. */ }
    }
    function openDeletion(owner) {
        if (!validOwner(owner)) return;
        selectedOwner = owner;
        deletePanel.hidden = false;
        deleteFeedback.textContent = '';
        deleteButton.disabled = false;
        deletePanel.scrollIntoView({ behavior: 'auto', block: 'center' });
        deleteButton.focus({ preventScroll: true });
    }
    document.getElementById('reviewCancelDelete').addEventListener('click', () => {
        deletePanel.hidden = true;
        selectedOwner = null;
        if (window.location.hash.startsWith('#eliminar-resena=')) window.location.hash = 'resenas';
    });
    deleteButton.addEventListener('click', async () => {
        if (!configured || !validOwner(selectedOwner) || deleteButton.disabled) return;
        const owner = selectedOwner;
        deleteButton.disabled = true;
        deleteFeedback.textContent = 'Eliminando…';
        try {
            const deleted = await request('rpc/delete_own_review', {
                method: 'POST', body: JSON.stringify({ p_id: owner.id, p_token: owner.token })
            });
            deleteFeedback.textContent = deleted ? 'Tu reseña y sus fotos se han eliminado.' : 'Esta reseña ya no existe o este navegador no tiene autorización para eliminarla.';
            if (deleted) {
                delete owned[owner.id];
                accountOwned.delete(owner.id);
                accountReviewResolved = true;
                selectedOwner = null;
                deletePanel.hidden = true;
                try { localStorage.setItem(storageKey, JSON.stringify(owned)); } catch { /* Opcional. */ }
                if (window.location.hash.startsWith('#eliminar-resena=')) window.location.hash = 'resenas';
                updateReviewAccess();
                window.showSuccessPopup?.('Reseña eliminada', 'Tu reseña y sus fotos se han eliminado correctamente.');
                loadReviews(true); loadSummary();
            }
        } catch (error) {
            deleteFeedback.textContent = error.code === 'PGRST202'
                ? 'La eliminación todavía no está activada. Contacta con Neizan para retirar tu reseña.'
                : 'No se pudo confirmar la eliminación. Puedes volver a intentarlo.';
            deleteButton.disabled = false;
        }
    });
    const pageSize = isAllReviews ? 9 : 3;
    let offset = 0;
    let loading = false;
    let refreshRequested = false;
    const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && /^sb_publishable_/.test(key);

    async function request(path, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`${url}/rest/v1/${path}`, {
                ...options,
                signal: controller.signal,
                headers: { apikey: key, 'Content-Type': 'application/json', ...(window.reviewAuth?.session?.access_token ? { Authorization: `Bearer ${window.reviewAuth.session.access_token}` } : {}), ...options.headers }
            });
            // Supabase puede devolver 201 sin cuerpo con return=minimal.
            const body = await response.text();
            if (!response.ok) {
                const error = new Error('Request failed');
                try { error.code = JSON.parse(body).code; } catch { /* Error de red o proxy. */ }
                throw error;
            }
            return body ? JSON.parse(body) : null;
        } finally { clearTimeout(timer); }
    }

    function addReview(review) {
        const card = document.createElement('article');
        card.className = 'reviewCard';
        card.id = `review-${review.id}`;
        const head = document.createElement('div');
        head.className = 'reviewHead';
        const avatar = document.createElement('span');
        avatar.className = 'reviewAvatar';
        avatar.setAttribute('aria-hidden', 'true');
        const initial = Array.from(review.name.trim())[0].toLocaleUpperCase('es');
        const avatarUrl = typeof review.avatar_url === 'string' && /^https:\/\//i.test(review.avatar_url) ? review.avatar_url : '';
        if (avatarUrl) {
            const image = document.createElement('img');
            image.src = avatarUrl;
            image.alt = '';
            image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', () => { image.remove(); avatar.textContent = initial; });
            avatar.append(image);
        } else avatar.textContent = initial;
        const identity = document.createElement('div');
        const name = document.createElement('h3');
        name.textContent = review.name;
        const date = document.createElement('time');
        date.dateTime = review.created_at;
        date.textContent = new Date(review.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
        identity.append(name, date);
        head.append(avatar, identity);
        const stars = document.createElement('p');
        stars.className = 'reviewStars';
        stars.setAttribute('aria-label', `${review.rating} de 5 estrellas`);
        stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const comment = document.createElement('p');
        comment.className = 'reviewComment';
        // textContent impide que un comentario ejecute HTML o JavaScript.
        comment.textContent = review.comment;
        card.append(head, stars, comment);
        if (!isAllReviews) {
            const expand = document.createElement('a');
            expand.className = 'reviewExpandLink';
            expand.href = `Resenas.html#review-${review.id}`;
            expand.textContent = 'Ver reseña en grande';
            card.append(expand);
        }
        if (review.photo_count > 0) {
            const viewPhotos = document.createElement('button');
            viewPhotos.type = 'button';
            viewPhotos.className = 'reviewPhotosButton';
            viewPhotos.textContent = `Ver fotos (${review.photo_count})`;
            const photos = document.createElement('div');
            photos.className = 'reviewPhotos';
            viewPhotos.addEventListener('click', async () => {
                viewPhotos.disabled = true;
                try {
                    const [row] = await request(`reviews?select=photos&id=eq.${review.id}&approved=eq.true`);
                    const images = (row?.photos || []).filter(src => /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(src));
                    images.forEach((src, index) => {
                        const image = document.createElement('img');
                        image.src = src; image.alt = `Foto ${index + 1} de la reseña de ${review.name}`;
                        image.decoding = 'async';
                        image.addEventListener('click', () => openReviewPhoto(images, index, review.name));
                        photos.append(image);
                    });
                    viewPhotos.hidden = true;
                } catch {
                    viewPhotos.textContent = 'Reintentar cargar fotos';
                    viewPhotos.disabled = false;
                }
            });
            card.append(viewPhotos, photos);
        }
        const owner = accountOwned.has(review.id) ? { id: review.id, token: '' } : (config.googleEnabled ? null : owned[review.id]);
        if (validOwner(owner)) {
            const actions = document.createElement('div');
            actions.className = 'reviewOwnerActions';
            const remove = document.createElement('button');
            const edit = document.createElement('button');
            edit.type = 'button'; edit.textContent = 'Editar mi reseña';
            edit.addEventListener('click', () => openEditor(review, owner, edit));
            remove.type = 'button';
            remove.textContent = 'Eliminar mi reseña';
            remove.addEventListener('click', () => openDeletion(owner));
            actions.append(edit, remove);
            card.append(actions);
        }
        list.append(card);
    }

    async function loadReviews(reset = false) {
        if (loading) { if (reset) refreshRequested = true; return; }
        if (reset) {
            offset = 0;
            list.replaceChildren();
            more.hidden = true;
        }
        loading = true;
        more.disabled = true;
        status.textContent = 'Cargando opiniones…';
        try {
            let rows;
            try {
                rows = await request(`reviews?select=id,name,rating,comment,created_at,photo_count,avatar_url&approved=eq.true&order=created_at.desc,id.desc&limit=${pageSize + 1}&offset=${offset}`);
            } catch (error) {
                // Seguir mostrando el texto mientras el propietario aplica la migración.
                if (error.code !== '42703' && error.code !== 'PGRST204') throw error;
                rows = await request(`reviews?select=id,name,rating,comment,created_at&approved=eq.true&order=created_at.desc,id.desc&limit=${pageSize + 1}&offset=${offset}`);
            }
            const page = rows.slice(0, pageSize);
            page.forEach(addReview);
            offset += page.length;
            more.hidden = !isAllReviews || rows.length <= pageSize;
            if (allLink) allLink.hidden = isAllReviews || offset === 0;
            if (isAllReviews && window.location.hash.startsWith('#review-')) {
                const target = document.getElementById(window.location.hash.slice(1));
                target?.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
            status.textContent = offset === 0 ? 'Todavía no hay reseñas publicadas. ¿Compartes tu experiencia?' : '';
        } catch {
            status.textContent = 'No se pudieron cargar las reseñas. Puedes volver a intentarlo.';
            more.textContent = 'Reintentar';
            more.hidden = false;
        } finally {
            loading = false;
            more.disabled = false;
            if (refreshRequested) {
                refreshRequested = false;
                loadReviews(true);
            }
        }
    }

    async function loadSummary() {
        try {
            const [data] = await request('rpc/review_summary', { method: 'POST', body: '{}' });
            if (!data || !Number(data.total)) { summary.hidden = true; summary.textContent = ''; return; }
            const average = Number(data.average).toLocaleString('es-ES', { minimumFractionDigits: 1 });
            summary.textContent = `${average} / 5 ★ · ${data.total} ${Number(data.total) === 1 ? 'reseña' : 'reseñas'}`;
            summary.hidden = false;
        } catch { /* La lista y el formulario siguen funcionando sin la media. */ }
    }

    document.querySelectorAll('input[name="reviewRating"]').forEach(input => {
        input.addEventListener('change', () => {
            document.getElementById('ratingHint').textContent = `${input.value} de 5 estrellas`;
            document.querySelectorAll('.ratingOption').forEach(label => {
                label.classList.toggle('ratingSelected', Number(label.querySelector('input').value) <= Number(input.value));
            });
        });
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!configured || submit.disabled) return;
        if (config.googleEnabled && !window.reviewAuth?.session) { window.showNoticePopup?.('Inicia sesión con Google', 'Usa tu cuenta para publicar y gestionar tu reseña cuando quieras.'); return; }
        if (config.googleEnabled && !editingOwner && accountOwned.size > 0) {
            updateReviewAccess();
            window.showNoticePopup?.('Ya tienes una reseña', 'Solo se permite una reseña por cuenta. Puedes editarla o eliminarla desde tu tarjeta.');
            return;
        }
        const data = new FormData(form);
        if (data.get('website')) return; // Campo señuelo para bots básicos.
        const name = String(data.get('reviewName') || '').trim();
        const comment = String(data.get('reviewComment') || '').trim();
        const rating = Number(data.get('reviewRating'));
        if (name.length < 2 || name.length > 60 || comment.length < 10 || comment.length > 1000 || !Number.isInteger(rating) || rating < 1 || rating > 5 || !data.get('reviewConsent')) {
            feedback.textContent = 'Revisa el nombre, el comentario, las estrellas y el consentimiento.';
            return;
        }
        submit.disabled = true;
        photosInput.disabled = true;
        submit.textContent = 'Enviando…';
        editCancel.disabled = true; clearPhotos.disabled = true;
        feedback.textContent = '';
        try {
            const photos = await photosReady;
            if (!photos) { feedback.textContent = 'Revisa las fotos: hasta 3 archivos JPG, PNG o WebP de 15 MB cada uno.'; return; }
            const isEditing = !!editingOwner;
            if (isEditing) {
                const saved = await request('rpc/update_own_review', {
                    method: 'POST', body: JSON.stringify({ p_id: editingOwner.id, p_token: editingOwner.token, p_name: name, p_rating: rating, p_comment: comment, p_consent: true, p_photos: photos })
                });
                if (!saved) throw new Error('Not authorized');
            } else {
            const signature = JSON.stringify({ name, rating, comment, photos });
            if (!pendingSubmission || pendingSubmission.signature !== signature) {
                const bytes = crypto.getRandomValues(new Uint8Array(32));
                pendingSubmission = {
                    id: crypto.randomUUID(),
                    token: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''),
                    signature
                };
            }
            const owner = { id: pendingSubmission.id, token: pendingSubmission.token };
            // Guardarlo antes evita perder la propiedad si la respuesta se interrumpe.
            remember(owner);
            await request('rpc/submit_review', {
                method: 'POST',
                body: JSON.stringify({ p_id: owner.id, p_name: name, p_rating: rating, p_comment: comment, p_consent: true, p_token: owner.token, p_photos: photos })
            });
            if (config.googleEnabled) {
                accountOwned.add(owner.id);
                accountReviewResolved = true;
            }
            }
            resetEditor();
            feedback.textContent = isEditing ? 'Tu reseña se ha actualizado.' : '¡Gracias! Tu reseña se ha publicado.';
            window.showSuccessPopup?.(isEditing ? '¡Cambios guardados!' : '¡Gracias por tu reseña!', isEditing ? 'Tu reseña ya muestra los cambios que has hecho.' : 'Tu reseña se ha publicado. Gracias por compartir tu experiencia con Neizan Photo 26.');
            loadReviews(true);
            loadSummary();
            if (config.googleEnabled) syncAccount();
        } catch (error) {
            if (error.code === '23505' && !editingOwner) {
                feedback.textContent = 'Esta cuenta ya tiene una reseña. Puedes editarla o eliminarla desde su tarjeta.';
                window.showNoticePopup?.('Ya tienes una reseña', 'Solo se permite una reseña por cuenta.');
                syncAccount();
            } else feedback.textContent = error.code === 'PGRST202'
                ? (editingOwner ? 'La edición todavía no está activada. Contacta con Neizan o inténtalo más tarde.' : 'El envío todavía no está actualizado. Contacta con Neizan o inténtalo más tarde.')
                : 'No se ha podido confirmar el envío. Tu texto sigue aquí; vuelve a intentarlo en unos momentos.';
        } finally {
            submit.disabled = false;
            photosInput.disabled = false;
            editCancel.disabled = false; clearPhotos.disabled = false;
            submit.textContent = editingOwner ? 'Guardar cambios' : 'Enviar mi reseña';
        }
    });
    more.addEventListener('click', () => { more.textContent = 'Ver más reseñas'; loadReviews(); });
    if (!configured) {
        status.textContent = 'Las reseñas estarán disponibles próximamente.';
        feedback.textContent = 'El envío de reseñas todavía no está disponible.';
        return;
    }
    submit.disabled = false;
    function readDeletionLink() {
        const match = window.location.hash.match(/^#eliminar-resena=([0-9a-f-]{36})\.([a-f0-9]{64})$/);
        if (match) openDeletion({ id: match[1], token: match[2] });
    }
    window.addEventListener('hashchange', readDeletionLink);
    readDeletionLink();
    // No cargar la base de datos hasta acercarse a este apartado.
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                observer.disconnect();
                loadReviews();
                loadSummary();
            }
        }, { rootMargin: '200px' });
        observer.observe(document.getElementById('resenas'));
    } else { loadReviews(); loadSummary(); }
})();
