// ==========================================
//  CONFIGURACIÓN
// ==========================================
const listaArchivos = [
    "TORNEO MINOR PAREJAS 04.01.2026 A.xlsx",
    "TORNEO LOCAL 11.01.2026 A.xlsx",
    
    // Agrega nuevos aquí...
];
const RUTA_CARPETA = './torneos/';
// ==========================================

// Variables Globales
let torneosCache = []; // Aquí guardaremos TODOS los datos al inicio
let totalesCache = null;
let chartInstance = null;
let isChartVisible = false;

document.addEventListener('DOMContentLoaded', initSystem);

async function initSystem() {
    // 1. Mostrar carga
    document.getElementById('view-loading').classList.add('active');

    try {
        // 2. DESCARGAR TODO DE GOLPE (Paralelo)
        // Preparamos las promesas de los torneos individuales
        const promesasTorneos = listaArchivos.map(async (filename) => {
            const meta = parseMetadata(filename);
            const data = await fetchExcel(RUTA_CARPETA + filename);
            return { ...meta, data }; // Guardamos metadatos Y los datos del excel
        });

        // Preparamos la promesa de totales
        const promesaTotales = fetchExcel(RUTA_CARPETA + 'TOTALTORNEOS.xlsx');

        // Ejecutamos todas las descargas a la vez
        const [resultadosTorneos, datosTotales] = await Promise.all([
            Promise.all(promesasTorneos),
            promesaTotales
        ]);

        // 3. Guardar en memoria
        torneosCache = resultadosTorneos.sort((a, b) => a.dateObj - b.dateObj);
        totalesCache = datosTotales;

        // 4. Generar Pestañas
        renderTabs();

        // 5. Abrir la última pestaña por defecto
        const tabs = document.querySelectorAll('.tab-btn');
        if (tabs.length > 0) {
            // Clic en la penúltima (último torneo) o última (General)
            // Si quieres que inicie en GENERAL siempre, usa: loadTotalsView(tabs[tabs.length-1]);
            // Si quieres el último torneo:
            const ultimoTorneoBtn = tabs[tabs.length - 2]; // -2 porque el ultimo es General
            if(ultimoTorneoBtn) ultimoTorneoBtn.click(); 
            else tabs[tabs.length - 1].click(); // Si no hay torneos, click en General
        }

    } catch (error) {
        console.error(error);
        document.querySelector('.loading-msg').innerHTML = 
            `❌ Error cargando archivos.<br>Verifica que los nombres en 'listaArchivos' coinciden con la carpeta.<br>Detalle: ${error.message}`;
    }
}

function renderTabs() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';

    // A) Pestañas de Torneos
    torneosCache.forEach((torneo) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        // Texto: FECHA - NOMBRE CORTO
        btn.innerText = `${torneo.dateStr.slice(0,5)} - ${torneo.shortName}`;
        
        // AL HACER CLIC: Cargamos desde memoria (cache)
        btn.onclick = () => showTournamentView(torneo, btn);
        
        container.appendChild(btn);
    });

    // B) Pestaña General
    const totalBtn = document.createElement('button');
    totalBtn.className = 'tab-btn tab-total';
    totalBtn.innerText = '🏆 GENERAL';
    totalBtn.onclick = () => showTotalsView(totalBtn);
    container.appendChild(totalBtn);
}

// --- VISTA TORNEO (Instantánea) ---
function showTournamentView(torneo, btn) {
    activateTab(btn);
    
    // Renderizar Tabla con los datos que YA tenemos en 'torneo.data'
    renderTableTournament(torneo.data);

    // Actualizar UI
    document.getElementById('header-subtitle').innerText = `${torneo.fullName} | ${torneo.dateStr}`;
    document.getElementById('tournament-title').innerText = "RESULTADOS: " + torneo.shortName;
    updateLogo(torneo.sede);

    switchView('view-tournament');
}

// --- VISTA TOTALES (Instantánea) ---
function showTotalsView(btn) {
    activateTab(btn);

    // Renderizar con datos de 'totalesCache'
    renderTableTotals(totalesCache);
    renderChart(totalesCache);

    document.getElementById('header-subtitle').innerText = "TEMPORADA 2026 - ACUMULADO";
    updateLogo('NONE');

    // Resetear toggle gráfica
    isChartVisible = false;
    document.getElementById('totals-chart-container').style.display = 'none';
    document.getElementById('totals-table-container').style.display = 'block';

    switchView('view-totals');
}


