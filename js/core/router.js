/**
 * router.js
 * ---------------------------------------------------------------
 * Modul router ringan untuk MeasureVision (Sprint 3).
 *
 * PRINSIP KERJA:
 * Setiap "halaman" (home.html, camera.html, dst) tetap berupa file
 * HTML statis yang nyata dan bisa diakses/dibuka langsung.
 * Router ini hanya menambah lapisan transisi di atasnya:
 *   - Klik pada link internal (<a href="xxx.html">) dicegat,
 *     kontennya diambil lewat fetch(), lalu ditukar ke dalam
 *     kontainer .app saat ini tanpa reload penuh.
 *   - history.pushState() dipakai supaya URL bar & tombol
 *     back/forward browser tetap akurat.
 *   - window.addEventListener('popstate', ...) menangani navigasi
 *     back/forward agar kontennya ikut berganti.
 *
 * KENAPA REFRESH TETAP AMAN:
 * Karena setiap route sesungguhnya adalah file .html asli (bukan
 * virtual route), me-refresh browser pada URL manapun akan memuat
 * file aslinya secara normal dari sistem file/​server — tidak perlu
 * konfigurasi server tambahan.
 *
 * FALLBACK:
 * Jika fetch() gagal (mis. dibuka lewat metode yang membatasi akses
 * antar file lokal), router otomatis melakukan navigasi penuh
 * (window.location.href) seperti link biasa — aplikasi tetap
 * berfungsi, hanya tanpa efek transisi halus.
 * ---------------------------------------------------------------
 */

const APP_SELECTOR = '.app';
const DEFAULT_PAGE = 'home.html';

/** Ambil elemen kontainer utama aplikasi dari sebuah dokumen. */
function getAppRoot(doc) {
  return doc.querySelector(APP_SELECTOR);
}

/** Ambil nama file halaman (tanpa path) dari sebuah URL/path. */
function fileNameOf(pathOrUrl) {
  const clean = pathOrUrl.split('?')[0].split('#')[0];
  const name = clean.split('/').pop();
  return name && name.endsWith('.html') ? name : DEFAULT_PAGE;
}

/**
 * Tentukan apakah sebuah elemen <a> adalah link internal antar
 * halaman aplikasi (bukan anchor, bukan link eksternal, bukan
 * link unduhan/target baru).
 */
function isInternalPageLink(anchor) {
  if (!anchor || !anchor.getAttribute) return false;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return false;

  let url;
  try {
    url = new URL(href, window.location.href);
  } catch (err) {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (!url.pathname.endsWith('.html')) return false;
  return true;
}

/** Sinkronkan status aria-current pada item bottom-nav sesuai halaman aktif. */
function syncActiveNav(pageName) {
  document.querySelectorAll('.bottom-nav__item').forEach((item) => {
    const href = item.getAttribute('href');
    if (href === pageName) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });
}

/**
 * Muat halaman tujuan lewat fetch dan tukar konten .app tanpa
 * reload penuh. Mengembalikan true jika berhasil, false jika perlu
 * fallback ke navigasi penuh.
 */
async function loadPage(pageName, { pushHistory = true } = {}) {
  try {
    const res = await fetch(pageName, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const html = await res.text();
    const parser = new DOMParser();
    const nextDoc = parser.parseFromString(html, 'text/html');

    const nextApp = getAppRoot(nextDoc);
    const currentApp = getAppRoot(document);
    if (!nextApp || !currentApp) throw new Error('Kontainer .app tidak ditemukan');

    currentApp.replaceWith(nextApp);
    document.title = nextDoc.title || document.title;

    if (pushHistory) {
      history.pushState({ page: pageName }, '', pageName);
    }

    window.scrollTo(0, 0);
    syncActiveNav(pageName);
    return true;
  } catch (err) {
    // fetch/parse gagal (mis. keterbatasan akses file lokal) —
    // biarkan pemanggil melakukan navigasi penuh sebagai fallback.
    console.warn('[router] fallback ke navigasi penuh:', err.message);
    return false;
  }
}

/** Delegasi klik pada dokumen: cegat semua klik link internal. */
function handleDocumentClick(event) {
  const anchor = event.target.closest('a');
  if (!isInternalPageLink(anchor)) return;

  const pageName = fileNameOf(anchor.getAttribute('href'));
  event.preventDefault();

  loadPage(pageName, { pushHistory: true }).then((success) => {
    if (!success) {
      window.location.href = pageName; // fallback: navigasi penuh
    }
  });
}

/** Tangani tombol back/forward browser. */
function handlePopState() {
  const pageName = fileNameOf(window.location.pathname);
  loadPage(pageName, { pushHistory: false });
}

/** Inisialisasi router pada halaman saat ini. Dipanggil sekali per load. */
export function initRouter() {
  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('popstate', handlePopState);

  const currentPage = fileNameOf(window.location.pathname);
  syncActiveNav(currentPage);

  // Catat state awal supaya event popstate pertama punya referensi valid
  if (!history.state) {
    history.replaceState({ page: currentPage }, '', window.location.href);
  }
}

initRouter();
