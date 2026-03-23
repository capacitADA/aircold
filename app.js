// ============================================
// AIRCOLD - APP COMPLETA CON FIREBASE
// Mobile-first | Gestión HVAC
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs,
    deleteDoc, doc, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===== CONFIGURACIÓN FIREBASE - AIRCOLDV2 =====
const firebaseConfig = {
    apiKey: "AIzaSyBIS_xJnFZRtG_m_4yMR8QPVKUSfYww1Lk",
    authDomain: "aircoldv2.firebaseapp.com",
    projectId: "aircoldv2",
    storageBucket: "aircoldv2.firebasestorage.app",
    messagingSenderId: "433526897735",
    appId: "1:433526897735:web:b7778a46eea8126713c562"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== ESTADO GLOBAL =====
let clientes = [];
let equipos = [];
let servicios = [];
let tecnicos = [];
let currentView = 'panel';
let selectedClienteId = null;
let selectedEquipoId = null;
const fotosNuevas = [null, null, null];
const stExt = new Array(13).fill(false);
const stInt = new Array(10).fill(false);

const CIUDADES = ["Cúcuta", "Los Patios", "Villa del Rosario", "Bucaramanga",
    "Girón", "Floridablanca", "Piedecuesta", "Pamplona", "Chinácota", "El Zulia"];

const CK_EXT = ['LIMPIEZA GENERAL', 'LIMPIEZA DE SERPENTINES', 'ENGRASE DE RODAMIENTOS',
    'AJUSTE DE TORNILLERIA', 'REPARACIÓN MOTOR VENTILADOR', 'REPARACIÓN MOTOR COMPRESOR',
    'CAMBIO DE CONTACTOR', 'CAMBIO CONDENSADOR VENTILADOR', 'CAMBIO DE CAPACITOR COMPRESOR',
    'REPARACIÓN DE FUGA', 'RECARGA DE GAS', 'REPAR. VALVULA DE CARGA', 'REVISIÓN ACOMETIDA ELÉCTRICA'];

const CK_INT = ['LIMPIEZA GENERAL', 'LIMPIEZA DE REJILLAS', 'LIMPIEZA DE SERPENTINES',
    'LIMPIEZA DRENAJES DE AGUA', 'REPARACIÓN TARJETA ELECTRONICA', 'AJUSTES DE CORREAS',
    'REPARACIÓN DE FUGA', 'CAMBIO DE BLOWER', 'REPARACIÓN MOTOR VENTILADOR', 'OTROS'];

// ===== HELPERS =====
const getEq = id => equipos.find(e => e.id === id);
const getCl = id => clientes.find(c => c.id === id);
const getEquiposCliente = cid => equipos.filter(e => e.clienteId === cid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosCliente = cid => servicios.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));

function fmtFecha(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES');
}
function fmtFechaLarga(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function calcProxFecha(fecha) {
    const d = new Date(fecha + 'T12:00:00');
    d.setMonth(d.getMonth() + 4);
    return d.toISOString().split('T')[0];
}
function getMesActual() {
    return new Date().toISOString().slice(0, 7);
}

// ===== TOAST =====
function toast(msg, duration = 2500) {
    const t = document.getElementById('toastEl');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ===== OVERLAY / MODAL =====
function showModal(html) {
    const ov = document.getElementById('overlayEl');
    ov.innerHTML = html;
    ov.classList.remove('hidden');
    ov.onclick = e => { if (e.target === ov) closeModal(); };
}
function closeModal() {
    const ov = document.getElementById('overlayEl');
    ov.classList.add('hidden');
    ov.innerHTML = '';
    fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;
}

// ===== CARGAR DATOS FIREBASE =====
async function cargarDatos() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando datos...</p></div>';
    
    try {
        const clientesSnap = await getDocs(query(collection(db, 'clientes'), orderBy('nombre')));
        clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const equiposSnap = await getDocs(collection(db, 'equipos'));
        equipos = equiposSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const serviciosSnap = await getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc')));
        servicios = serviciosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const tecnicosSnap = await getDocs(collection(db, 'tecnicos'));
        tecnicos = tecnicosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        toast('✅ Listo', 1000);
        
    } catch (e) {
        console.error('Error cargando datos:', e);
        toast('⚠️ Error de conexión. Revisa tu internet.', 4000);
        main.innerHTML = '<div class="page" style="text-align:center;padding:2rem;"><p>⚠️ Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

// ===== SUBIR IMAGEN (Base64, sin Storage) =====
function comprimirImagen(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            const maxPx = 1200;
            
            if (width > maxPx || height > maxPx) {
                if (width > height) {
                    height = Math.round(height * maxPx / width);
                    width = maxPx;
                } else {
                    width = Math.round(width * maxPx / height);
                    height = maxPx;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(b => resolve(b), 'image/jpeg', 0.7);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Error al cargar imagen'));
        };
        
        img.src = url;
    });
}

async function subirImagen(file) {
    const blob = await comprimirImagen(file);
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

// ===== NAVEGACIÓN =====
function goTo(view, cid = null, eid = null) {
    currentView = view;
    selectedClienteId = cid;
    selectedEquipoId = eid;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active', b.dataset.page === view ||
            (view === 'detalle' && b.dataset.page === 'clientes') ||
            (view === 'historial' && b.dataset.page === 'clientes'));
    });
}

function renderView() {
    const main = document.getElementById('mainContent');
    switch (currentView) {
        case 'panel': main.innerHTML = renderPanel(); break;
        case 'clientes': main.innerHTML = renderClientes(); break;
        case 'detalle': main.innerHTML = renderDetalleCliente(); break;
        case 'historial': main.innerHTML = renderHistorial(); break;
        case 'equipos': main.innerHTML = renderEquipos(); break;
        case 'servicios': main.innerHTML = renderServicios(); aplicarFiltros(); break;
        case 'mantenimientos': main.innerHTML = renderMantenimientos(); break;
        case 'tecnicos': main.innerHTML = renderTecnicos(); break;
        default: main.innerHTML = renderPanel();
    }
}

// ============================================
// PANEL
// ============================================
function renderPanel() {
    const mes = getMesActual();
    const man = servicios.filter(s => s.tipo === 'Mantenimiento');
    const rep = servicios.filter(s => s.tipo === 'Reparación');
    const inst = servicios.filter(s => s.tipo === 'Instalación');
    const manM = man.filter(s => s.fecha?.startsWith(mes));
    const repM = rep.filter(s => s.fecha?.startsWith(mes));
    const instM = inst.filter(s => s.fecha?.startsWith(mes));

    const nuevosDelMes = clientes.filter(c => {
        if (!c.fechaCreacion) return false;
        return c.fechaCreacion.startsWith(mes);
    }).length;

    return `<div class="page">
        <div class="panel-banner">
            <div class="panel-banner-sub">Sistema de Gestión de</div>
            <div class="panel-banner-title">Servicios de Refrigeración</div>
        </div>
        <div class="panel-grid">
            <div class="panel-col gold">
                <div class="panel-col-head">Clientes</div>
                <div class="panel-box" onclick="goTo('clientes')">
                    <div class="panel-box-num">${clientes.length}</div>
                    <div class="panel-box-lbl">TOTALES</div>
                </div>
                <div class="panel-box" onclick="goTo('clientes')">
                    <div class="panel-box-num">${nuevosDelMes}</div>
                    <div class="panel-box-lbl">NUEVOS MES</div>
                </div>
            </div>
            <div class="panel-col gray">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box" onclick="goTo('servicios')">
                    <div class="panel-box-lbl">ANUAL</div>
                </div>
                <div class="panel-box" onclick="goTo('servicios')">
                    <div class="panel-box-num">${man.length}</div>
                    <div class="panel-box-lbl">Mantenimiento</div>
                </div>
                <div class="panel-box" onclick="goTo('servicios')">
                    <div class="panel-box-num">${rep.length}</div>
                    <div class="panel-box-lbl">Reparación</div>
                </div>
                <div class="panel-box" onclick="goTo('servicios')">
                    <div class="panel-box-num">${inst.length}</div>
                    <div class="panel-box-lbl">Instalación</div>
                </div>
            </div>
            <div class="panel-col gray">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box" onclick="goTo('servicios')">
                    <div class="panel-box-lbl">MENSUAL</div>
                </div>
                <div class="panel-box" onclick="goTo('servicios')">
                    <div class="panel-box-num">${manM.length}</div>
                    <div class="panel-box-lbl">Mantenimiento</div>
                </div>
                <div class="panel-box" onclick="goTo('servicios')">
                    <div class="panel-box-num">${repM.length}</div>
                    <div class="panel-box-lbl">Reparación</div>
                </div>
                <div class="panel-box" onclick="goTo('servicios')">
                    <div class="panel-box-num">${instM.length}</div>
                    <div class="panel-box-lbl">Instalación</div>
                </div>
            </div>
        </div>
    </div>`;
}

