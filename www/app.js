// ============================================================
//  LECTOR DE TABLAS - DETECCIÓN POR ÁNGULOS DE 90°
//  DETECCIÓN MEJORADA PARA EXCEL Y WHATSAPP
// ============================================================

let currentImageFile = null;
let tableData = [];
let worker = null;
let isProcessing = false;
let tesseractReady = false;

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
        setStatus('📸 Imagen cargada. Toca "Extraer".', 'info');
    };
    reader.readAsDataURL(file);
}

// ============================================================
//  INICIALIZAR TESSERACT
// ============================================================

async function initTesseract() {
    try {
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract no está disponible.');
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
    
    // 1. Convertir a escala de grises
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        gray[idx] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    
    // 2. Calcular umbral adaptativo (Otsu simplificado)
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
    
    // 3. Binarizar imagen
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) {
        binary[i] = gray[i] < threshold ? 0 : 255;
    }
    
    return { binary, width, height, threshold };
}

// ============================================================
//  DETECCIÓN DE LÍNEAS CON ÁNGULOS DE 90°
// ============================================================

function detectLinesWithAngles(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Preprocesar
    const { binary } = preprocessImage(imageData);
    
    // Umbral para detectar líneas (más sensible)
    const lineThreshold = 20; // Porcentaje de píxeles oscuros en una línea
    const minLineLength = Math.min(width, height) * 0.25; // Mínimo 25% de la imagen
    
    // 1. DETECTAR LÍNEAS HORIZONTALES
    const horizontalLines = [];
    for (let y = 0; y < height; y++) {
        let darkCount = 0;
        let startX = -1;
        let endX = -1;
        
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (binary[idx] === 0) { // Píxel oscuro
                darkCount++;
                if (startX === -1) startX = x;
                endX = x;
            }
        }
        
        const percentage = (darkCount / width) * 100;
        if (percentage > lineThreshold && darkCount > minLineLength) {
            horizontalLines.push({
                y: y,
                x1: startX,
                x2: endX,
                length: darkCount,
                percentage: percentage
            });
        }
    }
    
    // 2. DETECTAR LÍNEAS VERTICALES
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
            verticalLines.push({
                x: x,
                y1: startY,
                y2: endY,
                length: darkCount,
                percentage: percentage
            });
        }
    }
    
    console.log(`📐 Líneas detectadas - H: ${horizontalLines.length}, V: ${verticalLines.length}`);
    
    // 3. FILTRAR LÍNEAS CERCANAS
    const filteredH = filterCloseLines(horizontalLines, 'y', 10);
    const filteredV = filterCloseLines(verticalLines, 'x', 10);
    
    console.log(`📐 Líneas filtradas - H: ${filteredH.length}, V: ${filteredV.length}`);
    
    // 4. ENCONTRAR INTERSECCIONES CON ÁNGULOS DE 90°
    const intersections = [];
    for (const h of filteredH) {
        for (const v of filteredV) {
            // Verificar intersección en ángulo recto
            const x = v.x;
            const y = h.y;
            
            // Verificar que el punto está dentro de ambas líneas
            const withinH = (x >= h.x1 && x <= h.x2);
            const withinV = (y >= v.y1 && y <= v.y2);
            
            if (withinH && withinV) {
                intersections.push({ x, y });
            }
        }
    }
    
    console.log(`📍 Intersecciones encontradas: ${intersections.length}`);
    
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
//  DETECTAR CELDAS DESDE INTERSECCIONES
// ============================================================

function detectCellsFromIntersections(intersections) {
    if (intersections.length < 4) {
        return null;
    }
    
    // 1. Agrupar por Y (filas)
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
    
    // 2. Para cada fila, ordenar por X (columnas)
    const tableCells = [];
    for (const row of rows) {
        const sortedByX = [...row].sort((a, b) => a.x - b.x);
        if (sortedByX.length > 1) {
            tableCells.push(sortedByX);
        }
    }
    
    // 3. Verificar que hay al menos 2 filas y 2 columnas
    if (tableCells.length < 2 || tableCells[0].length < 2) {
        return null;
    }
    
    // 4. Verificar que las filas tienen el mismo número de columnas
    const colCount = tableCells[0].length;
    for (const row of tableCells) {
        if (row.length !== colCount) {
            // Intentar normalizar
            if (row.length > colCount) {
                // Tomar solo las primeras colCount
                row.splice(colCount);
            } else if (row.length < colCount) {
                // Rellenar con puntos de intersección estimados
                const lastX = row[row.length - 1].x;
                const firstX = row[0].x;
                const spacing = (lastX - firstX) / (colCount - 1);
                for (let i = row.length; i < colCount; i++) {
                    row.push({ x: firstX + (i * spacing), y: row[0].y });
                }
            }
        }
    }
    
    console.log(`✅ Filas: ${tableCells.length}, Columnas: ${tableCells[0].length}`);
    return tableCells;
}

// ============================================================
//  EXTRAER CELDAS CON OCR
// ============================================================

