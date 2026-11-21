class LineEnhancer {
  constructor() {
    this.bilateralRadius = 2;
    this.bilateralSigma = 50;
    this.sobelThreshold = 30;
    this.brushSize = 3;
  }

  enhance(imageData) {
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    
    // Paso 1: Escala de grises
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      gray[j] = 0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2];
    }
    
    // Paso 2: Filtro bilateral (reduce ruido sin difuminar bordes)
    const bilateral = this.applyBilateral(gray, w, h);
    
    // Paso 3: Sobel horizontal + vertical
    const sobelH = this.applySobelH(bilateral, w, h);
    const sobelV = this.applySobelV(bilateral, w, h);
    
    // Paso 4: Combinar Sobel (máximo de ambos)
    const edges = new Uint8ClampedArray(w * h);
    for (let i = 0; i < edges.length; i++) {
      edges[i] = Math.max(sobelH[i], sobelV[i]) > this.sobelThreshold ? 255 : 0;
    }
    
    // Paso 5: Morphological opening (elimina ruido)
    const opened = this.morphOpen(edges, w, h, this.brushSize);
    
    // Paso 6: Crear ImageData
    const result = new ImageData(w, h);
    for (let i = 0, j = 0; i < result.data.length; i += 4, j++) {
      result.data[i] = opened[j];
      result.data[i+1] = opened[j];
      result.data[i+2] = opened[j];
      result.data[i+3] = 255;
    }
    
    return result;
  }

  applyBilateral(gray, w, h) {
    const result = new Uint8ClampedArray(w * h);
    const r = this.bilateralRadius;
    const sigmaS = r;
    const sigmaR = this.bilateralSigma;
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const center = gray[y * w + x];
        let sumW = 0, sumI = 0;
        
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            
            const neighbor = gray[ny * w + nx];
            const spatialDist = Math.sqrt(dx*dx + dy*dy);
            const rangeDist = Math.abs(center - neighbor);
            
            const ws = Math.exp(-(spatialDist*spatialDist) / (2*sigmaS*sigmaS));
            const wr = Math.exp(-(rangeDist*rangeDist) / (2*sigmaR*sigmaR));
            const weight = ws * wr;
            
            sumW += weight;
            sumI += weight * neighbor;
          }
        }
        
        result[y * w + x] = sumI / sumW;
      }
    }
    
    return result;
  }

  applySobelH(gray, w, h) {
    const result = new Uint8ClampedArray(w * h);
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx = 
          -gray[(y-1)*w + (x-1)] + gray[(y-1)*w + (x+1)] +
          -2*gray[y*w + (x-1)] + 2*gray[y*w + (x+1)] +
          -gray[(y+1)*w + (x-1)] + gray[(y+1)*w + (x+1)];
        
        result[y * w + x] = Math.abs(gx);
      }
    }
    
    return result;
  }

  applySobelV(gray, w, h) {
    const result = new Uint8ClampedArray(w * h);
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gy = 
          -gray[(y-1)*w + (x-1)] - 2*gray[(y-1)*w + x] - gray[(y-1)*w + (x+1)] +
          gray[(y+1)*w + (x-1)] + 2*gray[(y+1)*w + x] + gray[(y+1)*w + (x+1)];
        
        result[y * w + x] = Math.abs(gy);
      }
    }
    
    return result;
  }

  morphOpen(binary, w, h, size) {
    // Erosión
    const eroded = new Uint8ClampedArray(w * h);
    const half = Math.floor(size / 2);
    
    for (let y = half; y < h - half; y++) {
      for (let x = half; x < w - half; x++) {
        let min = 255;
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            min = Math.min(min, binary[(y+dy)*w + (x+dx)]);
          }
        }
        eroded[y * w + x] = min;
      }
    }
    
    // Dilatación
    const result = new Uint8ClampedArray(w * h);
    for (let y = half; y < h - half; y++) {
      for (let x = half; x < w - half; x++) {
        let max = 0;
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            max = Math.max(max, eroded[(y+dy)*w + (x+dx)]);
          }
        }
        result[y * w + x] = max;
      }
    }
    
    return result;
  }
}

window.LineEnhancer = LineEnhancer;
