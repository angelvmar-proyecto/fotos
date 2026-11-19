class ProfileProjection {
  constructor() {
    this.name = 'Profile Projection';
    this.color = '#FFFF00';
    this.textRemover = new TextRemover();
  }

  async detect(imageData) {
    logger.info('Iniciando Profile Projection con eliminacion de texto...');
    const start = Date.now();

    const cleanedImage = this.textRemover.removeText(imageData);
    const gray = this.toGrayscale(cleanedImage);
    
    const hProjection = this.horizontalProjection(gray);
    const hLines = this.detectLines(hProjection, 'horizontal', gray.width, gray.height);
    
    const vProjection = this.verticalProjection(gray);
    const vLines = this.detectLines(vProjection, 'vertical', gray.width, gray.height);
    
    const lines = [...hLines, ...vLines];
    const time = Date.now() - start;
    logger.info('Profile Projection completado en ' + time + 'ms. Lineas: ' + lines.length);
    
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, horizontalLines: hLines.length, verticalLines: vLines.length }
    };
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

  detectLines(projection, direction, width, height) {
    const lines = [];
    const threshold = this.calculateThreshold(projection);
    let inLine = false, lineStart = 0;
    
    for (let i = 0; i < projection.length; i++) {
      if (projection[i] < threshold) {
        if (!inLine) { lineStart = i; inLine = true; }
      } else {
        if (inLine) {
          const linePos = Math.floor((lineStart + i) / 2);
          if (direction === 'horizontal') {
            lines.push({ x1: 0, y1: linePos, x2: width - 1, y2: linePos, angle: 0, length: width });
          } else {
            lines.push({ x1: linePos, y1: 0, x2: linePos, y2: height - 1, angle: 90, length: height });
          }
          inLine = false;
        }
      }
    }
    return lines;
  }

  calculateThreshold(projection) {
    const min = Math.min(...projection);
    const max = Math.max(...projection);
    return min + (max - min) * 0.3;
  }
}
window.ProfileProjection = ProfileProjection;
