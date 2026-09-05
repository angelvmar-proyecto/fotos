// ============================================================
//  LECTOR DE TABLAS - DETECCIÓN HÍBRIDA (LÍNEAS + ESPACIOS)
//  100% OFFLINE - Canvas API + Tesseract.js
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

// ============================================================
//  FUNCIONES UI
// ============================================================

function setStatus(msg, type = 'info') {
    statusEl.textContent = msg;
    statusEl.className = `status status-${type}`;
    console.log(`[${type}] ${msg}`);
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
            throw new Error('Tesseract no está disponible. Conéctate a internet.');
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
//  DETECCIÓN DE LÍNEAS CON CANVAS API
// ============================================================

function detectLines(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        gray[idx] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    
    const threshold = 150;
    const minLineLength = Math.min(width, height) * 0.5;
    
    const horizontalLines = [];
    for (let y = 0; y < height; y++) {
        let darkCount = 0;
        let startX = -1;
        let endX = -1;
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (gray[idx] < threshold) {
                darkCount++;
                if (startX === -1) startX = x;
                endX = x;
            }
        }
        if (darkCount > minLineLength) {
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
            if (gray[idx] < threshold) {
                darkCount++;
                if (startY === -1) startY = y;
                endY = y;
            }
        }
        if (darkCount > minLineLength) {
            verticalLines.push({ x, y1: startY, y2: endY, length: darkCount });
        }
    }
    
    const filteredHorizontal = filterCloseLines(horizontalLines, 'y', 10);
    const filteredVertical = filterCloseLines(verticalLines, 'x', 10);
    
    const intersections = [];
    for (const h of filteredHorizontal) {
        for (const v of filteredVertical) {
            if (v.x >= h.x1 && v.x <= h.x2 && h.y >= v.y1 && h.y <= v.y2) {
                intersections.push({ x: v.x, y: h.y });
            }
        }
    }
    
    console.log(`✅ Horizontales: ${filteredHorizontal.length}, Verticales: ${filteredVertical.length}, Intersecciones: ${intersections.length}`);
    
    return {
        horizontalLines: filteredHorizontal,
        verticalLines: filteredVertical,
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

function detectCells(intersections) {
    if (intersections.length < 4) return [];
    
    const rows = [];
    let currentRow = [];
    const thresholdY = 15;
    const sortedByY = [...intersections].sort((a, b) => a.y - b.y);
    
    for (const point of sortedByY) {
        if (currentRow.length === 0 || Math.abs(point.y - currentRow[0].y) < thresholdY) {
            currentRow.push(point);
        } else {
            if (currentRow.length > 0) rows.push(currentRow);
            currentRow = [point];
        }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    
    const tableCells = [];
    for (const row of rows) {
        const sortedByX = [...row].sort((a, b) => a.x - b.x);
        tableCells.push(sortedByX);
    }
    
    if (tableCells.length < 2 || tableCells[0].length < 2) return [];
    
    console.log(`✅ Filas: ${tableCells.length}, Columnas: ${tableCells[0].length}`);
    return tableCells;
}

// ============================================================
//  DETECCIÓN DE TABLAS POR ESPACIOS (SIN LÍNEAS)
// ============================================================

function detectTableBySpacing(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) return null;
    
    const columnPositions = findColumnPositions(lines);
    if (columnPositions.length < 2) return null;
    
    const tableData = [];
    for (const line of lines) {
        const row = extractColumns(line, columnPositions);
        if (row.length > 0) {
            tableData.push(row);
        }
    }
    
    return tableData.length > 1 ? tableData : null;
}

function findColumnPositions(lines) {
    const positions = [];
    const minSpaces = 3;
    
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const line = lines[i];
        let spaceCount = 0;
        let lastChar = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === ' ') {
                spaceCount++;
            } else {
                if (spaceCount >= minSpaces && lastChar !== ' ') {
                    positions.push({
                        col: j - spaceCount,
                        width: spaceCount,
                        row: i
                    });
                }
                spaceCount = 0;
            }
            lastChar = char;
        }
    }
    
    const groups = [];
    const threshold = 5;
    for (const pos of positions) {
        let found = false;
        for (const group of groups) {
            if (Math.abs(group.col - pos.col) < threshold) {
                group.col = Math.round((group.col + pos.col) / 2);
                group.count++;
                found = true;
                break;
            }
        }
        if (!found) {
            groups.push({ col: pos.col, count: 1 });
        }
    }
    
    groups.sort((a, b) => a.col - b.col);
    return groups.filter(g => g.count >= 2).map(g => g.col);
}

function extractColumns(line, columnPositions) {
    const row = [];
    let start = 0;
    
    for (const col of columnPositions) {
        const end = Math.min(col, line.length);
        const cell = line.substring(start, end).trim();
        if (cell.length > 0 || row.length > 0) {
            row.push(cell);
        }
        start = end;
    }
    
    const last = line.substring(start).trim();
    if (last.length > 0) {
        row.push(last);
    }
    
    return row;
}

// ============================================================
//  PARSER DE TABLA MEJORADO (HÍBRIDO)
// ============================================================

