class Morphological {
  constructor() { 
    this.name = 'Morphological'; 
    this.color = '#808080'; 
  }
  
  async detect(imageData) {
    logger.info('Iniciando Morphological (optimizado para tablas densas)');
    const start = Date.now();
    
    const gray = this.toGrayscale(imageData);
    const width = gray.width;
    const height = gray.height;
    const data = gray.data;
    
    const lines = [];
    
    // Kernel reducido a 15px para no fusionar filas separadas por ~23px
    const hKernelSize = 15;
    const hEroded = this.erode1D(data, width, height, hKernelSize, 'horizontal');
    const hDilated = this.dilate1D(hEroded, width, height, hKernelSize, 'horizontal');
    
    const hProjection = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (hDilated[y * width + x] < 128) hProjection[y]++;
      }
    }
    
    // Umbral adaptativo bajo para tablas densas
    const hThreshold = width * 0.10;
    let inLine = false, lineStart = 0;
    
    for (let y = 0; y < height; y++) {
      if (hProjection[y] > hThreshold) {
        if (!inLine) { lineStart = y; inLine = true; }
      } else {
        if (inLine) {
          lines.push({ x1: 0, y1: lineStart, x2: width - 1, y2: lineStart, angle: 0, length: width });
          inLine = false;
        }
      }
    }
    
    // Kernel vertical de 15px
    const vKernelSize = 15;
    const vEroded = this.erode1D(data, width, height, vKernelSize, 'vertical');
    const vDilated = this.dilate1D(vEroded, width, height, vKernelSize, 'vertical');
    
    const vProjection = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (vDilated[y * width + x] < 128) vProjection[x]++;
      }
    }
    
    const vThreshold = height * 0.10;
    inLine = false; lineStart = 0;
    
    for (let x = 0; x < width; x++) {
      if (vProjection[x] > vThreshold) {
        if (!inLine) { lineStart = x; inLine = true; }
      } else {
        if (inLine) {
          lines.push({ x1: lineStart, y1: 0, x2: lineStart, y2: height - 1, angle: 90, length: height });
          inLine = false;
        }
      }
    }
    
    // Fusionar solo si están a menos de 3px (para no perder líneas de 23px de separación)
    const merged = this.mergeNearbyLines(lines, 3);
    
    const time = Date.now() - start;
    logger.info(`Morphological completado en ${time}ms. Lineas: ${merged.length}`);
    
    return { 
      algorithm: this.name, color: this.color, lines: merged, 
      metrics: { totalLines: merged.length, executionTime: time } 
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
  
  erode1D(data, width, height, kernelSize, direction) {
    const result = new Uint8ClampedArray(data.length);
    const half = Math.floor(kernelSize / 2);
    if (direction === 'horizontal') {
      for (let y = 0; y < height; y++) {
        for (let x = half; x < width - half; x++) {
          let minVal = 255;
          for (let k = 0; k < kernelSize; k++) {
            minVal = Math.min(minVal, data[y * width + (x - half + k)]);
          }
          result[y * width + x] = minVal;
        }
      }
    } else {
      for (let x = 0; x < width; x++) {
        for (let y = half; y < height - half; y++) {
          let minVal = 255;
          for (let k = 0; k < kernelSize; k++) {
            minVal = Math.min(minVal, data[(y - half + k) * width + x]);
          }
          result[y * width + x] = minVal;
        }
      }
    }
    return result;
  }
  
  dilate1D(data, width, height, kernelSize, direction) {
    const result = new Uint8ClampedArray(data.length);
    const half = Math.floor(kernelSize / 2);
    if (direction === 'horizontal') {
      for (let y = 0; y < height; y++) {
        for (let x = half; x < width - half; x++) {
          let maxVal = 0;
          for (let k = 0; k < kernelSize; k++) {
            maxVal = Math.max(maxVal, data[y * width + (x - half + k)]);
          }
          result[y * width + x] = maxVal;
        }
      }
    } else {
      for (let x = 0; x < width; x++) {
        for (let y = half; y < height - half; y++) {
          let maxVal = 0;
          for (let k = 0; k < kernelSize; k++) {
            maxVal = Math.max(maxVal, data[(y - half + k) * width + x]);
          }
          result[y * width + x] = maxVal;
        }
      }
    }
    return result;
  }
  
  mergeNearbyLines(lines, threshold) {
    const merged = [];
    const used = new Set();
    const horizontal = lines.filter(l => l.angle === 0);
    const vertical = lines.filter(l => l.angle === 90);
    
    for (let i = 0; i < horizontal.length; i++) {
      if (used.has(i)) continue;
      let current = horizontal[i];
      for (let j = i + 1; j < horizontal.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(current.y1 - horizontal[j].y1) < threshold) {
          current.y1 = current.y2 = Math.floor((current.y1 + horizontal[j].y1) / 2);
          used.add(j);
        }
      }
      merged.push(current);
      used.add(i);
    }
    
    for (let i = 0; i < vertical.length; i++) {
      if (used.has(i + horizontal.length)) continue;
      let current = vertical[i];
      for (let j = i + 1; j < vertical.length; j++) {
        if (used.has(j + horizontal.length)) continue;
        if (Math.abs(current.x1 - vertical[j].x1) < threshold) {
          current.x1 = current.x2 = Math.floor((current.x1 + vertical[j].x1) / 2);
          used.add(j + horizontal.length);
        }
      }
      merged.push(current);
      used.add(i + horizontal.length);
    }
    return merged;
  }
}
window.Morphological = Morphological;
