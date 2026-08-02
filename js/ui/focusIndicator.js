/**
 * focusIndicator.js
 * ---------------------------------------------------------------
 * Modul UI: indikator visual (kotak/ring) untuk Tap-to-Focus, mirip
 * indikator kuning pada aplikasi kamera native iOS.
 * Tanggung jawab TUNGGAL: render, posisikan, dan ubah gaya indikator
 * sesuai status — TIDAK ada logika fokus/kamera di sini.
 * ---------------------------------------------------------------
 */

let indicatorEl = null;

// Pemetaan status fokus ke class CSS indikator
const STATE_CLASS = Object.freeze({
  focusing: 'focus-indicator--focusing',
  focused: 'focus-indicator--focused',
  locked: 'focus-indicator--locked',
  unsupported: 'focus-indicator--unsupported',
  error: 'focus-indicator--error',
});

/**
 * Tampilkan indikator fokus di titik (x, y) ternormalisasi (0-1)
 * relatif terhadap container (mis. hasil tap dibagi lebar/tinggi container).
 * @param {HTMLElement} container elemen pembungkus preview kamera
 * @param {number} x posisi horizontal 0-1
 * @param {number} y posisi vertikal 0-1
 */
export function showFocusIndicator(container, x, y) {
  if (!container) return;
  injectIndicatorStyles();

  if (!indicatorEl) {
    indicatorEl = document.createElement('div');
    indicatorEl.className = 'focus-indicator';
  }

  // Container perlu positioning context agar indikator (position:absolute)
  // terposisi relatif terhadapnya, bukan terhadap dokumen.
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  indicatorEl.style.left = `${x * 100}%`;
  indicatorEl.style.top = `${y * 100}%`;

  if (indicatorEl.parentElement !== container) {
    container.appendChild(indicatorEl);
  }

  // Re-trigger animasi pulse setiap kali indikator dipindah
  indicatorEl.classList.remove('focus-indicator--pulse');
  // Reflow paksa supaya animasi CSS restart
  void indicatorEl.offsetWidth;
  indicatorEl.classList.add('focus-indicator--pulse');
}

/**
 * Ganti tampilan indikator sesuai status fokus terkini.
 * @param {string} status salah satu nilai FOCUS_STATE
 */
export function updateFocusIndicatorState(status) {
  if (!indicatorEl) return;
  Object.values(STATE_CLASS).forEach((cls) => indicatorEl.classList.remove(cls));
  const cls = STATE_CLASS[status];
  if (cls) indicatorEl.classList.add(cls);
}

/**
 * Sembunyikan & hapus indikator dari DOM.
 * Aman dipanggil berulang meski indikator tidak sedang tampil.
 */
export function hideFocusIndicator() {
  if (indicatorEl && indicatorEl.parentElement) {
    indicatorEl.parentElement.removeChild(indicatorEl);
  }
}

/**
 * Suntik style indikator satu kali saja ke <head> (idempotent).
 * Warna memakai variabel CSS yang sudah ada (tokens.css) dengan
 * fallback statis, supaya modul ini tetap berfungsi walau dipakai
 * di halaman yang belum memuat tokens.css.
 */
function injectIndicatorStyles() {
  if (document.getElementById('focus-indicator-styles')) return;

  const style = document.createElement('style');
  style.id = 'focus-indicator-styles';
  style.textContent = `
    .focus-indicator {
      position: absolute;
      width: 64px; height: 64px;
      margin-left: -32px; margin-top: -32px;
      border: 2px solid var(--accent, #FF6A13);
      border-radius: 8px;
      pointer-events: none;
      z-index: 50;
      transition: border-color 150ms ease, opacity 150ms ease;
    }
    .focus-indicator--pulse {
      animation: focus-indicator-pulse 400ms ease-out;
    }
    .focus-indicator--focusing { border-color: var(--warn, #E2B93B); }
    .focus-indicator--focused { border-color: var(--ok, #49B379); }
    .focus-indicator--locked { border-color: var(--accent, #FF6A13); border-width: 3px; }
    .focus-indicator--unsupported { border-color: var(--text-tertiary, #8D959B); border-style: dashed; }
    .focus-indicator--error { border-color: var(--danger, #E5484D); }
    @keyframes focus-indicator-pulse {
      0% { transform: scale(1.35); opacity: 0.35; }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}
