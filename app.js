// ============================================================
//  EXCEL A TABLA - OPTIMIZADO PARA WHATSAPP
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
const debugInfo = document.getElementById('debugInfo');
const demoBtn = document.getElementById('demoBtn');
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

function addDebug(msg) {
    debugInfo.style.display = 'block';
    debugInfo.textContent += msg + '\n';
    console.log('[DEBUG]', msg);
}

// ============================================================
//  MANEJO DE IMÁGENES
// ============================================================

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        setStatus('⚠️ Sube una imagen válida (captura de pantalla)', 'error');
        return;
    }

    currentImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        processBtn.disabled = false;
        setStatus('📸 Captura cargada. Toca "Extraer Tabla".', 'info');
        addDebug('✅ Imagen cargada: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)');
    };
    reader.onerror = (e) => {
        addDebug('❌ Error al leer imagen: ' + e);
    };
    reader.readAsDataURL(file);
}

// ============================================================
//  INICIALIZAR TESSERACT
// ============================================================

async function initTesseract() {
    try {
        // Verificar que Tesseract existe
        if (typeof Tesseract === 'undefined') {
            throw new Error('Tesseract no está disponible. Revisa la conexión a internet.');
        }

        setStatus('⏳ Cargando OCR para tablas...', 'info');
        showProgress(true, 5);
        addDebug('🔄 Inicializando Tesseract...');

        worker = await Tesseract.createWorker('spa', 1, {
            logger: m => {
                if (m.status === 'loading tesseract core') {
                    showProgress(true, 20);
                    setStatus('📦 Cargando motor OCR...', 'info');
                    addDebug('📦 Cargando core...');
                } else if (m.status === 'loading language traineddata') {
                    showProgress(true, 40);
                    setStatus('📚 Descargando idioma español... (requiere internet)', 'info');
                    addDebug('📚 Descargando modelo español...');
                } else if (m.status === 'initializing api') {
                    showProgress(true, 70);
                    setStatus('🚀 Inicializando OCR...', 'info');
                    addDebug('🚀 Inicializando API...');
                } else if (m.status === 'recognizing text') {
                    const pct = Math.round(70 + (m.progress * 30));
                    showProgress(true, pct);
                    setStatus(`🔍 Leyendo tabla... ${pct}%`, 'info');
                }
            }
        });

        showProgress(true, 85);
        setStatus('⚙️ Configurando parámetros...', 'info');

        // Configuración optimizada para tablas
        await worker.setParameters({
            tessedit_pageseg_mode: 6,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;%$€£@#+-/() ',
        });

        showProgress(true, 100);
        tesseractReady = true;
        setStatus('✅ OCR listo. Sube una captura.', 'success');
        addDebug('✅ Tesseract inicializado correctamente');
        setTimeout(() => showProgress(false), 1000);
        return true;
    } catch (error) {
        console.error('Error Tesseract:', error);
        setStatus(`❌ Error: ${error.message}`, 'error');
        addDebug('❌ Error Tesseract: ' + error.message);
        showProgress(false);
        tesseractReady = false;
        return false;
    }
}

// ============================================================
//  PROCESAR IMAGEN CON TESSERACT REAL
// ============================================================

async function processImage() {
    // Verificar que hay imagen
    if (!currentImageFile) {
        setStatus('⚠️ Primero sube una captura de pantalla', 'error');
        return;
    }

    // Verificar que Tesseract está listo
    if (!tesseractReady) {
        setStatus('⏳ Inicializando OCR... espera un momento', 'warning');
        const ready = await initTesseract();
        if (!ready) {
            setStatus('❌ No se pudo inicializar OCR. Usa "Ejemplo".', 'error');
            return;
        }
    }

    if (isProcessing) return;
    isProcessing = true;
    processBtn.disabled = true;

    try {
        addDebug('🔄 Iniciando procesamiento...');
        showProgress(true, 5);
        setStatus('🔍 Analizando captura de pantalla...', 'info');

        // Convertir imagen a base64
        const imageData = await fileToBase64(currentImageFile);
        addDebug('📸 Imagen convertida a base64');

        showProgress(true, 30);
        setStatus('🔍 Reconociendo texto con OCR...', 'info');

        // Ejecutar OCR
        const { data: { text } } = await worker.recognize(imageData);

        showProgress(true, 80);
        setStatus('📊 Extrayendo tabla...', 'info');

        // Mostrar texto crudo
        showOcrResult(text);
        addDebug('📄 Texto OCR obtenido (' + text.length + ' caracteres)');
        addDebug('📄 Primeras líneas:\n' + text.substring(0, 200));

        // Intentar parsear como tabla
        const parsed = parseExcelTable(text);
        
        if (parsed && parsed.length > 1) {
            tableData = parsed;
            renderTable(tableData);
            const rows = tableData.length - 1;
            const cols = tableData[0]?.length || 0;
            setStatus(`✅ Tabla extraída: ${rows} filas × ${cols} columnas`, 'success');
            addDebug(`✅ Tabla extraída: ${rows} filas, ${cols} columnas`);
            downloadBtn.disabled = false;
            copyBtn.disabled = false;
            updateCellCount();
        } else {
            // Si no se detecta tabla, mostrar el texto extraído
            setStatus('⚠️ No se detectó una tabla. Mostrando texto extraído.', 'warning');
            addDebug('⚠️ No se detectó estructura de tabla');
            
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                tableData = [['Texto extraído'], ...lines.map(l => [l])];
                renderTable(tableData);
            } else {
                tableData = [['Sin datos']];
                renderTable(tableData);
            }
        }

        showProgress(true, 100);
        addDebug('✅ Procesamiento completado');
    } catch (error) {
        console.error('Error:', error);
        setStatus(`❌ Error: ${error.message}`, 'error');
        addDebug('❌ Error en procesamiento: ' + error.message);
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        setTimeout(() => showProgress(false), 1500);
    }
}