// ============================================
// CLIENTES
// ============================================
function renderClientes() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Clientes (${clientes.length})</h2>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoCliente()">+ Nuevo</button>
        </div>
        <input class="search" placeholder="🔍 Buscar por nombre, ciudad, teléfono..."
            oninput="filtrarClientes(this.value)" id="searchClientes">
        <div id="clientesGrid">
            ${clientes.map(c => `
            <div class="cc" data-search="${(c.nombre + c.ciudad + c.telefono + (c.email || '')).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div class="cc-name">${c.nombre}</div>
                    <div style="display:flex;gap:4px;">
                        <button class="ib" onclick="modalEditarCliente('${c.id}')">✏️</button>
                        <button class="ib" onclick="modalEliminarCliente('${c.id}')">🗑️</button>
                    </div>
                </div>
                <div class="cc-row">📞 ${c.telefono}</div>
                ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
                <div class="cc-row">📍 ${c.direccion}</div>
                <span class="city-tag">${c.ciudad}</span>
                ${c.latitud && c.longitud ? `
                <div style="margin-top:4px;">
                    <a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver GPS</a>
                </div>` : ''}
                <div class="cc-meta">${getEquiposCliente(c.id).length} equipo(s) · ${getServiciosCliente(c.id).length} servicio(s)</div>
                <button class="link-btn" onclick="goTo('detalle','${c.id}')">Ver equipos y servicios →</button>
            </div>`).join('')}
        </div>
    </div>`;
}

function filtrarClientes(v) {
    const txt = v.toLowerCase();
    document.querySelectorAll('#clientesGrid .cc').forEach(c => {
        c.style.display = (c.dataset.search || '').includes(txt) ? '' : 'none';
    });
}

// ============================================
// DETALLE CLIENTE
// ============================================
function renderDetalleCliente() {
    const c = getCl(selectedClienteId);
    if (!c) { goTo('clientes'); return ''; }
    const eqs = getEquiposCliente(c.id);
    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('clientes')">← Volver</button>
            <div>
                <div style="font-size:0.92rem;font-weight:700;">${c.nombre}</div>
                <div style="font-size:0.72rem;color:var(--hint);">${c.ciudad}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="cc-row">📞 <strong>${c.telefono}</strong></div>
            ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
            <div class="cc-row">📍 ${c.direccion}</div>
            ${c.latitud ? `<a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver en Google Maps</a>`
                : '<div style="font-size:0.72rem;color:var(--hint);margin-top:2px;">Sin GPS registrado</div>'}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
            <span style="font-size:0.9rem;font-weight:700;">Equipos (${eqs.length})</span>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${c.id}')">+ Equipo</button>
        </div>
        ${eqs.length === 0 ? '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1rem;">Sin equipos. Agrega uno.</p>' : ''}
        ${eqs.map(e => `
        <div class="ec">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <div class="ec-name">${e.marca} ${e.modelo}</div>
                    <div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie || 'S/N'}</div>
                    <div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s) registrado(s)</div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button>
                    <button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button>
                </div>
            </div>
            <div class="ec-btns">
                <button class="ab" onclick="goTo('historial','${c.id}','${e.id}')">📋 Servicios</button>
                <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo servicio</button>
                <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
            </div>
        </div>`).join('')}
    </div>`;
}