async function extractCellsWithOCR(imageData, cells) {
    // Dibujar imagen en canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    
    const tableData = [];
    const padding = 4;
    
    // Para cada celda (excepto la última fila y columna)
    for (let row = 0; row < cells.length - 1; row++) {
        const rowData = [];
        for (let col = 0; col < cells[row].length - 1; col++) {
            // Definir área de la celda
            const x1 = Math.max(0, cells[row][col].x + padding);
            const y1 = Math.max(0, cells[row][col].y + padding);
            const x2 = Math.min(imageData.width, cells[row][col + 1].x - padding);
            const y2 = Math.min(imageData.height, cells[row + 1][col].y - padding);
            
            // Validar que la celda tiene tamaño
            if (x2 <= x1 || y2 <= y1) {
                rowData.push('');
                continue;
            }
            
            // Recortar celda
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = x2 - x1;
            cellCanvas.height = y2 - y1;
            const cellCtx = cellCanvas.getContext('2d');
            cellCtx.drawImage(canvas, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);
            
            // Mejorar imagen de la celda
            const cellImageData = cellCtx.getImageData(0, 0, cellCanvas.width, cellCanvas.height);
            enhanceCellImage(cellImageData);
            cellCtx.putImageData(cellImageData, 0, 0);
            
            // OCR en la celda
            try {
                const text = await recognizeCell(cellCanvas);
                rowData.push(text);
            } catch (e) {
                console.warn('Error en celda:', e);
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
    // Aumentar contraste
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        const enhanced = gray < 128 ? 0 : 255;
        data[i] = enhanced;
        data[i+1] = enhanced;
        data[i+2] = enhanced;
    }
}

async function recognizeCell(canvas) {
    // Si la celda es muy pequeña
    if (canvas.width < 10 || canvas.height < 10) {
        return '';
    }
    
    // Redimensionar para mejor OCR
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
        console.warn('OCR error:', e);
        return '';
    }
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

        // Obtener ImageData
        const img = new Image();
        img.src = await fileToBase64(currentImageFile);
        await img.decode();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Redimensionar si es muy grande
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

        showProgress(true, 25);
        setStatus('📐 Detectando líneas con ángulos de 90°...', 'info');

        // Detectar líneas con intersecciones de 90°
        const { horizontalLines, verticalLines, intersections } = detectLinesWithAngles(imageData);
        
        if (intersections.length < 4) {
            // No hay tabla detectable, usar OCR normal
            showProgress(true, 50);
            setStatus('📄 No se detectó tabla. Usando OCR general...', 'warning');
            
            const enhancedCanvas = document.createElement('canvas');
            enhancedCanvas.width = width;
            enhancedCanvas.height = height;
            const eCtx = enhancedCanvas.getContext('2d');
            eCtx.putImageData(imageData, 0, 0);
            
            const { data: { text } } = await worker.recognize(enhancedCanvas);
            showOcrResult(text);
            
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                tableData = [['Texto extraído'], ...lines.map(l => [l])];
                renderTable(tableData);
                setStatus('⚠️ No se detectó tabla. Texto extraído.', 'warning');
            } else {
                setStatus('⚠️ No se detectó texto.', 'error');
            }
            showProgress(true, 100);
            setTimeout(() => showProgress(false), 1000);
            return;
        }

        showProgress(true, 50);
        setStatus('📊 Identificando celdas...', 'info');

        // Detectar celdas desde intersecciones
        const cells = detectCellsFromIntersections(intersections);
        
        if (!cells || cells.length < 2) {
            setStatus('⚠️ No se pudo identificar la tabla.', 'warning');
            showProgress(true, 100);
            setTimeout(() => showProgress(false), 1000);
            return;
        }

        showProgress(true, 65);
        setStatus('🔍 Leyendo cada celda...', 'info');

        // Extraer cada celda con OCR
        const tableDataResult = await extractCellsWithOCR(imageData, cells);
        
        showProgress(true, 90);
        setStatus('📋 Reconstruyendo tabla...', 'info');

        // Mostrar tabla
        if (tableDataResult && tableDataResult.length > 0) {
            // Limpiar filas vacías
            const cleanData = tableDataResult.filter(row => row.some(cell => cell.length > 0));
            if (cleanData.length > 0) {
                tableData = cleanData;
                renderTable(tableData);
                setStatus(`✅ Tabla extraída (${tableData.length} filas, ${tableData[0]?.length || 0} columnas)`, 'success');
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                updateCellCount();
            } else {
                setStatus('⚠️ No se detectaron datos en las celdas.', 'warning');
            }
        } else {
            setStatus('⚠️ No se pudo extraer la tabla.', 'warning');
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
    }
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

// ============================================================
//  INICIO
// ============================================================

setStatus('📸 Sube una captura de pantalla', 'info');

setTimeout(async () => {
    await initTesseract();
}, 1000);

console.log('📊 Lector de Tablas - Detección por ángulos de 90°');
console.log('📐 Optimizado para Excel y WhatsApp');