// ============================================================
//  PARSER OPTIMIZADO PARA TABLAS DE EXCEL
// ============================================================

function parseExcelTable(text) {
    addDebug('🔍 Parseando texto...');
    
    // Limpiar y dividir en líneas
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.match(/^[-\s]+$/));

    addDebug(`📄 ${lines.length} líneas no vacías`);

    if (lines.length < 2) {
        addDebug('⚠️ Menos de 2 líneas, no es una tabla');
        return null;
    }

    // Detectar separadores
    const separators = ['\t', '|', ',', ';'];
    let bestSep = null;
    let bestCount = 0;

    for (const sep of separators) {
        const count = lines.reduce((sum, line) => sum + (line.includes(sep) ? 1 : 0), 0);
        if (count > bestCount) {
            bestCount = count;
            bestSep = sep;
        }
    }

    addDebug(`🔍 Mejor separador: ${bestSep || 'espacios'} (${bestCount} ocurrencias)`);

    // Si no hay separadores claros, usar espacios
    if (bestCount < 2) {
        bestSep = 'spaces';
    }

    const table = lines.map(line => {
        let cells;
        if (bestSep === '\t') {
            cells = line.split('\t').map(c => c.trim());
        } else if (bestSep === '|') {
            cells = line.split('|').map(c => c.trim()).filter(c => c);
        } else if (bestSep === ',') {
            cells = line.split(',').map(c => c.trim());
        } else if (bestSep === ';') {
            cells = line.split(';').map(c => c.trim());
        } else {
            // Espacios: usar 2+ espacios como separador
            cells = line.split(/\s{2,}/).map(c => c.trim());
            if (cells.length < 2) {
                cells = line.split(/\s+/).map(c => c.trim());
            }
        }
        return cells.filter(c => c.length > 0);
    });

    // Filtrar filas vacías
    const filtered = table.filter(row => row.length > 0);
    addDebug(`📊 ${filtered.length} filas después de filtrar`);
    
    if (filtered.length > 0) {
        const maxCols = Math.max(...filtered.map(row => row.length));
        addDebug(`📊 Máximo de columnas: ${maxCols}`);
        
        return filtered.map(row => {
            while (row.length < maxCols) row.push('');
            return row;
        });
    }
    
    return null;
}

// ============================================================
//  RENDERIZAR TABLA CON EDITOR
// ============================================================

function renderTable(data) {
    if (!data || data.length === 0) {
        data = [['Sin datos']];
    }

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
            input.style.border = '2px solid #25D366';
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
        ['Producto', 'Cantidad', 'Precio Unitario', 'Total'],
        ['Manzanas', '10', '$2.50', '$25.00'],
        ['Peras', '5', '$3.00', '$15.00'],
        ['Naranjas', '8', '$1.80', '$14.40'],
        ['Plátanos', '12', '$0.90', '$10.80'],
        ['Kiwi', '6', '$2.20', '$13.20'],
        ['Fresas', '15', '$1.50', '$22.50'],
        ['Total', '', '', '$101.90']
    ];
    renderTable(tableData);
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
    setStatus('📊 Ejemplo de tabla Excel cargado', 'success');
    addDebug('📊 Datos de ejemplo cargados');
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
//  EXPORTAR CSV
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
    setStatus('📥 CSV descargado (compatible con Excel)', 'success');
}

function copyTable() {
    if (!tableData || tableData.length === 0) {
        alert('No hay datos para copiar');
        return;
    }

    const text = tableData.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text)
        .then(() => setStatus('📋 Tabla copiada (puedes pegarla en Excel)', 'success'))
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

setStatus('📸 Sube una captura de pantalla de WhatsApp/Excel', 'info');
addDebug('🚀 App iniciada');

setTimeout(() => {
    loadDemo();
    addDebug('📊 Datos de ejemplo cargados');
}, 500);

// Inicializar Tesseract
setTimeout(async () => {
    addDebug('🔄 Iniciando carga de Tesseract...');
    await initTesseract();
}, 2000);

console.log('📊 Lector de Tablas - Optimizado para Excel/WhatsApp');
console.log('📸 Sube una captura de pantalla y extrae la tabla');
