// ============================================================
//  LECTOR DE TABLAS - App Principal
// ============================================================

let currentImageFile = null;
let tableData = [];
let isProcessing = false;

// ===== DOM REFERENCIAS =====
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const resultTable = document.getElementById('resultTable');
const demoBtn = document.getElementById('demoBtn');
const addRowBtn = document.getElementById('addRowBtn');
const addColBtn = document.getElementById('addColBtn');
const clearBtn = document.getElementById('clearBtn');
const cellCount = document.getElementById('cellCount');

// ============================================================
//  FUNCIONES PRINCIPALES
// ============================================================

function setStatus(msg, type = 'info') {
    statusEl.textContent = msg;
    statusEl.className = `status status-${type}`;
    console.log(`[${type}] ${msg}`);
}

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
        setStatus('📸 Imagen cargada. Toca "Procesar"', 'info');
    };
    reader.readAsDataURL(file);
}

function processImage() {
    if (!currentImageFile) {
        setStatus('⚠️ Primero sube una imagen', 'error');
        return;
    }

    if (isProcessing) return;
    isProcessing = true;
    processBtn.disabled = true;

    setStatus('🔍 Procesando imagen... (simulado)', 'info');
    
    // Simular procesamiento con datos de ejemplo
    setTimeout(() => {
        tableData = [
            ['Producto', 'Cantidad', 'Precio', 'Total'],
            ['Manzanas', '10', '$2.50', '$25.00'],
            ['Peras', '5', '$3.00', '$15.00'],
            ['Naranjas', '8', '$1.80', '$14.40'],
            ['Plátanos', '12', '$0.90', '$10.80']
        ];
        renderTable(tableData);
        downloadBtn.disabled = false;
        copyBtn.disabled = false;
        setStatus(`✅ Tabla extraída (${tableData.length - 1} filas)`, 'success');
        isProcessing = false;
        processBtn.disabled = false;
    }, 1500);
}

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
            html += `<td>${escapeHtml(data[i][j] || '')}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';

    resultTable.innerHTML = html;
    updateCellCount();
}

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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
console.log('📊 Lector de Tablas iniciado');
