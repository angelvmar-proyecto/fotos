class Morphological {
  constructor() { 
    this.name = 'Morphological'; 
    this.color = '#808080'; 
  }
  
  async detect(imageData) {
    logger.info('Iniciando Morphological Operations');
    const start = Date.now();
    
    const gray = ImageProcessor.toGrayscale(imageData);
    const width = gray.width;
    const height = gray.height;
    const data = gray.data;
    
    const lines = [];
    
    // Crear imagen binaria
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      binary[i/4] = data[i] < 200 ? 1 : 0;
    }
    
    // Kernel horizontal
    const hKernelSize = 30;
    const hEroded = this.erode(binary, width, height, hKernelSize, 1);
    const hDilated = this.dilate(hEroded, width, height, hKernelSize, 1);
    
    // Detectar líneas horizontales
    const hProjection = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (hDilated[y * width + x]) hProjection[y]++;
      }
    }
    
    const hThreshold = width * 0.3;
    for (let y = 0; y < height; y++) {
      if (hProjection[y] > hThreshold) {
        lines.push({
          x1: 0, y1: y,
          x2: width - 1, y2: y,
          angle: 0,
          length: width
        });
      }
    }
    
    // Kernel vertical
    const vKernelSize = 30;
    const vEroded = this.erode(binary, width, height, 1, vKernelSize);
    const vDilated = this.dilate(vEroded, width, height, 1, vKernelSize);
    
    // Detectar líneas verticales
    const vProjection = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (vDilated[y * width + x]) vProjection[x]++;
      }
    }
    
    const vThreshold = height * 0.3;
    for (let x = 0; x < width; x++) {
      if (vProjection[x] > vThreshold) {
        lines.push({
          x1: x, y1: 0,
          x2: x, y2: height - 1,
          angle: 90,
          length: height
        });
      }
    }
    
    const time = Date.now() - start;
    logger.info(`Morphological completado en ${time}ms. Lineas: ${lines.length}`);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines, 
      metrics: { totalLines: lines.length, executionTime: time } 
    };
  }
  
  erode(binary, width, height, kWidth, kHeight) {
    const result = new Uint8Array(width * height);
    const halfW = Math.floor(kWidth / 2);
    const halfH = Math.floor(kHeight / 2);
    
    for (let y = halfH; y < height - halfH; y++) {
      for (let x = halfW; x < width - halfW; x++) {
        let minVal = 1;
        for (let ky = 0; ky < kHeight; ky++) {
          for (let kx = 0; kx < kWidth; kx++) {
            const px = x + kx - halfW;
            const py = y + ky - halfH;
            if (!binary[py * width + px]) {
              minVal = 0;
              break;
            }
          }
          if (!minVal) break;
        }
        result[y * width + x] = minVal;
      }
    }
    return result;
  }
  
  dilate(binary, width, height, kWidth, kHeight) {
    const result = new Uint8Array(width * height);
    const halfW = Math.floor(kWidth / 2);
    const halfH = Math.floor(kHeight / 2);
    
    for (let y = halfH; y < height - halfH; y++) {
      for (let x = halfW; x < width - halfW; x++) {
        let maxVal = 0;
        for (let ky = 0; ky < kHeight; ky++) {
          for (let kx = 0; kx < kWidth; kx++) {
            const px = x + kx - halfW;
            const py = y + ky - halfH;
            if (binary[py * width + px]) {
              maxVal = 1;
              break;
            }
          }
          if (maxVal) break;
        }
        result[y * width + x] = maxVal;
      }
    }
    return result;
  }
}
window.Morphological = Morphological;
