class TextRemover {
  constructor() {
    this.minLineLength = 40;
    this.minAspect = 6;
  }

  removeText(imageData) {
    const t0 = Date.now();
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, src = lineValidator.bin;
    const labels = new Int32Array(w * h);
    const keep = new Map();
    const stack = new Int32Array(w * h);
    let label = 0, preserved = 0;

    for (let s = 0; s < src.length; s++) {
      if (src[s] !== 1 || labels[s] !== 0) continue;
      label++;
      let sp = 0; stack[sp++] = s; labels[s] = label;
      let minX = s % w, maxX = minX, minY = (s / w) | 0, maxY = minY;
      while (sp > 0) {
        const c = stack[--sp];
        const cx = c % w, cy = (c / w) | 0;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        if (cx > 0)     { const n = c - 1; if (src[n] === 1 && labels[n] === 0) { labels[n] = label; stack[sp++] = n; } }
        if (cx < w - 1) { const n = c + 1; if (src[n] === 1 && labels[n] === 0) { labels[n] = label; stack[sp++] = n; } }
        if (cy > 0)     { const n = c - w; if (src[n] === 1 && labels[n] === 0) { labels[n] = label; stack[sp++] = n; } }
        if (cy < h - 1) { const n = c + w; if (src[n] === 1 && labels[n] === 0) { labels[n] = label; stack[sp++] = n; } }
      }
      const cw = maxX - minX + 1, ch = maxY - minY + 1;
      const mx = Math.max(cw, ch), mn = Math.max(1, Math.min(cw, ch));
      const isLine = (mx >= this.minLineLength && (mx / mn) >= this.minAspect) || mx >= 0.35 * Math.max(w, h);
      keep.set(label, isLine);
      if (isLine) preserved++;
    }

    const out = new ImageData(w, h);
    const od = out.data;
    for (let i = 0, j = 0; i < src.length; i++, j += 4) {
      const l = labels[i];
      const v = (l > 0 && keep.get(l)) ? 0 : 255;
      od[j] = v; od[j+1] = v; od[j+2] = v; od[j+3] = 255;
    }
    logger.info('  Texto eliminado: ' + preserved + ' estructuras de ' + label + ' conservadas en ' + (Date.now() - t0) + 'ms');
    return out;
  }
}
window.TextRemover = TextRemover;
