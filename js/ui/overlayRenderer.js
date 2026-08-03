/**
 * overlayRenderer.js
 * ---------------------------------------------------------------
 * Fungsi MURNI untuk menggambar tiap layer overlay ke 2D context.
 * Tanggung jawab TUNGGAL: menggambar. Tidak menyimpan state, tidak
 * membaca/menulis DOM di luar context yang diberikan.
 *
 * PENTING: semua koordinat & proporsi di sini murni VISUAL (rule of
 * thirds, crosshair di tengah, dll) — TIDAK ADA perhitungan ukuran
 * atau dimensi dunia nyata. Itu di luar scope Overlay Framework,
 * akan jadi tanggung jawab Measurement Engine di sprint mendatang.
 * ---------------------------------------------------------------
 */

/**
 * Bersihkan seluruh isi canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Gambar crosshair (garis silang + lingkaran kecil) di tengah frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} [opacity]
 */
export function drawCrosshair(ctx, width, height, opacity = 1) {
  const cx = width / 2;
  const cy = height / 2;
  const armLength = Math.min(width, height) * 0.06;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = '#FF6A13';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(cx - armLength, cy);
  ctx.lineTo(cx + armLength, cy);
  ctx.moveTo(cx, cy - armLength);
  ctx.lineTo(cx, cy + armLength);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, armLength * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Gambar grid rule-of-thirds (2 garis vertikal + 2 garis horizontal).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} [opacity]
 */
export function drawGrid(ctx, width, height, opacity = 1) {
  const x1 = width / 3;
  const x2 = (width / 3) * 2;
  const y1 = height / 3;
  const y2 = (height / 3) * 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(x1, 0); ctx.lineTo(x1, height);
  ctx.moveTo(x2, 0); ctx.lineTo(x2, height);
  ctx.moveTo(0, y1); ctx.lineTo(width, y1);
  ctx.moveTo(0, y2); ctx.lineTo(width, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Gambar kotak safe-area (garis putus-putus dengan margin dari tepi).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} [opacity]
 * @param {number} [margin] rasio margin dari tepi (0-0.49)
 */
export function drawSafeArea(ctx, width, height, opacity = 1, margin = 0.08) {
  const mx = width * margin;
  const my = height * margin;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(mx, my, width - mx * 2, height - my * 2);
  ctx.restore();
}

/**
 * Gambar kotak ROI (Region of Interest) sesuai rect ternormalisasi.
 * Murni visual — tidak menghitung ukuran/dimensi nyata apa pun.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} [opacity]
 * @param {{x:number,y:number,w:number,h:number}|null} rect koordinat ternormalisasi (0-1)
 */
export function drawROI(ctx, width, height, opacity = 1, rect) {
  if (!rect) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = '#49B379';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x * width, rect.y * height, rect.w * width, rect.h * height);
  ctx.restore();
}

/**
 * Gambar seluruh layer yang visible sesuai snapshot state overlay.
 * Urutan gambar: safeArea → grid → roi → crosshair (crosshair paling
 * atas supaya selalu terlihat jelas).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width ukuran CSS canvas (bukan ukuran piksel internal)
 * @param {number} height
 * @param {object} layers snapshot `layers` dari overlayState.js
 */
export function renderLayers(ctx, width, height, layers) {
  clearCanvas(ctx, width, height);

  if (layers.safeArea?.visible) {
    drawSafeArea(ctx, width, height, layers.safeArea.opacity, layers.safeArea.margin);
  }
  if (layers.grid?.visible) {
    drawGrid(ctx, width, height, layers.grid.opacity);
  }
  if (layers.roi?.visible) {
    drawROI(ctx, width, height, layers.roi.opacity, layers.roi.rect);
  }
  if (layers.crosshair?.visible) {
    drawCrosshair(ctx, width, height, layers.crosshair.opacity);
  }
}
