/**
 * cameraPreview.js
 * ---------------------------------------------------------------
 * Modul view-layer untuk menampilkan preview kamera.
 * Tanggung jawab TUNGGAL: membuat elemen <video>, memasang/melepas
 * MediaStream ke/dari elemen tersebut, dan mount/unmount ke DOM.
 *
 * Modul ini TIDAK meminta izin dan TIDAK membuka stream sendiri —
 * itu tanggung jawab cameraManager.js. cameraPreview.js murni
 * lapisan tampilan (Single Responsibility).
 * ---------------------------------------------------------------
 */

/**
 * Buat elemen <video> baru yang siap dipakai untuk preview kamera.
 * Atribut playsinline & muted WAJIB agar autoplay berfungsi normal
 * di iOS Safari tanpa memaksa fullscreen.
 * @returns {HTMLVideoElement}
 */
export function createPreviewElement() {
  const video = document.createElement('video');
  video.setAttribute('playsinline', ''); // wajib iOS: cegah auto-fullscreen
  video.setAttribute('autoplay', '');
  video.muted = true; // wajib agar autoplay diizinkan browser
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  return video;
}

/**
 * Pasang MediaStream ke elemen <video> dan mulai pemutaran.
 * @param {HTMLVideoElement} videoEl
 * @param {MediaStream} stream
 * @returns {Promise<void>}
 * @throws {Error} jika videoEl atau stream tidak diisi
 */
export async function attachStream(videoEl, stream) {
  if (!videoEl || !stream) {
    throw new Error('[cameraPreview] videoEl dan stream wajib diisi');
  }
  videoEl.srcObject = stream;
  try {
    await videoEl.play();
  } catch (err) {
    // Sebagian browser menolak play() terprogram tanpa gesture langsung —
    // srcObject tetap terpasang, biarkan pemanggil menangani jika perlu.
    console.warn('[cameraPreview] video.play() gagal otomatis:', err.message);
  }
}

/**
 * Lepaskan stream dari elemen <video>. TIDAK menghentikan track
 * MediaStream — penghentian track adalah tanggung jawab
 * cameraManager.js (pemilik lifecycle stream).
 * @param {HTMLVideoElement} videoEl
 */
export function detachStream(videoEl) {
  if (!videoEl) return;
  videoEl.pause();
  videoEl.srcObject = null;
}

/**
 * Sisipkan elemen preview ke dalam container target.
 * Mengosongkan container terlebih dahulu agar preview lama tidak menumpuk.
 * @param {HTMLElement} container
 * @param {HTMLVideoElement} videoEl
 */
export function mountPreview(container, videoEl) {
  if (!container || !videoEl) return;
  container.innerHTML = '';
  container.appendChild(videoEl);
}

/**
 * Hapus elemen preview sepenuhnya dari DOM.
 * @param {HTMLVideoElement} videoEl
 */
export function unmountPreview(videoEl) {
  if (videoEl && videoEl.parentNode) {
    videoEl.parentNode.removeChild(videoEl);
  }
}
