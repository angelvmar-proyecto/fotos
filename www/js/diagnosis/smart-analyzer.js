class SmartAnalyzer {
  constructor() { this.imageProfile = null; }

  analyzeImage(imageData) {
    const t0 = Date.now();
    const width = imageData.width, height = imageData.height;
    const data = imageData.data, aspect = width / height;
    let sumGray = 0, minVal = 255, maxVal = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      sumGray += gray;
      if (gray < minVal) minVal = gray;
      if (gray > maxVal) maxVal = gray;
    }

    const totalPixels = width * height;
    const meanGray = sumGray / totalPixels;
    const isDark = meanGray < 128;

    let edgeCount = 0;
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4;
        const gx = Math.abs(data[idx] - data[idx + 4]);
        const gy = Math.abs(data[idx] - data[(y + 1) * width * 4 + x * 4]); // Simplificado
        if (Math.sqrt(gx*gx + gy*gy) > 30) edgeCount++;
      }
    }
    const edgeDensity = edgeCount / (totalPixels / 4);

    const hProj = new Array(height).fill(0);
    const vProj = new Array(width).fill(0);
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4;
        if (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2] < 128) {
          hProj[y]++; vProj[x]++;
        }
      }
    }

    const hPeaks = this.countPeaks(hProj, 8); // Reducido a 8 para tablas densas
    const vPeaks = this.countPeaks(vProj, 8);
    const avgLineThickness = this.estimateLineThickness(hProj, vProj);
    const skewAngle = this.estimateSkew(hProj);

    this.imageProfile = {
      width, height, aspectRatio: aspect.toFixed(2),
      meanGray: Math.round(meanGray), contrast: maxVal - minVal,
      edgeDensity: (edgeDensity * 100).toFixed(2), isDark,
      hPeaks, vPeaks, avgLineThickness: avgLineThickness.toFixed(2),
      skewAngle: skewAngle.toFixed(2),
      imageType: this.classifyImageType({ edgeDensity, contrast: maxVal - minVal, isDark, hPeaks, vPeaks, avgLineThickness: parseFloat(avgLineThickness.toFixed(2)), aspectRatio: aspect }),
      analysisTime: Date.now() - t0
    };

    logger.info('=== ANALISIS DE IMAGEN ===');
    logger.info('Tamano: ' + width + 'x' + height + ' (aspecto: ' + aspect.toFixed(2) + ')');
    logger.info('Brillo promedio: ' + this.imageProfile.meanGray + (isDark ? ' (OSCURA)' : ' (CLARA)'));
    logger.info('Densidad de bordes: ' + this.imageProfile.edgeDensity + '%');
    logger.info('Lineas horizontales estimadas: ' + hPeaks);
    logger.info('Lineas verticales estimadas: ' + vPeaks);
    logger.info('Grosor promedio de linea: ' + this.imageProfile.avgLineThickness + 'px');
    logger.info('Tipo de imagen: ' + this.imageProfile.imageType);
    logger.info('Tiempo de analisis: ' + this.imageProfile.analysisTime + 'ms');

    return this.imageProfile;
  }

  countPeaks(projection, minDistance) {
    const peaks = [];
    const min = Math.min(...projection);
    const max = Math.max(...projection);
    const threshold = min + (max - min) * 0.25; // Umbral adaptativo más bajo

    for (let i = 1; i < projection.length - 1; i++) {
      if (projection[i] > threshold && projection[i] >= projection[i-1] && projection[i] >= projection[i+1]) {
        let tooClose = false;
        for (let j = 0; j < peaks.length; j++) {
          if (Math.abs(peaks[j] - i) < minDistance) {
            // Si hay uno más alto cerca, lo reemplazamos
            if (projection[i] > projection[peaks[j]]) {
              peaks[j] = i;
            }
            tooClose = true;
            break;
          }
        }
        if (!tooClose) peaks.push(i);
      }
    }
    return peaks.length;
  }

  estimateLineThickness(hProj, vProj) {
    const widths = [];
    [hProj, vProj].forEach(proj => {
      const max = Math.max(...proj);
      const threshold = max * 0.6;
      let inPeak = false, peakStart = 0;
      for (let i = 0; i < proj.length; i++) {
        if (proj[i] > threshold) {
          if (!inPeak) { inPeak = true; peakStart = i; }
        } else if (inPeak) {
          widths.push(i - peakStart);
          inPeak = false;
        }
      }
    });
    return widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : 1;
  }

  estimateSkew(hProj) {
    const mid = Math.floor(hProj.length / 2);
    let leftSum = 0, rightSum = 0;
    for (let i = 0; i < mid; i++) leftSum += hProj[i];
    for (let i = mid; i < hProj.length; i++) rightSum += hProj[i];
    return (Math.abs(leftSum - rightSum) / (leftSum + rightSum)) * 5;
  }

  classifyImageType(stats) {
    if (stats.edgeDensity < 2) return 'FOTO_NATURAL';
    if (stats.aspectRatio > 2.5) return stats.isDark ? 'TABLA_ANCHA_OSCURA' : 'TABLA_ANCHA_CLARA';
    if (stats.isDark) return stats.avgLineThickness > 2.5 ? 'TABLA_OSCURA_GRUESA' : 'TABLA_OSCURA_FINA';
    if (stats.edgeDensity > 8) return stats.avgLineThickness > 2.5 ? 'TABLA_DENSA_GRUESA' : 'TABLA_DENSA_FINA';
    if (stats.hPeaks > 30 && stats.vPeaks > 20) return 'TABLA_COMPLEJA';
    if (stats.hPeaks > 15 || stats.vPeaks > 10) return 'TABLA_SIMPLE';
    return 'TABLA_MINIMALISTA';
  }

  suggestAlgorithms(profile) {
    const suggestions = { primary: [], secondary: [], avoid: [], params: {} };
    switch (profile.imageType) {
      case 'TABLA_ANCHA_CLARA': case 'TABLA_ANCHA_OSCURA':
        suggestions.primary = ['Echo Radar', 'Cell Detector'];
        suggestions.secondary = ['Fourier Analysis', 'Profile Projection'];
        suggestions.params = { 'Echo Radar': { minCoverage: 0.25, minRunRatio: 0.25, gapTolerance: 6 }, 'Radar Matcher': { kernelSize: 8, threshold: 2 } };
        break;
      case 'TABLA_DENSA_GRUESA':
        suggestions.primary = ['Echo Radar', 'Morphological'];
        suggestions.secondary = ['Fourier Analysis', 'Profile Projection'];
        suggestions.params = { 'Echo Radar': { minCoverage: 0.6, minRunRatio: 0.6 }, 'Morphological': { kernelSize: 20 } };
        break;
      case 'TABLA_DENSA_FINA':
        suggestions.primary = ['Echo Radar', 'Fourier Analysis'];
        suggestions.secondary = ['Profile Projection', 'Cell Detector'];
        suggestions.params = { 'Echo Radar': { minCoverage: 0.2, minRunRatio: 0.2, gapTolerance: 8 }, 'Fourier Analysis': { minDistance: 10 } };
        break;
      default:
        suggestions.primary = ['Echo Radar', 'Profile Projection'];
        suggestions.secondary = ['Fourier Analysis'];
        suggestions.params = { 'Echo Radar': { minCoverage: 0.3, minRunRatio: 0.3, gapTolerance: 8 } };
    }
    
    if (parseFloat(profile.avgLineThickness) < 1.5) {
      logger.info('Lineas muy finas detectadas - relajando umbrales de evidencia');
      if (suggestions.params['Echo Radar']) {
        suggestions.params['Echo Radar'].minCoverage = Math.max(0.2, suggestions.params['Echo Radar'].minCoverage - 0.1);
        suggestions.params['Echo Radar'].minRunRatio = Math.max(0.2, suggestions.params['Echo Radar'].minRunRatio - 0.1);
      }
    }
    return suggestions;
  }

  getRecommendation() {
    if (!this.imageProfile) return null;
    const s = this.suggestAlgorithms(this.imageProfile);
    logger.info('\n=== RECOMENDACIONES ===');
    logger.info('Algoritmos PRIMARIOS: ' + s.primary.join(', '));
    logger.info('Algoritmos SECUNDARIOS: ' + s.secondary.join(', '));
    Object.entries(s.params).forEach(([algo, params]) => {
      if (algo !== 'deskew') logger.info('Parametros ' + algo + ': ' + JSON.stringify(params));
    });
    return s;
  }
}
window.SmartAnalyzer = SmartAnalyzer;
