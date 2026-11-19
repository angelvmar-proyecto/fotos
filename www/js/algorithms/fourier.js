class FourierAnalysis {
  constructor() {
    this.name = 'Fourier Analysis';
    this.color = '#FFA500';
    this.textRemover = new TextRemover();
    this.minDistance = 15;
  }

  async detect(imageData) {
    logger.info('Iniciando Fourier Analysis con eliminacion de texto...');
    const start = Date.now();

    const cleanedImage = this.textRemover.removeText(imageData);
    const gray = this.toGrayscale(cleanedImage);
    
    const hProjection = this.horizontalProjection(gray);
    const hLines = this.detectPeriodicLines(hProjection, 'horizontal', gray.width, gray.height);
    
    const vProjection = this.verticalProjection(gray);
    const vLines = this.detectPeriodicLines(vProjection, 'vertical', gray.width, gray.height);
    
    const lines = [...hLines, ...vLines];
    const time = Date.now() - start;
    logger.info('Fourier completado en ' + time + 'ms. Lineas: ' + lines.length + ' (minDistance: ' + this.minDistance + ')');
    
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, minDistance: this.minDistance, horizontalLines: hLines.length, verticalLines: vLines.length }
    };
  }

  setMinDistance(distance) {
    this.minDistance = distance;
    logger.info('Fourier: minDistance ajustado a ' + distance);
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

  detectPeriodicLines(projection, direction, width, height) {
    const lines = [];
    const min = Math.min(...projection);
    const max = Math.max(...projection);
    const threshold = min + (max - min) * 0.25;
    const peaks = [];
    
    for (let i = 1; i < projection.length - 1; i++) {
      if (projection[i] < threshold &&
          projection[i] < projection[i - 1] &&
          projection[i] < projection[i + 1]) {
        let tooClose = false;
        for (const peak of peaks) {
          if (Math.abs(peak - i) < this.minDistance) { tooClose = true; break; }
        }
        if (!tooClose) peaks.push(i);
      }
    }
    
    for (const pos of peaks) {
      if (direction === 'horizontal') {
        lines.push({ x1: 0, y1: pos, x2: width - 1, y2: pos, angle: 0, length: width });
      } else {
        lines.push({ x1: pos, y1: 0, x2: pos, y2: height - 1, angle: 90, length: height });
      }
    }
    return lines;
  }
}
window.FourierAnalysis = FourierAnalysis;
