// ============================================================
//  LECTOR DE TABLAS - 4 MÉTODOS DE DETECCIÓN
//  Líneas | Texto | Híbrido | ML (Simulado)
// ============================================================

let currentImageFile = null;
let tableData = [];
let worker = null;
let isProcessing = false;
let tesseractReady = false;
let currentMethod = 'hybrid';
let imageDataCache = null;

// ===== DOM REFERENCIAS =====
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const resultTable = document.getElementById('resultTable');
const ocrResult = document.getElementById('ocrResult');
const statusLoading = document.getElementById('statusLoading');
const addRowBtn = document.getElementById('addRowBtn');
const addColBtn = document.getElementById('addColBtn');
const clearBtn = document.getElementById('clearBtn');
const cellCount = document.getElementById('cellCount');

// Métodos
const methodLines = document.getElementById('methodLines');
const methodText = document.getElementById('methodText');
const methodHybrid = document.getElementById('methodHybrid');
const methodML = document.getElementById('methodML');
const clearMethodsBtn = document.getElementById('clearMethodsBtn');

// Estadísticas
const statLines = document.getElementById('statLines');
const statText = document.getElementById('statText');
const statHybrid = document.getElementById('statHybrid');
const statML = document.getElementById('statML');

const badges = {
    lines: document.getElementById('badgeLines'),
    text: document.getElementById('badgeText'),
    hybrid: document.getElementById('badgeHybrid'),
    ml: document.getElementById('badgeML')
};

// ===== RESULTADOS DE CADA MÉTODO =====
let results = {
    lines: null,
    text: null,
    hybrid: null,
    ml: null
};

function setStatus(msg, type = 'info') {
    statusEl.textContent = msg;
    statusEl.className = `status status-${type}`;
}

function showProgress(show, value = 0) {
    if (show) {
        progressBar.style.display = 'block';
        progressFill.style.width = Math.min(100, Math.max(0, value)) + '%';
    } else {
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
    }
}

function showOcrResult(text) {
    if (text && text.length > 0) {
        ocrResult.textContent = text;
        ocrResult.style.display = 'block';
    } else {
        ocrResult.style.display = 'none';
    }
}

// ============================================================
//  MANEJO DE IMÁGENES
// ============================================================

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        setStatus('⚠️ Sube una imagen válida', 'error');
        return;
    }

    currentImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        processBtn.disabled = false;
        // Habilitar botones de métodos
        [methodLines, methodText, methodHybrid, methodML].forEach(b => b.disabled = false);
        setStatus('📸 Imagen cargada. Elige un método y toca "Extraer".', 'info');
    };
    reader.readAsDataURL(file);
}

// ============================================================
//  INICIALIZAR TESSERACT CON CACHÉ
// ============================================================

async function initTesseract() {
    try {
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract no está disponible.');
        }

        const ocrReady = localStorage.getItem('tesseract_ready');
        if (ocrReady === 'true' && worker) {
            tesseractReady = true;
            setStatus('✅ OCR listo (desde caché).', 'success');
            return true;
        }

        statusLoading.style.display = 'block';
        statusLoading.textContent = '⏳ Cargando OCR...';
        setStatus('⏳ Cargando OCR...', 'info');
        showProgress(true, 5);

        worker = await Tesseract.createWorker('spa', 1, {
            logger: m => {
                if (m.status === 'loading tesseract core') {
                    showProgress(true, 20);
                    statusLoading.textContent = '📦 Cargando motor OCR...';
                } else if (m.status === 'loading language traineddata') {
                    showProgress(true, 50);
                    statusLoading.textContent = '📚 Cargando idioma español...';
                } else if (m.status === 'initializing api') {
                    showProgress(true, 75);
                    statusLoading.textContent = '🚀 Inicializando...';
                } else if (m.status === 'recognizing text') {
                    const pct = Math.round(75 + (m.progress * 25));
                    showProgress(true, pct);
                    statusLoading.textContent = `🔍 Reconociendo... ${pct}%`;
                }
            }
        });

        await worker.setParameters({
            tessedit_pageseg_mode: 6,
        });

        localStorage.setItem('tesseract_ready', 'true');
        
        showProgress(true, 100);
        tesseractReady = true;
        statusLoading.style.display = 'none';
        setStatus('✅ OCR listo.', 'success');
        setTimeout(() => showProgress(false), 1000);
        return true;
    } catch (error) {
        console.error('Error:', error);
        statusLoading.style.display = 'block';
        statusLoading.textContent = '❌ Error: ' + error.message;
        setStatus(`❌ Error: ${error.message}`, 'error');
        showProgress(false);
        tesseractReady = false;
        localStorage.removeItem('tesseract_ready');
        return false;
    }
}

