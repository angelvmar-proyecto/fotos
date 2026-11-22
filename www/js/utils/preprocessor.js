class Preprocessor {
  constructor() {
    this.lastMetrics = {};
  }

  // === Adaptación Inteligente Universal (Corregida) ===
  adapt(imageData, profile) {
    logger.info('Adaptando imagen según perfil: ' + profile.imageType);
    const t0 = Date.now();
    const w = imageData.width, h = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    
    let contrastFactor = 1.0;
    let brightnessOffset = 0;
    const type = profile.imageType;
    const meanGray = profile.meanGray;

    // 1. AJUSTE DE BRILLO Y CONTRASTE ADAPTATIVO (Más conservador)
    if (type.includes('PANTALLA_PC')) {
      // Solo aplicar contraste si la imagen es oscura
      if (meanGray < 140) {
        contrastFactor = 1.25;
        brightnessOffset = 10;
        logger.info('  Ajuste: Contraste moderado (1.25x) y brillo leve (+10) para pantalla oscura');
      } else {
        // Imagen ya clara: solo contraste suave
        contrastFactor = 1.10;
        logger.info('  Ajuste: Contraste suave (1.10x) para pantalla clara (brillo=' + meanGray + ')');
      }
    } else if (type.includes('OSCURA')) {
      contrastFactor = 1.30;
      brightnessOffset = 15;
      logger.info('  Ajuste: +Contraste (1.30x) y +Brillo (+15) para imagen oscura');
    } else if (type.includes('DENSA_FINA')) {
      contrastFactor = 1.08;
      logger.info('  Ajuste: Realce muy suave (1.08x) para preservar líneas finas');
    } else if (type.includes('GRUESA')) {
      contrastFactor = 1.03;
      logger.info('  Ajuste: Normalización mínima (1.03x) para líneas gruesas');
    }

    if (contrastFactor !== 1.0 || brightnessOffset !== 0) {
      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          let val = data[i + c];
          val += brightnessOffset;
          val = ((val - 128) * contrastFactor) + 128;
          data[i + c] = Math.max(0, Math.min(255, val));
        }
      }
    }

    // 2. FILTRO ESPECÍFICO: Suavizado anti-moiré MUY SUAVE solo para pantallas oscuras
    if (type.includes('PANTALLA_PC') && meanGray < 140) {
      logger.info('  Aplicando suavizado muy suave anti-moiré (solo para pantallas oscuras)');
      const temp = new Uint8ClampedArray(data);
      for (let y = 1; y < h - 1; y += 2) {  // Solo cada 2 píxeles para velocidad
        for (let x = 1; x < w - 1; x += 2) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const sum = temp[idx - w * 4 + c] + temp[idx + c] + temp[idx + w * 4 + c] +
                        temp[idx - 4 + c] + temp[idx + 4 + c];
            data[idx + c] = Math.round((data[idx + c] * 3 + sum / 5) / 4);  // 75% original, 25% suavizado
          }
        }
      }
    }

    this.lastMetrics = { contrastFactor, brightnessOffset, type, meanGray };
    logger.info('Adaptación de imagen completada en ' + (Date.now() - t0) + 'ms');
    return new ImageData(data, w, h);
  }

  // === MÉTODOS ORIGINALES (sin cambios) ===
  process(imageData) {
    logger.info('Preprocesando imagen (Sauvola optimizado + deskew)...');
    const start = Date.now();
    const gray = this.toGrayscale(imageData);
    const binary = this.sauvolaThresholdOptimized(gray, 15, 0.5);
    const inverted = this.needsInversion(binary);
    const finalBinary = inverted ? this.invert(binary) : binary;
    if (inverted) logger.info('  Imagen invertida (fondo oscuro detectado)');

    const skewAngle = this.detectSkew(finalBinary);
    logger.info('  Angulo de inclinacion: ' + skewAngle.toFixed(2) + ' grados');

    let result = finalBinary;
    if (Math.abs(skewAngle) > 0.3) {
      result = this.deskew(finalBinary, skewAngle);
      logger.info('  Deskew aplicado: ' + skewAngle.toFixed(2) + ' grados');
    }

    this.lastMetrics.skewAngle = skewAngle;
    this.lastMetrics.inverted = inverted;
    this.lastMetrics.preprocessingTime = Date.now() - start;
    logger.info('Preprocesamiento completado en ' + (Date.now() - start) + 'ms');
    return result;
  }

  toGrayscale(imageData) {
    const data = imageData.data, w = imageData.width, h = imageData.height;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    return { data: gray, width: w, height: h };
  }

  sauvolaThresholdOptimized(gray, windowSize, k) {
    const data = gray.data, width = gray.width, height = gray.height;
    const binary = new Uint8Array(width * height);
    const half = Math.floor(windowSize / 2), R = 128;
    const integral = new Float64Array((width + 1) * (height + 1));
    const integralSq = new Float64Array((width + 1) * (height + 1));

    for (let y = 0; y < height; y++) {
      let rowSum = 0, rowSumSq = 0;
      for (let x = 0; x < width; x++) {
        const val = data[y * width + x];
        rowSum += val; rowSumSq += val * val;
        const idx = (y + 1) * (width + 1) + (x + 1);
        integral[idx] = rowSum + integral[y * (width + 1) + (x + 1)];
        integralSq[idx] = rowSumSq + integralSq[y * (width + 1) + (x + 1)];
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - half), y1 = Math.max(0, y - half);
        const x2 = Math.min(width - 1, x + half), y2 = Math.min(height - 1, y + half);
        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        const i1 = y1 * (width + 1) + x1, i2 = y1 * (width + 1) + (x2 + 1);
        const i3 = (y2 + 1) * (width + 1) + x1, i4 = (y2 + 1) * (width + 1) + (x2 + 1);
        const sum = integral[i4] - integral[i2] - integral[i3] + integral[i1];
        const sumSq = integralSq[i4] - integralSq[i2] - integralSq[i3] + integralSq[i1];
        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        const std = Math.sqrt(Math.max(0, variance));
        const threshold = mean * (1 + k * (std / R - 1));
        binary[y * width + x] = data[y * width + x] < threshold ? 1 : 0;
      }
    }
    return { data: binary, width, height };
  }

  needsInversion(binary) {
    let blackCount = 0;
    for (let i = 0; i < binary.data.length; i++) if (binary.data[i] === 1) blackCount++;
    return blackCount > binary.data.length / 2;
  }

  invert(binary) {
    const inverted = new Uint8Array(binary.data.length);
    for (let i = 0; i < binary.data.length; i++) inverted[i] = binary.data[i] === 1 ? 0 : 1;
    return { data: inverted, width: binary.width, height: binary.height };
  }

  detectSkew(binary) {
    const step = 4; let bestAngle = 0, bestScore = -Infinity;
    for (let angle = -3; angle <= 3; angle += 0.5) {
      const score = this.evaluateAngleFast(binary, angle, step);
      if (score > bestScore) { bestScore = score; bestAngle = angle; }
    }
    for (let angle = Math.max(-3, bestAngle - 0.5); angle <= Math.min(3, bestAngle + 0.5); angle += 0.1) {
      const score = this.evaluateAngleFast(binary, angle, step);
      if (score > bestScore) { bestScore = score; bestAngle = angle; }
    }
    return bestAngle;
  }

  evaluateAngleFast(binary, angle, step) {
    const data = binary.data, width = binary.width, height = binary.height;
    if (Math.abs(angle) < 0.01) return this.horizontalProjectionScoreFast(data, width, height, step);
    const rad = angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const cx = width / 2, cy = height / 2;
    const projection = new Array(Math.ceil(height / step)).fill(0);
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[y * width + x] === 1) {
          const srcY = Math.round(-(x - cx) * sin + (y - cy) * cos + cy);
          const projIdx = Math.floor(srcY / step);
          if (projIdx >= 0 && projIdx < projection.length) projection[projIdx]++;
        }
      }
    }
    const mean = projection.reduce((a, b) => a + b, 0) / projection.length;
    let variance = 0;
    for (let i = 0; i < projection.length; i++) variance += (projection[i] - mean) ** 2;
    return variance / projection.length;
  }

  horizontalProjectionScoreFast(data, width, height, step) {
    const projection = new Array(Math.ceil(height / step)).fill(0);
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[y * width + x] === 1) projection[Math.floor(y/step)]++;
      }
    }
    const mean = projection.reduce((a, b) => a + b, 0) / projection.length;
    let variance = 0;
    for (let i = 0; i < projection.length; i++) variance += (projection[i] - mean) ** 2;
    return variance / projection.length;
  }

  deskew(binary, angle) { return this.rotateBinary(binary, angle); }

  rotateBinary(binary, angleDeg) {
    const data = binary.data, width = binary.width, height = binary.height;
    const rotated = new Uint8Array(width * height);
    const rad = angleDeg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const cx = width / 2, cy = height / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx, dy = y - cy;
        const srcX = Math.round(dx * cos + dy * sin + cx);
        const srcY = Math.round(-dx * sin + dy * cos + cy);
        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          rotated[y * width + x] = data[srcY * width + srcX];
        }
      }
    }
    return { data: rotated, width, height };
  }

  getMetrics() { return this.lastMetrics; }
}
const preprocessor = new Preprocessor();
window.Preprocessor = Preprocessor;
window.preprocessor = preprocessor;
