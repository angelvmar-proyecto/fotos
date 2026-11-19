class FourierAvanzado {
  constructor() {
    this.name = 'Fourier Avanzado';
    this.color = '#FF6600';
  }

  async detect(imageData) {
    logger.info('Iniciando Fourier Avanzado (Pasa-Bajas + Ancho de Valle)...');
    const start = Date.now();

    // 1. Filtro Pasa-Bajas (desenfoque suave para eliminar fantasmas de texto)
    const filteredImage = this.applyLowPassFilter(imageData);
    const gray = this.toGrayscale(filteredImage);
    
    // 2. Proyecciones
    const hProj = this.getProjection(gray, 'horizontal');
    const vProj = this.getProjection(gray, 'vertical');
    
    // 3. Detección con filtro de Ancho de Valle
    const hLines = this.detectWithValleyWidth(hProj, 'horizontal', gray.width, gray.height);
    const vLines = this.detectWithValleyWidth(vProj, 'vertical', gray.width, gray.height);
    
    const lines = [...hLines, ...vLines];
    const time = Date.now() - start;
    
    logger.info('Fourier Avanzado completado en ' + time + 'ms. Lineas: ' + lines.length);
    return {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: { totalLines: lines.length, executionTime: time }
    };
  }

  applyLowPassFilter(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const newData = new Uint8ClampedArray(data.length);
    
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const kernelSum = 16;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;
        let idx = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pIdx = ((y + ky) * width + (x + kx)) * 4;
            r += data[pIdx] * kernel[idx];
            g += data[pIdx + 1] * kernel[idx];
            b += data[pIdx + 2] * kernel[idx];
            idx++;
          }
        }
        const outIdx = (y * width + x) * 4;
        newData[outIdx] = r / kernelSum;
        newData[outIdx + 1] = g / kernelSum;
        newData[outIdx + 2] = b / kernelSum;
        newData[outIdx + 3] = data[outIdx + 3];
      }
    }
    return new ImageData(newData, width, height);
  }

  toGrayscale(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Float32Array(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    return { data: gray, width, height };
  }

  getProjection(gray, direction) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const len = direction === 'horizontal' ? height : width;
    const proj = new Float32Array(len);
    
    if (direction === 'horizontal') {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) sum += data[y * width + x];
        proj[y] = sum / width;
      }
    } else {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let y = 0; y < height; y++) sum += data[y * width + x];
        proj[x] = sum / height;
      }
    }
    return proj;
  }

  detectWithValleyWidth(proj, direction, width, height) {
    const lines = [];
    const min = Math.min(...proj);
    const max = Math.max(...proj);
    const threshold = min + (max - min) * 0.25;
    
    let inValley = false;
    let valleyStart = 0;
    let minPos = 0;
    let minVal = Infinity;
    
    for (let i = 0; i < proj.length; i++) {
      if (proj[i] < threshold) {
        if (!inValley) {
          inValley = true;
          valleyStart = i;
          minPos = i;
          minVal = proj[i];
        } else {
          if (proj[i] < minVal) {
            minVal = proj[i];
            minPos = i;
          }
        }
      } else {
        if (inValley) {
          const valleyWidth = i - valleyStart;
          if (valleyWidth >= 6) {
            if (direction === 'horizontal') {
              lines.push({ x1: 0, y1: minPos, x2: width - 1, y2: minPos, angle: 0, length: width });
            } else {
              lines.push({ x1: minPos, y1: 0, x2: minPos, y2: height - 1, angle: 90, length: height });
            }
          }
          inValley = false;
        }
      }
    }
    return lines;
  }
}
window.FourierAvanzado = FourierAvanzado;
