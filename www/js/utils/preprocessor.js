class Preprocessor {
  constructor() {
    this.lastMetrics = {};
    this.cache = null; // Cache de la última imagen procesada
    this.cacheKey = null;
  }

  process(imageData) {
    // Crear clave única para esta imagen
    const key = imageData.width + 'x' + imageData.height + '_' + imageData.data.length;
    
    // Si ya procesamos esta imagen, devolver cache
    if (this.cacheKey === key && this.cache) {
      logger.info('  Usando preprocesamiento en cache');
      return this.cache;
    }
    
    logger.info('Preprocesando imagen (Sauvola optimizado + deskew)...');
    const start = Date.now();
    
    // 1. Escala de grises
    const gray = this.toGrayscale(imageData);
    logger.info('  Escala de grises OK');
    
    // 2. Umbral adaptativo de Sauvola con imágenes integrales (100× más rápido)
    const binary = this.sauvolaThresholdOptimized(gray, 15, 0.5);
    logger.info('  Umbral Sauvola optimizado OK');
    
    // 3. Detectar inversion
    const inverted = this.needsInversion(binary);
    const finalBinary = inverted ? this.invert(binary) : binary;
    if (inverted) logger.info('  Imagen invertida (fondo oscuro detectado)');
    
    // 4. Detectar y corregir skew
    const skewAngle = this.detectSkew(finalBinary);
    logger.info('  Angulo de inclinacion: ' + skewAngle.toFixed(2) + ' grados');
    
    let result = finalBinary;
    if (Math.abs(skewAngle) > 0.3) {
      result = this.deskew(finalBinary, skewAngle);
      logger.info('  Deskew aplicado: ' + skewAngle.toFixed(2) + ' grados');
    }
    
    const time = Date.now() - start;
    this.lastMetrics = {
      skewAngle,
      inverted,
      preprocessingTime: time
    };
    logger.info('Preprocesamiento completado en ' + time + 'ms');
    
    // Guardar en cache
    this.cache = result;
    this.cacheKey = key;
    
    return result;
  }

  clearCache() {
    this.cache = null;
    this.cacheKey = null;
  }

  toGrayscale(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Uint8ClampedArray(width * height);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    
    return { data: gray, width, height };
  }

  // Sauvola con imágenes integrales: O(N) en vez de O(N×225)
  sauvolaThresholdOptimized(gray, windowSize, k) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const binary = new Uint8Array(width * height);
    const half = Math.floor(windowSize / 2);
    const R = 128;
    
    // Construir imágenes integrales
    const integral = new Float64Array((width + 1) * (height + 1));
    const integralSq = new Float64Array((width + 1) * (height + 1));
    
    // Llenar imágenes integrales
    for (let y = 0; y < height; y++) {
      let rowSum = 0, rowSumSq = 0;
      for (let x = 0; x < width; x++) {
        const val = data[y * width + x];
        rowSum += val;
        rowSumSq += val * val;
        
        const idx = (y + 1) * (width + 1) + (x + 1);
        integral[idx] = rowSum + integral[y * (width + 1) + (x + 1)];
        integralSq[idx] = rowSumSq + integralSq[y * (width + 1) + (x + 1)];
      }
    }
    
    // Aplicar umbral usando imágenes integrales (O(1) por píxel)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - half);
        const y1 = Math.max(0, y - half);
        const x2 = Math.min(width - 1, x + half);
        const y2 = Math.min(height - 1, y + half);
        
        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        
        // Calcular suma y suma de cuadrados usando imágenes integrales
        const i1 = y1 * (width + 1) + x1;
        const i2 = y1 * (width + 1) + (x2 + 1);
        const i3 = (y2 + 1) * (width + 1) + x1;
        const i4 = (y2 + 1) * (width + 1) + (x2 + 1);
        
        const sum = integral[i4] - integral[i2] - integral[i3] + integral[i1];
        const sumSq = integralSq[i4] - integralSq[i2] - integralSq[i3] + integralSq[i1];
        
        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        const std = Math.sqrt(Math.max(0, variance));
        
        // Fórmula de Sauvola
        const threshold = mean * (1 + k * (std / R - 1));
        
        binary[y * width + x] = data[y * width + x] < threshold ? 1 : 0;
      }
    }
    
    return { data: binary, width, height };
  }

  needsInversion(binary) {
    const data = binary.data;
    let blackCount = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 1) blackCount++;
    }
    return blackCount > data.length / 2;
  }

  invert(binary) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    const inverted = new Uint8Array(width * height);
    
    for (let i = 0; i < data.length; i++) {
      inverted[i] = data[i] === 1 ? 0 : 1;
    }
    
    return { data: inverted, width, height };
  }

  detectSkew(binary) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    
    // Para velocidad, trabajar con versión reducida
    const step = 4;
    let bestAngle = 0;
    let bestScore = -Infinity;
    
    for (let angle = -3; angle <= 3; angle += 0.5) {
      const score = this.evaluateAngleFast(binary, angle, step);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    
    const refinedStart = Math.max(-3, bestAngle - 0.5);
    const refinedEnd = Math.min(3, bestAngle + 0.5);
    
    for (let angle = refinedStart; angle <= refinedEnd; angle += 0.1) {
      const score = this.evaluateAngleFast(binary, angle, step);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    
    return bestAngle;
  }

  evaluateAngleFast(binary, angle, step) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    
    if (Math.abs(angle) < 0.01) {
      return this.horizontalProjectionScoreFast(data, width, height, step);
    }
    
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cx = width / 2;
    const cy = height / 2;
    
    const projection = new Array(Math.ceil(height / step)).fill(0);
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[y * width + x] === 1) {
          const dx = x - cx;
          const dy = y - cy;
          const srcY = Math.round(-dx * sin + dy * cos + cy);
          const projIdx = Math.floor(srcY / step);
          if (projIdx >= 0 && projIdx < projection.length) {
            projection[projIdx]++;
          }
        }
      }
    }
    
    const mean = projection.reduce((a, b) => a + b, 0) / projection.length;
    let variance = 0;
    for (let i = 0; i < projection.length; i++) {
      variance += (projection[i] - mean) ** 2;
    }
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
    for (let i = 0; i < projection.length; i++) {
      variance += (projection[i] - mean) ** 2;
    }
    return variance / projection.length;
  }

  deskew(binary, angle) {
    logger.info('  Aplicando deskew de ' + angle.toFixed(2) + ' grados...');
    return this.rotateBinary(binary, angle);
  }

  rotateBinary(binary, angleDeg) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    const rotated = new Uint8Array(width * height);
    
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cx = width / 2;
    const cy = height / 2;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const srcX = Math.round(dx * cos + dy * sin + cx);
        const srcY = Math.round(-dx * sin + dy * cos + cy);
        
        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          rotated[y * width + x] = data[srcY * width + srcX];
        }
      }
    }
    
    return { data: rotated, width, height };
  }

  getMetrics() {
    return this.lastMetrics;
  }
}

const preprocessor = new Preprocessor();