function parseTable(text) {
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.match(/^[-\s]+$/));

    if (lines.length < 2) return null;

    // 1. Intentar detectar separadores comunes
    const sep = detectSeparator(lines);
    
    if (sep !== 'spaces') {
        const table = lines.map(line => {
            let cells;
            if (sep === 'tab') cells = line.split('\t');
            else if (sep === 'pipe') cells = line.split('|').filter(c => c.trim());
            else if (sep === 'comma') cells = line.split(',').map(c => c.trim());
            else if (sep === 'semicolon') cells = line.split(';').map(c => c.trim());
            else cells = line.split(/\s{2,}/).map(c => c.trim());
            return cells.filter(c => c.length > 0);
        });
        
        const filtered = table.filter(row => row.length > 0);
        if (filtered.length > 0) {
            const maxCols = Math.max(...filtered.map(row => row.length));
            return filtered.map(row => {
                while (row.length < maxCols) row.push('');
                return row;
            });
        }
    }
    
    // 2. Intentar detección por espacios (sin líneas)
    const spacedTable = detectTableBySpacing(text);
    if (spacedTable && spacedTable.length > 1) {
        return spacedTable;
    }
    
    // 3. Fallback: dividir por espacios múltiples
    const fallback = lines.map(line => {
        const parts = line.split(/\s{2,}/).map(c => c.trim());
        return parts.length > 1 ? parts : [line];
    });
    
    const filtered = fallback.filter(row => row.length > 0);
    if (filtered.length > 0) {
        const maxCols = Math.max(...filtered.map(row => row.length));
        return filtered.map(row => {
            while (row.length < maxCols) row.push('');
            return row;
        });
    }
    
    return null;
}

function detectSeparator(lines) {
    const counts = { tab: 0, pipe: 0, comma: 0, semicolon: 0 };
    const sample = lines.slice(0, Math.min(lines.length, 10));
    
    for (const line of sample) {
        if (line.includes('\t')) counts.tab++;
        if (line.includes('|')) counts.pipe++;
        if (line.includes(',')) counts.comma++;
        if (line.includes(';')) counts.semicolon++;
    }
    
    let max = 0;
    let best = 'spaces';
    for (const [key, val] of Object.entries(counts)) {
        if (val > max) { max = val; best = key; }
    }
    return max > 0 ? best : 'spaces';
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
    const padding = 5;
    
    for (let row = 0; row < cells.length - 1; row++) {
        const rowData = [];
        for (let col = 0; col < cells[row].length - 1; col++) {
            const x1 = cells[row][col].x + padding;
            const y1 = cells[row][col].y + padding;
            const x2 = cells[row][col + 1].x - padding;
            const y2 = cells[row + 1][col].y - padding;
            
            if (x2 <= x1 || y2 <= y1) {
                rowData.push('');
                continue;
            }
            
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = x2 - x1;
            cellCanvas.height = y2 - y1;
            const cellCtx = cellCanvas.getContext('2d');
            cellCtx.drawImage(canvas, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);
            
            try {
                const cellImageData = cellCtx.getImageData(0, 0, cellCanvas.width, cellCanvas.height);
                const text = await recognizeCell(cellImageData);
                rowData.push(text);
            } catch (e) {
                console.warn('Error en celda:', e);
                rowData.push('');
            }
        }
        if (rowData.length > 0) {
            tableData.push(rowData);
        }
    }
    
    return tableData;
}

async function recognizeCell(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    
    if (canvas.width < 10 || canvas.height < 10) return '';
    
    const imageUrl = canvas.toDataURL('image/png');
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

        const img = new Image();
        img.src = await fileToBase64(currentImageFile);
        await img.decode();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // ===== PRIMERO: DETECTAR LÍNEAS =====
        showProgress(true, 25);
        setStatus('📐 Detectando líneas...', 'info');

        const { horizontalLines, verticalLines, intersections } = detectLines(imageData);
        
        let tableDataResult = null;
        
        if (intersections.length >= 4) {
            showProgress(true, 50);
            setStatus('📊 Identificando celdas por líneas...', 'info');
            
            const cells = detectCells(intersections);
            
            if (cells.length >= 2) {
                showProgress(true, 65);
                setStatus('🔍 Leyendo cada celda...', 'info');
                tableDataResult = await extractCellsWithOCR(imageData, cells);
            }
        }
        
        // ===== SEGUNDO: SI NO HAY LÍNEAS, USAR OCR GENERAL + DETECCIÓN POR ESPACIOS =====
        if (!tableDataResult || tableDataResult.length === 0) {
            showProgress(true, 50);
            setStatus('📄 No se detectaron líneas. Usando OCR + detección por espacios...', 'warning');
            
            const { data: { text } } = await worker.recognize(imageData);
            showOcrResult(text);
            
            const parsed = parseTable(text);
            
            if (parsed && parsed.length > 1) {
                tableDataResult = parsed;
                setStatus(`✅ Tabla detectada por espacios (${tableDataResult.length} filas)`, 'success');
            } else {
                // Último recurso: mostrar texto como tabla simple
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length > 0) {
                    tableDataResult = [['Texto extraído'], ...lines.map(l => [l])];
                    setStatus('⚠️ No se detectó tabla. Mostrando texto.', 'warning');
                }
            }
        }
        
        showProgress(true, 90);
        setStatus('📋 Reconstruyendo tabla...', 'info');

        if (tableDataResult && tableDataResult.length > 0) {
            const cleanData = tableDataResult.filter(row => row.some(cell => cell.length > 0));
            if (cleanData.length > 0) {
                tableData = cleanData;
                renderTable(tableData);
                const cols = tableData[0]?.length || 0;
                setStatus(`✅ Tabla extraída (${tableData.length} filas, ${cols} columnas)`, 'success');
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                updateCellCount();
            } else {
                setStatus('⚠️ No se detectaron datos.', 'warning');
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
//  RENDERIZAR TABLA (CON EDITOR DE CELDAS)
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

console.log('📊 Lector de Tablas - Detección Híbrida (Líneas + Espacios)');
console.log('📐 100% OFFLINE - Sin servidores');
