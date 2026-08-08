/**
 * navMenuController.js
 * ---------------------------------------------------------------
 * Controller navigasi global: mengganti bottom-nav yang selalu
 * memakan ruang layar dengan dropdown ringkas di topbar. Dimuat di
 * SETIAP halaman (pola sama seperti cameraPageController.js dkk)
 * memakai deteksi ulang setiap kali `.app` di-swap oleh SPA Router
 * — TIDAK ADA perubahan pada router.js.
 *
 * Elemen yang dicari: #nav-menu-toggle (tombol) + #nav-menu-panel
 * (daftar link). Ada di topbar setiap halaman.
 * ---------------------------------------------------------------
 */

let currentOutsideHandler = null;
let wiredToggle = null;

function evaluate() {
  const toggle = document.getElementById('nav-menu-toggle');
  if (toggle && toggle !== wiredToggle) {
    wire(toggle);
    wiredToggle = toggle;
  }
  markCurrentPage();
}

function wire(toggle) {
  const panel = document.getElementById('nav-menu-panel');
  if (!panel) return;

  function close() {
    panel.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function open() {
    panel.removeAttribute('hidden');
    toggle.setAttribute('aria-expanded', 'true');
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (panel.hasAttribute('hidden')) open();
    else close();
  });

  panel.querySelectorAll('.nav-menu__item').forEach((item) => {
    item.addEventListener('click', close);
  });

  // Hanya satu listener outside-click aktif pada satu waktu — cegah
  // penumpukan listener setiap kali halaman berpindah lewat SPA Router.
  if (currentOutsideHandler) {
    document.removeEventListener('click', currentOutsideHandler);
  }
  currentOutsideHandler = (event) => {
    if (!event.target.closest('.nav-menu')) close();
  };
  document.addEventListener('click', currentOutsideHandler);
}

/** Tandai item nav yang sesuai halaman saat ini dengan aria-current. */
function markCurrentPage() {
  const currentFile = window.location.pathname.split('/').pop() || 'home.html';
  document.querySelectorAll('.nav-menu__item').forEach((item) => {
    const href = item.getAttribute('href');
    if (href === currentFile) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });
}

const observer = new MutationObserver(evaluate);
observer.observe(document.body, { childList: true, subtree: true });
evaluate();