// ============================================================
//  PREPROCESAMIENTO DE IMAGEN
// ============================================================

function preprocessImage(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        gray[idx] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) {
        hist[gray[i]]++;
    }
    
    let total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 128;
    
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const varBetween = wB * wF * (mB - mF) * (mB - mF);
        if (varBetween > varMax) {
            varMax = varBetween;
            threshold = t;
        }
    }
    
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) {
        binary[i] = gray[i] < threshold ? 0 : 255;
    }
    
    return { binary, width, height, threshold };
}

// ============================================================
//  MÉTODO 1: DETECCIÓN POR LÍNEAS
// ============================================================

function detectLines(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const { binary } = preprocessImage(imageData);
    
    const lineThreshold = 15;
    const minLineLength = Math.min(width, height) * 0.2;
    
    const horizontalLines = [];
    for (let y = 0; y < height; y++) {
        let darkCount = 0;
        let startX = -1;
        let endX = -1;
        
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0) {
                darkCount++;
                if (startX === -1) startX = x;
                endX = x;
            }
        }
        
        const percentage = (darkCount / width) * 100;
        if (percentage > lineThreshold && darkCount > minLineLength) {
            horizontalLines.push({ y, x1: startX, x2: endX, length: darkCount });
        }
    }
    
    const verticalLines = [];
    for (let x = 0; x < width; x++) {
        let darkCount = 0;
        let startY = -1;
        let endY = -1;
        
        for (let y = 0; y < height; y++) {
            const idx = y * width + x;
            if (binary[idx] === 0) {
                darkCount++;
                if (startY === -1) startY = y;
                endY = y;
            }
        }
        
        const percentage = (darkCount / height) * 100;
        if (percentage > lineThreshold && darkCount > minLineLength) {
            verticalLines.push({ x, y1: startY, y2: endY, length: darkCount });
        }
    }
    
    const filteredH = filterCloseLines(horizontalLines, 'y', 10);
    const filteredV = filterCloseLines(verticalLines, 'x', 10);
    
    const intersections = [];
    for (const h of filteredH) {
        for (const v of filteredV) {
            const x = v.x;
            const y = h.y;
            const withinH = (x >= h.x1 && x <= h.x2);
            const withinV = (y >= v.y1 && y <= v.y2);
            if (withinH && withinV) {
                intersections.push({ x, y });
            }
        }
    }
    
    return {
        horizontalLines: filteredH,
        verticalLines: filteredV,
        intersections: intersections
    };
}

function filterCloseLines(lines, axis, threshold) {
    if (lines.length === 0) return [];
    const sorted = [...lines].sort((a, b) => a[axis] - b[axis]);
    const filtered = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        if (Math.abs(sorted[i][axis] - sorted[i-1][axis]) > threshold) {
            filtered.push(sorted[i]);
        }
    }
    return filtered;
}

// ============================================================
//  MÉTODO 2: DETECCIÓN POR TEXTO
// ============================================================

function detectTextBlocks(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        binary[idx] = gray < 128 ? 0 : 255;
    }
    
    const visited = new Uint8Array(width * height);
    const blocks = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0 && !visited[idx]) {
                const block = floodFill(binary, visited, width, height, x, y);
                if (block.length > 10) {
                    blocks.push(block);
                }
            }
        }
    }
    
    const textBlocks = blocks.map(block => {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        
        for (const [px, py] of block) {
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
            sumX += px;
            sumY += py;
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: sumX / block.length,
            centerY: sumY / block.length,
            area: block.length
        };
    });
    
    return textBlocks.filter(b => b.width > 5 && b.height > 5);
}

function floodFill(binary, visited, width, height, startX, startY) {
    const queue = [[startX, startY]];
    const region = [];
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    while (queue.length > 0) {
        const [x, y] = queue.shift();
        const idx = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited[idx]) continue;
        if (binary[idx] !== 0) continue;
        
        visited[idx] = 1;
        region.push([x, y]);
        
        for (const [dx, dy] of dirs) {
            queue.push([x + dx, y + dy]);
        }
    }
    
    return region;
}

