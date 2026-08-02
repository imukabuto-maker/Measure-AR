# CAMERA_API.md

Referensi API internal untuk **Camera Core** MeasureVision — mencakup semua modul yang sudah dibangun dari Sprint 5 sampai Sprint 8 (Camera Engine, Focus Manager, Zoom Manager, Exposure Manager).

Dokumen ini murni referensi. Tidak ada kode yang diubah untuk membuat dokumen ini. Tujuannya: jadi acuan saat mengerjakan Calibration Engine, OpenCV Engine, dan Measurement Engine di sprint-sprint berikutnya, supaya modul baru memanggil Camera Core dengan cara yang benar tanpa perlu membaca ulang seluruh source code.

---

## 1. Peta Modul

```
permissionManager.js  (Sprint 4 — dependency)
        │
        ▼
cameraManager.js  (Sprint 5 — Camera Engine)
        │  reuse via getActiveVideoTrack() / getPreviewElement() / onCameraStateChange()
        ├──▶ focusManager.js    (Sprint 6)
        ├──▶ zoomManager.js     (Sprint 7)
        └──▶ exposureManager.js (Sprint 8)
```

Setiap facade (`*Manager.js`) punya struktur internal yang sama:

```
xxxManager.js   → facade: fungsi publik yang dipanggil UI/modul lain
xxxState.js     → state store: status saat ini + pub/sub perubahan
xxxIndicator.js → UI: elemen visual overlay di atas preview (view-only)
```

Semua modul ada di:
- `js/core/` — facade & state store (`cameraManager`, `cameraState`, `focusManager`, `focusState`, `zoomManager`, `zoomState`, `exposureManager`, `exposureState`)
- `js/ui/` — indikator visual (`cameraPreview`, `focusIndicator`, `zoomIndicator`, `exposureIndicator`)
- `js/utils/` — utilitas murni (`cameraError`)

**Prinsip inti:** Focus/Zoom/Exposure Manager **tidak pernah** membuka stream kamera sendiri. Mereka semua membaca track & elemen preview yang sama lewat 3 fungsi yang diekspor `cameraManager.js`:

```js
getActiveVideoTrack()   // MediaStreamTrack aktif, atau null
getPreviewElement()     // elemen <video> aktif, atau null
onCameraStateChange(cb) // subscribe ke perubahan status kamera
```

---

## 2. cameraManager.js (Camera Engine)

Lokasi: `js/core/cameraManager.js`

| Fungsi | Signature | Deskripsi |
|---|---|---|
| `openCamera` | `(container: HTMLElement, options?: {facingMode?: 'environment'\|'user'}) => Promise<{success, error?}>` | Cek/lengkapi izin lewat Permission Manager → `getUserMedia()` → buat `<video>` → mount ke `container`. |
| `closeCamera` | `() => void` | Hentikan semua track, lepas & hapus elemen preview. Aman dipanggil berulang. |
| `switchCamera` | `(container: HTMLElement) => Promise<{success, error?}>` | Toggle `environment` ↔ `user`, buka ulang di container yang sama. |
| `getActiveVideoTrack` | `() => MediaStreamTrack \| null` | **[Integrasi]** Track video aktif, dipakai Focus/Zoom/Exposure Manager. |
| `getPreviewElement` | `() => HTMLVideoElement \| null` | **[Integrasi]** Elemen `<video>` aktif. |
| `getCameraState` | `() => {status, facingMode, errorMessage}` | Salinan state saat ini (re-export dari `cameraState.js`). |
| `onCameraStateChange` | `(cb: (state) => void) => unsubscribe` | Subscribe perubahan status (re-export). |

**CAMERA_STATE** (`js/core/cameraState.js`): `idle` · `opening` · `previewing` · `closed` · `error`

**Event kunci untuk modul lain:** `onCameraStateChange` adalah "sinyal utama" yang dipakai Focus/Zoom/Exposure Manager untuk tahu kapan harus deteksi kapabilitas & pasang listener (`status === 'previewing'`) dan kapan harus reset (`status === 'closed' | 'error'`). Modul Calibration/Measurement nanti disarankan memakai pola yang sama.

