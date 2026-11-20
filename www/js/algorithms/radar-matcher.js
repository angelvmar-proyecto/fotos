class RadarMatcher {
  constructor() { 
    this.name = 'Cell Detector'; 
    this.color = '#800080';
    this.kernelSize = 6;
    this.step = 2;
    this.threshold = 3;
    this.minCellWidth = 20;
    this.minCellHeight = 15;
    this.tolerance = 8; // Tolerancia para agrupar intersecciones
  }
  
  async detect(imageData) {
    logger.info('Iniciando Cell Detector (deteccion de celdas por filas adyacentes)...');
    const start = Date.now();
    
    const maxDim = Math.max(imageData.width, imageData.height);
    const aspect = imageData.width / imageData.height;
    let maxSize = 1200;
    if (aspect > 2.5) maxSize = 1600;
    else if (aspect > 2) maxSize = 1400;
    
    const { data: scaled, width: sw, height: sh, scale } = this.downscale(imageData, maxSize);
    logger.info('  Imagen reescalada a ' + sw + 'x' + sh + ' (factor: ' + scale.toFixed(3) + ')');
    
    const preprocessed = preprocessor.process(scaled);
    const width = preprocessed.width;
    const height = preprocessed.height;
    const data = preprocessed.data;
    
    const halfKernel = Math.floor(this.kernelSize / 2);
    const intersections = [];
    
    for (let y = halfKernel; y < height - halfKernel; y += this.step) {
      for (let x = halfKernel; x < width - halfKernel; x += this.step) {
        const hasUp = this.checkDirection(data, width, x, y, 0, -1, halfKernel);
        const hasDown = this.checkDirection(data, width, x, y, 0, 1, halfKernel);
        const hasLeft = this.checkDirection(data, width, x, y, -1, 0, halfKernel);
        const hasRight = this.checkDirection(data, width, x, y, 1, 0, halfKernel);
        
        if (hasUp && hasDown && hasLeft && hasRight) {
          intersections.push({ x, y });
        }
      }
    }
    
    logger.info('  Intersecciones detectadas: ' + intersections.length);
    
    const cells = this.detectCells(intersections, width, height);
    logger.info('  Celdas detectadas: ' + cells.length);
    
    const lines = this.cellsToLines(cells, scale);
    const time = Date.now() - start;
    
    logger.info('Cell Detector completado en ' + time + 'ms. Celdas: ' + cells.length + ', Lineas: ' + lines.length);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines: lines, 
      metrics: { 
        totalLines: lines.length, 
        executionTime: time,
        cellsDetected: cells.length,
        intersectionsDetected: intersections.length
      } 
    };
  }
  
  detectCells(intersections, width, height) {
    if (intersections.length < 4) return [];
    
    // Ordenar por Y, luego por X
    const sorted = [...intersections].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
    
    // Agrupar en filas (líneas horizontales)
    const rows = [];
    let currentRow = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].y - currentRow[0].y) < this.tolerance) {
        currentRow.push(sorted[i]);
      } else {
        rows.push(currentRow.sort((a, b) => a.x - b.x));
        currentRow = [sorted[i]];
      }
    }
    rows.push(currentRow.sort((a, b) => a.x - b.x));
    
    const cells = [];
    
    // Buscar celdas entre filas adyacentes
    for (let r = 0; r < rows.length - 1; r++) {
      const row1 = rows[r];
      const row2 = rows[r + 1];
      
      // Encontrar coordenadas X comunes (líneas verticales)
      const commonX = [];
      for (const p1 of row1) {
        for (const p2 of row2) {
          if (Math.abs(p1.x - p2.x) < this.tolerance) {
            commonX.push({ 
              x: (p1.x + p2.x) / 2, 
              y1: p1.y, 
              y2: p2.y 
            });
          }
        }
      }
      
      // Ordenar X comunes y formar celdas
      commonX.sort((a, b) => a.x - b.x);
      
      for (let c = 0; c < commonX.length - 1; c++) {
        const v1 = commonX[c];
        const v2 = commonX[c + 1];
        const cellWidth = v2.x - v1.x;
        const cellHeight = Math.abs(v2.y2 - v1.y1);
        
        if (cellWidth > this.minCellWidth && cellHeight > this.minCellHeight) {
          cells.push({
            x1: v1.x, y1: v1.y1,
            x2: v2.x, y2: v2.y2,
            width: cellWidth, height: cellHeight
          });
        }
      }
    }
    
    return cells;
  }
  
  cellsToLines(cells, scale) {
    const lines = [];
    for (const cell of cells) {
      lines.push({ x1: Math.round(cell.x1/scale), y1: Math.round(cell.y1/scale), x2: Math.round(cell.x2/scale), y2: Math.round(cell.y1/scale), angle: 0, length: cell.width/scale });
      lines.push({ x1: Math.round(cell.x1/scale), y1: Math.round(cell.y2/scale), x2: Math.round(cell.x2/scale), y2: Math.round(cell.y2/scale), angle: 0, length: cell.width/scale });
      lines.push({ x1: Math.round(cell.x1/scale), y1: Math.round(cell.y1/scale), x2: Math.round(cell.x1/scale), y2: Math.round(cell.y2/scale), angle: 90, length: cell.height/scale });
      lines.push({ x1: Math.round(cell.x2/scale), y1: Math.round(cell.y1/scale), x2: Math.round(cell.x2/scale), y2: Math.round(cell.y2/scale), angle: 90, length: cell.height/scale });
    }
    return lines;
  }
  
  downscale(imageData, maxSize) {
    const data = imageData.data, width = imageData.width, height = imageData.height;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const nw = Math.round(width * scale), nh = Math.round(height * scale);
    if (scale === 1) return { data: imageData, width, height, scale: 1 };
    
    const newData = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const srcIdx = (Math.round(y / scale) * width + Math.round(x / scale)) * 4;
        const dstIdx = (y * nw + x) * 4;
        newData[dstIdx] = data[srcIdx]; newData[dstIdx+1] = data[srcIdx+1];
        newData[dstIdx+2] = data[srcIdx+2]; newData[dstIdx+3] = data[srcIdx+3];
      }
    }
    return { data: { data: newData, width: nw, height: nh }, width: nw, height: nh, scale };
  }
  
  checkDirection(data, width, startX, startY, dx, dy, maxDistance) {
    let darkCount = 0;
    for (let i = 1; i <= maxDistance; i++) {
      const x = startX + dx * i, y = startY + dy * i;
      if (x < 0 || x >= width || y < 0 || y >= data.length / width) break;
      if (data[y * width + x] === 1) {
        darkCount++;
        if (darkCount >= this.threshold) return true;
      }
    }
    return false;
  }
}
window.RadarMatcher = RadarMatcher;