function detectTableFromText(textBlocks, width, height) {
    if (textBlocks.length < 4) return { horizontalLines: [], verticalLines: [], intersections: [] };
    
    const sortedByY = [...textBlocks].sort((a, b) => a.centerY - b.centerY);
    const rows = [];
    let currentRow = [];
    const thresholdY = 20;
    
    for (const block of sortedByY) {
        if (currentRow.length === 0 || 
            Math.abs(block.centerY - currentRow[0].centerY) < thresholdY) {
            currentRow.push(block);
        } else {
            if (currentRow.length > 1) {
                rows.push(currentRow);
            }
            currentRow = [block];
        }
    }
    if (currentRow.length > 1) rows.push(currentRow);
    
    const tableRows = rows.map(row => 
        [...row].sort((a, b) => a.centerX - b.centerX)
    );
    
    const horizontalLines = [];
    for (let i = 0; i < tableRows.length - 1; i++) {
        const row1 = tableRows[i];
        const row2 = tableRows[i + 1];
        const y = Math.round((row1[0].centerY + row2[0].centerY) / 2);
        horizontalLines.push({ y, x1: 0, x2: width });
    }
    
    const verticalLines = [];
    const numCols = Math.min(...tableRows.map(row => row.length));
    for (let col = 0; col < numCols - 1; col++) {
        let x = 0;
        let count = 0;
        for (const row of tableRows) {
            if (row.length > col + 1) {
                x += (row[col].centerX + row[col + 1].centerX) / 2;
                count++;
            }
        }
        if (count > 0) {
            x = Math.round(x / count);
            verticalLines.push({ x, y1: 0, y2: height });
        }
    }
    
    const intersections = [];
    for (const h of horizontalLines) {
        for (const v of verticalLines) {
            intersections.push({ x: v.x, y: h.y });
        }
    }
    
    return {
        horizontalLines: horizontalLines,
        verticalLines: verticalLines,
        intersections: intersections
    };
}

// ============================================================
//  MÉTODO 3: HÍBRIDO (LÍNEAS + TEXTO)
// ============================================================

function detectTableHybrid(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    
    const lineResult = detectLines(imageData);
    const textBlocks = detectTextBlocks(imageData);
    
    if (lineResult.intersections.length > 10) {
        return lineResult;
    }
    
    if (textBlocks.length > 5) {
        return detectTableFromText(textBlocks, width, height);
    }
    
    return detectTableHybridCombine(lineResult, textBlocks, width, height);
}

function detectTableHybridCombine(lineResult, textBlocks, width, height) {
    if (lineResult.intersections.length < 4) {
        return detectTableFromText(textBlocks, width, height);
    }
    
    const textResult = detectTableFromText(textBlocks, width, height);
    
    for (const h of textResult.horizontalLines) {
        let exists = false;
        for (const existing of lineResult.horizontalLines) {
            if (Math.abs(existing.y - h.y) < 10) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            lineResult.horizontalLines.push(h);
        }
    }
    
    for (const v of textResult.verticalLines) {
        let exists = false;
        for (const existing of lineResult.verticalLines) {
            if (Math.abs(existing.x - v.x) < 10) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            lineResult.verticalLines.push(v);
        }
    }
    
    lineResult.horizontalLines.sort((a, b) => a.y - b.y);
    lineResult.verticalLines.sort((a, b) => a.x - b.x);
    
    const newIntersections = [];
    for (const h of lineResult.horizontalLines) {
        for (const v of lineResult.verticalLines) {
            newIntersections.push({ x: v.x, y: h.y });
        }
    }
    lineResult.intersections = newIntersections;
    
    return lineResult;
}

// ============================================================
//  MÉTODO 4: ML (SIMULADO CON PARÁMETROS AJUSTABLES)
// ============================================================