---

## 3. focusManager.js (Focus Manager)

Lokasi: `js/core/focusManager.js`

| Fungsi | Signature | Deskripsi |
|---|---|---|
| `enableTapToFocus` | `(container: HTMLElement) => void` | Pasang listener tap. Dipanggil **otomatis** saat kamera `previewing`. |
| `disableTapToFocus` | `() => void` | Lepas listener tap. Dipanggil otomatis saat kamera `closed`/`error`. |
| `focusAt` | `(container: HTMLElement, x: number, y: number) => Promise<FOCUS_STATE>` | Fokus ke titik ternormalisasi (0–1). Fallback aman jika `focusMode` manual tidak didukung. |
| `lockFocus` | `() => Promise<FOCUS_STATE>` | Kunci fokus pada titik terakhir (atau tengah frame jika belum pernah tap). |
| `unlockFocus` | `() => Promise<FOCUS_STATE>` | Lepas lock, kembali ke `continuous` autofocus jika didukung. |
| `getFocusState` | `() => {status, point, locked, errorMessage}` | Re-export dari `focusState.js`. |
| `onFocusStateChange` | `(cb) => unsubscribe` | Re-export dari `focusState.js`. |

**FOCUS_STATE**: `idle` · `focusing` · `focused` · `locked` · `unsupported` · `error`

**Catatan Safari iOS:** `focusMode` manual umumnya tidak tersedia — hampir selalu berakhir di `unsupported`, indikator tetap tampil sebagai feedback visual, autofocus bawaan tetap aktif.

---

## 4. zoomManager.js (Zoom Manager)

Lokasi: `js/core/zoomManager.js`

| Fungsi | Signature | Deskripsi |
|---|---|---|
| `setZoom` | `(value: number) => Promise<ZOOM_STATE>` | Terapkan nilai zoom (di-clamp ke min–max). Hardware (`applyConstraints`) atau digital (`CSS transform`) tergantung deteksi kapabilitas. |
| `zoomIn` / `zoomOut` | `() => Promise<ZOOM_STATE>` | +/- satu `step` dari nilai saat ini. |
| `setZoomFromSlider` | `(rawValue: number\|string) => Promise<ZOOM_STATE>` | Alias `setZoom()` untuk input `<input type="range">`. |
| `enablePinchToZoom` / `disablePinchToZoom` | `(container?) => void` | Gesture 2 jari. Auto-enable saat `previewing`, auto-disable saat `closed`/`error`. |
| `getZoomState` | `() => {status, mode, value, min, max, step, errorMessage}` | Re-export dari `zoomState.js`. |
| `onZoomStateChange` | `(cb) => unsubscribe` | Re-export dari `zoomState.js`. |

**ZOOM_STATE**: `idle` · `zooming` · `unsupported` · `error`
**ZOOM_MODE**: `hardware` · `digital` · `none`

**Penting untuk Measurement Engine nanti:** cek `getZoomState().mode` sebelum menghitung rasio piksel/mm — mode `digital` mengubah gambar lewat CSS scale (bukan optik sungguhan), sehingga kalibrasi piksel/mm pada mode ini **tidak boleh disamakan** dengan mode `hardware`.

---

## 5. exposureManager.js (Exposure Manager)

Lokasi: `js/core/exposureManager.js`

| Fungsi | Signature | Deskripsi |
|---|---|---|
| `setExposureCompensation` | `(value: number) => Promise<EXPOSURE_STATE>` | Terapkan EV compensation (di-clamp ke min–max hasil deteksi). Tidak berefek apa pun jika `unsupported` — murni informatif. |
| `lockExposure` | `() => Promise<EXPOSURE_STATE>` | `exposureMode: 'manual'` — bekukan exposure saat ini. |
| `unlockExposure` | `() => Promise<EXPOSURE_STATE>` | `exposureMode: 'continuous'` — kembali ke auto exposure. |
| `getExposureState` | `() => {status, mode, locked, compensation, min, max, step, errorMessage}` | Re-export dari `exposureState.js`. |
| `onExposureStateChange` | `(cb) => unsubscribe` | Re-export dari `exposureState.js`. |

