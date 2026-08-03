/**
 * cameraOrientationManager.js
 * ---------------------------------------------------------------
 * Modul khusus deteksi perubahan orientasi device (portrait/landscape)
 * yang relevan untuk siklus hidup kamera — TIDAK melakukan rotasi
 * video manual (rendering `<video>` sudah otomatis mengikuti aspect
 * ratio browser) dan TIDAK menghitung ukuran/dimensi apa pun.
 *
 * Kegunaan utamanya: memberi sinyal ke Resolution Manager & Session
 * Manager bahwa orientasi berubah, sehingga mereka bisa membaca ulang
 * resolusi aktual stream (`track.getSettings()`) — beberapa browser
 * melaporkan width/height tertukar setelah rotasi.
 * ---------------------------------------------------------------
 */

// Kemungkinan nilai orientasi yang dilaporkan
export const ORIENTATION = Object.freeze({
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
});

const listeners = new Set();
let currentOrientation = null;
let mediaQueryList = null;
let initialized = false;

/**
 * Baca orientasi saat ini lewat matchMedia (lebih konsisten lintas
 * browser dibanding `window.orientation` yang sudah deprecated, dan
 * dibanding `screen.orientation` yang tidak selalu tersedia di Safari
 * versi lama).
 * @returns {string} salah satu nilai ORIENTATION
 */
function readOrientation() {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(orientation: portrait)').matches
      ? ORIENTATION.PORTRAIT
      : ORIENTATION.LANDSCAPE;
  }
  // Fallback kasar jika matchMedia tidak tersedia sama sekali
  return window.innerHeight >= window.innerWidth ? ORIENTATION.PORTRAIT : ORIENTATION.LANDSCAPE;
}

/** Beri tahu semua listener dengan nilai orientasi terbaru. */
function notifyListeners() {
  listeners.forEach((callback) => {
    try {
      callback(currentOrientation);
    } catch (err) {
      // Error pada satu listener tidak boleh menghentikan listener lain
      console.error('[cameraOrientationManager] Listener gagal dijalankan:', err.message);
    }
  });
}

/** Tangani perubahan orientasi: perbarui nilai & beri tahu listener jika berubah. */
function handleOrientationChange() {
  const next = readOrientation();
  if (next !== currentOrientation) {
    currentOrientation = next;
    notifyListeners();
  }
}

/**
 * Ambil orientasi saat ini. Menginisialisasi listener secara otomatis
 * pada pemanggilan pertama jika belum pernah di-init.
 * @returns {string} salah satu nilai ORIENTATION
 */
export function getOrientation() {
  if (!initialized) initOrientationTracking();
  return currentOrientation;
}

/**
 * Daftarkan listener yang dipanggil setiap kali orientasi berubah.
 * @param {(orientation: string) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 */
export function onOrientationChange(callback) {
  if (!initialized) initOrientationTracking();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Inisialisasi pemantauan orientasi. Aman dipanggil berulang
 * (idempotent) — hanya benar-benar memasang listener sekali.
 */
export function initOrientationTracking() {
  if (initialized) return;
  initialized = true;
  currentOrientation = readOrientation();

  try {
    if (typeof window.matchMedia === 'function') {
      mediaQueryList = window.matchMedia('(orientation: portrait)');
      // Safari lama memakai addListener/removeListener (bukan addEventListener)
      if (typeof mediaQueryList.addEventListener === 'function') {
        mediaQueryList.addEventListener('change', handleOrientationChange);
      } else if (typeof mediaQueryList.addListener === 'function') {
        mediaQueryList.addListener(handleOrientationChange);
      }
    }
  } catch (err) {
    console.warn('[cameraOrientationManager] matchMedia listener gagal dipasang:', err.message);
  }

  // Fallback tambahan — sebagian versi iOS Safari lebih konsisten
  // memicu 'orientationchange' dibanding event matchMedia untuk kasus tertentu.
  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', handleOrientationChange);
}

/**
 * Lepas seluruh listener orientasi. Umumnya tidak perlu dipanggil
 * (modul ini bersifat singleton sepanjang umur halaman), disediakan
 * untuk kebutuhan cleanup eksplisit/testing.
 */
export function stopOrientationTracking() {
  if (mediaQueryList) {
    if (typeof mediaQueryList.removeEventListener === 'function') {
      mediaQueryList.removeEventListener('change', handleOrientationChange);
    } else if (typeof mediaQueryList.removeListener === 'function') {
      mediaQueryList.removeListener(handleOrientationChange);
    }
    mediaQueryList = null;
  }
  window.removeEventListener('orientationchange', handleOrientationChange);
  window.removeEventListener('resize', handleOrientationChange);
  initialized = false;
}
