// ============================================================
//  LECTOR DE TABLAS - CON TESSERACT REAL
// ============================================================

let currentImageFile = null;
let tableData = [];
let worker = null;
let isProcessing = false;

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
const demoBtn = document.getElementById('demoBtn');
const addRowBtn = document.getElementById('addRowBtn');
const addColBtn = document.getElementById('addColBtn');
const clearBtn = document.getElementById('clearBtn');
const cellCount = document.getElementById('cellCount');

// ============================================================
//  FUNCIONES DE UI
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
        setStatus('📸 Imagen cargada. Toca "Procesar".', 'info');
    };
    reader.readAsDataURL(file);
}

// ============================================================
//  INICIALIZAR TESSERACT
// ============================================================

async function initTesseract() {
    try {
        setStatus('⏳ Cargando Tesseract (OCR)...', 'info');
        showProgress(true, 10);

        // Usar worker con configuración básica
        worker = await Tesseract.createWorker('spa', 1, {
            logger: m => {
                if (m.status === 'loading tesseract core') {
                    showProgress(true, 30);
                    setStatus('📦 Cargando motor OCR...', 'info');
                } else if (m.status === 'loading language traineddata') {
                    showProgress(true, 60);
                    setStatus('📚 Descargando idioma español...', 'info');
                } else if (m.status === 'initializing api') {
                    showProgress(true, 85);
                    setStatus('🚀 Preparando...', 'info');
                } else if (m.status === 'recognizing text') {
                    const pct = Math.round(85 + (m.progress * 15));
                    showProgress(true, pct);
                    setStatus(`🔍 Reconociendo texto... ${pct}%`, 'info');
                }
            }
        });

        // Configurar para mejor reconocimiento de tablas
        await worker.setParameters({
            tessedit_pageseg_mode: 6, // Asume un bloque de texto uniforme
        });

        showProgress(true, 100);
        setStatus('✅ Tesseract listo. Sube una imagen.', 'success');
        setTimeout(() => showProgress(false), 1000);
        return true;
    } catch (error) {
        console.error('Error Tesseract:', error);
        setStatus(`⚠️ ${error.message}. Usa "Ejemplo".`, 'warning');
        showProgress(false);
        return false;
    }
}

// ============================================================
//  PROCESAR IMAGEN CON TESSERACT
// ============================================================

