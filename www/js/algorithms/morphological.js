class Morphological {
  constructor() {
    this.name = 'Morphological';
    this.color = '#808080';
    this.textRemover = new TextRemover();
    this.kernelSize = 15;
  }

  async detect(imageData) {
    logger.info('Iniciando Morphological con eliminacion de texto...');
    const start = Date.now();

    const cleanedImage = this.textRemover.removeText(imageData);
    const gray = this.toGrayscale(cleanedImage);
    const binary = this.binarize(gray);
    
    const hLines = this.detectHorizontalLines(binary);
    const vLines = this.detectVerticalLines(binary);
    const lines = [...hLines, ...vLines];
    
    const time = Date.now() - start;
    logger.info('Morphological completado en ' + time + 'ms. Lineas: ' + lines.length);
    
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

  binarize(gray) {
    const data = gray.data;
    const width = gray.width;
    const height = gray.height;
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i++) binary[i] = data[i] < 128 ? 1 : 0;
    return { data: binary, width, height };
  }

  detectHorizontalLines(binary) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    const eroded = this.erodeHorizontal(data, width, height, this.kernelSize);
    const dilated = this.dilateHorizontal(eroded, width, height, this.kernelSize);
    
    const projection = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) projection[y] += dilated[y * width + x];
    }
    return this.detectLinesFromProjection(projection, 'horizontal', width, height);
  }

  detectVerticalLines(binary) {
    const data = binary.data;
    const width = binary.width;
    const height = binary.height;
    const eroded = this.erodeVertical(data, width, height, this.kernelSize);
    const dilated = this.dilateVertical(eroded, width, height, this.kernelSize);
    
    const projection = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) projection[x] += dilated[y * width + x];
    }
    return this.detectLinesFromProjection(projection, 'vertical', width, height);
  }

  erodeHorizontal(data, width, height, kernelSize) {
    const result = new Uint8Array(width * height);
    const half = Math.floor(kernelSize / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let min = 1;
        for (let k = -half; k <= half; k++) {
          const nx = x + k;
          if (nx >= 0 && nx < width) min = Math.min(min, data[y * width + nx]);
          else { min = 0; break; }
        }
        result[y * width + x] = min;
      }
    }
    return result;
  }

  dilateHorizontal(data, width, height, kernelSize) {
    const result = new Uint8Array(width * height);
    const half = Math.floor(kernelSize / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let max = 0;
        for (let k = -half; k <= half; k++) {
          const nx = x + k;
          if (nx >= 0 && nx < width) max = Math.max(max, data[y * width + nx]);
        }
        result[y * width + x] = max;
      }
    }
    return result;
  }

  erodeVertical(data, width, height, kernelSize) {
    const result = new Uint8Array(width * height);
    const half = Math.floor(kernelSize / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let min = 1;
        for (let k = -half; k <= half; k++) {
          const ny = y + k;
          if (ny >= 0 && ny < height) min = Math.min(min, data[ny * width + x]);
          else { min = 0; break; }
        }
        result[y * width + x] = min;
      }
    }
    return result;
  }

  dilateVertical(data, width, height, kernelSize) {
    const result = new Uint8Array(width * height);
    const half = Math.floor(kernelSize / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let max = 0;
        for (let k = -half; k <= half; k++) {
          const ny = y + k;
          if (ny >= 0 && ny < height) max = Math.max(max, data[ny * width + x]);
        }
        result[y * width + x] = max;
      }
    }
    return result;
  }

  detectLinesFromProjection(projection, direction, width, height) {
    const lines = [];
    const threshold = Math.max(...projection) * 0.3;
    let inLine = false, lineStart = 0;
    
    for (let i = 0; i < projection.length; i++) {
      if (projection[i] > threshold) {
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
}
window.Morphological = Morphological;
