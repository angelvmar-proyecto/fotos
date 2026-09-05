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
    statusEl.className = 'status status-' + type;
    console.log('[' + type + '] ' + msg);
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
    reader.onload = function(e) {
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
            logger: function(m) {
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
                    var pct = Math.round(75 + (m.progress * 25));
                    showProgress(true, pct);
                    statusLoading.textContent = '🔍 Reconociendo... ' + pct + '%';
                }
            }
        });

        await worker.setParameters({
            tessedit_pageseg_mode: 6
        });

        showProgress(true, 100);
        tesseractReady = true;
        statusLoading.style.display = 'none';
        setStatus('✅ OCR listo.', 'success');
        setTimeout(function() { showProgress(false); }, 1000);
        return true;
    } catch (error) {
        console.error('Error:', error);
        statusLoading.style.display = 'block';
        statusLoading.textContent = '❌ Error: ' + error.message;
        setStatus('❌ Error: ' + error.message, 'error');
        showProgress(false);
        tesseractReady = false;
        return false;
    }
}

// ============================================================
//  DETECCIÓN DE LÍNEAS CON CANVAS API
// ============================================================

function detectLines(imageData) {
    var width = imageData.width;
    var height = imageData.height;
    var data = imageData.data;
    
    var gray = new Uint8Array(width * height);
    for (var i = 0; i < data.length; i += 4) {
        var idx = i / 4;
        gray[idx] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    
    var threshold = 150;
    var minLineLength = Math.min(width, height) * 0.5;
    
    var horizontalLines = [];
    for (var y = 0; y < height; y++) {
        var darkCount = 0;
        var startX = -1;
        var endX = -1;
        for (var x = 0; x < width; x++) {
            var idx = y * width + x;
            if (gray[idx] < threshold) {
                darkCount++;
                if (startX === -1) startX = x;
                endX = x;
            }
        }
        if (darkCount > minLineLength) {
            horizontalLines.push({ y: y, x1: startX, x2: endX, length: darkCount });
        }
    }
    
    var verticalLines = [];
    for (var x = 0; x < width; x++) {
        var darkCount = 0;
        var startY = -1;
        var endY = -1;
        for (var y = 0; y < height; y++) {
            var idx = y * width + x;
            if (gray[idx] < threshold) {
                darkCount++;
                if (startY === -1) startY = y;
                endY = y;
            }
        }
        if (darkCount > minLineLength) {
            verticalLines.push({ x: x, y1: startY, y2: endY, length: darkCount });
        }
    }
    
    var filteredHorizontal = filterCloseLines(horizontalLines, 'y', 10);
    var filteredVertical = filterCloseLines(verticalLines, 'x', 10);
    
    var intersections = [];
    for (var h = 0; h < filteredHorizontal.length; h++) {
        for (var v = 0; v < filteredVertical.length; v++) {
            var hLine = filteredHorizontal[h];
            var vLine = filteredVertical[v];
            if (vLine.x >= hLine.x1 && vLine.x <= hLine.x2 && hLine.y >= vLine.y1 && hLine.y <= vLine.y2) {
                intersections.push({ x: vLine.x, y: hLine.y });
            }
        }
    }
    
    console.log('✅ Horizontales: ' + filteredHorizontal.length + ', Verticales: ' + filteredVertical.length + ', Intersecciones: ' + intersections.length);
    
    return {
        horizontalLines: filteredHorizontal,
        verticalLines: filteredVertical,
        intersections: intersections
    };
}

function filterCloseLines(lines, axis, threshold) {
    if (lines.length === 0) return [];
    var sorted = lines.slice().sort(function(a, b) { return a[axis] - b[axis]; });
    var filtered = [sorted[0]];
    for (var i = 1; i < sorted.length; i++) {
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
    
    var rows = [];
    var currentRow = [];
    var thresholdY = 15;
    var sortedByY = intersections.slice().sort(function(a, b) { return a.y - b.y; });
    
    for (var i = 0; i < sortedByY.length; i++) {
        var point = sortedByY[i];
        if (currentRow.length === 0 || Math.abs(point.y - currentRow[0].y) < thresholdY) {
            currentRow.push(point);
        } else {
            if (currentRow.length > 0) rows.push(currentRow);
            currentRow = [point];
        }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    
    var tableCells = [];
    for (var r = 0; r < rows.length; r++) {
        var sortedByX = rows[r].slice().sort(function(a, b) { return a.x - b.x; });
        tableCells.push(sortedByX);
    }
    
    if (tableCells.length < 2 || tableCells[0].length < 2) return [];
    
    console.log('✅ Filas: ' + tableCells.length + ', Columnas: ' + tableCells[0].length);
    return tableCells;
}

// ============================================================
//  DETECCIÓN DE TABLAS POR ESPACIOS (SIN LÍNEAS)
// ============================================================

function detectTableBySpacing(text) {
    var lines = text.split('\n').filter(function(line) { return line.trim().length > 0; });
    if (lines.length < 2) return null;
    
    var columnPositions = findColumnPositions(lines);
    if (columnPositions.length < 2) return null;
    
    var tableData = [];
    for (var i = 0; i < lines.length; i++) {
        var row = extractColumns(lines[i], columnPositions);
        if (row.length > 0) {
            tableData.push(row);
        }
    }
    
    return tableData.length > 1 ? tableData : null;
}

function findColumnPositions(lines) {
    var positions = [];
    var minSpaces = 3;
    var maxLines = Math.min(lines.length, 20);
    
    for (var i = 0; i < maxLines; i++) {
        var line = lines[i];
        var spaceCount = 0;
        var lastChar = '';
        
        for (var j = 0; j < line.length; j++) {
            var char = line[j];
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
    
    var groups = [];
    var threshold = 5;
    for (var p = 0; p < positions.length; p++) {
        var pos = positions[p];
        var found = false;
        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
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
    
    groups.sort(function(a, b) { return a.col - b.col; });
    var result = [];
    for (var g = 0; g < groups.length; g++) {
        if (groups[g].count >= 2) {
            result.push(groups[g].col);
        }
    }
    return result;
}

function extractColumns(line, columnPositions) {
    var row = [];
    var start = 0;
    
    for (var c = 0; c < columnPositions.length; c++) {
        var col = columnPositions[c];
        var end = Math.min(col, line.length);
        var cell = line.substring(start, end).trim();
        if (cell.length > 0 || row.length > 0) {
            row.push(cell);
        }
        start = end;
    }
    
    var last = line.substring(start).trim();
    if (last.length > 0) {
        row.push(last);
    }
    
    return row;
}

// ============================================================
//  PARSER DE TABLA MEJORADO (HÍBRIDO)
// ============================================================

function parseTable(text) {
    var lines = text.split('\n')
        .map(function(line) { return line.trim(); })
        .filter(function(line) { return line.length > 0 && !line.match(/^[-\s]+$/); });

    if (lines.length < 2) return null;

    var sep = detectSeparator(lines);
    
    if (sep !== 'spaces') {
        var table = lines.map(function(line) {
            var cells;
            if (sep === 'tab') cells = line.split('\t');
            else if (sep === 'pipe') cells = line.split('|').filter(function(c) { return c.trim(); });
            else if (sep === 'comma') cells = line.split(',').map(function(c) { return c.trim(); });
            else if (sep === 'semicolon') cells = line.split(';').map(function(c) { return c.trim(); });
            else cells = line.split(/\s{2,}/).map(function(c) { return c.trim(); });
            return cells.filter(function(c) { return c.length > 0; });
        });
        
        var filtered = table.filter(function(row) { return row.length > 0; });
        if (filtered.length > 0) {
            var maxCols = Math.max.apply(null, filtered.map(function(row) { return row.length; }));
            return filtered.map(function(row) {
                while (row.length < maxCols) row.push('');
                return row;
            });
        }
    }
    
    var spacedTable = detectTableBySpacing(text);
    if (spacedTable && spacedTable.length > 1) {
        return spacedTable;
    }
    
    var fallback = lines.map(function(line) {
        var parts = line.split(/\s{2,}/).map(function(c) { return c.trim(); });
        return parts.length > 1 ? parts : [line];
    });
    
    var filtered2 = fallback.filter(function(row) { return row.length > 0; });
    if (filtered2.length > 0) {
        var maxCols2 = Math.max.apply(null, filtered2.map(function(row) { return row.length; }));
        return filtered2.map(function(row) {
            while (row.length < maxCols2) row.push('');
            return row;
        });
    }
    
    return null;
}

function detectSeparator(lines) {
    var counts = { tab: 0, pipe: 0, comma: 0, semicolon: 0 };
    var sample = lines.slice(0, Math.min(lines.length, 10));
    
    for (var i = 0; i < sample.length; i++) {
        var line = sample[i];
        if (line.includes('\t')) counts.tab++;
        if (line.includes('|')) counts.pipe++;
        if (line.includes(',')) counts.comma++;
        if (line.includes(';')) counts.semicolon++;
    }
    
    var max = 0;
    var best = 'spaces';
    var keys = Object.keys(counts);
    for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (counts[key] > max) {
            max = counts[key];
            best = key;
        }
    }
    return max > 0 ? best : 'spaces';
}

// ============================================================
//  EXTRAER CELDAS CON OCR
// ============================================================

async function extractCellsWithOCR(imageData, cells) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    
    var tableData = [];
    var padding = 5;
    
    for (var row = 0; row < cells.length - 1; row++) {
        var rowData = [];
        for (var col = 0; col < cells[row].length - 1; col++) {
            var x1 = cells[row][col].x + padding;
            var y1 = cells[row][col].y + padding;
            var x2 = cells[row][col + 1].x - padding;
            var y2 = cells[row + 1][col].y - padding;
            
            if (x2 <= x1 || y2 <= y1) {
                rowData.push('');
                continue;
            }
            
            var cellCanvas = document.createElement('canvas');
            cellCanvas.width = x2 - x1;
            cellCanvas.height = y2 - y1;
            var cellCtx = cellCanvas.getContext('2d');
            cellCtx.drawImage(canvas, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);
            
            try {
                var cellImageData = cellCtx.getImageData(0, 0, cellCanvas.width, cellCanvas.height);
                var text = await recognizeCell(cellImageData);
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
    var canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    var ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    
    if (canvas.width < 10 || canvas.height < 10) return '';
    
    var imageUrl = canvas.toDataURL('image/png');
    try {
        var result = await worker.recognize(imageUrl);
        return result.data.text.trim();
    } catch (e) {
        console.warn('OCR error:', e);
        return '';
    }
}

// ============================================================
//  MOSTRAR TEXTO COMO TABLA (FALLBACK)
// ============================================================

function mostrarTextoComoTabla(text) {
    var lines = text.split('\n').filter(function(line) { return line.trim().length > 0; });
    if (lines.length === 0) {
        setStatus('⚠️ No se detectó texto en la imagen.', 'warning');
        return;
    }
    
    var data = [['Texto extraído']];
    for (var i = 0; i < Math.min(lines.length, 50); i++) {
        data.push([lines[i]]);
    }
    
    tableData = data;
    renderTable(tableData);
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
    updateCellCount();
    setStatus('📄 Texto extraído (' + (data.length - 1) + ' líneas). Puedes editar la tabla manualmente.', 'warning');
}

// ============================================================
//  PROCESAR IMAGEN COMPLETO CON MANEJO DE ERRORES
// ============================================================

async function processImage() {
    if (!currentImageFile) {
        setStatus('⚠️ Primero sube una imagen', 'error');
        return;
    }

    if (!tesseractReady) {
        setStatus('⏳ Cargando OCR...', 'warning');
        var ready = await initTesseract();
        if (!ready) return;
    }

    if (isProcessing) return;
    isProcessing = true;
    processBtn.disabled = true;

    var text = '';
    var tableDataResult = null;

    try {
        showProgress(true, 5);
        setStatus('🔍 Procesando imagen...', 'info');

        var img = new Image();
        img.src = await fileToBase64(currentImageFile);
        await img.decode();

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 1. Intentar detectar líneas
        showProgress(true, 25);
        setStatus('📐 Detectando líneas...', 'info');

        var intersections = [];
        var cells = [];

        try {
            var linesResult = detectLines(imageData);
            intersections = linesResult.intersections || [];
        } catch (e) {
            console.warn('⚠️ Error en detectLines:', e);
            intersections = [];
        }

        if (intersections.length >= 4) {
            try {
                showProgress(true, 50);
                setStatus('📊 Identificando celdas por líneas...', 'info');
                cells = detectCells(intersections);
            } catch (e) {
                console.warn('⚠️ Error en detectCells:', e);
                cells = [];
            }

            if (cells && cells.length >= 2) {
                try {
                    showProgress(true, 65);
                    setStatus('🔍 Leyendo cada celda...', 'info');
                    tableDataResult = await extractCellsWithOCR(imageData, cells);
                } catch (e) {
                    console.warn('⚠️ Error en extractCellsWithOCR:', e);
                    tableDataResult = null;
                }
            }
        }

        // 2. Si no hay líneas, usar OCR general
        if (!tableDataResult || tableDataResult.length === 0) {
            showProgress(true, 50);
            setStatus('📄 Usando OCR general...', 'warning');

            try {
                var result = await worker.recognize(imageData);
                text = result.data.text || '';
            } catch (e) {
                console.warn('⚠️ Error en OCR general:', e);
                text = '';
            }

            if (text) {
                showOcrResult(text);
                try {
                    var parsed = parseTable(text);
                    if (parsed && parsed.length > 1) {
                        tableDataResult = parsed;
                        setStatus('✅ Tabla detectada por espacios (' + tableDataResult.length + ' filas)', 'success');
                    }
                } catch (e) {
                    console.warn('⚠️ Error en parseTable:', e);
                    tableDataResult = null;
                }
            }
        }

        // 3. SIEMPRE mostrar algo (tabla o texto)
        showProgress(true, 90);
        setStatus('📋 Reconstruyendo...', 'info');

        if (tableDataResult && tableDataResult.length > 0) {
            var cleanData = tableDataResult.filter(function(row) {
                return row && row.some(function(cell) { return cell && cell.length > 0; });
            });
            if (cleanData.length > 0) {
                tableData = cleanData;
                renderTable(tableData);
                var cols = tableData[0] ? tableData[0].length : 0;
                setStatus('✅ Tabla extraída (' + tableData.length + ' filas, ' + cols + ' columnas)', 'success');
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                updateCellCount();
            } else {
                mostrarTextoComoTabla(text);
            }
        } else {
            // Si no hay tableDataResult, usar texto OCR
            if (text && text.length > 0) {
                mostrarTextoComoTabla(text);
            } else {
                setStatus('⚠️ No se pudo extraer ningún texto.', 'warning');
            }
        }

        showProgress(true, 100);
    } catch (error) {
        console.error('❌ Error en processImage:', error);
        setStatus('❌ Error: ' + (error.message || 'undefined'), 'error');
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        setTimeout(function() { showProgress(false); }, 1500);
    }
}

// ============================================================
//  RENDERIZAR TABLA (CON EDITOR DE CELDAS)
// ============================================================

function renderTable(data) {
    if (!data || data.length === 0) data = [['Sin datos']];

    var maxCols = 0;
    for (var i = 0; i < data.length; i++) {
        if (data[i].length > maxCols) maxCols = data[i].length;
    }
    data = data.map(function(row) {
        while (row.length < maxCols) row.push('');
        return row;
    });

    tableData = data;

    var html = '<thead><tr>';
    for (var j = 0; j < data[0].length; j++) {
        html += '<th>' + escapeHtml(data[0][j] || 'Col ' + (j+1)) + '</th>';
    }
    html += '</tr></thead>';

    html += '<tbody>';
    for (var r = 1; r < data.length; r++) {
        html += '<tr>';
        for (var c = 0; c < data[r].length; c++) {
            html += '<td data-row="' + r + '" data-col="' + c + '">' + escapeHtml(data[r][c] || '') + '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody>';

    resultTable.innerHTML = html;
    updateCellCount();
    enableEditing();
}

function enableEditing() {
    var cells = resultTable.querySelectorAll('td');
    for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        cell.addEventListener('dblclick', function() {
            var row = parseInt(this.dataset.row);
            var col = parseInt(this.dataset.col);
            if (isNaN(row) || isNaN(col)) return;

            var original = this.textContent;
            var input = document.createElement('input');
            input.type = 'text';
            input.value = original;
            input.style.width = '100%';
            input.style.border = '2px solid #25D366';
            input.style.borderRadius = '4px';
            input.style.padding = '4px';

            this.textContent = '';
            this.appendChild(input);
            input.focus();
            input.select();

            var self = this;
            var save = function() {
                var val = input.value;
                self.textContent = val || ' ';
                if (tableData[row] && tableData[row][col] !== undefined) {
                    tableData[row][col] = val;
                }
                updateCellCount();
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { self.textContent = original; input.remove(); }
            });
        });
    }
}

// ============================================================
//  ACCIONES DE TABLA
// ============================================================

function addRow() {
    if (!tableData || tableData.length === 0) tableData = [['Nueva fila']];
    var cols = tableData[0] ? tableData[0].length : 1;
    var newRow = [];
    for (var i = 0; i < cols; i++) newRow.push('');
    tableData.push(newRow);
    renderTable(tableData);
}

function addColumn() {
    if (!tableData || tableData.length === 0) tableData = [['Nueva columna']];
    for (var i = 0; i < tableData.length; i++) {
        tableData[i].push('');
    }
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

    var csv = '';
    for (var i = 0; i < tableData.length; i++) {
        var row = tableData[i];
        var rowStr = '';
        for (var j = 0; j < row.length; j++) {
            var cell = String(row[j] || '').replace(/"/g, '""');
            if (j > 0) rowStr += ',';
            rowStr += '"' + cell + '"';
        }
        csv += rowStr + '\n';
    }

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tabla_' + new Date().toISOString().slice(0,10) + '.csv';
    link.click();
    setStatus('📥 CSV descargado', 'success');
}

function copyTable() {
    if (!tableData || tableData.length === 0) {
        alert('No hay datos');
        return;
    }

    var text = '';
    for (var i = 0; i < tableData.length; i++) {
        text += tableData[i].join('\t') + '\n';
    }

    navigator.clipboard.writeText(text)
        .then(function() { setStatus('📋 Tabla copiada', 'success'); })
        .catch(function() {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setStatus('📋 Tabla copiada', 'success');
        });
}

// ============================================================
//  UTILIDADES
// ============================================================

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = function() { reject(reader.error); };
        reader.readAsDataURL(file);
    });
}

function updateCellCount() {
    var count = 0;
    for (var i = 0; i < tableData.length; i++) {
        count += tableData[i].length;
    }
    cellCount.textContent = count + ' celdas';
}

// ============================================================
//  EVENTOS
// ============================================================

dropZone.addEventListener('click', function() { fileInput.click(); });
fileInput.addEventListener('change', function(e) {
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

setTimeout(function() {
    initTesseract();
}, 1000);

console.log('📊 Lector de Tablas - Detección Híbrida (Líneas + Espacios)');
console.log('📐 100% OFFLINE - Sin servidores');