**EXPOSURE_STATE**: `idle` · `adjusting` · `locked` · `unsupported` · `error`
**EXPOSURE_MODE**: `hardware` · `none`

**Beda penting dari Zoom Manager:** Exposure Manager **tidak** punya fallback simulasi visual. Kalau `unsupported`, tidak ada efek apa pun diterapkan ke video — hanya status + pesan informatif. (Alasan: memalsukan exposure lewat CSS filter berisiko menyesatkan pengguna soal kondisi sensor sesungguhnya.)

---

## 6. Modul Pendukung (view-layer & utils)

Modul-modul ini **tidak dipanggil langsung** dari luar Camera Core — mereka dipakai secara internal oleh facade di atas. Dicantumkan di sini supaya jelas kalau ada kebutuhan integrasi langsung (jarang diperlukan).

| Modul | Isi |
|---|---|
| `js/ui/cameraPreview.js` | `createPreviewElement`, `attachStream`, `detachStream`, `mountPreview`, `unmountPreview` — dipakai `cameraManager.js`. |
| `js/ui/focusIndicator.js` | `showFocusIndicator`, `updateFocusIndicatorState`, `hideFocusIndicator` — dipakai `focusManager.js`. |
| `js/ui/zoomIndicator.js` | `showZoomIndicator`, `hideZoomIndicator` — dipakai `zoomManager.js`. |
| `js/ui/exposureIndicator.js` | `showExposureIndicator`, `hideExposureIndicator` — dipakai `exposureManager.js`. |
| `js/utils/cameraError.js` | `mapCameraError(err)`, `unsupportedCameraError()` — dipakai `cameraManager.js` untuk menerjemahkan `DOMException`. |

---

## 7. Cara Modul Saling Berkomunikasi

Camera Core **tidak** memakai custom event/DOM event (`CustomEvent`, `dispatchEvent`), dan **tidak** memakai import langsung antar facade level yang sama (mis. `zoomManager.js` tidak pernah `import` dari `focusManager.js`). Semua komunikasi lewat 2 pola:

### Pola A — Reuse via getter (facade → facade)
Focus/Zoom/Exposure Manager membaca kondisi kamera lewat 2 fungsi murni (bukan event):

```js
import { getActiveVideoTrack, getPreviewElement } from './cameraManager.js';
```

Tidak ada state yang di-cache jangka panjang di sisi pemanggil — setiap kali butuh track/elemen, panggil ulang getter ini (track bisa berubah kalau `switchCamera()` dipanggil).

### Pola B — Subscribe state (pub/sub, satu arah)
Setiap `xxxState.js` adalah **state store mandiri** dengan `on___StateChange(callback)`. Ini pola pub/sub sederhana, bukan `EventTarget`/`CustomEvent` — memanggil `callback(snapshot)` langsung tiap kali `set___State()` dipanggil.

```
cameraState.js  ──onCameraStateChange──▶  focusManager.js   (auto attach/detach)
cameraState.js  ──onCameraStateChange──▶  zoomManager.js    (auto attach/detach)
cameraState.js  ──onCameraStateChange──▶  exposureManager.js (auto attach/detach)
```

Focus/Zoom/Exposure Manager masing-masing mendaftarkan listener ke `onCameraStateChange` milik Camera Engine **satu kali saat modul dimuat** (bukan dipanggil manual oleh UI). Artinya: begitu `import focusManager.js` (atau zoom/exposure) dieksekusi, modul itu otomatis "mendengarkan" siklus hidup kamera selamanya, tanpa perlu kode tambahan di halaman.

**Konsekuensi penting untuk sprint berikutnya:** kalau Calibration Engine atau Measurement Engine butuh tahu kapan preview siap / kapan fokus terkunci / kapan zoom berubah, **jangan** poll `getXState()` secara berkala — subscribe lewat `on___StateChange()`, sama seperti pola yang sudah dipakai di 3 modul ini.

---

## 8. Daftar Event (State Change) yang Tersedia

