/**
 * cameraPageController.js
 * ---------------------------------------------------------------
 * Controller integrasi untuk halaman Camera (Sprint 10.5).
 * Menghubungkan elemen DOM di camera.html ke seluruh Camera Core:
 * Permission → Camera Engine → Focus → Zoom → Exposure → Overlay
 * → Lifecycle. TIDAK ADA logika Camera Core baru di sini — murni
 * wiring DOM ke fungsi yang sudah ada di modul masing-masing.
 *
 * KENAPA FILE INI DIMUAT DI SETIAP HALAMAN (bukan hanya camera.html):
 * SPA Router menukar konten `.app` lewat fetch() + DOM swap saat
 * navigasi internal (lihat router.js). Elemen <script> yang hanya
 * ada di dalam camera.html TIDAK akan pernah dieksekusi saat halaman
 * itu dicapai lewat klik navigasi (bukan reload penuh) — browser
 * tidak otomatis menjalankan <script> hasil parse DOMParser yang
 * disisipkan lewat appendChild/replaceWith.
 *
 * Solusinya: controller ini dimuat SEKALI di setiap halaman (persis
 * seperti router.js), lalu memakai MutationObserver untuk mendeteksi
 * kapan elemen halaman Camera (#preview-container) muncul di `.app`
 * — baik lewat reload penuh maupun swap SPA — dan baru memasang
 * wiring saat itu terdeteksi, serta melepasnya saat user pindah ke
 * halaman lain. Ini TIDAK mengubah router.js sama sekali; murni
 * controller pasif yang bereaksi terhadap perubahan DOM.
 * ---------------------------------------------------------------
 */

import {
  startCameraLifecycle,
  stopCameraLifecycle,
  onSessionStateChange,
  getSessionState,
} from './cameraLifecycleManager.js';
import { switchCamera } from './cameraManager.js';
import { lockFocus, unlockFocus, onFocusStateChange, FOCUS_STATE } from './focusManager.js';
import { setZoomFromSlider, onZoomStateChange } from './zoomManager.js';
import { setExposureCompensation, onExposureStateChange } from './exposureManager.js';
import { setLayerVisible, OVERLAY_LAYERS } from './overlayManager.js';

const SESSION_BADGE_CLASS = {
  inactive: 'badge--neutral', starting: 'badge--warn', active: 'badge--ok',
  paused: 'badge--warn', stopping: 'badge--neutral', error: 'badge--danger',
};

let wired = false;
let unsubscribers = [];

/** Cek apakah halaman Camera sedang tampil, pasang/lepas wiring sesuai kondisi. */
function evaluatePage() {
  const container = document.getElementById('preview-container');
  if (container && !wired) {
    wireCameraPage(container);
  } else if (!container && wired) {
    unwireCameraPage();
  }
}

