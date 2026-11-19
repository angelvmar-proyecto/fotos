class FourierAnalysis {
  constructor() {
    this.name = 'Fourier Analysis';
    this.color = '#FFA500';
    this.textRemover = new TextRemover();
    this.minDistance = 15;
    this.detectionLevel = 'all'; // 'thick', 'medium', 'thin', 'all'
  }

  async detect(imageData) {
    logger.info('Iniciando Fourier Analysis Multinivel...');
    const start = Date.now();

    const cleanedImage = this.textRemover.removeText(imageData);
    const gray = this.toGrayscale(cleanedImage);
    
    // Detectar líneas con análisis de grosor
    const hLines = this.detectLinesWithThickness(gray, 'horizontal');
    const vLines = this.detectLinesWithThickness(gray, 'vertical');
    
    // Filtrar por nivel de detección
    const filteredH = this.filterByLevel(hLines, 'horizontal');
    const filteredV = this.filterByLevel(vLines, 'vertical');
    
    const lines = [...filteredH, ...filteredV];
    
    // Estadísticas por nivel
    const thickH = filteredH.filter(l => l.thickness >= 3).length;
    const mediumH = filteredH.filter(l => l.thickness >= 1.5 && l.thickness < 3).length;
    const thinH = filteredH.filter(l => l.thickness < 1.5).length;
    
    const thickV = filteredV.filter(l => l.thickness >= 3).length;
    const mediumV = filteredV.filter(l => l.thickness >= 1.5 && l.thickness < 3).length;
    const thinV = filteredV.filter(l => l.thickness < 1.5).length;
    
    const time = Date.now() - start;
    logger.info('Fourier completado en ' + time + 'ms. Lineas: ' + lines.length);
    logger.info('  Horizontales: ' + filteredH.length + ' (gruesas:' + thickH + ', medianas:' + mediumH + ', finas:' + thinH + ')');
    logger.info('  Verticales: ' + filteredV.length + ' (gruesas:' + thickV + ', medianas:' + mediumV + ', finas:' + thinV + ')');
    
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { 
        totalLines: lines.length, 
        executionTime: time, 
        minDistance: this.minDistance,
        detectionLevel: this.detectionLevel,
        horizontalLines: filteredH.length,
        verticalLines: filteredV.length,
        thickLines: thickH + thickV,
        mediumLines: mediumH + mediumV,
        thinLines: thinH + thinV
      }
    };
  }

  setMinDistance(distance) {
    this.minDistance = distance;
    logger.info('Fourier: minDistance ajustado a ' + distance);
  }

  setDetectionLevel(level) {
    this.detectionLevel = level;
    logger.info('Fourier: nivel de detección = ' + level);
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

  detectLinesWithThickness(gray, direction) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    
    // Calcular proyección
    const projection = direction === 'horizontal' 
      ? this.horizontalProjection(gray)
      : this.verticalProjection(gray);
    
    const length = projection.length;
    const lines = [];
    
    // Umbral base (muy bajo para detectar todo)
    const min = Math.min(...projection);
    const max = Math.max(...projection);
    const baseThreshold = min + (max - min) * 0.15;
    
    // Detectar todos los mínimos locales
    const allPeaks = [];
    for (let i = 1; i < length - 1; i++) {
      if (projection[i] < baseThreshold &&
          projection[i] < projection[i - 1] &&
          projection[i] < projection[i + 1]) {
        
        let tooClose = false;
        for (const peak of allPeaks) {
          if (Math.abs(peak.pos - i) < this.minDistance) { tooClose = true; break; }
        }
        
        if (!tooClose) {
          // Calcular grosor de la línea
          const thickness = this.calculateLineThickness(projection, i, baseThreshold);
          allPeaks.push({ pos: i, thickness: thickness });
        }
      }
    }
    
    // Convertir a líneas
    for (const peak of allPeaks) {
      const line = direction === 'horizontal'
        ? { x1: 0, y1: peak.pos, x2: width - 1, y2: peak.pos, angle: 0, length: width, thickness: peak.thickness }
        : { x1: peak.pos, y1: 0, x2: peak.pos, y2: height - 1, angle: 90, length: height, thickness: peak.thickness };
      lines.push(line);
    }
    
    return lines;
  }

  calculateLineThickness(projection, peakPos, threshold) {
    // Medir cuántos píxeles alrededor del pico están por debajo del umbral
    let leftWidth = 0;
    for (let i = peakPos - 1; i >= 0; i--) {
      if (projection[i] < threshold) leftWidth++;
      else break;
    }
    
    let rightWidth = 0;
    for (let i = peakPos + 1; i < projection.length; i++) {
      if (projection[i] < threshold) rightWidth++;
      else break;
    }
    
    return leftWidth + rightWidth + 1; // Grosor total en píxeles
  }

  filterByLevel(lines, direction) {
    if (this.detectionLevel === 'all') return lines;
    
    if (this.detectionLevel === 'thick') {
      return lines.filter(l => l.thickness >= 3);
    } else if (this.detectionLevel === 'medium') {
      return lines.filter(l => l.thickness >= 1.5 && l.thickness < 3);
    } else if (this.detectionLevel === 'thin') {
      return lines.filter(l => l.thickness < 1.5);
    }
    
    return lines;
  }

  horizontalProjection(gray) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const projection = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) projection[y] += data[y * width + x];
    }
    return projection;
  }

  verticalProjection(gray) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const projection = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) projection[x] += data[y * width + x];
    }
    return projection;
  }
}
window.FourierAnalysis = FourierAnalysis;
