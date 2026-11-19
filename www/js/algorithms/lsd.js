class LSD {
  constructor() {
    this.name = 'LSD';
    this.color = '#00FF00';
    this.angleStep = 3;
    this.minLength = 25;
  }

  async detect(imageData) {
    logger.info('Iniciando LSD (SIN eliminacion de texto)...');
    const start = Date.now();

    // NO usar text-remover, trabajar directamente con bordes
    const gray = this.toGrayscale(imageData);
    const edges = this.sobelEdges(gray);
    
    const lines = [];
    for (let angle = 0; angle < 180; angle += this.angleStep) {
      const rad = angle * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const projection = this.projectAtAngle(edges, cos, sin, gray.width, gray.height);
      const linePositions = this.findLocalMinima(projection);
      
      for (const pos of linePositions) {
        const line = this.positionToLine(pos, angle, gray.width, gray.height);
        if (line.length >= this.minLength) lines.push(line);
      }
    }
    
    const time = Date.now() - start;
    logger.info('LSD completado en ' + time + 'ms. Lineas: ' + lines.length);
    
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time }
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

  sobelEdges(gray) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const edges = new Uint8Array(width * height);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const ki = (ky + 1) * 3 + (kx + 1);
            gx += data[idx] * sobelX[ki];
            gy += data[idx] * sobelY[ki];
          }
        }
        edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      }
    }
    return edges;
  }

  projectAtAngle(edges, cos, sin, width, height) {
    const projection = [];
    const maxDist = Math.ceil(Math.sqrt(width * width + height * height));
    
    for (let d = -maxDist; d <= maxDist; d++) {
      let sum = 0, count = 0;
      for (let t = -maxDist; t <= maxDist; t++) {
        const x = Math.round(d * cos - t * sin);
        const y = Math.round(d * sin + t * cos);
        if (x >= 0 && x < width && y >= 0 && y < height) {
          sum += edges[y * width + x];
          count++;
        }
      }
      projection.push(count > 0 ? sum / count : 0);
    }
    return projection;
  }

  findLocalMinima(projection) {
    const minima = [];
    const min = Math.min(...projection);
    const max = Math.max(...projection);
    const threshold = min + (max - min) * 0.3;
    
    for (let i = 1; i < projection.length - 1; i++) {
      if (projection[i] < projection[i - 1] && 
          projection[i] < projection[i + 1] &&
          projection[i] < threshold) {
        minima.push(i);
      }
    }
    return minima;
  }

  positionToLine(pos, angle, width, height) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let x1, y1, x2, y2;
    
    if (Math.abs(cos) > Math.abs(sin)) {
      x1 = Math.round(pos * cos); y1 = 0;
      x2 = Math.round(pos * cos + height * sin); y2 = height;
    } else {
      x1 = 0; y1 = Math.round(pos * sin);
      x2 = width; y2 = Math.round(pos * sin + width * cos);
    }
    
    x1 = Math.max(0, Math.min(width - 1, x1));
    y1 = Math.max(0, Math.min(height - 1, y1));
    x2 = Math.max(0, Math.min(width - 1, x2));
    y2 = Math.max(0, Math.min(height - 1, y2));
    
    return { x1, y1, x2, y2, angle: angle, length: Math.sqrt((x2-x1)**2 + (y2-y1)**2) };
  }
}
window.LSD = LSD;
