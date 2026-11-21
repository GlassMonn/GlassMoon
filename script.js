// ========================================
// GLASS MOON STUDIO – GOOGLE DRIVE GALÉRIA
// ========================================

const DRIVE_API_KEY = "AIzaSyCivNGMGPd8lH03UjYCHTgCiqxz9Lc1We4"; // ← ide kerül a Google Drive API kulcs
const EVENTS_FOLDER_ID = "1sXjqSrvHmaJeyF-wG8d4dv6-cfJ0Tv8z";

const API_URL = "https://www.googleapis.com/drive/v3/files";

const CACHE_TTL = 20 * 60 * 1000; // 20 perc
const CONCURRENCY = 4;            // egyszerre ennyi mappa képeit kérjük le

let eventList = null;
let albumContainer = null;

let events = [];
let activeEvent = null;
let activePhoto = 0;

// ========================================
// SEGÉDFÜGGVÉNYEK
// ========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function readCache(key) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;

        const cached = JSON.parse(raw);

        if (Date.now() - cached.time > CACHE_TTL) return null;

        return cached.files;
    } catch {
        return null;
    }
}

function writeCache(key, files) {
    try {
        sessionStorage.setItem(
            key,
            JSON.stringify({ time: Date.now(), files })
        );
    } catch {
        // a gyorsítótár nem kötelező
    }
}

async function runPool(items, worker, limit) {
    let next = 0;

    const runners = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
            while (next < items.length) {
                const index = next++;

                try {
                    await worker(items[index], index);
                } catch (error) {
                    console.error("Mappa betöltési hiba:", error);
                }
            }
        }
    );

    await Promise.all(runners);
}

// ========================================
// GOOGLE DRIVE API
// ========================================

async function getDriveFiles(query) {
    const cacheKey = `gm:${query}`;
    const cached = readCache(cacheKey);

    if (cached) return cached;

    let files = [];
    let pageToken = "";

    do {
        const params = new URLSearchParams({
            key: DRIVE_API_KEY,
            q: query,
            fields: "nextPageToken,files(id,name,mimeType,thumbnailLink)",
            pageSize: "1000",
            orderBy: "name"
        });

        if (pageToken) {
            params.set("pageToken", pageToken);
        }

        const response = await fetch(`${API_URL}?${params}`);

        if (!response.ok) {
            let message = `Google Drive API hiba (${response.status}).`;

            try {
                const error = await response.json();
                console.error("Google Drive API hiba:", error);
                message = error.error?.message || message;
            } catch {
                // nem JSON válasz
            }

            throw new Error(message);
        }

        const data = await response.json();

        files = files.concat(data.files || []);
        pageToken = data.nextPageToken || "";

    } while (pageToken);

    writeCache(cacheKey, files);

    return files;
}

// ========================================
// KÉP URL-EK
// ========================================

function createPhotoUrls(image) {
    const id = encodeURIComponent(image.id);

    // Gyors, átméretezett kép a Google CDN-ről (ha az API adott thumbnailLinket)
    const cdn = width =>
        image.thumbnailLink
            ? image.thumbnailLink.replace(/=s\d+.*$/, `=w${width}`)
            : null;

    const driveThumb = width =>
        `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;

    // Utolsó tartalék: az eredeti, teljes méretű fájl (lassú)
    const original =
        `https://drive.google.com/uc?export=view&id=${id}`;

    const main = [cdn(1600), driveThumb(1600), original].filter(Boolean);
    const small = [cdn(400), driveThumb(400)].filter(Boolean);

    return {
        url: main[0],
        fallbacks: main.slice(1),
        thumb: small[0],
        thumbFallbacks: small.slice(1)
    };
}

// ========================================
// ESEMÉNYEK BETÖLTÉSE
// ========================================

function ensurePhotos(event) {
    if (event.promise) return event.promise;

    event.promise = getDriveFiles(
        `'${event.id}' in parents and mimeType contains 'image/' and trashed = false`
    )
        .then(files => {
            event.photos = files.map(image => ({
                id: image.id,
                name: image.name,
                ...createPhotoUrls(image)
            }));

            return event.photos;
        })
        .catch(error => {
            event.promise = null;
            throw error;
        });

    return event.promise;
}

function countLabel(event) {
    if (event.failed) return "nem elérhető";
    return event.photos ? `${event.photos.length} kép` : "betöltés…";
}

function updateEventCount(index) {
    const label = eventList.querySelector(
        `[data-event-count="${index}"]`
    );

    if (label) {
        label.textContent = countLabel(events[index]);
    }
}