// --- UTILS ---
function activateTab(btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function switchView(id) {
    // Ocultar loading y todas las vistas
    document.getElementById('view-loading').classList.remove('active');
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    // Mostrar la deseada
    document.getElementById(id).classList.add('active');
}

// Lee metadatos del nombre de archivo
function parseMetadata(filename) {
    let clean = filename.replace('.xlsx', '').replace('.XLSX', '');
    let parts = clean.split(' ');
    
    if(parts.length < 3) return { fullName: clean, shortName: clean, dateStr: "??", dateObj: new Date(0), sede: "" };

    let sede = parts[parts.length - 1].toUpperCase(); 
    let dateStr = parts[parts.length - 2]; 
    let nameParts = parts.slice(0, parts.length - 2); 
    let fullName = nameParts.join(' '); 
    let shortName = fullName.replace('TORNEO ', '');
    let [d, m, y] = dateStr.split('.');
    let dateObj = new Date(`${y}-${m}-${d}`);

    return { fullName, shortName, dateStr, dateObj, sede };
}

async function fetchExcel(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`No se encontró: ${path}`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, {type: 'array'});
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}

function updateLogo(sedeCode) {
    const img = document.getElementById('venue-logo');
    img.style.opacity = '0';
    setTimeout(() => {
        if(sedeCode === 'A') img.src = RUTA_CARPETA + 'Arlequin.png';
        else if(sedeCode === 'F') img.src = RUTA_CARPETA + 'frikiPlaza.jpg';
        else { img.src = ''; return; }
        img.onload = () => { img.style.opacity = '1'; };
    }, 200);
}

function toggleChart() {
    const table = document.getElementById('totals-table-container');
    const chart = document.getElementById('totals-chart-container');
    isChartVisible = !isChartVisible;
    table.style.display = isChartVisible ? 'none' : 'block';
    chart.style.display = isChartVisible ? 'block' : 'none';
}

// --- RENDERIZADO TABLAS (Igual que antes) ---
function renderTableTournament(data) {
    let html = "";
    data.forEach((row, i) => {
        let pos = row["POSICION"] || (i + 1);
        
        // Evitar filas vacías o repetidas
        if(String(pos).includes("POSICION")) return;

        // Si el excel no trae "TOTAL PTS", intenta buscar "TOTAL" o suma 0
        let total = row["TOTAL PTS"] || row["TOTAL"] || 0;
        let blader = row["BLADER"] || "";

        html += `<tr>
            <td class="${pos <= 3 ? 'rank-' + pos : ''}">${pos}</td>
            <td class="col-blader">${blader}</td>
            <td class="col-total" style="font-size: 1.2rem;">${total}</td>
        </tr>`;
    });
    document.getElementById('body-tournament').innerHTML = html;
}

function renderTableTotals(data) {
    let html = "";
    data.forEach(row => {
        let pos = row["POSICION"];
        if(!pos || String(pos).includes("POSICION")) return;
        html += `<tr>
            <td class="${pos<=3?'rank-'+pos:''}">${pos}</td>
            <td class="col-blader">${row["BLADER"]||""}</td>
            <td>${row["TORNEOS"]||0}</td>
            <td class="col-total">${row["TOTAL PTS"]||0}</td>
            <td>${row["ORO"]==1?"🥇":""}</td>
            <td>${row["PLATA"]==1?"🥈":""}</td>
            <td>${row["BRONCE"]==1?"🥉":""}</td>
        </tr>`;
    });
    document.getElementById('body-totals').innerHTML = html;
}

function renderChart(data) {
    const clean = data.filter(d => d["BLADER"] && d["TOTAL PTS"]!=undefined && d["POSICION"]!="POSICION");
    clean.sort((a,b) => b["TOTAL PTS"] - a["TOTAL PTS"]);
    const top = clean.slice(0, 20);

    const ctx = document.getElementById('pointsChart').getContext('2d');
    if(chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top.map(d => d["BLADER"]),
            datasets: [{
                label: 'PUNTOS',
                data: top.map(d => d["TOTAL PTS"]),
                backgroundColor: top.map((d, i) => i<3?['#ffd700','#c0c0c0','#cd7f32'][i]:'#ff5a00')
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: {display:false} },
            scales: { 
                x: { ticks: {color:'white', font:{weight:'bold'}} },
                y: { ticks: {color:'#888'}, grid:{color:'#333'} }
            }
        }
    });
}