// ============================================
// HISTORIAL EQUIPO
// ============================================
function renderHistorial() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('clientes'); return ''; }
    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(e.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('detalle','${e.clienteId}')">← Volver</button>
            <div>
                <div style="font-size:0.88rem;font-weight:700;">${e.marca} ${e.modelo}</div>
                <div style="font-size:0.72rem;color:var(--hint);">${e.ubicacion} · ${c?.nombre}</div>
            </div>
        </div>
        <div style="margin-bottom:0.65rem;">
            <span style="font-size:0.88rem;font-weight:700;">Historial (${ss.length})</span>
        </div>
        ${ss.length === 0 ? '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1rem;">Sin servicios registrados.</p>' : ''}
        ${ss.map(s => `
        <div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo === 'Mantenimiento' ? 'b-blue' : s.tipo === 'Reparación' ? 'b-red' : 'b-green'}">${s.tipo}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
                    <button class="ib" style="padding:3px 7px;min-height:28px;font-size:0.78rem;" onclick="modalEditarServicio('${s.id}')">✏️</button>
                </div>
            </div>
            <div class="si-info">🔧 ${s.tecnico}</div>
            <div class="si-info" style="color:#64748b;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.78rem;color:var(--gold);margin-top:3px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">
                ${(s.fotos || []).map(f => `<img class="fthumb" src="${f}" loading="lazy" onerror="this.style.background='#e2e8f0'">`).join('')}
                ${!(s.fotos || []).length ? '<span style="font-size:0.72rem;color:var(--hint);">Sin fotos</span>' : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

// ============================================
// EQUIPOS
// ============================================
function renderEquipos() {
    return `<div class="page">
        <div class="sec-head"><h2>Equipos (${equipos.length})</h2></div>
        <input class="search" placeholder="🔍 Buscar equipo o cliente..." oninput="filtrarEquipos(this.value)" id="searchEq">
        <div id="equiposGrid">
        ${equipos.map(e => {
            const c = getCl(e.clienteId);
            return `<div class="ec" data-search="${(e.marca + e.modelo + (c?.nombre || '')).toLowerCase()}">
                <div class="ec-name">${e.marca} ${e.modelo}</div>
                <div class="ec-meta">👤 ${c?.nombre || 'Sin cliente'} · 📍 ${e.ubicacion}</div>
                <div class="ec-btns">
                    <button class="ab" onclick="goTo('historial','${e.clienteId}','${e.id}')">📋 Servicios</button>
                    <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
                    <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                </div>
            </div>`;
        }).join('')}
        </div>
    </div>`;
}
function filtrarEquipos(v) {
    document.querySelectorAll('#equiposGrid .ec').forEach(c => {
        c.style.display = (c.dataset.search || '').includes(v.toLowerCase()) ? '' : 'none';
    });
}

// ============================================
// SERVICIOS con filtros
// ============================================
function renderServicios() {
    const años = [...new Set(servicios.map(s => s.fecha?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `<div class="page">
        <div class="sec-head"><h2>Servicios</h2></div>
        <div class="filtros">
            <select class="fi" id="fAnio">
                <option value="">Todos los años</option>
                ${años.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
            <select class="fi" id="fMes">
                <option value="">Todos los meses</option>
                ${meses.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('')}
            </select>
            <select class="fi" id="fTipo">
                <option value="">Todos los tipos</option>
                <option>Mantenimiento</option>
                <option>Reparación</option>
                <option>Instalación</option>
            </select>
            <select class="fi" id="fCliente">
                <option value="">Todos los clientes</option>
                ${clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
            </select>
            <select class="fi" id="fTecnico">
                <option value="">Todos los técnicos</option>
                ${tecnicos.map(t => `<option>${t.nombre}</option>`).join('')}
            </select>
            <button class="btn btn-blue btn-full" onclick="aplicarFiltros()">Aplicar filtros</button>
            <button class="btn btn-gray btn-full" onclick="limpiarFiltros()">Limpiar filtros</button>
        </div>
        <div id="listaServicios"></div>
    </div>`;
}

function aplicarFiltros() {
    const anio = document.getElementById('fAnio')?.value || '';
    const mes = document.getElementById('fMes')?.value || '';
    const tipo = document.getElementById('fTipo')?.value || '';
    const cid = document.getElementById('fCliente')?.value || '';
    const tec = document.getElementById('fTecnico')?.value || '';

    let filtrados = [...servicios].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (anio) filtrados = filtrados.filter(s => s.fecha?.startsWith(anio));
    if (mes) filtrados = filtrados.filter(s => s.fecha?.slice(5, 7) === mes);
    if (tipo) filtrados = filtrados.filter(s => s.tipo === tipo);
    if (cid) filtrados = filtrados.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));
    if (tec) filtrados = filtrados.filter(s => s.tecnico === tec);

    const el = document.getElementById('listaServicios');
    if (!el) return;
    if (!filtrados.length) {
        el.innerHTML = '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1.5rem;">Sin resultados para los filtros seleccionados.</p>';
        return;
    }
    el.innerHTML = filtrados.map(s => {
        const e = getEq(s.equipoId);
        const c = getCl(e?.clienteId);
        return `<div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo === 'Mantenimiento' ? 'b-blue' : s.tipo === 'Reparación' ? 'b-red' : 'b-green'}">${s.tipo}</span>
                <span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
            </div>
            <div class="si-info">👤 ${c?.nombre || 'N/A'} · ${e?.marca || ''} ${e?.modelo || ''}</div>
            <div class="si-info">📍 ${e?.ubicacion || ''} · 🔧 ${s.tecnico}</div>
            <div class="si-info" style="color:#64748b;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.75rem;color:var(--gold);margin-top:2px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">
                ${(s.fotos || []).map(f => `<img class="fthumb" src="${f}" loading="lazy">`).join('')}
            </div>
        </div>`;
    }).join('');
}

function limpiarFiltros() {
    ['fAnio', 'fMes', 'fTipo', 'fCliente', 'fTecnico'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    aplicarFiltros();
}

// ============================================
// MANTENIMIENTOS / AGENDA
// ============================================
function renderMantenimientos() {
    const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const año = new Date().getFullYear();
    const mant = servicios.filter(s => s.proximoMantenimiento);

    return `<div class="page">
        <div class="sec-head"><h2>Agenda ${año}</h2></div>
        <div class="tbl-wrap">
             <table>
                <thead>
                     <tr>
                        <th>Mes</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Equipo</th>
                        <th></th>
                     </tr>
                </thead>
                <tbody>
                    ${MESES.map((mes, idx) => {
                        const mp = String(idx + 1).padStart(2, '0');
                        const lista = mant.filter(m => m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                        if (!lista.length) {
                            return `<tr>
                                <td style="color:var(--hint);font-size:0.72rem;background:var(--bg2);">${mes}</td>
                                <td colspan="4" style="color:#cbd5e1;font-size:0.7rem;">—</td>
                             </tr>`;
                        }
                        return lista.map((m, i) => {
                            const e = getEq(m.equipoId);
                            const c = getCl(e?.clienteId);
                            return `<tr>
                                ${i === 0 ? `<td rowspan="${lista.length}" style="font-weight:700;font-size:0.75rem;background:var(--bg2);">${mes}</td>` : ''}
                                <td>${fmtFecha(m.proximoMantenimiento)}</td>
                                <td style="font-size:0.75rem;">${c?.nombre || 'N/A'}</td>
                                <td style="font-size:0.72rem;">${e ? `${e.marca} ${e.modelo}` : 'N/A'}</td>
                                <td>
                                    <button class="rec-btn"
                                        onclick="modalRecordar('${c?.telefono || ''}','${e?.marca || ''} ${e?.modelo || ''}','${e?.ubicacion || ''}','${m.proximoMantenimiento}','${c?.nombre || ''}')">
                                        📱
                                    </button>
                                </td>
                             </tr>`;
                        }).join('');
                    }).join('')}
                </tbody>
             </table>
        </div>
    </div>`;
}

// ============================================
// TÉCNICOS
// ============================================
function renderTecnicos() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Técnicos</h2>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>
        </div>
        ${tecnicos.map(t => `
        <div class="ec" style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div class="ec-name">${t.nombre}</div>
                <div class="ec-meta">📞 ${t.telefono}</div>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button>
                <button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button>
            </div>
        </div>`).join('')}
    </div>`;
}

// ============================================
// MODAL: RECORDAR WHATSAPP
// ============================================
function modalRecordar(tel, equipo, ubicacion, fecha, nombre) {
    const fechaF = fmtFechaLarga(fecha);
    const msg = `Hola ${nombre}, le recordamos que su equipo ${equipo} (${ubicacion}) tiene programado mantenimiento preventivo para el ${fechaF}. Por favor confirmarnos si podemos agendar la visita técnica. Gracias — AIRCOLD Cúcuta 📞 3174022372`;

    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h">
            <h3>📱 Recordatorio WhatsApp</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <div style="font-size:0.82rem;color:var(--muted);margin-bottom:0.6rem;">
                Mensaje para <strong>${nombre}</strong> · 📞 ${tel}
            </div>
            <div class="wa-bubble">${msg}</div>
            <div style="font-size:0.75rem;color:var(--hint);margin-bottom:0.5rem;">Editar antes de enviar:</div>
            <textarea class="fi" id="waMsgEdit" rows="5">${msg}</textarea>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-wa" onclick="enviarWhatsApp('${tel}')">📱 Abrir WhatsApp</button>
            </div>
        </div>
    </div>`);
}

function enviarWhatsApp(tel) {
    const msg = document.getElementById('waMsgEdit')?.value || '';
    const telLimpio = '57' + tel.replace(/\D/g, '');
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    closeModal();
    toast('📱 WhatsApp abierto');
}

// ============================================
// MODAL: NUEVO SERVICIO
// ============================================
function modalNuevoServicio(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const hoy = new Date().toISOString().split('T')[0];
    fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;

    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h">
            <h3>Nuevo servicio</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <div style="font-size:0.82rem;color:var(--hint);margin-bottom:0.65rem;background:var(--bg2);padding:0.55rem;border-radius:8px;">
                ${c?.nombre}<br><span style="font-size:0.75rem;">${e?.marca} ${e?.modelo} · 📍 ${e?.ubicacion}</span>
            </div>

            <div class="fr">
                <div>
                    <label class="fl first">Tipo *</label>
                    <select class="fi" id="sTipo" onchange="onTipoChange()">
                        <option>Mantenimiento</option>
                        <option>Reparación</option>
                        <option>Instalación</option>
                    </select>
                </div>
                <div>
                    <label class="fl first">Fecha *</label>
                    <input class="fi" type="date" id="sFecha" value="${hoy}" onchange="onFechaChange()">
                </div>
            </div>

            <label class="fl">Técnico *</label>
            <select class="fi" id="sTecnico">
                ${tecnicos.map(t => `<option>${t.nombre}</option>`).join('')}
            </select>

            <div style="background:#f5f3ff;border:0.5px solid #c4b5fd;border-radius:10px;padding:0.65rem;margin-top:0.6rem;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:0.8rem;color:#5b21b6;flex:1;">¿Requiere informe técnico con checklist?</span>
                <button class="btn btn-purple btn-sm" onclick="modalInformeTecnico('${eid}')">📋 Abrir</button>
            </div>

            <label class="fl">Diagnóstico / Recomendaciones *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado, observaciones, materiales usados..."></textarea>

            <div class="mant-box" id="mantBox">
                <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;margin-bottom:6px;">
                    <input type="checkbox" id="proxCheck" checked onchange="onProxCheck()" style="width:18px;height:18px;accent-color:var(--blue);">
                    Programar próximo mantenimiento
                </label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input class="fi" type="date" id="proxFecha" disabled style="flex:1;">
                    <span id="proxTip" style="font-size:0.72rem;color:var(--gold);white-space:nowrap;">4 meses · auto</span>
                </div>
            </div>

            <label class="fl" style="margin-top:0.7rem;">📷 Fotos del servicio (máx 3)</label>
            <div class="foto-row">
                ${[0, 1, 2].map(i => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <div class="fslot" id="fslot${i}" onclick="document.getElementById('finput${i}').click()">
                        <div class="fslot-plus">+</div>
                        <div class="fslot-lbl">Foto ${i + 1}</div>
                        <input type="file" id="finput${i}" accept="image/*"
                            style="display:none" onchange="previewFoto(this,${i})">
                    </div>
                    <span style="font-size:0.68rem;color:var(--muted);">Foto ${i + 1}</span>
                </div>`).join('')}
            </div>

            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" id="btnGuardarServ" onclick="guardarServicio('${eid}')">💾 Guardar</button>
            </div>
        </div>
    </div>`);

    document.getElementById('proxFecha').value = calcProxFecha(hoy);
    onTipoChange();
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const box = document.getElementById('mantBox');
    if (box) box.classList.toggle('hidden', tipo !== 'Mantenimiento');
}

function onFechaChange() {
    const chk = document.getElementById('proxCheck');
    if (chk?.checked) {
        document.getElementById('proxFecha').value = calcProxFecha(document.getElementById('sFecha').value);
    }
}

function onProxCheck() {
    const chk = document.getElementById('proxCheck').checked;
    const fi = document.getElementById('proxFecha');
    const tip = document.getElementById('proxTip');
    fi.disabled = chk;
    if (chk) {
        fi.value = calcProxFecha(document.getElementById('sFecha').value);
        tip.textContent = '4 meses · auto';
    } else {
        fi.value = '';
        tip.textContent = 'Editable';
    }
}

function previewFoto(input, idx) {
    if (!input.files || !input.files[0]) return;
    fotosNuevas[idx] = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const slot = document.getElementById('fslot' + idx);
        if (slot) {
            slot.innerHTML = `
                <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">
                <button class="fslot-del" onclick="borrarFoto(event,${idx})">✕</button>
                <input type="file" id="finput${idx}" accept="image/*"
                    style="display:none" onchange="previewFoto(this,${idx})">
                <div style="position:absolute;bottom:2px;right:4px;background:rgba(0,0,0,0.6);color:white;font-size:9px;padding:1px 4px;border-radius:4px;">
                    📸
                </div>
            `;
        }
    };
    reader.readAsDataURL(input.files[0]);
}

function borrarFoto(e, idx) {
    e.stopPropagation();
    fotosNuevas[idx] = null;
    const slot = document.getElementById('fslot' + idx);
    if (slot) {
        slot.innerHTML = `
            <div class="fslot-plus">+</div>
            <div class="fslot-lbl">Foto ${idx + 1}</div>
            <input type="file" id="finput${idx}" accept="image/*"
                style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick = () => document.getElementById('finput' + idx).click();
    }
}

// ===== GUARDAR SERVICIO =====
async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if (!desc) { toast('⚠️ Ingresa el diagnóstico'); return; }

    const btn = document.getElementById('btnGuardarServ');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Procesando...'; }

    try {
        const tipo = document.getElementById('sTipo').value;
        const proxChk = document.getElementById('proxCheck')?.checked;
        const prox = tipo === 'Mantenimiento' && proxChk
            ? document.getElementById('proxFecha').value
            : null;

        const fotosValidas = fotosNuevas.filter(Boolean);
        let urlsFotos = [];
        
        if (fotosValidas.length > 0) {
            toast(`📸 Subiendo ${fotosValidas.length} foto(s)...`);
            if (btn) btn.textContent = `📤 Subiendo ${fotosValidas.length} foto(s)...`;
            
            const uploadPromises = fotosValidas.map(file => subirImagen(file));
            urlsFotos = await Promise.all(uploadPromises);
            
            toast('✅ Fotos subidas correctamente');
        }

        if (btn) btn.textContent = '💾 Guardando servicio...';
        
        await addDoc(collection(db, 'servicios'), {
            equipoId: eid,
            tipo,
            fecha: document.getElementById('sFecha').value,
            tecnico: document.getElementById('sTecnico').value,
            descripcion: desc,
            proximoMantenimiento: prox,
            fotos: urlsFotos
        });

        await cargarDatos();
        toast('✅ Servicio guardado correctamente');
        
        const e = getEq(eid);
        if (e) goTo('historial', e.clienteId, eid);

    } catch (err) {
        console.error('Error:', err);
        toast('⚠️ Error al guardar: ' + (err.message || 'Intenta de nuevo'));
        if (btn) { 
            btn.disabled = false; 
            btn.textContent = '💾 Guardar'; 
        }
    }
}

