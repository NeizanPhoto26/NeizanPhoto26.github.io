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
    const storageKey = `neizan-review-links:${url}`;
    let owned = {};
    try { owned = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* El enlace también se puede copiar. */ }
    let selectedOwner = null;
    let pendingSubmission = null;
    let editingOwner = null;
    const editCancel = document.getElementById('reviewEditCancel');
    const clearPhotos = document.getElementById('reviewClearPhotos');
    function showPhotoPreview(images) {
        photosPreview.replaceChildren();
        images.forEach(src => { const image = document.createElement('img'); image.src = src; image.alt = 'Foto de tu reseña'; photosPreview.append(image); });
        clearPhotos.hidden = images.length === 0;
    }
    function resetEditor() {
        editingOwner = null; pendingSubmission = null; form.reset();
        photoSelection++; photosReady = Promise.resolve([]); showPhotoPreview([]);
        form.querySelector('h3').textContent = '¿Qué tal tu sesión?';
        editCancel.hidden = true; submit.textContent = 'Enviar mi reseña';
        document.querySelectorAll('.ratingSelected').forEach(label => label.classList.remove('ratingSelected'));
        document.getElementById('ratingHint').textContent = 'Elige de 1 a 5 estrellas';
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
            resetEditor(); editingOwner = owner;
            document.getElementById('reviewName').value = review.name;
            document.getElementById('reviewComment').value = review.comment;
            const selected = form.querySelector(`input[name="reviewRating"][value="${review.rating}"]`);
            selected.checked = true; selected.dispatchEvent(new Event('change'));
            const images = current.photos || [];
            photosReady = Promise.resolve(images); showPhotoPreview(images);
            form.querySelector('h3').textContent = 'Edita tu reseña';
            submit.textContent = 'Guardar cambios'; editCancel.hidden = false;
            feedback.textContent = 'Puedes cambiar el texto, las estrellas o las fotos. Seleccionar fotos nuevas sustituye las anteriores.';
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
        const selection = ++photoSelection;
        const files = Array.from(photosInput.files || []);
        photosPreview.replaceChildren();
        photosReady = (async () => {
            try {
                if (files.length > 3) throw new Error('Puedes añadir hasta 3 fotos.');
                const images = [];
                // Procesar una a una evita decodificar varias fotos grandes simultáneamente.
                for (const file of files) images.push(await compressPhoto(file));
                if (selection === photoSelection) {
                    showPhotoPreview(images);
                    feedback.textContent = '';
                }
                return images;
            } catch (error) {
                if (selection === photoSelection) feedback.textContent = error.message;
                return null;
            }
        })();
    });
    const photoDialog = document.getElementById('reviewPhotoViewer');
    const photoFull = document.getElementById('reviewPhotoFull');
    function openReviewPhoto(src, alt) {
        photoFull.src = src; photoFull.alt = alt;
        photoDialog.showModal();
    }
    document.getElementById('reviewPhotoClose').addEventListener('click', () => photoDialog.close());
    photoDialog.addEventListener('click', event => { if (event.target === photoDialog) photoDialog.close(); });
    photoDialog.addEventListener('close', () => { photoFull.src = ''; });
    const validOwner = owner => owner && /^[0-9a-f-]{36}$/.test(owner.id) && /^[a-f0-9]{64}$/.test(owner.token);
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
                try { localStorage.setItem(storageKey, JSON.stringify(owned)); } catch { /* Opcional. */ }
                if (window.location.hash.startsWith('#eliminar-resena=')) window.location.hash = 'resenas';
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
                headers: { apikey: key, 'Content-Type': 'application/json', ...options.headers }
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
        avatar.textContent = Array.from(review.name.trim())[0].toLocaleUpperCase('es');
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
                    (row?.photos || []).forEach((src, index) => {
                        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) return;
                        const image = document.createElement('img');
                        image.src = src; image.alt = `Foto ${index + 1} de la reseña de ${review.name}`;
                        image.decoding = 'async';
                        image.addEventListener('click', () => openReviewPhoto(src, image.alt));
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
        const owner = owned[review.id];
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
                rows = await request(`reviews?select=id,name,rating,comment,created_at,photo_count&approved=eq.true&order=created_at.desc,id.desc&limit=${pageSize + 1}&offset=${offset}`);
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
            }
            resetEditor();
            feedback.textContent = isEditing ? 'Tu reseña se ha actualizado.' : '¡Gracias! Tu reseña se ha publicado.';
            window.showSuccessPopup?.(isEditing ? '¡Cambios guardados!' : '¡Gracias por tu reseña!', isEditing ? 'Tu reseña ya muestra los cambios que has hecho.' : 'Tu reseña se ha publicado. Gracias por compartir tu experiencia con Neizan Photo 26.');
            loadReviews(true);
            loadSummary();
        } catch (error) {
            feedback.textContent = error.code === 'PGRST202'
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
