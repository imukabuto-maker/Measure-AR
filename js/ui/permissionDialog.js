/**
 * permissionDialog.js
 * ---------------------------------------------------------------
 * Modul UI reusable untuk menampilkan dialog konfirmasi SEBELUM
 * memicu prompt izin native (best practice: jelaskan alasan dulu),
 * serta dialog fallback saat izin ditolak (mengarahkan user untuk
 * membuka Settings iOS secara manual).
 *
 * Dialog dibangun memakai class CSS yang SUDAH ADA (.card, .btn,
 * .eyebrow, var(--sp-*) dst dari components.css/tokens.css) —
 * tidak menambah sistem desain baru, tidak mengubah halaman UI
 * lain. Elemen dibuat dinamis lewat DOM API, hanya aktif saat
 * dipanggil, dan dibersihkan setelah ditutup.
 * ---------------------------------------------------------------
 */

let activeDialog = null;

/**
 * Tampilkan dialog permission generik.
 * @param {Object} options
 * @param {string} options.title judul dialog
 * @param {string} options.message isi pesan/penjelasan
 * @param {string} [options.confirmLabel] label tombol konfirmasi
 * @param {string} [options.cancelLabel] label tombol batal
 * @returns {Promise<boolean>} true jika user menekan tombol konfirmasi
 */
export function showPermissionDialog({
  title,
  message,
  confirmLabel = 'Izinkan',
  cancelLabel = 'Nanti',
}) {
  return new Promise((resolve) => {
    closePermissionDialog(); // pastikan tidak ada dialog ganda menumpuk

    injectDialogStyles();

    const overlay = document.createElement('div');
    overlay.className = 'perm-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="card card--pad perm-dialog">
        <p class="eyebrow" style="margin-bottom:8px;">Izin Diperlukan</p>
        <h2 style="font-size:var(--fs-lg); font-weight:600; margin-bottom:8px;">${escapeHtml(title)}</h2>
        <p style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:var(--sp-5);">${escapeHtml(message)}</p>
        <div class="btn-row">
          <button type="button" class="btn btn--secondary" data-action="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn btn--primary" data-action="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    // Delegasi klik: tombol confirm/cancel maupun klik di luar kartu (overlay)
    overlay.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      const action = actionEl ? actionEl.dataset.action : null;

      if (action === 'confirm') {
        closePermissionDialog();
        resolve(true);
      } else if (action === 'cancel' || event.target === overlay) {
        closePermissionDialog();
        resolve(false);
      }
    });

    document.body.appendChild(overlay);
    activeDialog = overlay;
  });
}

/**
 * Tutup dialog permission yang sedang tampil (jika ada).
 * Aman dipanggil berulang kali meski tidak ada dialog aktif.
 */
export function closePermissionDialog() {
  if (activeDialog && activeDialog.parentNode) {
    activeDialog.parentNode.removeChild(activeDialog);
  }
  activeDialog = null;
}

/**
 * Tampilkan dialog khusus saat izin ditolak, mengarahkan user
 * membuka Settings iOS secara manual (web tidak bisa membuka
 * Settings otomatis).
 * @param {string} permissionName label izin untuk ditampilkan, mis. "Kamera"
 * @returns {Promise<boolean>}
 */
export function showPermissionDeniedDialog(permissionName) {
  return showPermissionDialog({
    title: `Izin ${permissionName} Ditolak`,
    message: `Buka Settings iPhone → Safari → izinkan akses ${permissionName} untuk aplikasi ini, lalu muat ulang halaman.`,
    confirmLabel: 'Mengerti',
    cancelLabel: 'Tutup',
  });
}

/**
 * Escape teks agar aman disisipkan sebagai HTML (mencegah injeksi
 * dari string title/message yang mungkin berasal dari luar).
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Suntik style overlay dialog satu kali saja ke <head> (idempotent).
 * Hanya menata overlay/positioning — warna & tipografi tetap
 * memakai variabel CSS yang sudah ada di tokens.css.
 */
function injectDialogStyles() {
  if (document.getElementById('perm-dialog-styles')) return;

  const style = document.createElement('style');
  style.id = 'perm-dialog-styles';
  style.textContent = `
    .perm-dialog-overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: flex-end; justify-content: center;
      padding: var(--sp-4);
    }
    .perm-dialog { width: 100%; max-width: 420px; }
    @media (min-width: 480px) {
      .perm-dialog-overlay { align-items: center; }
    }
  `;
  document.head.appendChild(style);
}
