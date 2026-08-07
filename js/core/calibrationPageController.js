/**
 * calibrationPageController.js
 * ---------------------------------------------------------------
 * Controller integrasi untuk halaman Calibration.
 * Menghubungkan elemen DOM di calibration.html ke:
 * - cameraManager.js (buka/tutup kamera untuk preview)
 * - calibrationProfileManager.js (buat/pilih profil aktif)
 * - calibrationEngine.js (mulai sesi, hitung, simpan hasil)
 *
 * TIDAK ADA logika baru di sini — murni wiring DOM. Dimuat di
 * SETIAP halaman (pola sama seperti cameraPageController.js/
 * projectPageController.js) memakai MutationObserver, karena SPA
 * Router tidak mengeksekusi <script> dari halaman yang di-fetch.
 * Elemen yang dipakai (id="calib-*") sengaja diberi prefix unik
 * supaya tidak bentrok dengan cameraPageController.js yang juga
 * mencari id="preview-container"/"btn-open-camera" di semua halaman.
 * ---------------------------------------------------------------
 */

import { openCamera, closeCamera, getPreviewElement } from './cameraManager.js';
import {
  createProfile,
  selectActiveProfile,
  getActiveProfile,
  onCalibrationProfileStateChange,
} from './calibrationProfileManager.js';
import {
  startCalibration,
  cancelCalibration,
  computeCalibration,
  saveCalibrationResult,
  onSessionStateChange,
  onEngineStateChange,
  getSessionState,
  SESSION_STATE,
} from './calibrationEngine.js';

let wired = false;
let unsubscribers = [];
let outsideClickHandler = null;

const QUALITY_LABEL = { good: 'Baik', fair: 'Cukup', poor: 'Kurang' };
const QUALITY_BADGE_CLASS = { good: 'badge--ok', fair: 'badge--warn', poor: 'badge--danger' };

function evaluatePage() {
  const container = document.getElementById('calib-preview-container');
  if (container && !wired) {
    wireCalibrationPage(container);
  } else if (!container && wired) {
    unwireCalibrationPage();
  }
}

