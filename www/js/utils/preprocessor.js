class Preprocessor {
  constructor() {
    this.lastMetrics = {};
  }

  process(imageData) {
    logger.info('Preprocesando imagen...');
    const start = Date.now();
    
    // 1. Escala de grises
    const gray = this.toGrayscale(imageData);
    logger.info('  Escala de grises OK');
    
    // 2. Umbral de Otsu
    const otsuThreshold = this.otsuThreshold(gray);
    logger.info(`  Umbral Otsu: ${otsuThreshold}`);
    
    // 3. Binarización
    const binary = this.binarize(gray, otsuThreshold);
    logger.info('  Binarizacion OK');
    
    // 4. Detectar inversion (fondo oscuro?)
    const inverted = this.needsInversion(binary);
    const finalBinary = inverted ? this.invert(binary) : binary;
    if (inverted) logger.info('  Imagen invertida (fondo oscuro detectado)');
    
    // 5. Detectar y corregir skew
    const skewAngle = this.detectSkew(finalBinary);
    logger.info(`  Angulo de inclinacion detectado: ${skewAngle.toFixed(2)} grados`);
    
    let result = finalBinary;
    if (Math.abs(skewAngle) > 0.3) {
      result = this.deskew(finalBinary, skewAngle);
      logger.info(`  Deskew aplicado: ${skewAngle.toFixed(2)} grados`);
    }
    
    const time = Date.now() - start;
    this.lastMetrics = {
      otsuThreshold,
      skewAngle,
      inverted,
      preprocessingTime: time
    };
    logger.info(`Preprocesamiento completado en ${time}ms`);
    
    return result;
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

  otsuThreshold(gray) {
    const data = gray.data;
    const hist = new Array(256).fill(0);
    
    for (let i = 0; i < data.length; i++) {
      hist[data[i]]++;
    }
    
    const total = data.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    
    let sumB = 0, wB = 0, wF = 0;
    let maxVariance = 0, threshold = 128;
    
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;
      
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const variance = wB * wF * (mB - mF) * (mB - mF);
      
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }
    
    return threshold;
  }

  binarize(gray, threshold) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const binary = new Uint8Array(width * height);
    
    for (let i = 0; i < data.length; i++) {
      binary[i] = data[i] < threshold ? 1 : 0;
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
    
    let bestAngle = 0;
    let bestScore = -Infinity;
    
    // Probar angulos de -3 a +3 con paso de 0.5
    for (let angle = -3; angle <= 3; angle += 0.5) {
      const score = this.evaluateAngle(binary, angle);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    
    // Refinar con paso de 0.1 alrededor del mejor
    const refinedStart = Math.max(-3, bestAngle - 0.5);
    const refinedEnd = Math.min(3, bestAngle + 0.5);
    
    for (let angle = refinedStart; angle <= refinedEnd; angle += 0.1) {
      const score = this.evaluateAngle(binary, angle);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    
    return bestAngle;
  }

  evaluateAngle(binary, angle) {
    if (Math.abs(angle) < 0.01) {
      // Sin rotacion: proyeccion directa
      return this.horizontalProjectionScore(binary);
    }
    
    // Rotar virtualmente y evaluar
    const rotated = this.rotateBinary(binary, angle);
    return this.horizontalProjectionScore(rotated);
  }

  horizontalProjectionScore(binary) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    const projection = new Array(height).fill(0);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x] === 1) projection[y]++;
      }
    }
    
    // Score = varianza de la proyeccion (picos altos = lineas claras)
    const mean = projection.reduce((a, b) => a + b, 0) / height;
    let variance = 0;
    for (let i = 0; i < height; i++) {
      variance += (projection[i] - mean) ** 2;
    }
    return variance / height;
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

  deskew(binary, angle) {
    logger.info(`  Aplicando deskew de ${angle.toFixed(2)} grados...`);
    return this.rotateBinary(binary, angle);
  }

  getMetrics() {
    return this.lastMetrics;
  }
}

const preprocessor = new Preprocessor();
