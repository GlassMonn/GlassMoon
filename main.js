/**
 * Glass Moon Studios – Interaktív UI vezérlő (main.js)
 * Kezeli: mobil hamburger menüt, görgetés alapú aktív menüpontot,
 * portfólió szűrést, lightbox galériát, parallax/reveal animációkat és az űrlapot.
 */

document.addEventListener('DOMContentLoaded', () => {
    /* 1. Aktuális év a láblécben */
    const yearEl = document.getElementById('current-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    /* 2. Fejléc görgetés figyelése & aktív menüpont kijelölése */
    const header = document.getElementById('top-header');
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.desktop-nav .nav-link, .mobile-nav .mobile-link');

    function updateNavigationState() {
        const scrollY = window.scrollY;

        if (header) {
            header.classList.toggle('scrolled', scrollY > 30);
        }

        let currentId = 'kezdolap';
        sections.forEach(section => {
            const top = section.offsetTop - 160;
            const height = section.offsetHeight;
            if (scrollY >= top && scrollY < top + height) {
                currentId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                link.classList.toggle('active', href === `#${currentId}`);
            }
        });
    }

    window.addEventListener('scroll', updateNavigationState, { passive: true });
    updateNavigationState();

    /* 3. Mobil Hamburger Menü */
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerClose = document.getElementById('drawer-close');
    const mobileBackdrop = document.getElementById('mobile-backdrop');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    function openDrawer() {
        if (!mobileDrawer || !hamburgerBtn) return;
        mobileDrawer.classList.add('open');
        mobileDrawer.setAttribute('aria-hidden', 'false');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        if (!mobileDrawer || !hamburgerBtn) return;
        mobileDrawer.classList.remove('open');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeDrawer);

    mobileLinks.forEach(link => {
        link.addEventListener('click', closeDrawer);
    });

    /* 4. Scroll-alapú megjelenés (Intersection Observer) */
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -40px 0px'
        });

        revealElements.forEach(el => revealObserver.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('is-visible'));
    }

    /* 5. Visszafogott Parallax a háttér holdmotívumra */
    const moonEl = document.querySelector('.moon-crescent');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (moonEl && !prefersReducedMotion) {
        window.addEventListener('scroll', () => {
            const offset = window.scrollY * 0.12;
            moonEl.style.transform = `translate3d(0, ${offset}px, 0) rotate(-18deg)`;
        }, { passive: true });
    }

    /* 6. Portfólió kategória szűrés */
    const filterButtons = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;

            filterButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            portfolioItems.forEach(item => {
                const category = item.dataset.category;
                if (filter === 'all' || category === filter) {
                    item.classList.remove('hidden-item');
                } else {
                    item.classList.add('hidden-item');
                }
            });
        });
    });

    /* 7. Lightbox Galéria */
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDesc = document.getElementById('lightbox-desc');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxBackdrop = document.getElementById('lightbox-backdrop');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    let visibleItems = [];
    let currentIndex = 0;

    function getVisiblePortfolioItems() {
        return Array.from(portfolioItems).filter(item => !item.classList.contains('hidden-item'));
    }

    function showLightboxImage(index) {
        visibleItems = getVisiblePortfolioItems();
        if (!visibleItems.length) return;

        currentIndex = (index + visibleItems.length) % visibleItems.length;
        const target = visibleItems[currentIndex];
        const img = target.querySelector('img');

        if (img && lightboxImg) {
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt || '';
        }
        if (lightboxTitle) lightboxTitle.textContent = target.dataset.title || '';
        if (lightboxDesc) lightboxDesc.textContent = target.dataset.desc || '';
    }

    function openLightbox(item) {
        visibleItems = getVisiblePortfolioItems();
        const idx = visibleItems.indexOf(item);
        showLightboxImage(idx >= 0 ? idx : 0);

        if (lightboxModal) {
            lightboxModal.classList.add('open');
            lightboxModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeLightbox() {
        if (!lightboxModal) return;
        lightboxModal.classList.remove('open');
        lightboxModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    portfolioItems.forEach(item => {
        item.addEventListener('click', () => openLightbox(item));
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', () => showLightboxImage(currentIndex - 1));
    if (lightboxNext) lightboxNext.addEventListener('click', () => showLightboxImage(currentIndex + 1));

    /* Billentyűzet támogatás (ESC és nyilak) */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDrawer();
            closeLightbox();
        }
        if (lightboxModal && lightboxModal.classList.contains('open')) {
            if (e.key === 'ArrowLeft') showLightboxImage(currentIndex - 1);
            if (e.key === 'ArrowRight') showLightboxImage(currentIndex + 1);
        }
    });

    /* 8. Kapcsolatfelvételi űrlap megnyitása a látogató saját levelezőjében (Gmail) */
    const contactForm = document.getElementById('contact-form');
    const formFeedback = document.getElementById('form-feedback');

    if (contactForm && formFeedback) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('sender-name').value.trim();
            const email = document.getElementById('sender-email').value.trim();
            const message = document.getElementById('sender-message').value.trim();

            if (!name || !email || !message) {
                formFeedback.textContent = 'Kérjük, töltsd ki a nevet, az e-mail címet és az üzenet mezőt is.';
                return;
            }

            // A levél tárgya és szövege
            const subject = encodeURIComponent(`Új ajánlatkérés - ${name}`);
            const body = encodeURIComponent(
                `Név: ${name}\n` +
                `E-mail cím: ${email}\n\n` +
                `Projekt leírása:\n${message}`
            );

            // Megnyitja a levelezőt (pl. Gmail) az előre kitöltött adatokkal
            window.location.href = `mailto:gmpictures01@gmail.com?subject=${subject}&body=${body}`;

            formFeedback.textContent = `Köszönjük, ${name}! Megnyitottuk a leveleződet a kész üzenettel, már csak el kell küldened.`;
            contactForm.reset();
        });
    }
});