function detectTableML(imageData) {
    // Este método simula un modelo de ML con parámetros ajustables
    // En una implementación real, aquí cargarías un modelo ONNX o TensorFlow Lite
    
    const width = imageData.width;
    const height = imageData.height;
    const { binary } = preprocessImage(imageData);
    
    // Parámetros "aprendidos" (simulan un modelo entrenado)
    const mlParams = {
        lineThreshold: 12,        // Más sensible que el método líneas
        minLineLength: 0.15,      // Detecta líneas más cortas
        filterThreshold: 8,       // Más preciso
        confidenceThreshold: 0.7, // Filtra líneas con baja confianza
        adaptiveThreshold: true   // Usa umbral adaptativo
    };
    
    // Simular "aprendizaje" de la imagen
    const avgDarkness = calculateAverageDarkness(binary, width, height);
    const adjustedThreshold = mlParams.adaptiveThreshold ? 
        Math.max(8, mlParams.lineThreshold - (avgDarkness * 0.3)) : 
        mlParams.lineThreshold;
    
    const minLineLength = Math.min(width, height) * mlParams.minLineLength;
    
    // Detectar líneas con parámetros ajustados
    const horizontalLines = [];
    for (let y = 0; y < height; y++) {
        let darkCount = 0;
        let startX = -1;
        let endX = -1;
        
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0) {
                darkCount++;
                if (startX === -1) startX = x;
                endX = x;
            }
        }
        
        const percentage = (darkCount / width) * 100;
        // Confianza basada en densidad de píxeles
        const confidence = Math.min(1, percentage / 30);
        if (percentage > adjustedThreshold && darkCount > minLineLength && confidence > mlParams.confidenceThreshold) {
            horizontalLines.push({ y, x1: startX, x2: endX, length: darkCount, confidence });
        }
    }
    
    const verticalLines = [];
    for (let x = 0; x < width; x++) {
        let darkCount = 0;
        let startY = -1;
        let endY = -1;
        
        for (let y = 0; y < height; y++) {
            const idx = y * width + x;
            if (binary[idx] === 0) {
                darkCount++;
                if (startY === -1) startY = y;
                endY = y;
            }
        }
        
        const percentage = (darkCount / height) * 100;
        const confidence = Math.min(1, percentage / 30);
        if (percentage > adjustedThreshold && darkCount > minLineLength && confidence > mlParams.confidenceThreshold) {
            verticalLines.push({ x, y1: startY, y2: endY, length: darkCount, confidence });
        }
    }
    
    // Filtrar con umbral más preciso
    const filteredH = filterCloseLines(horizontalLines, 'y', mlParams.filterThreshold);
    const filteredV = filterCloseLines(verticalLines, 'x', mlParams.filterThreshold);
    
    // Generar intersecciones con ponderación de confianza
    const intersections = [];
    for (const h of filteredH) {
        for (const v of filteredV) {
            const x = v.x;
            const y = h.y;
            const withinH = (x >= h.x1 && x <= h.x2);
            const withinV = (y >= v.y1 && y <= v.y2);
            if (withinH && withinV) {
                // Ponderación por confianza combinada
                const combinedConfidence = (h.confidence + v.confidence) / 2;
                intersections.push({ x, y, confidence: combinedConfidence });
            }
        }
    }
    
    // Ordenar por confianza y mantener las mejores
    intersections.sort((a, b) => b.confidence - a.confidence);
    const topIntersections = intersections.slice(0, Math.min(intersections.length, 200));
    
    console.log(`🧠 ML detectado: ${filteredH.length}H, ${filteredV.length}V, ${topIntersections.length} intersecciones`);
    console.log(`🧠 Confianza promedio: ${(topIntersections.reduce((s, i) => s + i.confidence, 0) / topIntersections.length * 100).toFixed(1)}%`);
    
    return {
        horizontalLines: filteredH,
        verticalLines: filteredV,
        intersections: topIntersections
    };
}

function calculateAverageDarkness(binary, width, height) {
    let darkCount = 0;
    for (let i = 0; i < binary.length; i++) {
        if (binary[i] === 0) darkCount++;
    }
    return darkCount / (width * height);
}

// ============================================================
//  DETECTAR CELDAS DESDE INTERSECCIONES
// ============================================================