/** Pasang seluruh wiring Camera Core ke elemen-elemen halaman Camera. */
function wireCameraPage(container) {
  wired = true;

  const errorBanner = document.getElementById('camera-error-banner');
  const errorText = document.getElementById('camera-error-text');
  const sessionBadge = document.getElementById('camera-session-badge');
  const hudFocusBadge = document.getElementById('hud-auto-badge');
  const hudZoomBadge = document.getElementById('hud-zoom-badge');
  const btnOpen = document.getElementById('btn-open-camera');
  const btnClose = document.getElementById('btn-close-camera');
  const btnSwitch = document.getElementById('btn-switch-camera');
  const btnFocusLock = document.getElementById('btn-focus-lock');
  const zoomSlider = document.getElementById('zoom-slider');
  const exposureSlider = document.getElementById('exposure-slider');
  const overlayCrosshair = document.getElementById('overlay-crosshair-switch');
  const overlayGrid = document.getElementById('overlay-grid-switch');

  function showError(message) {
    if (!errorBanner || !errorText) return;
    errorBanner.style.display = 'block';
    errorText.textContent = message;
  }
  function clearError() {
    if (errorBanner) errorBanner.style.display = 'none';
  }

  // ---- Session (status badge + error banner) ----
  unsubscribers.push(onSessionStateChange((state) => {
    if (sessionBadge) {
      sessionBadge.textContent = `Kamera: ${state.status}`;
      sessionBadge.className = 'badge ' + (SESSION_BADGE_CLASS[state.status] || 'badge--neutral');
    }
    if (state.status === 'error' && state.errorMessage) {
      showError(state.errorMessage);
    } else if (state.status === 'active') {
      clearError();
    }
  }));

  const initialSession = getSessionState();
  if (sessionBadge) {
    sessionBadge.textContent = `Kamera: ${initialSession.status}`;
    sessionBadge.className = 'badge ' + (SESSION_BADGE_CLASS[initialSession.status] || 'badge--neutral');
  }

  // ---- Focus (HUD badge + lock/unlock button) ----
  unsubscribers.push(onFocusStateChange((state) => {
    if (hudFocusBadge) hudFocusBadge.textContent = state.status === FOCUS_STATE.LOCKED ? 'Terkunci' : 'Auto';
    if (btnFocusLock) btnFocusLock.textContent = state.status === FOCUS_STATE.LOCKED ? 'Buka Kunci Fokus' : 'Kunci Fokus';
  }));

  // ---- Zoom (HUD badge + slider) ----
  unsubscribers.push(onZoomStateChange((state) => {
    if (hudZoomBadge) hudZoomBadge.textContent = `${state.value.toFixed(1)}x`;
    if (zoomSlider) {
      zoomSlider.min = state.min;
      zoomSlider.max = state.max;
      zoomSlider.step = state.step;
      zoomSlider.value = state.value;
    }
  }));

  // ---- Exposure (slider) ----
  unsubscribers.push(onExposureStateChange((state) => {
    if (exposureSlider) {
      exposureSlider.min = state.min;
      exposureSlider.max = state.max;
      exposureSlider.step = state.step;
      exposureSlider.value = state.compensation;
      exposureSlider.disabled = state.mode === 'none';
    }
  }));

  // ---- Kontrol: Open / Close / Switch Camera ----
  btnOpen?.addEventListener('click', async () => {
    clearError();
    const result = await startCameraLifecycle(container);
    if (!result.success) showError(result.error?.message ?? 'Gagal membuka kamera.');
  });

  btnClose?.addEventListener('click', () => {
    stopCameraLifecycle();
    clearError();
  });

  btnSwitch?.addEventListener('click', async () => {
    clearError();
    const result = await switchCamera(container);
    if (!result.success) showError(result.error?.message ?? 'Gagal mengganti kamera.');
  });

  // ---- Kontrol: Focus Lock/Unlock ----
  btnFocusLock?.addEventListener('click', async () => {
    const locked = btnFocusLock.textContent === 'Buka Kunci Fokus';
    if (locked) {
      await unlockFocus();
    } else {
      await lockFocus();
    }
  });

  // ---- Kontrol: Zoom slider ----
  zoomSlider?.addEventListener('input', (e) => {
    setZoomFromSlider(e.target.value);
  });

  // ---- Kontrol: Exposure slider ----
  exposureSlider?.addEventListener('input', (e) => {
    setExposureCompensation(Number(e.target.value));
  });

  // ---- Kontrol: Overlay layer switches ----
  overlayCrosshair?.addEventListener('click', () => {
    const next = overlayCrosshair.getAttribute('aria-checked') !== 'true';
    overlayCrosshair.setAttribute('aria-checked', String(next));
    setLayerVisible(OVERLAY_LAYERS.CROSSHAIR, next);
  });

  overlayGrid?.addEventListener('click', () => {
    const next = overlayGrid.getAttribute('aria-checked') !== 'true';
    overlayGrid.setAttribute('aria-checked', String(next));
    setLayerVisible(OVERLAY_LAYERS.GRID, next);
  });
}

/**
 * Lepas wiring saat user navigasi meninggalkan halaman Camera.
 * Sesi kamera SENGAJA dihentikan penuh di sini (bukan hanya di-pause)
 * — mencegah kebocoran stream/indikator kamera iOS tetap menyala saat
 * user sudah pindah ke halaman lain dalam aplikasi.
 */
function unwireCameraPage() {
  wired = false;
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  stopCameraLifecycle();
}

// Amati perubahan DOM di seluruh body — mendeteksi swap `.app` yang
// dilakukan router.js tanpa perlu router.js men-dispatch event apa pun.
const observer = new MutationObserver(evaluatePage);
observer.observe(document.body, { childList: true, subtree: true });

// Cek langsung saat script dimuat, untuk kasus halaman Camera dibuka
// lewat reload penuh (bukan hasil navigasi SPA).
evaluatePage();
