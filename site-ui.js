(() => {
    'use strict';
    const menuButton = document.getElementById('botonMenu');
    const closeButton = document.getElementById('botonCerrar');
    const menu = document.getElementById('panelMenu');
    if (menuButton && closeButton && menu) {
        function toggleMenu(open) {
            menu.classList.toggle('panelabierto', open);
            menu.setAttribute('aria-hidden', String(!open));
            menuButton.setAttribute('aria-expanded', String(open));
            menu.inert = !open;
            if (open) closeButton.focus();
            else menuButton.focus();
        }
        menuButton.addEventListener('click', () => toggleMenu(!menu.classList.contains('panelabierto')));
        closeButton.addEventListener('click', () => toggleMenu(false));
        menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => toggleMenu(false)));
        document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.classList.contains('panelabierto')) toggleMenu(false); });
        // Los enlaces del panel cerrado no deben recibir foco.
        menu.inert = true;
    }

    const popup = document.createElement('dialog');
    popup.className = 'successPopup';
    popup.setAttribute('aria-labelledby', 'successPopupTitle');
    popup.setAttribute('aria-describedby', 'successPopupText');
    const icon = document.createElement('div');
    icon.className = 'successPopupIcon'; icon.textContent = '✓'; icon.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h2'); title.id = 'successPopupTitle';
    const message = document.createElement('p'); message.id = 'successPopupText';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'reservaBoton'; close.textContent = '¡Perfecto!';
    popup.append(icon, title, message, close);
    document.body.append(popup);
    close.addEventListener('click', () => popup.close());
    popup.addEventListener('click', event => { if (event.target === popup) popup.close(); });
    function showPopup(heading, text, notice = false) {
        title.textContent = heading; message.textContent = text;
        icon.textContent = notice ? '!' : '✓';
        close.textContent = notice ? 'Entendido' : '¡Perfecto!';
        if (!popup.open) popup.showModal();
        close.focus();
    }
    window.showSuccessPopup = (heading, text) => showPopup(heading, text);
    window.showNoticePopup = (heading, text) => showPopup(heading, text, true);

    // La reserva usa el envío HTML original a Formspree y su redirección.
})();
