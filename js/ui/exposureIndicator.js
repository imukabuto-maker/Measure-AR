/**
 * exposureIndicator.js
 * ---------------------------------------------------------------
 * Modul UI: indikator visual pil yang menampilkan nilai exposure
 * compensation saat ini (mis. "+0.3 EV") atau status lock, mirip
 * indikator kecerahan pada aplikasi kamera native.
 * Tanggung jawab TUNGGAL: render/posisikan/hide indikator —
 * TIDAK ada logika exposure di sini.
 * ---------------------------------------------------------------
 */

let indicatorEl = null;
let hideTimer = null;

/**
 * Tampilkan (atau perbarui) indikator exposure di dalam container.
 * Indikator otomatis hilang setelah jeda singkat tanpa perubahan,
 * KECUALI saat status 'locked' (tetap tampil selama lock aktif).
 * @param {HTMLElement} container elemen pembungkus preview kamera
 * @param {string} label teks nilai, mis. "+0.3 EV" atau "Terkunci"
 * @param {boolean} [persist] jika true, indikator tidak auto-hide
 */
export function showExposureIndicator(container, label, persist = false) {
  if (!container) return;
  injectIndicatorStyles();

  if (!indicatorEl) {
    indicatorEl = document.createElement('div');
    indicatorEl.className = 'exposure-indicator';
    indicatorEl.innerHTML = `
      <span class="exposure-indicator__icon">☀</span>
      <span class="exposure-indicator__value"></span>
    `;
  }

  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  indicatorEl.querySelector('.exposure-indicator__value').textContent = label;

  if (indicatorEl.parentElement !== container) {
    container.appendChild(indicatorEl);
  }

  indicatorEl.classList.add('exposure-indicator--visible');

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (!persist) {
    hideTimer = setTimeout(() => {
      if (indicatorEl) indicatorEl.classList.remove('exposure-indicator--visible');
    }, 1200);
  }
}

/**
 * Sembunyikan & hapus indikator dari DOM segera (mis. saat kamera ditutup).
 */
export function hideExposureIndicator() {
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
  if (document.getElementById('exposure-indicator-styles')) return;

  const style = document.createElement('style');
  style.id = 'exposure-indicator-styles';
  style.textContent = `
    .exposure-indicator {
      position: absolute;
      right: 16px; top: 16px;
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px;
      background: rgba(13, 15, 17, 0.75);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 100px;
      pointer-events: none;
      z-index: 50;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 150ms ease, transform 150ms ease;
      font-family: var(--font-mono, ui-monospace, monospace);
    }
    .exposure-indicator--visible {
      opacity: 1;
      transform: translateY(0);
    }
    .exposure-indicator__icon {
      font-size: 12px;
      color: var(--warn, #E2B93B);
    }
    .exposure-indicator__value {
      color: var(--text-primary, #E9EBEC);
      font-size: 12px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
}