function detectCellsFromIntersections(intersections) {
    if (intersections.length < 4) {
        return null;
    }
    
    const rows = [];
    let currentRow = [];
    const thresholdY = 15;
    
    const sortedByY = [...intersections].sort((a, b) => a.y - b.y);
    
    for (const point of sortedByY) {
        if (currentRow.length === 0 || 
            Math.abs(point.y - currentRow[0].y) < thresholdY) {
            currentRow.push(point);
        } else {
            if (currentRow.length > 1) {
                rows.push(currentRow);
            }
            currentRow = [point];
        }
    }
    if (currentRow.length > 1) rows.push(currentRow);
    
    const tableCells = [];
    for (const row of rows) {
        const sortedByX = [...row].sort((a, b) => a.x - b.x);
        if (sortedByX.length > 1) {
            tableCells.push(sortedByX);
        }
    }
    
    if (tableCells.length < 2 || tableCells[0].length < 2) {
        return null;
    }
    
    const colCount = tableCells[0].length;
    for (const row of tableCells) {
        if (row.length !== colCount) {
            if (row.length > colCount) {
                row.splice(colCount);
            } else if (row.length < colCount) {
                const lastX = row[row.length - 1].x;
                const firstX = row[0].x;
                const spacing = (lastX - firstX) / (colCount - 1);
                for (let i = row.length; i < colCount; i++) {
                    row.push({ x: firstX + (i * spacing), y: row[0].y });
                }
            }
        }
    }
    
    return tableCells;
}

// ============================================================
//  EXTRAER CELDAS CON OCR
// ============================================================

async function extractCellsWithOCR(imageData, cells) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    
    const tableData = [];
    const padding = 4;
    
    for (let row = 0; row < cells.length - 1; row++) {
        const rowData = [];
        for (let col = 0; col < cells[row].length - 1; col++) {
            const x1 = Math.max(0, cells[row][col].x + padding);
            const y1 = Math.max(0, cells[row][col].y + padding);
            const x2 = Math.min(imageData.width, cells[row][col + 1].x - padding);
            const y2 = Math.min(imageData.height, cells[row + 1][col].y - padding);
            
            if (x2 <= x1 || y2 <= y1) {
                rowData.push('');
                continue;
            }
            
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = x2 - x1;
            cellCanvas.height = y2 - y1;
            const cellCtx = cellCanvas.getContext('2d');
            cellCtx.drawImage(canvas, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);
            
            const cellImageData = cellCtx.getImageData(0, 0, cellCanvas.width, cellCanvas.height);
            enhanceCellImage(cellImageData);
            cellCtx.putImageData(cellImageData, 0, 0);
            
            try {
                const text = await recognizeCell(cellCanvas);
                rowData.push(text);
            } catch (e) {
                rowData.push('');
            }
        }
        if (rowData.length > 0 && rowData.some(cell => cell.length > 0)) {
            tableData.push(rowData);
        }
    }
    
    return tableData;
}

function enhanceCellImage(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        const enhanced = gray < 128 ? 0 : 255;
        data[i] = enhanced;
        data[i+1] = enhanced;
        data[i+2] = enhanced;
    }
}

async function recognizeCell(canvas) {
    if (canvas.width < 10 || canvas.height < 10) {
        return '';
    }
    
    const targetSize = 100;
    let resizeCanvas = canvas;
    if (canvas.width < targetSize || canvas.height < targetSize) {
        resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = Math.max(targetSize, canvas.width * 2);
        resizeCanvas.height = Math.max(targetSize, canvas.height * 2);
        const ctx = resizeCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(canvas, 0, 0, resizeCanvas.width, resizeCanvas.height);
    }
    
    const imageUrl = resizeCanvas.toDataURL('image/png');
    
    try {
        const { data: { text } } = await worker.recognize(imageUrl);
        return text.trim();
    } catch (e) {
        return '';
    }
}

// ============================================================
//  PROCESAR CON UN MÉTODO ESPECÍFICO
// ============================================================

async function processWithMethod(method, imageData) {
    let result;
    let methodName = '';
    
    switch(method) {
        case 'lines':
            methodName = 'Líneas';
            result = detectLines(imageData);
            break;
        case 'text':
            methodName = 'Texto';
            result = detectTableFromText(detectTextBlocks(imageData), imageData.width, imageData.height);
            break;
        case 'hybrid':
            methodName = 'Híbrido';
            result = detectTableHybrid(imageData);
            break;
        case 'ml':
            methodName = 'ML';
            result = detectTableML(imageData);
            break;
        default:
            result = detectTableHybrid(imageData);
    }
    
    console.log(`📊 Método ${methodName}: ${result.intersections.length} intersecciones`);
    
    return result;
}

