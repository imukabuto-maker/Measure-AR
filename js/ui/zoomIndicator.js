/**
 * zoomIndicator.js
 * ---------------------------------------------------------------
 * Modul UI: indikator visual pil/badge yang menampilkan nilai zoom
 * saat ini (mis. "2.0x"), mirip indikator zoom pada aplikasi kamera
 * native. Tanggung jawab TUNGGAL: render/posisikan/hide indikator —
 * TIDAK ada logika zoom di sini.
 * ---------------------------------------------------------------
 */

let indicatorEl = null;
let hideTimer = null;

/**
 * Tampilkan (atau perbarui) indikator zoom di dalam container.
 * Indikator otomatis hilang setelah jeda singkat tanpa perubahan.
 * @param {HTMLElement} container elemen pembungkus preview kamera
 * @param {string} label teks yang ditampilkan, mis. "2.0x"
 * @param {string} [mode] 'hardware' | 'digital' — memengaruhi sub-label
 */
export function showZoomIndicator(container, label, mode) {
  if (!container) return;
  injectIndicatorStyles();

  if (!indicatorEl) {
    indicatorEl = document.createElement('div');
    indicatorEl.className = 'zoom-indicator';
    indicatorEl.innerHTML = `
      <span class="zoom-indicator__value"></span>
      <span class="zoom-indicator__mode"></span>
    `;
  }

  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  indicatorEl.querySelector('.zoom-indicator__value').textContent = label;
  indicatorEl.querySelector('.zoom-indicator__mode').textContent =
    mode === 'digital' ? 'digital' : mode === 'hardware' ? 'optik' : '';

  if (indicatorEl.parentElement !== container) {
    container.appendChild(indicatorEl);
  }

  indicatorEl.classList.add('zoom-indicator--visible');

  // Auto-hide setelah jeda singkat tanpa perubahan lanjutan
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (indicatorEl) indicatorEl.classList.remove('zoom-indicator--visible');
  }, 1200);
}

/**
 * Sembunyikan & hapus indikator dari DOM segera (mis. saat kamera ditutup).
 */
export function hideZoomIndicator() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (indicatorEl && indicatorEl.parentElement) {
    indicatorEl.parentElement.removeChild(indicatorEl);
  }
}

/**
 * Suntik style indikator satu kali saja ke <head> (idempotent).
 */
function injectIndicatorStyles() {
  if (document.getElementById('zoom-indicator-styles')) return;

  const style = document.createElement('style');
  style.id = 'zoom-indicator-styles';
  style.textContent = `
    .zoom-indicator {
      position: absolute;
      left: 50%; bottom: 16px;
      transform: translateX(-50%) translateY(8px);
      display: flex; align-items: baseline; gap: 6px;
      padding: 6px 12px;
      background: rgba(13, 15, 17, 0.75);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 100px;
      pointer-events: none;
      z-index: 50;
      opacity: 0;
      transition: opacity 150ms ease, transform 150ms ease;
      font-family: var(--font-mono, ui-monospace, monospace);
    }
    .zoom-indicator--visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .zoom-indicator__value {
      color: var(--accent, #FF6A13);
      font-size: 14px;
      font-weight: 600;
    }
    .zoom-indicator__mode {
      color: var(--text-tertiary, #8D959B);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  `;
  document.head.appendChild(style);
}