async function processImage() {
    if (!currentImageFile) {
        setStatus('⚠️ Primero sube una imagen', 'error');
        return;
    }

    if (!worker) {
        setStatus('⏳ Cargando Tesseract...', 'warning');
        const ready = await initTesseract();
        if (!ready) {
            setStatus('❌ No se pudo cargar Tesseract. Usa "Ejemplo".', 'error');
            return;
        }
    }

    if (isProcessing) return;
    isProcessing = true;
    processBtn.disabled = true;

    try {
        showProgress(true, 10);
        setStatus('🔍 Procesando imagen con OCR...', 'info');

        // Convertir imagen a base64
        const imageData = await fileToBase64(currentImageFile);
        
        // Reconocer texto
        const { data: { text } } = await worker.recognize(imageData);

        showProgress(true, 90);
        setStatus('📊 Extrayendo tabla...', 'info');

        // Mostrar texto extraído
        showOcrResult(text);
        console.log('Texto OCR:', text);

        // Intentar parsear como tabla
        const parsed = parseTable(text);
        
        if (parsed && parsed.length > 1) {
            tableData = parsed;
            renderTable(tableData);
            setStatus(`✅ Tabla extraída (${tableData.length - 1} filas)`, 'success');
            downloadBtn.disabled = false;
            copyBtn.disabled = false;
            updateCellCount();
        } else {
            // Si no se detecta tabla, mostrar el texto extraído
            setStatus('⚠️ No se detectó una tabla. Texto extraído:', 'warning');
            tableData = [['Texto extraído'], [text.substring(0, 200) + '...']];
            renderTable(tableData);
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
//  PARSER DE TABLA MEJORADO
// ============================================================

function parseTable(text) {
    // Limpiar y dividir en líneas
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.match(/^[-\s]+$/));

    if (lines.length < 2) {
        // Intentar con separadores de espacios múltiples
        const possibleTable = text.split(/\s{2,}/).filter(s => s.trim());
        if (possibleTable.length > 3) {
            return [['Datos extraídos'], ...possibleTable.map(item => [item])];
        }
        return null;
    }

    // Detectar separador
    const sep = detectSeparator(lines);
    
    const table = lines.map(line => {
        let cells;
        if (sep === 'tab') {
            cells = line.split('\t');
        } else if (sep === 'pipe') {
            cells = line.split('|').filter(c => c.trim());
        } else if (sep === 'comma') {
            cells = line.split(',').map(c => c.trim());
        } else if (sep === 'semicolon') {
            cells = line.split(';').map(c => c.trim());
        } else {
            // Espacios múltiples
            cells = line.split(/\s{2,}/).map(c => c.trim());
            if (cells.length < 2) {
                cells = line.split(/\s+/).map(c => c.trim());
            }
        }
        return cells.filter(c => c.length > 0);
    });

    // Filtrar filas vacías
    const filtered = table.filter(row => row.length > 0);
    
    if (filtered.length > 0) {
        const maxCols = Math.max(...filtered.map(row => row.length));
        // Normalizar número de columnas
        return filtered.map(row => {
            while (row.length < maxCols) row.push('');
            return row;
        });
    }
    
    return null;
}

function detectSeparator(lines) {
    const counts = { tab: 0, pipe: 0, comma: 0, semicolon: 0 };
    lines.forEach(line => {
        if (line.includes('\t')) counts.tab++;
        if (line.includes('|')) counts.pipe++;
        if (line.includes(',')) counts.comma++;
        if (line.includes(';')) counts.semicolon++;
    });
    let max = 0;
    let best = 'spaces';
    for (const [key, val] of Object.entries(counts)) {
        if (val > max) { max = val; best = key; }
    }
    return max > 0 ? best : 'spaces';
}

// ============================================================
//  RENDERIZAR TABLA CON EDITOR
// ============================================================

function renderTable(data) {
    if (!data || data.length === 0) {
        data = [['Sin datos']];
    }

    // Asegurar mismo número de columnas
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

// ============================================================
//  EDITOR DE CELDAS
// ============================================================

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
            input.style.border = '2px solid #667eea';
            input.style.borderRadius = '4px';
            input.style.padding = '4px';
            input.style.fontSize = '0.85rem';

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
                setStatus(`✅ Celda actualizada`, 'success');
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
//  DATOS DE EJEMPLO
// ============================================================

function loadDemo() {
    tableData = [
        ['Producto', 'Cantidad', 'Precio', 'Total'],
        ['Manzanas', '10', '$2.50', '$25.00'],
        ['Peras', '5', '$3.00', '$15.00'],
        ['Naranjas', '8', '$1.80', '$14.40'],
        ['Plátanos', '12', '$0.90', '$10.80'],
        ['Total', '', '', '$65.20']
    ];
    renderTable(tableData);
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
    setStatus('📊 Datos de ejemplo cargados', 'success');
}

// ============================================================
//  ACCIONES DE TABLA
// ============================================================

function addRow() {
    if (!tableData || tableData.length === 0) {
        tableData = [['Nueva fila']];
    }
    const cols = tableData[0]?.length || 1;
    tableData.push(new Array(cols).fill(''));
    renderTable(tableData);
    setStatus('➕ Fila agregada', 'info');
}

function addColumn() {
    if (!tableData || tableData.length === 0) {
        tableData = [['Nueva columna']];
    }
    tableData.forEach(row => row.push(''));
    renderTable(tableData);
    setStatus('➕ Columna agregada', 'info');
}

function clearTable() {
    if (confirm('¿Eliminar todos los datos?')) {
        tableData = [['Tabla vacía']];
        renderTable(tableData);
        downloadBtn.disabled = true;
        copyBtn.disabled = true;
        setStatus('🗑️ Tabla limpiada', 'info');
    }
}

// ============================================================
//  EXPORTAR
// ============================================================

function exportCSV() {
    if (!tableData || tableData.length === 0) {
        alert('No hay datos para exportar');
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
        alert('No hay datos para copiar');
        return;
    }

    const text = tableData.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text)
        .then(() => setStatus('📋 Tabla copiada', 'success'))
        .catch(() => {
            const ta = document.createElement('textarea');
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
demoBtn.addEventListener('click', loadDemo);
addRowBtn.addEventListener('click', addRow);
addColBtn.addEventListener('click', addColumn);
clearBtn.addEventListener('click', clearTable);

// ============================================================
//  INICIO
// ============================================================

setStatus('💡 Sube una imagen o usa "Ejemplo"', 'info');
setTimeout(loadDemo, 500);

// Inicializar Tesseract
setTimeout(async () => {
    await initTesseract();
}, 1000);

console.log('📊 Lector de Tablas con Tesseract REAL');
console.log('💡 Sube una imagen para extraer la tabla');