// ============================================================
//  PROCESAR IMAGEN COMPLETO
// ============================================================

async function processImage() {
    if (!currentImageFile) {
        setStatus('⚠️ Primero sube una imagen', 'error');
        return;
    }

    if (!tesseractReady) {
        setStatus('⏳ Cargando OCR...', 'warning');
        const ready = await initTesseract();
        if (!ready) return;
    }

    if (isProcessing) return;
    isProcessing = true;
    processBtn.disabled = true;

    try {
        showProgress(true, 5);
        setStatus('🔍 Procesando imagen...', 'info');

        const img = new Image();
        img.src = await fileToBase64(currentImageFile);
        await img.decode();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        const maxSize = 2000;
        
        if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        imageDataCache = imageData;

        // Procesar con todos los métodos
        showProgress(true, 30);
        setStatus('🧪 Probando 4 métodos de detección...', 'info');

        const methods = ['lines', 'text', 'hybrid', 'ml'];
        const methodNames = ['Líneas', 'Texto', 'Híbrido', 'ML'];
        const resultsMap = {};

        for (let i = 0; i < methods.length; i++) {
            const m = methods[i];
            const name = methodNames[i];
            setStatus(`🧪 Probando método ${name}...`, 'info');
            
            try {
                const result = await processWithMethod(m, imageData);
                resultsMap[m] = result;
                
                // Actualizar badges
                const count = result.intersections.length;
                const badge = badges[m];
                if (badge) {
                    badge.textContent = count > 0 ? count : '✗';
                    badge.style.background = count > 4 ? '#2ECC71' : '#ff6b6b';
                }
                
                // Actualizar estadísticas
                const statMap = { lines: statLines, text: statText, hybrid: statHybrid, ml: statML };
                if (statMap[m]) {
                    statMap[m].textContent = count > 0 ? count : '✗';
                    statMap[m].parentElement.style.borderColor = count > 4 ? '#2ECC71' : '#ff6b6b';
                }
                
                // Guardar resultado
                results[m] = result;
                
            } catch (e) {
                console.error(`Error en método ${name}:`, e);
                const badge = badges[m];
                if (badge) {
                    badge.textContent = '!';
                    badge.style.background = '#ff6b6b';
                }
            }
            
            showProgress(true, 30 + (i * 15));
        }

        // Seleccionar el mejor método (el que tenga más intersecciones)
        let bestMethod = 'hybrid';
        let bestCount = 0;
        for (const m of methods) {
            if (resultsMap[m] && resultsMap[m].intersections.length > bestCount) {
                bestCount = resultsMap[m].intersections.length;
                bestMethod = m;
            }
        }

        showProgress(true, 90);
        setStatus(`✅ Mejor método: ${bestMethod.toUpperCase()} (${bestCount} intersecciones)`, 'success');

        // Usar el mejor método
        const bestResult = resultsMap[bestMethod];
        
        if (bestResult.intersections.length < 4) {
            setStatus('⚠️ No se detectó tabla en ningún método. Usando OCR general...', 'warning');
            const { data: { text } } = await worker.recognize(imageData);
            showOcrResult(text);
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                tableData = [['Texto extraído'], ...lines.map(l => [l])];
                renderTable(tableData);
            }
            showProgress(true, 100);
            setTimeout(() => showProgress(false), 1000);
            return;
        }

        const cells = detectCellsFromIntersections(bestResult.intersections);
        
        if (!cells || cells.length < 2) {
            setStatus('⚠️ No se pudo identificar la tabla.', 'warning');
            showProgress(true, 100);
            setTimeout(() => showProgress(false), 1000);
            return;
        }

        setStatus('🔍 Leyendo cada celda...', 'info');
        const tableDataResult = await extractCellsWithOCR(imageData, cells);
        
        if (tableDataResult && tableDataResult.length > 0) {
            const cleanData = tableDataResult.filter(row => row.some(cell => cell.length > 0));
            if (cleanData.length > 0) {
                tableData = cleanData;
                renderTable(tableData);
                setStatus(`✅ Tabla extraída (${tableData.length} filas, ${tableData[0]?.length || 0} columnas) [${bestMethod.toUpperCase()}]`, 'success');
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                updateCellCount();
            }
        }

        showProgress(true, 100);
    } catch (error) {
        console.error('Error:', error);
        setStatus(`❌ Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        setTimeout(() => showProgress(false), 1500);
    }
}

// ============================================================
//  PROCESAR CON MÉTODO ESPECÍFICO (BOTONES)
// ============================================================

async function processWithSpecificMethod(method) {
    if (!currentImageFile || !imageDataCache) {
        setStatus('⚠️ Primero sube una imagen y extrae con "Extraer"', 'error');
        return;
    }

    if (!tesseractReady) {
        setStatus('⏳ Cargando OCR...', 'warning');
        const ready = await initTesseract();
        if (!ready) return;
    }

    if (isProcessing) return;
    isProcessing = true;

    // Activar botón visualmente
    const btnMap = { lines: methodLines, text: methodText, hybrid: methodHybrid, ml: methodML };
    Object.keys(btnMap).forEach(key => btnMap[key].classList.remove('active'));
    if (btnMap[method]) btnMap[method].classList.add('active');

    try {
        setStatus(`🔍 Probando método ${method.toUpperCase()}...`, 'info');
        showProgress(true, 30);

        const result = await processWithMethod(method, imageDataCache);
        results[method] = result;

        const count = result.intersections.length;
        const badge = badges[method];
        if (badge) {
            badge.textContent = count > 0 ? count : '✗';
            badge.style.background = count > 4 ? '#2ECC71' : '#ff6b6b';
        }

        if (count < 4) {
            setStatus(`⚠️ Método ${method.toUpperCase()}: No se detectó tabla (${count} intersecciones)`, 'warning');
            showProgress(true, 100);
            setTimeout(() => showProgress(false), 1000);
            isProcessing = false;
            return;
        }

        const cells = detectCellsFromIntersections(result.intersections);
        if (!cells || cells.length < 2) {
            setStatus(`⚠️ Método ${method.toUpperCase()}: No se pudo identificar la tabla.`, 'warning');
            showProgress(true, 100);
            setTimeout(() => showProgress(false), 1000);
            isProcessing = false;
            return;
        }

        setStatus(`🔍 Leyendo celdas con método ${method.toUpperCase()}...`, 'info');
        showProgress(true, 60);

        const tableDataResult = await extractCellsWithOCR(imageDataCache, cells);

        if (tableDataResult && tableDataResult.length > 0) {
            const cleanData = tableDataResult.filter(row => row.some(cell => cell.length > 0));
            if (cleanData.length > 0) {
                tableData = cleanData;
                renderTable(tableData);
                setStatus(`✅ Tabla extraída (${tableData.length} filas, ${tableData[0]?.length || 0} columnas) [${method.toUpperCase()}]`, 'success');
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                updateCellCount();
            }
        }

        showProgress(true, 100);
    } catch (error) {
        console.error('Error:', error);
        setStatus(`❌ Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        setTimeout(() => showProgress(false), 1500);
    }
}