| Sumber | Fungsi subscribe | Payload snapshot |
|---|---|---|
| Camera Engine | `onCameraStateChange(cb)` | `{status, facingMode, errorMessage}` |
| Focus Manager | `onFocusStateChange(cb)` | `{status, point, locked, errorMessage}` |
| Zoom Manager | `onZoomStateChange(cb)` | `{status, mode, value, min, max, step, errorMessage}` |
| Exposure Manager | `onExposureStateChange(cb)` | `{status, mode, locked, compensation, min, max, step, errorMessage}` |

Semua `cb` dipanggil dengan **snapshot lengkap** (bukan delta) setiap kali ada perubahan — aman langsung dipakai untuk re-render UI tanpa perlu menggabungkan state lama+baru secara manual.

---

## 9. Contoh Penggunaan

### 9.1 Membuka kamera & memantau statusnya

```js
import { openCamera, closeCamera, onCameraStateChange } from './js/core/cameraManager.js';

const container = document.getElementById('preview-container');

onCameraStateChange((state) => {
  console.log('Kamera:', state.status, state.errorMessage ?? '');
});

const result = await openCamera(container, { facingMode: 'environment' });
if (!result.success) {
  console.error(result.error.code, result.error.message);
}

// ...selesai pakai kamera:
closeCamera();
```

### 9.2 Memakai Focus + Zoom + Exposure sekaligus (tidak perlu kode ekstra untuk sinkronisasi)

```js
import { openCamera } from './js/core/cameraManager.js';
import { lockFocus } from './js/core/focusManager.js';
import { setZoom } from './js/core/zoomManager.js';
import { setExposureCompensation } from './js/core/exposureManager.js';

const container = document.getElementById('preview-container');
await openCamera(container);
// Tap-to-focus & pinch-to-zoom SUDAH otomatis aktif di sini —
// tidak perlu enableTapToFocus()/enablePinchToZoom() manual.

await lockFocus();               // kunci fokus sebelum ambil ukuran
await setZoom(2);                // perbesar 2x (hardware atau digital)
await setExposureCompensation(0.3); // sedikit lebih terang, jika didukung
```

### 9.3 Membaca kapabilitas sebelum menghitung kalibrasi (relevan untuk Calibration Engine)

```js
import { getZoomState } from './js/core/zoomManager.js';

const zoom = getZoomState();
if (zoom.mode === 'digital') {
  console.warn('Zoom digital aktif — kalibrasi piksel/mm perlu faktor koreksi tambahan.');
}
```

### 9.4 Pola subscribe yang disarankan untuk modul baru (Calibration/Measurement)

```js
import { onCameraStateChange, CAMERA_STATE } from './js/core/cameraManager.js';

onCameraStateChange((state) => {
  if (state.status === CAMERA_STATE.PREVIEWING) {
    // inisialisasi modul di sini — JANGAN polling, tunggu event ini
  }
  if (state.status === CAMERA_STATE.CLOSED || state.status === CAMERA_STATE.ERROR) {
    // reset state modul di sini
  }
});
```

---

## 10. Ringkasan Keterbatasan Browser (Camera Core)

| Kapabilitas | Safari iOS | Chrome Android/Desktop |
|---|---|---|
| Buka/tutup kamera, switch depan/belakang | ✅ | ✅ |
| Tap-to-focus (`focusMode: manual`) | ⚠️ Umumnya `unsupported` | ✅ (tergantung device) |
| Zoom hardware (`getCapabilities().zoom`) | ⚠️ Umumnya `unsupported` → fallback digital | ✅ (tergantung device) |
| Exposure compensation/lock | ⚠️ Umumnya `unsupported` | ✅ (tergantung device) |

Semua modul sudah menangani ketidaktersediaan ini secara graceful (status `unsupported`, tanpa error) — tidak perlu penanganan khusus tambahan saat mengintegrasikan modul baru, cukup baca `mode`/`status` dari state sebelum mengasumsikan suatu kontrol tersedia.

---

*Dokumen ini tidak mengubah kode apa pun. Update dokumen ini setiap kali ada modul Camera Core baru atau fungsi publik yang berubah.*