// ============================================
// MODAL: INFORME TÉCNICO (checklist)
// ============================================
function modalInformeTecnico(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const descActual = document.getElementById('sDesc')?.value || '';
    const tecActual = document.getElementById('sTecnico')?.value || (tecnicos[0]?.nombre || '');
    const fechaActual = document.getElementById('sFecha')?.value || new Date().toISOString().split('T')[0];

    showModal(`<div class="modal modal-wide" onclick="event.stopPropagation()">
        <div class="modal-h">
            <h3>📋 Informe técnico detallado</h3>
            <button class="xbtn" onclick="volverDesdeInforme('${eid}')">✕</button>
        </div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Entidad</label><input class="fi" id="iEnt" value="${c?.nombre || ''}"></div>
                <div><label class="fl first">Ubicación equipo</label><input class="fi" id="iUbic" value="${e?.ubicacion || ''}"></div>
            </div>
            <div class="fr">
                <div><label class="fl">Marca</label><input class="fi" id="iMarca" value="${e?.marca || ''}"></div>
                <div><label class="fl">Modelo / Serial</label><input class="fi" id="iModelo" value="${e?.modelo || ''} · ${e?.serie || ''}"></div>
            </div>
            <div class="fr">
                <div><label class="fl">Fecha</label><input class="fi" id="iFecha" value="${fechaActual}"></div>
                <div><label class="fl">Valor del servicio</label><input class="fi" id="iValor" placeholder="$ 0 0 0"></div>
            </div>

            <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;margin:0.65rem 0 0.4rem;">
                Control de mantenimiento
            </div>
            <div class="ck-grid">
                <div class="ck-col">
                    <div class="ck-head">Unidad exterior (Condensadora)</div>
                    <div id="ckExt">
                        ${CK_EXT.map((t, i) => `
                        <div class="ck-item">
                            <span>${t}</span>
                            <div class="ckb ${stExt[i] ? 'on' : ''}" onclick="toggleCk('e',${i})"></div>
                        </div>`).join('')}
                    </div>
                </div>
                <div class="ck-col">
                    <div class="ck-head">Unidad interior (Manejadora)</div>
                    <div id="ckInt">
                        ${CK_INT.map((t, i) => `
                        <div class="ck-item">
                            <span>${t}</span>
                            <div class="ckb ${stInt[i] ? 'on' : ''}" onclick="toggleCk('i',${i})"></div>
                        </div>`).join('')}
                    </div>
                </div>
            </div>

            <label class="fl">Diagnóstico técnico</label>
            <textarea class="fi" id="iDiag" rows="3">${descActual}</textarea>

            <div class="fr" style="margin-top:0.5rem;">
                <div><label class="fl first">Técnico</label><input class="fi" id="iTec" value="${tecActual}"></div>
                <div><label class="fl first">Firma cliente</label><input class="fi" id="iCli" placeholder="Nombre cliente"></div>
            </div>

            <div class="modal-foot">
                <button class="btn btn-gray" onclick="volverDesdeInforme('${eid}')">← Volver</button>
                <button class="btn btn-blue" onclick="exportarPDFInforme('${eid}')">🖨️ Exportar PDF</button>
            </div>
        </div>
    </div>`);
}

function toggleCk(col, i) {
    if (col === 'e') {
        stExt[i] = !stExt[i];
        document.querySelectorAll('#ckExt .ckb')[i]?.classList.toggle('on', stExt[i]);
    } else {
        stInt[i] = !stInt[i];
        document.querySelectorAll('#ckInt .ckb')[i]?.classList.toggle('on', stInt[i]);
    }
}

function volverDesdeInforme(eid) {
    const diagInforme = document.getElementById('iDiag')?.value || '';
    closeModal();
    modalNuevoServicio(eid);
    setTimeout(() => {
        const sDesc = document.getElementById('sDesc');
        if (sDesc && diagInforme) sDesc.value = diagInforme;
    }, 50);
}

