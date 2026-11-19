class TextRemover {
  constructor() {
    this.minLineLength = 50;
  }

  removeText(imageData) {
    logger.info('Eliminando texto de la imagen...');
    const start = Date.now();

    const gray = this.toGrayscale(imageData);
    const binary = this.binarize(gray);
    const cleaned = this.removeSmallComponents(binary);
    const result = this.toImageData(cleaned, imageData.width, imageData.height);
    
    const time = Date.now() - start;
    logger.info('Texto eliminado en ' + time + 'ms');
    return result;
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

  binarize(gray) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) histogram[data[i]]++;
    
    const total = data.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    
    let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const variance = wB * wF * (mB - mF) * (mB - mF);
      if (variance > maxVar) { maxVar = variance; threshold = t; }
    }
    
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) {
      binary[i] = data[i] < threshold ? 255 : 0;
    }
    return { data: binary, width, height };
  }

  removeSmallComponents(binary) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    const labels = new Int32Array(width * height);
    let currentLabel = 1;
    const componentInfo = new Map();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (data[idx] === 255 && labels[idx] === 0) {
          const queue = [{ x, y }];
          labels[idx] = currentLabel;
          let minX = x, maxX = x, minY = y, maxY = y;
          
          while (queue.length > 0) {
            const { x: cx, y: cy } = queue.shift();
            minX = Math.min(minX, cx);
            maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy);
            maxY = Math.max(maxY, cy);
            
            const neighbors = [
              { x: cx - 1, y: cy }, { x: cx + 1, y: cy },
              { x: cx, y: cy - 1 }, { x: cx, y: cy + 1 }
            ];
            
            for (const { x: nx, y: ny } of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (data[nIdx] === 255 && labels[nIdx] === 0) {
                  labels[nIdx] = currentLabel;
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }
          
          const maxDim = Math.max(maxX - minX + 1, maxY - minY + 1);
          componentInfo.set(currentLabel, maxDim >= this.minLineLength);
          currentLabel++;
        }
      }
    }
    
    const result = new Uint8Array(width * height);
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label > 0 && componentInfo.get(label)) result[i] = 255;
    }
    
    let preserved = 0;
    componentInfo.forEach(v => { if (v) preserved++; });
    logger.info('Componentes preservados: ' + preserved + ' de ' + componentInfo.size);
    
    return { data: result, width, height };
  }

  toImageData(binary, width, height) {
    const imageData = new ImageData(width, height);
    const data = imageData.data;
    for (let i = 0, j = 0; i < binary.data.length; i++, j += 4) {
      const v = binary.data[i];
      data[j] = v; data[j+1] = v; data[j+2] = v; data[j+3] = 255;
    }
    return imageData;
  }
}
window.TextRemover = TextRemover;
