class RadarMatcherV2 {
  constructor() {
    this.name = 'Radar Matcher V2';
    this.color = '#800080';
  }

  async detect(imageData) {
    logger.info('Iniciando Radar Matcher V2 (Verificacion de continuidad completa)...');
    const start = Date.now();

    const gray = this.toGrayscale(imageData);
    const width = gray.width;
    const height = gray.height;
    
    // Binarizar con umbral adaptativo simple
    const binary = new Uint8Array(width * height);
    let sum = 0;
    for (let i = 0; i < gray.data.length; i++) sum += gray.data[i];
    const threshold = sum / gray.data.length;
    
    for (let i = 0; i < gray.data.length; i++) {
      binary[i] = gray.data[i] < threshold ? 1 : 0;
    }

    const lines = [];
    
    // 1. Verificar continuidad HORIZONTAL a lo largo de TODA la imagen
    for (let y = 0; y < height; y++) {
      let darkCount = 0;
      let maxContinuous = 0;
      let currentContinuous = 0;
      
      for (let x = 0; x < width; x++) {
        if (binary[y * width + x] === 1) {
          darkCount++;
          currentContinuous++;
          maxContinuous = Math.max(maxContinuous, currentContinuous);
        } else {
          currentContinuous = 0;
        }
      }
      
      // Si tiene suficientes pixeles oscuros Y una continuidad significativa (ej. > 30% del ancho)
      if (darkCount > width * 0.15 && maxContinuous > width * 0.3) {
        lines.push({ x1: 0, y1: y, x2: width - 1, y2: y, angle: 0, length: width });
      }
    }

    // 2. Verificar continuidad VERTICAL a lo largo de TODA la imagen
    for (let x = 0; x < width; x++) {
      let darkCount = 0;
      let maxContinuous = 0;
      let currentContinuous = 0;
      
      for (let y = 0; y < height; y++) {
        if (binary[y * width + x] === 1) {
          darkCount++;
          currentContinuous++;
          maxContinuous = Math.max(maxContinuous, currentContinuous);
        } else {
          currentContinuous = 0;
        }
      }
      
      // Si tiene suficientes pixeles oscuros Y una continuidad significativa (ej. > 30% del alto)
      if (darkCount > height * 0.15 && maxContinuous > height * 0.3) {
        lines.push({ x1: x, y1: 0, x2: x, y2: height - 1, angle: 90, length: height });
      }
    }

    // 3. Fusionar líneas cercanas (tolerancia 5px)
    const merged = this.mergeLines(lines, 5);
    const time = Date.now() - start;
    
    logger.info('Radar V2 completado en ' + time + 'ms. Lineas: ' + merged.length);
    return { algorithm: this.name, color: this.color, lines: merged, metrics: { totalLines: merged.length, executionTime: time } };
  }

  toGrayscale(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Float32Array(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    return { data: gray, width, height };
  }

  mergeLines(lines, tolerance) {
    const merged = [];
    const used = new Set();
    
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      let current = lines[i];
      
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(j)) continue;
        if (lines[j].angle === current.angle) {
          const dist = current.angle === 0 ? Math.abs(current.y1 - lines[j].y1) : Math.abs(current.x1 - lines[j].x1);
          if (dist <= tolerance) {
            if (current.angle === 0) current.y1 = current.y2 = Math.floor((current.y1 + lines[j].y1) / 2);
            else current.x1 = current.x2 = Math.floor((current.x1 + lines[j].x1) / 2);
            used.add(j);
          }
        }
      }
      merged.push(current);
      used.add(i);
    }
    return merged;
  }
}
window.RadarMatcherV2 = RadarMatcherV2;