// ===== EXPORTAR PDF (DESCARGA DIRECTA) =====
function exportarPDFInforme(eid) {
    const diagInforme = document.getElementById('iDiag')?.value || '';
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const fecha = document.getElementById('iFecha')?.value || '';
    const valor = document.getElementById('iValor')?.value || '';
    const tec = document.getElementById('iTec')?.value || '';
    const cli = document.getElementById('iCli')?.value || '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe AIRCOLD - ${c?.nombre}</title>
<style>
  @page { size: A4; margin: 1.5cm 2cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; }
  .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
  .hdr-logo { display: flex; align-items: center; gap: 8px; }
  .brand { font-size: 1.1rem; font-weight: 700; letter-spacing: 2px; }
  .contact { text-align: right; font-size: 10px; color: #475569; font-style: italic; line-height: 1.6; }
  table.fields { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.fields td { border: 0.5px solid #334155; padding: 4px 6px; font-size: 10px; }
  table.fields .lbl { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
  .section-title { text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px; border: 0.5px solid #334155; border-bottom: none; background: #f8fafc; }
  .ck-grid { display: grid; grid-template-columns: 1fr 1fr; border: 0.5px solid #334155; margin-bottom: 6px; }
  .ck-col { padding: 5px 6px; }
  .ck-col:first-child { border-right: 0.5px solid #334155; }
  .ck-head { font-size: 9px; font-weight: 700; text-transform: uppercase; padding-bottom: 3px; margin-bottom: 3px; border-bottom: 0.5px solid #e2e8f0; }
  .ck-row { display: flex; align-items: center; gap: 4px; padding: 1.5px 0; font-size: 9.5px; }
  .cb { width: 10px; height: 10px; border: 0.5px solid #334155; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; flex-shrink: 0; }
  .cb.on { background: #0f172a; color: white; }
  .diag { border: 0.5px solid #334155; padding: 6px; margin-bottom: 6px; min-height: 50px; }
  .diag .lbl { font-size: 9px; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
  .firmas { display: flex; margin-top: 20px; }
  .firma { flex: 1; text-align: center; padding: 0 10px; }
  .firma-line { border-top: 1px solid #334155; margin-bottom: 3px; margin-top: 30px; }
  .firma-name { font-size: 10px; font-weight: 700; }
  .firma-lbl { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
  .firma:first-child { border-right: 0.5px solid #e2e8f0; }
</style>
</head>
<body>
  <div class="hdr">
    <div class="hdr-logo">
      <img src="https://github.com/capacitADA/aircold/blob/main/AIRCOLD_LOGO.png?raw=true" style="height:52px;object-fit:contain;" alt="AIRCOLD">
    </div>
    <div class="contact">Servicios de Refrigeración<br>Cll. 23N # 2-99 Prados Norte<br>3174022372 – 3232458563</div>
  </div>
  <table class="fields">
      <tr><td><span class="lbl">Entidad</span><br>${c?.nombre || ''}</td>
      <td><span class="lbl">Ubicación del equipo</span><br>${e?.ubicacion || ''}</td></tr>
      <tr><td><span class="lbl">Marca de equipo</span><br>${e?.marca || ''}</td>
      <td><span class="lbl">Modelo y serial</span><br>${e?.modelo || ''} · ${e?.serie || ''}</td></tr>
      <tr><td><span class="lbl">Fecha</span><br>${fecha}</td>
      <td><span class="lbl">Valor</span><br>${valor || 'ΦΦΦ'}</td></tr>
    </table>
  <div class="section-title">Control de Mantenimiento</div>
  <div class="ck-grid">
    <div class="ck-col">
      <div class="ck-head">Unidad exterior (Condensadora)</div>
      ${CK_EXT.map((t, i) => `<div class="ck-row"><div class="cb ${stExt[i] === true ? 'on' : ''}">${stExt[i] === true ? '✓' : '&nbsp;'}</div><span>${t}</span></div>`).join('')}
    </div>
    <div class="ck-col">
      <div class="ck-head">Unidad interior (Manejadora)</div>
      ${CK_INT.map((t, i) => `<div class="ck-row"><div class="cb ${stInt[i] === true ? 'on' : ''}">${stInt[i] === true ? '✓' : '&nbsp;'}</div><span>${t}</span></div>`).join('')}
    </div>
  </div>
  <div class="diag"><div class="lbl">Diagnóstico técnico:</div>${diagInforme || ''}</div>
  <div class="firmas">
    <div class="firma"><div class="firma-lbl">Técnico</div><div class="firma-line"></div><div class="firma-name">${tec}</div></div>
    <div class="firma"><div class="firma-lbl">Cliente</div><div class="firma-line"></div><div class="firma-name">${cli}</div></div>
  </div>
</body>
</html>`;

    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
    toast('🖨️ Usa Imprimir → Guardar como PDF');
}

// ============================================
// INFORME PDF HISTORIAL
// ============================================
async function generarInformePDF(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe_${e?.marca}_${e?.modelo}</title>
<style>
  @page { size: A4; margin: 1.5cm 2cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 0; }
  .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 12px; }
  .brand { font-size: 1.3rem; font-weight: 700; letter-spacing: 2px; color: #0f172a; }
  .contact { text-align: right; font-size: 10px; color: #475569; font-style: italic; line-height: 1.6; }
  .title { font-size: 1rem; font-weight: 700; color: #2563eb; text-align: center; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .info-section { background: #f8fafc; border-radius: 6px; padding: 10px; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .info-item { font-size: 11px; }
  .info-item strong { color: #0f172a; }
  .servicio { border: 0.5px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 12px; page-break-inside: avoid; }
  .serv-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .tipo-badge { background: #dbeafe; color: #2563eb; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .tipo-badge.rep { background: #fee2e2; color: #dc2626; }
  .tipo-badge.inst { background: #dcfce7; color: #16a34a; }
  .fotos-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .foto-img { width: 140px; height: 105px; object-fit: cover; border-radius: 4px; border: 0.5px solid #e2e8f0; }
  .firmas { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; border-top: 0.5px solid #e2e8f0; }
  .firma { text-align: center; width: 42%; }
  .firma-line { border-top: 1px solid #334155; margin-bottom: 4px; margin-top: 30px; }
  .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; border-top: 0.5px solid #e2e8f0; padding-top: 6px; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <img src="https://github.com/capacitADA/aircold/blob/main/AIRCOLD_LOGO.png?raw=true" style="height:55px;object-fit:contain;" alt="AIRCOLD">
    </div>
    <div class="contact">Servicios de Refrigeración<br>Cll. 23N # 2-99 Prados Norte<br>3174022372 – 3232458563</div>
  </div>
  <div class="title">Informe Técnico HVAC</div>
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item"><strong>Cliente:</strong> ${c?.nombre || 'N/A'}</div>
      <div class="info-item"><strong>Teléfono:</strong> ${c?.telefono || 'N/A'}</div>
      <div class="info-item"><strong>Dirección:</strong> ${c?.direccion || 'N/A'}</div>
      <div class="info-item"><strong>Ciudad:</strong> ${c?.ciudad || 'N/A'}</div>
      <div class="info-item"><strong>Equipo:</strong> ${e?.marca || ''} ${e?.modelo || ''}</div>
      <div class="info-item"><strong>Serie:</strong> ${e?.serie || 'N/A'}</div>
      <div class="info-item"><strong>Ubicación:</strong> ${e?.ubicacion || 'N/A'}</div>
      <div class="info-item"><strong>Servicios:</strong> ${ss.length}</div>
    </div>
  </div>
  ${ss.map((s, idx) => `
    ${idx > 0 ? '<div class="page-break"></div>' : ''}
    <div class="servicio">
      <div class="serv-header">
        <span class="tipo-badge ${s.tipo === 'Reparación' ? 'rep' : s.tipo === 'Instalación' ? 'inst' : ''}">${s.tipo}</span>
        <span style="font-size:11px;color:#64748b;">${fmtFechaLarga(s.fecha)}</span>
      </div>
      <p style="margin:3px 0;font-size:11px;"><strong>Técnico:</strong> ${s.tecnico}</p>
      <p style="margin:3px 0;font-size:11px;"><strong>Descripción:</strong> ${s.descripcion}</p>
      ${s.proximoMantenimiento ? `<p style="margin:3px 0;font-size:11px;color:#d97706;"><strong>📅 Próximo mantenimiento:</strong> ${fmtFechaLarga(s.proximoMantenimiento)}</p>` : ''}
      ${(s.fotos || []).length > 0 ? `
      <div class="fotos-grid">
        ${s.fotos.map(f => `<img class="foto-img" src="${f}" onerror="this.style.display='none'">`).join('')}
      </div>` : '<p style="font-size:10px;color:#94a3b8;margin-top:6px;">Sin fotos adjuntas</p>'}
    </div>`).join('')}
  <div class="firmas">
    <div class="firma">
      <div class="firma-line"></div>
      <div style="font-size:11px;font-weight:700;">${tecnicos[0]?.nombre || ''}</div>
      <div style="font-size:10px;color:#64748b;">TÉCNICO</div>
    </div>
    <div class="firma">
      <div class="firma-line"></div>
      <div style="font-size:11px;font-weight:700;">___________</div>
      <div style="font-size:10px;color:#64748b;">CLIENTE</div>
    </div>
  </div>
  <div class="footer">Documento generado por AIRCOLD · Sistema de Gestión HVAC · ${new Date().toLocaleDateString('es-ES')}</div>
</body>
</html>`;

    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
    toast('🖨️ Usa Imprimir → Guardar como PDF');
    closeModal();
}

// ============================================
// MODAL: QR
// ============================================
function modalQR(eid) {
    const e = getEq(eid);
    const url = `${window.location.origin}${window.location.pathname}#/equipo/${eid}`;

    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:260px;height:260px;';
    document.body.appendChild(qrDiv);

    const QRLib = window.QRCode;
    if (!QRLib) { toast('⚠️ Recarga la página'); document.body.removeChild(qrDiv); return; }

    new QRLib(qrDiv, { text: url, width: 260, height: 260, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRLib.CorrectLevel.M });

    setTimeout(() => {
        const qrCanvas = qrDiv.querySelector('canvas');
        const W = 380, H = 540;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);

        // Borde azul
        ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(24,10); ctx.lineTo(W-24,10); ctx.quadraticCurveTo(W-10,10,W-10,24);
        ctx.lineTo(W-10,H-24); ctx.quadraticCurveTo(W-10,H-10,W-24,H-10);
        ctx.lineTo(24,H-10); ctx.quadraticCurveTo(10,H-10,10,H-24);
        ctx.lineTo(10,24); ctx.quadraticCurveTo(10,10,24,10);
        ctx.closePath(); ctx.stroke();

        // Caja logo
        ctx.fillStyle = '#1e40af';
        ctx.beginPath();
        ctx.moveTo(W/2-95+8,20); ctx.lineTo(W/2+95-8,20); ctx.quadraticCurveTo(W/2+95,20,W/2+95,28);
        ctx.lineTo(W/2+95,74); ctx.lineTo(W/2-95,74);
        ctx.lineTo(W/2-95,28); ctx.quadraticCurveTo(W/2-95,20,W/2-95+8,20);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='bold 24px Arial,sans-serif'; ctx.textAlign='center';
        ctx.fillText('AIRCOLD', W/2, 52);
        ctx.font='10px Arial,sans-serif'; ctx.fillStyle='#93c5fd';
        ctx.fillText('CÚCUTA', W/2, 68);

        // Nombre y ubicación
        ctx.fillStyle='#0f172a'; ctx.font='bold 15px Arial,sans-serif';
        ctx.fillText(`${e?.marca||''} ${e?.modelo||''}`, W/2, 100);
        ctx.fillStyle='#64748b'; ctx.font='12px Arial,sans-serif';
        ctx.fillText(`📍 ${e?.ubicacion||''}`, W/2, 118);

        // QR
        if (qrCanvas) ctx.drawImage(qrCanvas, (W-240)/2, 128, 240, 240);

        // URL
        ctx.fillStyle='#94a3b8'; ctx.font='8px Arial,sans-serif';
        const mid = Math.floor(url.length/2);
        ctx.fillText(url.slice(0,mid), W/2, 382);
        ctx.fillText(url.slice(mid), W/2, 393);

        // Línea
        ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(28,406); ctx.lineTo(W-28,406); ctx.stroke();

        // Teléfono grande
        ctx.fillStyle='#0f172a'; ctx.font='bold 28px Arial,sans-serif';
        ctx.fillText('317 402 2372', W/2, 448);

        // Footer
        ctx.fillStyle='#cbd5e1'; ctx.font='9px Arial,sans-serif';
        ctx.fillText('Generado por AIRCOLD · Sistema de Gestión HVAC', W/2, 508);

        document.body.removeChild(qrDiv);
        const dataUrl = c.toDataURL('image/png');

        // Mostrar modal con preview y botón descargar
        showModal(`<div class="modal" onclick="event.stopPropagation()" style="max-width:340px;">
            <div class="modal-h"><h3>📱 Código QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
            <div class="modal-b" style="text-align:center;">
                <img src="${dataUrl}" style="width:100%;border-radius:8px;margin-bottom:1rem;" alt="QR">
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <a href="${dataUrl}" download="QR_${(e?.marca||'')}_${(e?.modelo||'')}.png" class="btn btn-blue btn-full" style="text-decoration:none;display:block;padding:0.6rem;border-radius:10px;">⬇️ Descargar imagen</a>
                    <button class="btn btn-gray btn-full" onclick="closeModal()">Cerrar</button>
                </div>
            </div>
        </div>`);

    }, 200);
}

// ============================================
// CRUD CLIENTES
// ============================================
function modalNuevoCliente() {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre / Empresa *</label>
            <input class="fi" id="cNombre" placeholder="Ej: Supermercado El Rey">
            <div class="fr">
                <div><label class="fl">Teléfono *</label><input class="fi" id="cTel" placeholder="31XXXXXXXX" type="tel"></div>
                <div><label class="fl">Email</label><input class="fi" id="cEmail" type="email" placeholder="correo@..."></div>
            </div>
            <label class="fl">Ciudad *</label>
            <select class="fi" id="cCiudad">
                <option value="">Seleccionar...</option>
                ${CIUDADES.map(ci => `<option>${ci}</option>`).join('')}
            </select>
            <label class="fl">Dirección *</label>
            <input class="fi" id="cDir" placeholder="Calle, carrera, barrio">
            <div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:10px;padding:0.65rem;margin-top:0.5rem;">
                <div style="font-size:0.82rem;font-weight:700;margin-bottom:6px;">📍 Ubicación GPS</div>
                <button class="btn btn-blue btn-full" onclick="obtenerGPS()" style="min-height:46px;">
                    Compartir ubicación actual
                </button>
                <div id="gpsInfo" style="font-size:0.72rem;color:var(--hint);margin-top:4px;"></div>
                <input type="hidden" id="cLat">
                <input type="hidden" id="cLng">
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarCliente()">Guardar</button>
            </div>
        </div>
    </div>`);
}

function obtenerGPS() {
    const btn = document.querySelector('[onclick="obtenerGPS()"]');
    if (btn) btn.textContent = '⏳ Obteniendo...';
    if (!navigator.geolocation) { toast('⚠️ GPS no disponible'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        document.getElementById('cLat').value = lat;
        document.getElementById('cLng').value = lng;
        document.getElementById('gpsInfo').innerHTML =
            `✅ ${lat}, ${lng} · <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" style="color:var(--blue);">Ver mapa</a>`;
        if (btn) btn.textContent = '✅ Ubicación guardada';
    }, () => {
        toast('⚠️ No se pudo obtener GPS');
        if (btn) btn.textContent = 'Compartir ubicación actual';
    });
}

async function guardarCliente() {
    const n = document.getElementById('cNombre')?.value?.trim();
    const t = document.getElementById('cTel')?.value?.trim();
    const ci = document.getElementById('cCiudad')?.value;
    const d = document.getElementById('cDir')?.value?.trim();
    if (!n || !t || !ci || !d) { toast('⚠️ Complete los campos obligatorios (*)'); return; }

    try {
        await addDoc(collection(db, 'clientes'), {
            nombre: n, telefono: t, ciudad: ci, direccion: d,
            email: document.getElementById('cEmail')?.value || '',
            latitud: document.getElementById('cLat')?.value || null,
            longitud: document.getElementById('cLng')?.value || null,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });
        await cargarDatos();
        toast('✅ Cliente guardado');
    } catch (e) { toast('⚠️ Error al guardar'); }
}

function modalEditarCliente(cid) {
    const c = getCl(cid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre *</label><input class="fi" id="eNombre" value="${c.nombre}">
            <div class="fr">
                <div><label class="fl">Teléfono *</label><input class="fi" id="eTel" value="${c.telefono}" type="tel"></div>
                <div><label class="fl">Email</label><input class="fi" id="eEmail" value="${c.email || ''}"></div>
            </div>
            <label class="fl">Ciudad *</label>
            <select class="fi" id="eCiudad">
                ${CIUDADES.map(ci => `<option ${ci === c.ciudad ? 'selected' : ''}>${ci}</option>`).join('')}
            </select>
            <label class="fl">Dirección *</label><input class="fi" id="eDir" value="${c.direccion}">
            ${c.latitud ? `<div style="font-size:0.75rem;color:var(--green);margin-top:0.4rem;">✅ GPS registrado: ${c.latitud}, ${c.longitud}</div>` : ''}
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarCliente('${cid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarCliente(cid) {
    try {
        await updateDoc(doc(db, 'clientes', cid), {
            nombre: document.getElementById('eNombre').value,
            telefono: document.getElementById('eTel').value,
            email: document.getElementById('eEmail').value,
            ciudad: document.getElementById('eCiudad').value,
            direccion: document.getElementById('eDir').value
        });
        await cargarDatos();
        toast('✅ Cliente actualizado');
    } catch (e) { toast('⚠️ Error al actualizar'); }
}

function modalEliminarCliente(cid) {
    const c = getCl(cid);
    const eqs = getEquiposCliente(cid);
    const ss = getServiciosCliente(cid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Eliminar cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="confirm-box">
                <p>⚠️ ¿Eliminar <strong>${c.nombre}</strong>?</p>
                <p style="margin-top:5px;">Se eliminarán también <strong>${eqs.length} equipo(s)</strong> y <strong>${ss.length} servicio(s)</strong>.</p>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="eliminarCliente('${cid}')">🗑️ Sí, eliminar</button>
            </div>
        </div>
    </div>`);
}

async function eliminarCliente(cid) {
    try {
        const eids = getEquiposCliente(cid).map(e => e.id);
        for (const eid of eids) {
            const ss = getServiciosEquipo(eid);
            for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
            await deleteDoc(doc(db, 'equipos', eid));
        }
        await deleteDoc(doc(db, 'clientes', cid));
        await cargarDatos();
        goTo('clientes');
        toast('🗑️ Cliente eliminado');
    } catch (e) { toast('⚠️ Error al eliminar'); }
}

// ============================================
// CRUD EQUIPOS
// ============================================
function modalNuevoEquipo(cid) {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo equipo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Marca *</label><input class="fi" id="qMarca" placeholder="LG, Carrier..."></div>
                <div><label class="fl first">Modelo *</label><input class="fi" id="qModelo" placeholder="Inverter 24K..."></div>
            </div>
            <label class="fl">N° de serie</label>
            <input class="fi" id="qSerie" placeholder="Opcional">
            <label class="fl">Ubicación *</label>
            <input class="fi" id="qUbic" placeholder="Ej: Gerencia 2do piso">
            <label class="fl">Tipo de equipo</label>
            <input class="fi" id="qTipo" placeholder="Split, Cassette, Piso-techo...">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarEquipo('${cid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarEquipo(cid) {
    const m = document.getElementById('qMarca')?.value?.trim();
    const mo = document.getElementById('qModelo')?.value?.trim();
    const u = document.getElementById('qUbic')?.value?.trim();
    if (!m || !mo || !u) { toast('⚠️ Complete los campos obligatorios'); return; }
    try {
        await addDoc(collection(db, 'equipos'), {
            clienteId: cid, marca: m, modelo: mo,
            serie: document.getElementById('qSerie')?.value || 'S/N',
            ubicacion: u,
            tipo: document.getElementById('qTipo')?.value || ''
        });
        await cargarDatos();
        goTo('detalle', cid);
        toast('✅ Equipo guardado');
    } catch (e) { toast('⚠️ Error al guardar equipo'); }
}

// ============================================
// CRUD EQUIPOS — EDITAR / ELIMINAR
// ============================================
function modalEditarEquipo(eid) {
    const eq = getEq(eid);
    if (!eq) return;
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar equipo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Marca *</label><input class="fi" id="eMarca" value="${eq.marca}"></div>
                <div><label class="fl first">Modelo *</label><input class="fi" id="eModelo" value="${eq.modelo}"></div>
            </div>
            <label class="fl">N° de serie</label>
            <input class="fi" id="eSerie" value="${eq.serie || ''}">
            <label class="fl">Ubicación *</label>
            <input class="fi" id="eUbic" value="${eq.ubicacion}">
            <label class="fl">Tipo de equipo</label>
            <input class="fi" id="eTipoEq" value="${eq.tipo || ''}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarEquipo(eid) {
    const m = document.getElementById('eMarca')?.value?.trim();
    const mo = document.getElementById('eModelo')?.value?.trim();
    const u = document.getElementById('eUbic')?.value?.trim();
    if (!m || !mo || !u) { toast('⚠️ Complete los campos obligatorios'); return; }
    try {
        await updateDoc(doc(db, 'equipos', eid), {
            marca: m, modelo: mo,
            serie: document.getElementById('eSerie')?.value || 'S/N',
            ubicacion: u,
            tipo: document.getElementById('eTipoEq')?.value || ''
        });
        await cargarDatos();
        toast('✅ Equipo actualizado');
    } catch (e) { toast('⚠️ Error al actualizar equipo'); }
}

function modalEliminarEquipo(eid) {
    const eq = getEq(eid);
    if (!eq) return;
    const ss = getServiciosEquipo(eid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Eliminar equipo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="confirm-box">
                <p>⚠️ ¿Eliminar <strong>${eq.marca} ${eq.modelo}</strong>?</p>
                <p style="margin-top:5px;">Se eliminarán también <strong>${ss.length} servicio(s)</strong> asociados.</p>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="eliminarEquipo('${eid}')">🗑️ Sí, eliminar</button>
            </div>
        </div>
    </div>`);
}

async function eliminarEquipo(eid) {
    const eq = getEq(eid);
    try {
        const ss = getServiciosEquipo(eid);
        for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
        await deleteDoc(doc(db, 'equipos', eid));
        await cargarDatos();
        goTo('detalle', eq?.clienteId);
        toast('🗑️ Equipo eliminado');
    } catch (e) { toast('⚠️ Error al eliminar'); }
}

// ============================================
// EDITAR SERVICIO
// ============================================
// _esidActual guarda el id del servicio en edición y _fotosEditadas las fotos vigentes
let _esidActual = null;
let _fotosEditadas = [];

function renderFotosEdicion() {
    const MAX = 3;
    const row = document.getElementById('esFotoRow');
    const lbl = document.getElementById('esFotoLbl');
    if (!row) return;
    row.innerHTML = '';

    // Fotos existentes
    _fotosEditadas.forEach((src, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'position:relative;flex-shrink:0;';
        div.innerHTML = `<img src="${src}" style="width:76px;height:76px;border-radius:10px;object-fit:cover;border:0.5px solid #e2e8f0;display:block;">
            <button onclick="esFotoQuitar(${i})" style="position:absolute;top:3px;right:3px;background:rgba(220,38,38,0.88);color:white;border:none;border-radius:5px;width:20px;height:20px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>`;
        row.appendChild(div);
    });

    // Slots libres
    const libres = MAX - _fotosEditadas.length;
    for (let i = 0; i < libres; i++) {
        const slotIdx = _fotosEditadas.length + i;
        const div = document.createElement('div');
        div.id = `fslot${slotIdx}`;
        div.style.cssText = 'width:76px;height:76px;border-radius:10px;border:1.5px dashed #e2e8f0;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;position:relative;';
        div.innerHTML = `<div style="font-size:1.5rem;color:#94a3b8;line-height:1;">+</div>
            <div style="font-size:0.6rem;color:#94a3b8;margin-top:3px;">Foto ${slotIdx+1}</div>
            <input type="file" id="finput${slotIdx}" accept="image/*" style="display:none" onchange="esFotoAgregar(this,${slotIdx})">`;
        div.onclick = () => document.getElementById(`finput${slotIdx}`).click();
        row.appendChild(div);
    }

    if (lbl) lbl.textContent = `📷 Fotos del servicio (${_fotosEditadas.length} de ${MAX})`;
}

function esFotoQuitar(i) {
    _fotosEditadas.splice(i, 1);
    // resetear nuevas desde ese slot en adelante
    for (let j = i; j < 3; j++) fotosNuevas[j] = null;
    renderFotosEdicion();
}

function esFotoAgregar(input, idx) {
    if (!input.files || !input.files[0]) return;
    // idx relativo a slots libres — guardamos en fotosNuevas en posición correcta
    const nuevaPos = idx - _fotosEditadas.length;
    if (nuevaPos < 0 || nuevaPos > 2) return;
    fotosNuevas[nuevaPos] = input.files[0];
    // preview
    const reader = new FileReader();
    reader.onload = e => {
        const slot = document.getElementById(`fslot${idx}`);
        if (slot) {
            slot.style.border = '1.5px solid #2563eb';
            slot.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">
                <button onclick="esFotoNuevaQuitar(${nuevaPos},${idx})" style="position:absolute;top:3px;right:3px;background:rgba(220,38,38,0.88);color:white;border:none;border-radius:5px;width:20px;height:20px;font-size:10px;cursor:pointer;">✕</button>`;
            slot.onclick = null;
        }
    };
    reader.readAsDataURL(input.files[0]);
}

function esFotoNuevaQuitar(nuevaPos, slotIdx) {
    fotosNuevas[nuevaPos] = null;
    renderFotosEdicion();
}

function modalEditarServicio(sid) {
    const s = servicios.find(x => x.id === sid);
    if (!s) return;
    _esidActual = sid;
    _fotosEditadas = [...(s.fotos || [])];
    fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;

    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div>
                    <label class="fl first">Tipo *</label>
                    <select class="fi" id="esTipo">
                        <option ${s.tipo==='Mantenimiento'?'selected':''}>Mantenimiento</option>
                        <option ${s.tipo==='Reparación'?'selected':''}>Reparación</option>
                        <option ${s.tipo==='Instalación'?'selected':''}>Instalación</option>
                    </select>
                </div>
                <div>
                    <label class="fl first">Fecha *</label>
                    <input class="fi" type="date" id="esFecha" value="${s.fecha}">
                </div>
            </div>
            <label class="fl">Técnico *</label>
            <select class="fi" id="esTecnico">
                ${tecnicos.map(t => `<option ${t.nombre===s.tecnico?'selected':''}>${t.nombre}</option>`).join('')}
            </select>
            <label class="fl">Diagnóstico / Descripción *</label>
            <textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea>
            <label class="fl">Próximo mantenimiento</label>
            <input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento || ''}">
            <label class="fl" id="esFotoLbl" style="margin-top:0.7rem;">📷 Fotos del servicio</label>
            <div id="esFotoRow" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:0.4rem;"></div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" id="btnActServ" onclick="actualizarServicio('${sid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);

    setTimeout(() => renderFotosEdicion(), 50);
}

async function actualizarServicio(sid) {
    const desc = document.getElementById('esDesc')?.value?.trim();
    if (!desc) { toast('⚠️ Ingresa el diagnóstico'); return; }
    const btn = document.getElementById('btnActServ');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    try {
        let fotosFinales = [..._fotosEditadas];
        const fotosValidas = fotosNuevas.filter(Boolean);
        if (fotosValidas.length > 0) {
            if (btn) btn.textContent = '📤 Subiendo fotos...';
            const nuevasUrls = await Promise.all(fotosValidas.map(f => subirImagen(f)));
            fotosFinales = [...fotosFinales, ...nuevasUrls];
        }
        await updateDoc(doc(db, 'servicios', sid), {
            tipo: document.getElementById('esTipo').value,
            fecha: document.getElementById('esFecha').value,
            tecnico: document.getElementById('esTecnico').value,
            descripcion: desc,
            proximoMantenimiento: document.getElementById('esProx').value || null,
            fotos: fotosFinales
        });
        _fotosEditadas = [];
        fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;
        await cargarDatos();
        toast('✅ Servicio actualizado');
    } catch (e) {
        toast('⚠️ Error al actualizar');
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    }
}

// ============================================
// CRUD TÉCNICOS
// ============================================
function modalNuevoTecnico() {
    showModal(`<div class="modal" onclick="event.stopPropagation()" style="max-width:360px;">
        <div class="modal-h"><h3>Nuevo técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre completo *</label>
            <input class="fi" id="tNombre" placeholder="NOMBRE APELLIDO">
            <label class="fl">Teléfono *</label>
            <input class="fi" id="tTel" placeholder="31XXXXXXXX" type="tel">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button>
            </div>
        </div>
    </div>`);
}
function modalEditarTecnico(tid) {
    const t = tecnicos.find(x => x.id === tid);
    showModal(`<div class="modal" onclick="event.stopPropagation()" style="max-width:360px;">
        <div class="modal-h"><h3>Editar técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre *</label><input class="fi" id="etNombre" value="${t.nombre}">
            <label class="fl">Teléfono *</label><input class="fi" id="etTel" value="${t.telefono}" type="tel">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarTecnico('${tid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}
async function guardarTecnico() {
    const n = document.getElementById('tNombre')?.value?.trim();
    const t = document.getElementById('tTel')?.value?.trim();
    if (!n || !t) { toast('⚠️ Complete los campos'); return; }
    try {
        await addDoc(collection(db, 'tecnicos'), { nombre: n, telefono: t });
        await cargarDatos();
        toast('✅ Técnico guardado');
    } catch (e) { toast('⚠️ Error'); }
}
async function actualizarTecnico(tid) {
    try {
        await updateDoc(doc(db, 'tecnicos', tid), {
            nombre: document.getElementById('etNombre').value,
            telefono: document.getElementById('etTel').value
        });
        await cargarDatos();
        toast('✅ Técnico actualizado');
    } catch (e) { toast('⚠️ Error'); }
}
async function eliminarTecnico(tid) {
    if (!confirm('¿Eliminar este técnico?')) return;
    try {
        await deleteDoc(doc(db, 'tecnicos', tid));
        await cargarDatos();
        toast('🗑️ Técnico eliminado');
    } catch (e) { toast('⚠️ Error'); }
}

// ============================================
// RUTA PÚBLICA QR CON BOTÓN WHATSAPP
// ============================================
function manejarRutaQR() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/equipo/')) return false;
    const eid = hash.replace('#/equipo/', '');
    const e = getEq(eid);
    if (!e) return false;
    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const main = document.getElementById('mainContent');
    const topbar = document.querySelector('.topbar');
    const botnav = document.querySelector('.botnav');
    if (topbar) topbar.style.display = 'none';
    if (botnav) botnav.style.display = 'none';
    main.style.background = 'white';
    main.innerHTML = `<div style="max-width:600px;margin:0 auto;padding:1.5rem;">
        <div style="text-align:center;margin-bottom:1.5rem;">
            <img src="https://github.com/capacitADA/aircold/blob/main/AIRCOLD_LOGO.png?raw=true" style="max-height:65px;max-width:200px;object-fit:contain;margin-bottom:6px;" alt="AIRCOLD">
            <div style="font-size:0.75rem;color:#64748b;">Cúcuta · CL 23N #2-99 · 3174022372</div>
        </div>
        <div style="border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem;margin-bottom:1rem;background:#f8fafc;">
            <div style="font-size:1rem;font-weight:700;">📍 ${e.marca} ${e.modelo}</div>
            <div style="font-size:0.82rem;color:#475569;">Ubicación: ${e.ubicacion}</div>
            <div style="font-size:0.78rem;color:#475569;">Cliente: ${c?.nombre}</div>
            <div style="font-size:0.75rem;color:#94a3b8;">Serie: ${e.serie || 'N/A'}</div>
        </div>
        <div style="margin-bottom:1rem;">
            <button style="width:100%;background:#25D366;color:white;border:none;padding:14px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;"
                onclick="window.open('https://wa.me/573174022372?text=${encodeURIComponent('Hola, soy tu cliente ' + (c?.nombre || '') + ' y tengo una novedad con mi equipo ' + (e?.marca || '') + ' ' + (e?.modelo || '') + ' (' + (e?.ubicacion || '') + '), ¿podrías revisarlo?')}', '_blank')">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contactar técnico
            </button>
        </div>
        <div style="font-size:0.88rem;font-weight:700;margin-bottom:0.75rem;">Historial de servicios (${ss.length})</div>
        ${ss.map(s => `
        <div style="border:0.5px solid #bfdbfe;border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;background:white;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;">${s.tipo}</span>
                <span style="font-size:0.75rem;color:#94a3b8;">${fmtFecha(s.fecha)}</span>
            </div>
            <div style="font-size:0.82rem;color:#475569;">🔧 ${s.tecnico}</div>
            <div style="font-size:0.8rem;color:#64748b;margin-top:2px;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.75rem;color:#d97706;margin-top:3px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
                ${(s.fotos || []).map(f => `<img src="${f}" style="width:60px;height:60px;border-radius:6px;object-fit:cover;" loading="lazy">`).join('')}
            </div>
        </div>`).join('')}
        <div style="text-align:center;font-size:0.7rem;color:#94a3b8;margin-top:1rem;padding-top:0.75rem;border-top:0.5px solid #e2e8f0;">
            Generado por AIRCOLD · Sistema de Gestión HVAC
        </div>
    </div>`;
    return true;
}

// ============================================
// EXPORTAR FUNCIONES GLOBALES
// ============================================
window.goTo = goTo;
window.closeModal = closeModal;
window.filtrarClientes = filtrarClientes;
window.filtrarEquipos = filtrarEquipos;
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.modalNuevoCliente = modalNuevoCliente;
window.modalEditarCliente = modalEditarCliente;
window.modalEliminarCliente = modalEliminarCliente;
window.modalNuevoEquipo = modalNuevoEquipo;
window.modalNuevoServicio = modalNuevoServicio;
window.modalInformeTecnico = modalInformeTecnico;
window.modalRecordar = modalRecordar;
window.modalQR = modalQR;
window.modalNuevoTecnico = modalNuevoTecnico;
window.modalEditarTecnico = modalEditarTecnico;
window.generarInformePDF = generarInformePDF;
window.guardarCliente = guardarCliente;
window.guardarEquipo = guardarEquipo;
window.modalEditarEquipo = modalEditarEquipo;
window.actualizarEquipo = actualizarEquipo;
window.modalEliminarEquipo = modalEliminarEquipo;
window.eliminarEquipo = eliminarEquipo;
window.modalEditarServicio = modalEditarServicio;
window.esFotoQuitar = esFotoQuitar;
window.esFotoNuevaQuitar = esFotoNuevaQuitar;
window.esFotoAgregar = esFotoAgregar;
window.actualizarServicio = actualizarServicio;
window.guardarServicio = guardarServicio;
window.guardarTecnico = guardarTecnico;
window.actualizarCliente = actualizarCliente;
window.actualizarTecnico = actualizarTecnico;
window.eliminarCliente = eliminarCliente;
window.eliminarTecnico = eliminarTecnico;
window.onTipoChange = onTipoChange;
window.onFechaChange = onFechaChange;
window.onProxCheck = onProxCheck;
window.previewFoto = previewFoto;
window.borrarFoto = borrarFoto;
window.toggleCk = toggleCk;
window.volverDesdeInforme = volverDesdeInforme;
window.exportarPDFInforme = exportarPDFInforme;
window.obtenerGPS = obtenerGPS;
window.enviarWhatsApp = enviarWhatsApp;

// ============================================
// BOTTOM NAV
// ============================================
document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedClienteId = null;
        selectedEquipoId = null;
        goTo(btn.dataset.page);
    });
});

// ============================================
// INICIO
// ============================================
(async () => {
    await cargarDatos();
    if (!manejarRutaQR()) renderView();
})();