function wireCalibrationPage(container) {
  wired = true;

  const errorBanner = document.getElementById('calib-error-banner');
  const errorText = document.getElementById('calib-error-text');
  const sessionBadge = document.getElementById('calib-session-badge');
  const activeProfileLabel = document.getElementById('active-profile-label');
  const refLengthInput = document.getElementById('ref-length');
  const refUnitSelect = document.getElementById('ref-unit');
  const ppuResult = document.getElementById('ppu-result');
  const qualityBadge = document.getElementById('quality-badge');
  const referenceGuide = document.getElementById('reference-guide');
  const pointMarkerA = document.getElementById('point-marker-a');
  const pointMarkerB = document.getElementById('point-marker-b');
  const camHint = document.getElementById('cam-hint');

  function showError(message) {
    if (errorBanner && errorText) {
      errorBanner.style.display = 'block';
      errorText.textContent = message;
    }
  }
  function clearError() {
    if (errorBanner) errorBanner.style.display = 'none';
  }

  function refreshActiveProfileLabel() {
    const profile = getActiveProfile();
    if (activeProfileLabel) {
      activeProfileLabel.textContent = profile ? profile.profileName : 'Belum ada — buat dulu';
    }
  }

  // ---- Menu dropdown: toggle + tutup otomatis ----
  const menuToggle = document.getElementById('cam-menu-toggle');
  const menuPanel = document.getElementById('cam-menu-panel');
  function closeMenu() {
    menuPanel?.setAttribute('hidden', '');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
  function toggleMenu() {
    const isOpen = !menuPanel?.hasAttribute('hidden');
    if (isOpen) closeMenu();
    else { menuPanel?.removeAttribute('hidden'); menuToggle?.setAttribute('aria-expanded', 'true'); }
  }
  menuToggle?.addEventListener('click', (event) => { event.stopPropagation(); toggleMenu(); });
  outsideClickHandler = (event) => { if (!event.target.closest('.cam-menu')) closeMenu(); };
  document.addEventListener('click', outsideClickHandler);

  // ---- Buka/Tutup Kamera (id sudah di-prefix supaya tidak bentrok
  //      dengan cameraPageController.js) ----
  document.getElementById('btn-calib-open-camera')?.addEventListener('click', async () => {
    clearError();
    closeMenu();
    const result = await openCamera(container);
    if (!result.success) showError(result.error?.message ?? 'Gagal membuka kamera.');
  });
  document.getElementById('btn-calib-close-camera')?.addEventListener('click', () => {
    closeCamera();
    closeMenu();
    if (container && !container.querySelector('video')) {
      container.innerHTML = '<p class="eyebrow" id="calib-preview-placeholder" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:0 var(--sp-6);">Preview belum aktif</p>';
    }
  });

  // ---- Tipe Referensi: pilih di dropdown → guide berubah bentuk +
  //      auto-isi panjang referensi (bantu presisi memposisikan) ----
  document.querySelectorAll('.ref-type-item').forEach((item) => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;

      document.querySelectorAll('.ref-type-item').forEach((el) => el.setAttribute('aria-checked', el === item ? 'true' : 'false'));

      referenceGuide.classList.remove('reference-guide--coin', 'reference-guide--idcard', 'reference-guide--marker');
      if (type === 'coin') {
        referenceGuide.classList.add('reference-guide--coin');
        referenceGuide.hidden = false;
      } else if (type === 'idcard') {
        referenceGuide.classList.add('reference-guide--idcard');
        referenceGuide.hidden = false;
      } else if (type === 'marker') {
        referenceGuide.classList.add('reference-guide--marker');
        referenceGuide.hidden = false;
      } else {
        referenceGuide.hidden = true; // manual: tanpa guide
      }

      if (item.dataset.length) {
        refLengthInput.value = item.dataset.length;
        refUnitSelect.value = item.dataset.unit || 'mm';
      }
      closeMenu();
    });
  });

  // ---- Profil: buat & pilih aktif ----
  document.getElementById('btn-new-profile')?.addEventListener('click', async () => {
    try {
      const n = Math.floor(Math.random() * 1000);
      const profile = await createProfile({
        profileName: `Profil ${n}`,
        referenceLength: Number(refLengthInput.value) || 25,
        referenceUnit: refUnitSelect.value || 'mm',
      });
      await selectActiveProfile(profile.id);
      refreshActiveProfileLabel();
    } catch (err) {
      showError(err.message);
    }
  });
  unsubscribers.push(onCalibrationProfileStateChange(refreshActiveProfileLabel));
  refreshActiveProfileLabel();

  // ---- Sesi kalibrasi: tampilkan titik yang sudah dipilih di preview ----
  function updatePointMarkers(session) {
    const video = getPreviewElement();
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    [[session.pointA, pointMarkerA], [session.pointB, pointMarkerB]].forEach(([point, marker]) => {
      if (!point || !marker) {
        if (marker) marker.hidden = true;
        return;
      }
      // Konversi balik: koordinat native video → posisi CSS relatif container
      const scaleX = rect.width / video.videoWidth;
      const scaleY = rect.height / video.videoHeight;
      marker.style.left = `${(rect.left - containerRect.left) + point.x * scaleX}px`;
      marker.style.top = `${(rect.top - containerRect.top) + point.y * scaleY}px`;
      marker.hidden = false;
    });
  }

  const HINT_TEXT = {
    idle: 'Buka menu (⋮) untuk mulai',
    awaiting_point_a: 'Tap titik A pada preview',
    awaiting_point_b: 'Tap titik B pada preview',
    ready: 'Dua titik terpilih — isi panjang referensi, lalu Hitung',
    error: 'Terjadi kesalahan',
  };
  const SESSION_BADGE_CLASS = {
    idle: 'badge--neutral', awaiting_point_a: 'badge--warn', awaiting_point_b: 'badge--warn',
    ready: 'badge--ok', error: 'badge--danger',
  };

  unsubscribers.push(onSessionStateChange((session) => {
    if (sessionBadge) {
      sessionBadge.textContent = session.status;
      sessionBadge.className = 'badge ' + (SESSION_BADGE_CLASS[session.status] || 'badge--neutral');
    }
    if (camHint) camHint.textContent = HINT_TEXT[session.status] || session.status;
    updatePointMarkers(session);
  }));

  unsubscribers.push(onEngineStateChange((engine) => {
    if (engine.status === 'error' && engine.errorMessage) showError(engine.errorMessage);
  }));

  function startSessionSafely() {
    try {
      startCalibration();
    } catch (err) {
      showError(err.message);
    }
  }

  document.getElementById('btn-reset-points')?.addEventListener('click', () => {
    cancelCalibration();
    pointMarkerA.hidden = true;
    pointMarkerB.hidden = true;
    ppuResult.textContent = '— px/unit';
    qualityBadge.textContent = 'Menunggu';
    qualityBadge.className = 'badge badge--neutral';
    clearError();
    startSessionSafely();
    closeMenu();
  });

  // ---- Hitung & Simpan ----
  function runCompute() {
    clearError();
    try {
      const result = computeCalibration({ referenceLength: refLengthInput.value, referenceUnit: refUnitSelect.value });
      ppuResult.textContent = `${result.pixelPerUnit.toFixed(3)} px/${result.referenceUnit}`;
      qualityBadge.textContent = QUALITY_LABEL[result.calibrationQuality] || result.calibrationQuality;
      qualityBadge.className = 'badge ' + (QUALITY_BADGE_CLASS[result.calibrationQuality] || 'badge--neutral');
    } catch (err) {
      showError(err.message);
    }
  }
  document.getElementById('btn-compute')?.addEventListener('click', runCompute);

  async function runSave() {
    clearError();
    try {
      await saveCalibrationResult();
      showError('Tersimpan \u2713 — lihat Profil Kalibrasi Aktif di bawah.');
      refreshActiveProfileLabel();
    } catch (err) {
      showError(err.message);
    }
    closeMenu();
  }
  document.getElementById('btn-save-calibration')?.addEventListener('click', runSave);
  document.getElementById('btn-save-bottom')?.addEventListener('click', runSave);

  // Setelah profil baru dibuat & dipilih aktif, langsung mulai sesi
  // pemilihan titik (kalau kamera sudah terbuka) supaya user bisa
  // langsung tap tanpa langkah menu tambahan.
  document.getElementById('btn-new-profile')?.addEventListener('click', () => {
    setTimeout(startSessionSafely, 300);
  });

  // Sediakan juga lewat menu untuk memulai ulang sesi kapan saja.
  const initial = getSessionState();
  if (initial.status !== SESSION_STATE.IDLE) {
    updatePointMarkers(initial);
  }
}

function unwireCalibrationPage() {
  wired = false;
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
  cancelCalibration();
  closeCamera();
}

const observer = new MutationObserver(evaluatePage);
observer.observe(document.body, { childList: true, subtree: true });
evaluatePage();
