class RadarMatcher {
  constructor() { 
    this.name = 'Cell Detector'; 
    this.color = '#800080';
    this.kernelSize = 6;
    this.step = 2;
    this.threshold = 3;
    this.minCellWidth = 30;
    this.minCellHeight = 20;
  }
  
  async detect(imageData) {
    logger.info('Iniciando Cell Detector (deteccion de celdas)...');
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
    
    const grouped = this.groupIntersections(intersections, this.kernelSize);
    logger.info('  Intersecciones agrupadas: ' + grouped.length);
    
    // Detectar celdas (rectángulos formados por 4 intersecciones)
    const cells = this.detectCells(grouped, width, height);
    logger.info('  Celdas detectadas: ' + cells.length);
    
    // Convertir celdas a líneas (bordes de las celdas)
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
        intersectionsDetected: intersections.length,
        intersectionsGrouped: grouped.length
      } 
    };
  }
  
  detectCells(intersections, width, height) {
    const cells = [];
    const used = new Set();
    
    // Ordenar intersecciones por Y luego X
    const sorted = [...intersections].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
    
    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;
      
      const topLeft = sorted[i];
      
      // Buscar esquina superior derecha (misma Y, X mayor)
      let topRight = -1;
      for (let j = i + 1; j < sorted.length; j++) {
        if (Math.abs(sorted[j].y - topLeft.y) < 5 && sorted[j].x > topLeft.x + this.minCellWidth) {
          topRight = j;
          break;
        }
      }
      
      if (topRight === -1) continue;
      
      // Buscar esquina inferior izquierda (misma X, Y mayor)
      let bottomLeft = -1;
      for (let j = i + 1; j < sorted.length; j++) {
        if (Math.abs(sorted[j].x - topLeft.x) < 5 && sorted[j].y > topLeft.y + this.minCellHeight) {
          bottomLeft = j;
          break;
        }
      }
      
      if (bottomLeft === -1) continue;
      
      // Buscar esquina inferior derecha
      const bottomRightX = sorted[topRight].x;
      const bottomRightY = sorted[bottomLeft].y;
      
      let bottomRight = -1;
      for (let j = 0; j < sorted.length; j++) {
        if (Math.abs(sorted[j].x - bottomRightX) < 5 && Math.abs(sorted[j].y - bottomRightY) < 5) {
          bottomRight = j;
          break;
        }
      }
      
      if (bottomRight === -1) continue;
      
      // Celda válida
      cells.push({
        x1: topLeft.x,
        y1: topLeft.y,
        x2: sorted[topRight].x,
        y2: sorted[bottomLeft].y,
        width: sorted[topRight].x - topLeft.x,
        height: sorted[bottomLeft].y - topLeft.y
      });
      
      used.add(i);
      used.add(topRight);
      used.add(bottomLeft);
      used.add(bottomRight);
    }
    
    return cells;
  }
  
  cellsToLines(cells, scale) {
    const lines = [];
    
    for (const cell of cells) {
      // Borde superior
      lines.push({
        x1: Math.round(cell.x1 / scale),
        y1: Math.round(cell.y1 / scale),
        x2: Math.round(cell.x2 / scale),
        y2: Math.round(cell.y1 / scale),
        angle: 0,
        length: cell.width / scale
      });
      
      // Borde inferior
      lines.push({
        x1: Math.round(cell.x1 / scale),
        y1: Math.round(cell.y2 / scale),
        x2: Math.round(cell.x2 / scale),
        y2: Math.round(cell.y2 / scale),
        angle: 0,
        length: cell.width / scale
      });
      
      // Borde izquierdo
      lines.push({
        x1: Math.round(cell.x1 / scale),
        y1: Math.round(cell.y1 / scale),
        x2: Math.round(cell.x1 / scale),
        y2: Math.round(cell.y2 / scale),
        angle: 90,
        length: cell.height / scale
      });
      
      // Borde derecho
      lines.push({
        x1: Math.round(cell.x2 / scale),
        y1: Math.round(cell.y1 / scale),
        x2: Math.round(cell.x2 / scale),
        y2: Math.round(cell.y2 / scale),
        angle: 90,
        length: cell.height / scale
      });
    }
    
    return lines;
  }
  
  downscale(imageData, maxSize) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const nw = Math.round(width * scale);
    const nh = Math.round(height * scale);
    
    if (scale === 1) return { data: imageData, width, height, scale: 1 };
    
    const newData = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const sx = Math.round(x / scale);
        const sy = Math.round(y / scale);
        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = (y * nw + x) * 4;
        newData[dstIdx] = data[srcIdx];
        newData[dstIdx + 1] = data[srcIdx + 1];
        newData[dstIdx + 2] = data[srcIdx + 2];
        newData[dstIdx + 3] = data[srcIdx + 3];
      }
    }
    
    return { data: { data: newData, width: nw, height: nh }, width: nw, height: nh, scale };
  }
  
  checkDirection(data, width, startX, startY, dx, dy, maxDistance) {
    let darkCount = 0;
    
    for (let i = 1; i <= maxDistance; i++) {
      const x = startX + dx * i;
      const y = startY + dy * i;
      
      if (x < 0 || x >= width || y < 0 || y >= data.length / width) break;
      
      const idx = y * width + x;
      if (data[idx] === 1) {
        darkCount++;
        if (darkCount >= this.threshold) return true;
      }
    }
    
    return false;
  }
  
  groupIntersections(intersections, minDistance) {
    if (intersections.length === 0) return [];
    
    const cellSize = minDistance;
    const grid = new Map();
    
    for (const p of intersections) {
      const cellX = Math.floor(p.x / cellSize);
      const cellY = Math.floor(p.y / cellSize);
      const key = cellX + ',' + cellY;
      
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }
    
    const grouped = [];
    const used = new Set();
    
    for (const [key, points] of grid.entries()) {
      for (const p of points) {
        if (used.has(p)) continue;
        
        const cluster = [p];
        used.add(p);
        
        const [cx, cy] = key.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const neighborKey = (cx + dx) + ',' + (cy + dy);
            const neighborPoints = grid.get(neighborKey);
            if (!neighborPoints) continue;
            
            for (const q of neighborPoints) {
              if (used.has(q)) continue;
              const dist = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
              if (dist < minDistance) {
                cluster.push(q);
                used.add(q);
              }
            }
          }
        }
        
        const centerX = Math.round(cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length);
        const centerY = Math.round(cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length);
        
        grouped.push({ x: centerX, y: centerY });
      }
    }
    
    return grouped;
  }
}
window.RadarMatcher = RadarMatcher;
