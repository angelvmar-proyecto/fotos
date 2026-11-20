class SmartAnalyzer {
  constructor() {
    this.imageProfile = null;
  }

  analyzeImage(imageData) {
    const t0 = Date.now();
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const aspect = width / height;

    let sumR = 0, sumG = 0, sumB = 0;
    let minVal = 255, maxVal = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      sumR += data[i]; sumG += data[i+1]; sumB += data[i+2];
      if (gray < minVal) minVal = gray;
      if (gray > maxVal) maxVal = gray;
    }

    const totalPixels = width * height;
    const meanGray = (sumR + sumG + sumB) / (3 * totalPixels);
    const contrast = maxVal - minVal;
    const isDark = meanGray < 128;

    let edgeCount = 0;
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4;
        const idxR = (y * width + x + 1) * 4;
        const idxD = ((y + 1) * width + x) * 4;

        const gx = Math.abs(data[idx] - data[idxR]);
        const gy = Math.abs(data[idx] - data[idxD]);
        const grad = Math.sqrt(gx * gx + gy * gy);

        if (grad > 30) edgeCount++;
      }
    }
    const edgeDensity = edgeCount / (totalPixels / 4);

    const hProj = new Array(height).fill(0);
    const vProj = new Array(width).fill(0);

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
        if (gray < 128) {
          hProj[y]++;
          vProj[x]++;
        }
      }
    }

    const hPeaks = this.countPeaks(hProj, 10);
    const vPeaks = this.countPeaks(vProj, 10);
    const avgLineThickness = this.estimateLineThickness(hProj, vProj);
    const skewAngle = this.estimateSkew(hProj);

    const imageType = this.classifyImageType({
      edgeDensity,
      contrast,
      isDark,
      hPeaks,
      vPeaks,
      avgLineThickness,
      aspectRatio: aspect
    });

    this.imageProfile = {
      width,
      height,
      aspectRatio: aspect.toFixed(2),
      meanGray: Math.round(meanGray),
      contrast,
      edgeDensity: (edgeDensity * 100).toFixed(2),
      isDark,
      hPeaks,
      vPeaks,
      avgLineThickness: avgLineThickness.toFixed(2),
      skewAngle: skewAngle.toFixed(2),
      imageType,
      analysisTime: Date.now() - t0
    };

    logger.info('=== ANALISIS DE IMAGEN ===');
    logger.info('Tamano: ' + width + 'x' + height + ' (aspecto: ' + aspect.toFixed(2) + ')');
    logger.info('Brillo promedio: ' + this.imageProfile.meanGray + (isDark ? ' (OSCURA)' : ' (CLARA)'));
    logger.info('Contraste: ' + contrast);
    logger.info('Densidad de bordes: ' + this.imageProfile.edgeDensity + '%');
    logger.info('Lineas horizontales estimadas: ' + hPeaks);
    logger.info('Lineas verticales estimadas: ' + vPeaks);
    logger.info('Grosor promedio de linea: ' + this.imageProfile.avgLineThickness + 'px');
    logger.info('Inclinacion estimada: ' + this.imageProfile.skewAngle + ' grados');
    logger.info('Tipo de imagen: ' + imageType);
    logger.info('Tiempo de analisis: ' + this.imageProfile.analysisTime + 'ms');

    return this.imageProfile;
  }

  countPeaks(projection, minDistance) {
    // CORREGIDO: Ahora busca MAXIMOS locales (picos = líneas reales)
    // Antes buscaba minimos (espacios entre líneas)
    const peaks = [];
    const max = Math.max(...projection);
    const threshold = max * 0.4; // 40% del máximo = umbral para considerar "pico de línea"

    for (let i = 1; i < projection.length - 1; i++) {
      // Buscar MÁXIMO local: valor mayor que sus vecinos Y por encima del umbral
      if (projection[i] > threshold && 
          projection[i] >= projection[i-1] && 
          projection[i] >= projection[i+1]) {
        
        // Verificar que no esté demasiado cerca de otro pico
        let tooClose = false;
        for (const p of peaks) {
          if (Math.abs(p - i) < minDistance) {
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
      const threshold = max * 0.7; // 70% del máximo para detectar PICOS (líneas)
      
      let inPeak = false;
      let peakStart = 0;
      
      for (let i = 0; i < proj.length; i++) {
        if (proj[i] > threshold) { // PICOS = líneas
          if (!inPeak) {
            inPeak = true;
            peakStart = i;
          }
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
    
    const asymmetry = Math.abs(leftSum - rightSum) / (leftSum + rightSum);
    return asymmetry * 5;
  }

  classifyImageType(stats) {
    if (stats.edgeDensity < 0.02) return 'FOTO_NATURAL';
    
    if (stats.aspectRatio > 2.5) {
      if (stats.isDark) return 'TABLA_ANCHA_OSCURA';
      return 'TABLA_ANCHA_CLARA';
    }
    
    if (stats.isDark) {
      if (stats.avgLineThickness > 2.5) return 'TABLA_OSCURA_GRUESA';
      return 'TABLA_OSCURA_FINA';
    }
    
    if (stats.edgeDensity > 0.08) {
      if (stats.avgLineThickness > 2.5) return 'TABLA_DENSA_GRUESA';
      return 'TABLA_DENSA_FINA';
    }
    
    if (stats.hPeaks > 30 && stats.vPeaks > 20) return 'TABLA_COMPLEJA';
    if (stats.hPeaks > 15 || stats.vPeaks > 10) return 'TABLA_SIMPLE';
    
    return 'TABLA_MINIMALISTA';
  }

  suggestAlgorithms(profile) {
    const suggestions = {
      primary: [],
      secondary: [],
      avoid: [],
      params: {}
    };

    switch (profile.imageType) {
      case 'TABLA_ANCHA_CLARA':
      case 'TABLA_ANCHA_OSCURA':
        suggestions.primary.push('Echo Radar', 'Radar Matcher');
        suggestions.secondary.push('Fourier Analysis', 'Profile Projection');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.4, minRunRatio: 0.4, gapTolerance: 6 },
          'Radar Matcher': { kernelSize: 8, threshold: 2 }
        };
        logger.info('Imagen muy ancha detectada - usando reescalado conservador para Radar Matcher');
        break;

      case 'TABLA_DENSA_GRUESA':
        suggestions.primary.push('Echo Radar', 'Morphological');
        suggestions.secondary.push('Fourier Analysis', 'Profile Projection');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.6, minRunRatio: 0.6 },
          'Morphological': { kernelSize: 20 }
        };
        break;

      case 'TABLA_DENSA_FINA':
        suggestions.primary.push('Echo Radar', 'Fourier Analysis');
        suggestions.secondary.push('Profile Projection', 'Radar Matcher');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.3, minRunRatio: 0.25, gapTolerance: 8 },
          'Fourier Analysis': { minDistance: 10 }
        };
        break;

      case 'TABLA_OSCURA_GRUESA':
        suggestions.primary.push('Echo Radar', 'Morphological');
        suggestions.secondary.push('Fourier Analysis');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.5, minRunRatio: 0.5 }
        };
        break;

      case 'TABLA_OSCURA_FINA':
        suggestions.primary.push('Echo Radar', 'Fourier Analysis');
        suggestions.secondary.push('Profile Projection');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.25, minRunRatio: 0.2, gapTolerance: 10 },
          'Fourier Analysis': { minDistance: 8 }
        };
        break;

      case 'TABLA_COMPLEJA':
        suggestions.primary.push('Echo Radar', 'Fourier Analysis', 'Profile Projection');
        suggestions.secondary.push('Morphological');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.4, minRunRatio: 0.4, gapTolerance: 6 }
        };
        break;

      case 'TABLA_SIMPLE':
        suggestions.primary.push('Echo Radar', 'Profile Projection');
        suggestions.secondary.push('Fourier Analysis');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.5, minRunRatio: 0.5 }
        };
        break;

      case 'TABLA_MINIMALISTA':
        suggestions.primary.push('Echo Radar', 'Profile Projection');
        suggestions.secondary.push('Fourier Analysis');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.3, minRunRatio: 0.3, gapTolerance: 8 }
        };
        break;

      case 'FOTO_NATURAL':
        suggestions.primary.push('Echo Radar');
        suggestions.avoid.push('Hough Transform', 'LSD', 'Gabor Filters');
        suggestions.params = {
          'Echo Radar': { minCoverage: 0.7, minRunRatio: 0.7 }
        };
        break;
    }

    if (parseFloat(profile.skewAngle) > 2) {
      logger.info('Imagen con inclinacion significativa (' + profile.skewAngle + ' grados) - activando deskew');
      suggestions.params['deskew'] = true;
    }

    if (parseFloat(profile.avgLineThickness) < 1.5) {
      logger.info('Lineas muy finas detectadas - relajando umbrales de evidencia');
      if (suggestions.params['Echo Radar']) {
        suggestions.params['Echo Radar'].minCoverage = Math.max(0.2, suggestions.params['Echo Radar'].minCoverage - 0.15);
        suggestions.params['Echo Radar'].minRunRatio = Math.max(0.2, suggestions.params['Echo Radar'].minRunRatio - 0.15);
      }
    }

    return suggestions;
  }

  getRecommendation() {
    if (!this.imageProfile) return null;
    
    const suggestions = this.suggestAlgorithms(this.imageProfile);
    
    logger.info('');
    logger.info('=== RECOMENDACIONES ===');
    logger.info('Algoritmos PRIMARIOS (ejecutar primero):');
    suggestions.primary.forEach(a => logger.info('   - ' + a));
    
    if (suggestions.secondary.length > 0) {
      logger.info('Algoritmos SECUNDARIOS (complementarios):');
      suggestions.secondary.forEach(a => logger.info('   - ' + a));
    }
    
    if (suggestions.avoid.length > 0) {
      logger.info('Algoritmos NO RECOMENDADOS para esta imagen:');
      suggestions.avoid.forEach(a => logger.info('   - ' + a));
    }
    
    if (Object.keys(suggestions.params).length > 0) {
      logger.info('Parametros sugeridos:');
      Object.entries(suggestions.params).forEach(([algo, params]) => {
        if (algo !== 'deskew') {
          logger.info('   ' + algo + ': ' + JSON.stringify(params));
        }
      });
    }
    
    return suggestions;
  }
}

window.SmartAnalyzer = SmartAnalyzer;