// ============================================================
//  RENDERIZAR TABLA
// ============================================================

function renderTable(data) {
    if (!data || data.length === 0) data = [['Sin datos']];

    const maxCols = Math.max(...data.map(row => row.length));
    data = data.map(row => {
        while (row.length < maxCols) row.push('');
        return row;
    });

    tableData = data;

    let html = '<thead><tr>';
    for (let j = 0; j < data[0].length; j++) {
        html += `<th>${escapeHtml(data[0][j] || `Col ${j+1}`)}</th>`;
    }
    html += '</tr></thead>';

    html += '<tbody>';
    for (let i = 1; i < data.length; i++) {
        html += '<tr>';
        for (let j = 0; j < data[i].length; j++) {
            html += `<td data-row="${i}" data-col="${j}">${escapeHtml(data[i][j] || '')}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';

    resultTable.innerHTML = html;
    updateCellCount();
    enableEditing();
}

function enableEditing() {
    const cells = resultTable.querySelectorAll('td');
    cells.forEach(cell => {
        cell.addEventListener('dblclick', () => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            if (isNaN(row) || isNaN(col)) return;

            const original = cell.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = original;
            input.style.width = '100%';
            input.style.border = '2px solid #25D366';
            input.style.borderRadius = '4px';
            input.style.padding = '4px';

            cell.textContent = '';
            cell.appendChild(input);
            input.focus();
            input.select();

            const save = () => {
                const val = input.value;
                cell.textContent = val || ' ';
                if (tableData[row] && tableData[row][col] !== undefined) {
                    tableData[row][col] = val;
                }
                updateCellCount();
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { cell.textContent = original; input.remove(); }
            });
        });
    });
}

// ============================================================
//  ACCIONES DE TABLA
// ============================================================

function addRow() {
    if (!tableData || tableData.length === 0) tableData = [['Nueva fila']];
    const cols = tableData[0]?.length || 1;
    tableData.push(new Array(cols).fill(''));
    renderTable(tableData);
}

function addColumn() {
    if (!tableData || tableData.length === 0) tableData = [['Nueva columna']];
    tableData.forEach(row => row.push(''));
    renderTable(tableData);
}

function clearTable() {
    if (confirm('¿Eliminar todos los datos?')) {
        tableData = [['Tabla vacía']];
        renderTable(tableData);
        downloadBtn.disabled = true;
        copyBtn.disabled = true;
        // Limpiar estadísticas
        ['lines', 'text', 'hybrid', 'ml'].forEach(m => {
            badges[m].textContent = '-';
            badges[m].style.background = '#95A5A6';
        });
        Object.values(results).forEach(r => r = null);
    }
}

function clearMethodsStats() {
    ['lines', 'text', 'hybrid', 'ml'].forEach(m => {
        badges[m].textContent = '-';
        badges[m].style.background = '#95A5A6';
        const statMap = { lines: statLines, text: statText, hybrid: statHybrid, ml: statML };
        if (statMap[m]) {
            statMap[m].textContent = '-';
            statMap[m].parentElement.style.borderColor = '#25D366';
        }
        results[m] = null;
    });
    Object.keys(btnMap).forEach(key => btnMap[key].classList.remove('active'));
    setStatus('🗑️ Estadísticas limpiadas', 'info');
}

// ============================================================
//  EXPORTAR
// ============================================================

function exportCSV() {
    if (!tableData || tableData.length === 0) {
        alert('No hay datos');
        return;
    }

    const csv = tableData
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tabla_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    setStatus('📥 CSV descargado', 'success');
}

function copyTable() {
    if (!tableData || tableData.length === 0) {
        alert('No hay datos');
        return;
    }

    const text = tableData.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text)
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    setStatus('📋 Tabla copiada', 'success');
}

// ============================================================
//  LIMPIAR CACHÉ DE OCR
// ============================================================

function clearOCRCache() {
    localStorage.removeItem('tesseract_ready');
    setStatus('🗑️ Caché de OCR limpiado. Reinicia la app.', 'info');
    tesseractReady = false;
    worker = null;
}

// ============================================================
//  UTILIDADES
// ============================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateCellCount() {
    const count = tableData.reduce((sum, row) => sum + row.length, 0);
    cellCount.textContent = `${count} celdas`;
}

// ============================================================
//  EVENTOS
// ============================================================

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

processBtn.addEventListener('click', processImage);
downloadBtn.addEventListener('click', exportCSV);
copyBtn.addEventListener('click', copyTable);
addRowBtn.addEventListener('click', addRow);
addColBtn.addEventListener('click', addColumn);
clearBtn.addEventListener('click', clearTable);
clearMethodsBtn.addEventListener('click', clearMethodsStats);

// Botones de métodos
const btnMap = {
    lines: methodLines,
    text: methodText,
    hybrid: methodHybrid,
    ml: methodML
};

Object.keys(btnMap).forEach(method => {
    btnMap[method].addEventListener('click', () => {
        processWithSpecificMethod(method);
    });
});

document.querySelector('h1').addEventListener('dblclick', () => {
    if (confirm('¿Limpiar caché de OCR? (Esto forzará recargar el idioma español)')) {
        clearOCRCache();
        alert('Caché limpiado. Reinicia la app para recargar el OCR.');
    }
});

// ============================================================
//  INICIO
// ============================================================

setStatus('📸 Sube una captura de pantalla', 'info');

setTimeout(async () => {
    await initTesseract();
}, 1000);

console.log('📊 Lector de Tablas - 4 Métodos de Detección');
console.log('📐 Líneas | Texto | Híbrido | ML (Simulado)');
console.log('💾 Caché de OCR activado');
console.log('🔄 Doble toque en el título para limpiar caché');