async function loadEvents() {
    eventList.innerHTML =
        "<p class='gm-loading'>Események betöltése...</p>";

    if (!DRIVE_API_KEY) {
        eventList.innerHTML = `
            <p class="gm-loading">
                Nem sikerült betölteni az eseményeket.
                <br>
                Hiányzik a Google Drive API kulcs (DRIVE_API_KEY).
            </p>
        `;
        return;
    }

    try {
        const folders = await getDriveFiles(
            `'${EVENTS_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        );

        events = folders.map(folder => ({
            id: folder.id,
            name: folder.name,
            photos: null,
            promise: null,
            failed: false
        }));

        // A lista azonnal megjelenik, a képek száma utólag töltődik be
        renderEvents();

        await runPool(events, async (event, index) => {
            try {
                await ensurePhotos(event);
            } catch (error) {
                event.failed = true;
                throw error;
            } finally {
                updateEventCount(index);
            }
        }, CONCURRENCY);

    } catch (error) {
        console.error("Betöltési hiba:", error);

        eventList.innerHTML = `
            <p class="gm-loading">
                Nem sikerült betölteni az eseményeket.
                <br>
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}

// ========================================
// ESEMÉNYLISTA
// ========================================

function renderEvents() {
    if (!events.length) {
        eventList.innerHTML =
            "<p class='gm-loading'>Még nincsenek események.</p>";
        return;
    }

    eventList.innerHTML = events.map((event, index) => `
        <article class="gm-event">

            <p class="gm-event-date">
                GALÉRIA · <span data-event-count="${index}">${countLabel(event)}</span>
            </p>

            <div class="gm-event-info">
                <h3>${escapeHTML(event.name)}</h3>
                <p>Glass Moon Studio · Fotóalbum</p>
            </div>

            <button
                type="button"
                class="gm-button gm-button-primary gm-event-button"
                data-event-index="${index}">
                Képek megtekintése
            </button>

        </article>
    `).join("");
}

// ========================================
// KÉPHIBA KEZELÉSE
// ========================================

function handleImageError(img) {
    let fallbacks = [];

    try {
        fallbacks = JSON.parse(
            img.dataset.fallbackUrls || "[]"
        );
    } catch {
        fallbacks = [];
    }

    const index = Number(img.dataset.fallbackIndex || 0);

    if (index < fallbacks.length) {
        const nextUrl = fallbacks[index];

        img.dataset.fallbackIndex = String(index + 1);
        img.src = nextUrl;

        console.warn("Képforrás váltása:", nextUrl);
        return;
    }

    console.error(
        "A kép nem tölthető be:",
        img.dataset.originalUrl
    );

    img.style.opacity = "1";
    img.alt = "A kép jelenleg nem tölthető be.";
}

// ========================================
// ALBUM MEGNYITÁSA / BEZÁRÁSA
// ========================================

function scrollToAlbum() {
    albumContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function openAlbum(index) {
    const event = events[index];

    if (!event) return;

    activeEvent = event;
    activePhoto = 0;

    albumContainer.hidden = false;

    if (!event.photos) {
        albumContainer.innerHTML =
            "<p class='gm-loading'>Képek betöltése...</p>";

        scrollToAlbum();

        try {
            await ensurePhotos(event);
        } catch (error) {
            if (activeEvent === event) {
                albumContainer.innerHTML = `
                    <p class="gm-loading">
                        Nem sikerült betölteni a képeket.
                        <br>
                        ${escapeHTML(error.message)}
                    </p>
                `;
            }
            return;
        }

        // Közben bezárták vagy másik albumot nyitottak
        if (activeEvent !== event) return;
    }

    renderAlbum();
    scrollToAlbum();
}

function closeAlbum() {
    albumContainer.hidden = true;
    albumContainer.innerHTML = "";
    activeEvent = null;
}

// ========================================
// ALBUM MEGJELENÍTÉSE
// ========================================

function renderAlbum() {
    if (!activeEvent || !activeEvent.photos.length) {
        albumContainer.innerHTML = `
            <p class="gm-loading">
                Ebben az albumban még nincsenek képek.
            </p>

            <button
                type="button"
                class="gm-button gm-button-secondary"
                id="closeAlbum">
                Album bezárása
            </button>
        `;
        return;
    }

    albumContainer.innerHTML = `
        <div class="gm-album">

            <div class="gm-album-header">

                <div class="gm-album-title">
                    <p class="gm-eyebrow">Fotóalbum</p>
                    <h3>${escapeHTML(activeEvent.name)}</h3>
                </div>

                <button
                    type="button"
                    class="gm-button gm-button-secondary gm-close-button"
                    id="closeAlbum">
                    Album bezárása
                </button>

            </div>

            <div class="gm-album-viewer">

                <img
                    class="gm-album-main-image"
                    alt=""
                    decoding="async"
                    fetchpriority="high"
                    referrerpolicy="no-referrer"
                    onerror="handleImageError(this)">

                <button
                    type="button"
                    class="gm-album-arrow gm-album-prev"
                    id="prevPhoto"
                    aria-label="Előző kép">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
                </button>

                <button
                    type="button"
                    class="gm-album-arrow gm-album-next"
                    id="nextPhoto"
                    aria-label="Következő kép">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
                </button>

                <p class="gm-album-caption"></p>

            </div>

            <div class="gm-album-thumbnails">

                ${activeEvent.photos.map((item, index) => `
                    <button
                        type="button"
                        class="gm-album-thumb ${index === activePhoto ? "active" : ""}"
                        data-photo-index="${index}"
                        aria-label="${escapeHTML(item.name)}">

                        <img
                            src="${escapeHTML(item.thumb)}"
                            data-original-url="${escapeHTML(item.thumb)}"
                            data-fallback-urls="${escapeHTML(JSON.stringify(item.thumbFallbacks))}"
                            data-fallback-index="0"
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerpolicy="no-referrer"
                            onerror="handleImageError(this)">

                    </button>
                `).join("")}

            </div>

        </div>
    `;

    updateAlbumPhoto();
}

// ========================================
// AKTUÁLIS KÉP
// ========================================

function preloadPhoto(index) {
    const photo = activeEvent?.photos[index];

    if (!photo) return;

    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = photo.url;
}

function updateAlbumPhoto() {
    if (!activeEvent) return;

    const photo = activeEvent.photos[activePhoto];

    const mainImage = albumContainer.querySelector(
        ".gm-album-main-image"
    );

    const caption = albumContainer.querySelector(
        ".gm-album-caption"
    );

    if (!mainImage || !caption || !photo) return;

    mainImage.dataset.originalUrl = photo.url;
    mainImage.dataset.fallbackUrls = JSON.stringify(photo.fallbacks);
    mainImage.dataset.fallbackIndex = "0";

    mainImage.alt = photo.name;

    // Betöltés alatt halványabb, utána élesre vált
    mainImage.style.opacity = ".35";
    mainImage.onload = () => {
        mainImage.style.opacity = "1";
    };

    mainImage.src = photo.url;

    caption.textContent =
        `${photo.name} · ${activePhoto + 1} / ${activeEvent.photos.length}`;

    albumContainer.querySelectorAll(".gm-album-thumb")
        .forEach((thumbnail, index) => {
            thumbnail.classList.toggle(
                "active",
                index === activePhoto
            );
        });

    // A szomszédos képek előtöltése a gyors lapozásért
    const total = activeEvent.photos.length;

    preloadPhoto((activePhoto + 1) % total);
    preloadPhoto((activePhoto - 1 + total) % total);
}

// ========================================
// LAPOZÁS
// ========================================

function nextPhoto() {
    if (!activeEvent || !activeEvent.photos.length) return;

    activePhoto =
        (activePhoto + 1) % activeEvent.photos.length;

    updateAlbumPhoto();
}

function prevPhoto() {
    if (!activeEvent || !activeEvent.photos.length) return;

    activePhoto =
        (activePhoto - 1 + activeEvent.photos.length)
        % activeEvent.photos.length;

    updateAlbumPhoto();
}

// ========================================
// INDÍTÁS
// ========================================

function init() {
    eventList = document.querySelector(".gm-event-list");
    albumContainer = document.querySelector("#album-container");

    if (!eventList || !albumContainer) {
        console.error("Hiányzó HTML elem (.gm-event-list vagy #album-container).");
        return;
    }

    eventList.addEventListener("click", event => {
        const button = event.target.closest("[data-event-index]");

        if (!button) return;

        openAlbum(Number(button.dataset.eventIndex));
    });

    albumContainer.addEventListener("click", event => {

        if (event.target.closest("#closeAlbum")) {
            closeAlbum();
            return;
        }

        if (event.target.closest("#nextPhoto")) {
            nextPhoto();
            return;
        }

        if (event.target.closest("#prevPhoto")) {
            prevPhoto();
            return;
        }

        const thumbnail = event.target.closest("[data-photo-index]");

        if (thumbnail) {
            activePhoto = Number(thumbnail.dataset.photoIndex);
            updateAlbumPhoto();
        }
    });

    document.addEventListener("keydown", event => {
        if (!activeEvent || albumContainer.hidden) return;

        if (event.key === "ArrowRight") nextPhoto();
        else if (event.key === "ArrowLeft") prevPhoto();
        else if (event.key === "Escape") closeAlbum();
    });

    loadEvents();
}

// A szkript akkor is működik, ha a <head>-ben van, defer nélkül
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

// Globális hibakezelő (az inline onerror használja)
window.handleImageError = handleImageError;