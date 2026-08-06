/**
 * projectPageController.js
 * ---------------------------------------------------------------
 * Controller integrasi untuk halaman Project (Sprint 12).
 * Menghubungkan elemen DOM di project.html ke Project Manager
 * (create/open/rename/delete/list). TIDAK ADA logika Project Manager
 * baru di sini — murni wiring DOM ke fungsi yang sudah ada di
 * projectManager.js.
 *
 * Dimuat di SETIAP halaman (bukan hanya project.html) dengan alasan
 * arsitektur yang sama seperti cameraPageController.js (lihat komentar
 * di file itu): SPA Router menukar `.app` lewat fetch()+DOM swap, dan
 * <script> di dalam halaman yang di-fetch tidak otomatis dieksekusi
 * browser. MutationObserver di sini mendeteksi kapan elemen halaman
 * Project (#project-list-container) muncul, baik lewat reload penuh
 * maupun swap SPA — router.js sendiri TIDAK diubah.
 * ---------------------------------------------------------------
 */

import {
  listProjects,
  createProject,
  openProject,
  deleteProject,
  onProjectManagerStateChange,
  getProjectManagerState,
} from './projectManager.js';

let wired = false;
let unsubscribe = null;

/** Cek apakah halaman Project sedang tampil, pasang/lepas wiring sesuai kondisi. */
function evaluatePage() {
  const container = document.getElementById('project-list-container');
  if (container && !wired) {
    wireProjectPage();
  } else if (!container && wired) {
    unwireProjectPage();
  }
}

/** Escape teks agar aman disisipkan sebagai HTML (nama/deskripsi project adalah input user). */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/** Format tanggal ISO jadi label ringkas berbahasa Indonesia. */
function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

/** Render daftar project ke #project-list-container sesuai state saat ini. */
function renderProjects(state) {
  const container = document.getElementById('project-list-container');
  const countLabel = document.getElementById('project-count-label');
  if (!container) return;

  if (countLabel) {
    countLabel.textContent = `${state.projects.length} project`;
  }

  if (state.status === 'loading') {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Memuat daftar project…</p>
      </div>`;
    return;
  }

  if (!state.projects.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5a1 1 0 0 1 1-1h5l1.5 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>
        <p class="empty-state__title">Belum ada project</p>
        <p class="empty-state__body">Buat project baru untuk memisahkan sesi pengukuran.</p>
      </div>`;
    return;
  }

  container.innerHTML = state.projects.map((p) => `
    <div class="card card--pad project-card" data-project-id="${escapeHtml(p.id)}" style="margin-bottom: var(--sp-3); ${p.id === state.activeProjectId ? 'border-color: var(--accent);' : ''} cursor:pointer;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: var(--sp-3);">
        <div style="min-width:0;">
          <p style="font-size: var(--fs-md); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.name)}</p>
          <p class="mono" style="font-size: var(--fs-2xs); color: var(--text-tertiary); margin-top:4px; text-transform:uppercase; letter-spacing: var(--tracking-wide);">${p.measurementCount} item · dibuat ${formatDate(p.createdAt)}</p>
        </div>
        <div style="display:flex; align-items:center; gap: var(--sp-2); flex-shrink:0;">
          ${p.id === state.activeProjectId ? '<span class="badge badge--ok">Aktif</span>' : ''}
          <button class="icon-btn project-delete-btn" data-project-id="${escapeHtml(p.id)}" aria-label="Hapus project" style="width:32px;height:32px;">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Delegasi klik: tap kartu = buka project, tap ikon hapus = hapus project
  container.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', async (event) => {
      if (event.target.closest('.project-delete-btn')) return; // ditangani listener terpisah
      const id = card.dataset.projectId;
      try {
        await openProject(id);
      } catch (err) {
        showError(err.message);
      }
    });
  });

  container.querySelectorAll('.project-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = btn.dataset.projectId;
      const project = state.projects.find((p) => p.id === id);
      if (!window.confirm(`Hapus project "${project?.name ?? id}"? Tindakan ini tidak bisa dibatalkan.`)) return;
      try {
        await deleteProject(id);
      } catch (err) {
        showError(err.message);
      }
    });
  });
}

function showError(message) {
  const banner = document.getElementById('camera-error-banner-project');
  const text = document.getElementById('project-error-text');
  if (banner && text) {
    banner.style.display = 'block';
    text.textContent = message;
  }
}
function clearError() {
  const banner = document.getElementById('camera-error-banner-project');
  if (banner) banner.style.display = 'none';
}

/** Minta nama project baru via prompt native, lalu buat project. */
async function handleCreateProject() {
  const name = window.prompt('Nama project baru:');
  if (name === null) return; // user membatalkan
  clearError();
  try {
    await createProject({ name });
  } catch (err) {
    showError(err.message);
  }
}

/** Pasang seluruh wiring halaman Project. */
function wireProjectPage() {
  wired = true;

  unsubscribe = onProjectManagerStateChange((state) => {
    renderProjects(state);
  });

  document.getElementById('btn-new-project-top')?.addEventListener('click', handleCreateProject);
  document.getElementById('btn-new-project-bottom')?.addEventListener('click', handleCreateProject);

  // Muat daftar project setiap kali halaman ini tampil, supaya data
  // selalu sinkron (mis. setelah project dibuat dari sesi sebelumnya).
  listProjects().catch((err) => showError(err.message));

  // Render langsung dari cache jika sudah pernah dimuat sebelumnya,
  // supaya tidak ada jeda "Memuat..." saat balik ke halaman ini.
  renderProjects(getProjectManagerState());
}

/** Lepas wiring saat user pindah ke halaman lain. */
function unwireProjectPage() {
  wired = false;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

const observer = new MutationObserver(evaluatePage);
observer.observe(document.body, { childList: true, subtree: true });
evaluatePage();
