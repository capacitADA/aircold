// ============================================
// AIRCOLD - APP COMPLETA CON FIREBASE
// Mobile-first | Gestión HVAC
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs,
    deleteDoc, doc, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ===== CONFIGURACIÓN FIREBASE =====
const firebaseConfig = {
    apiKey: "AIzaSyDbwc3SoFP0oD3IfP93VHkXIATol-9Xxk0",
    authDomain: "aircold.firebaseapp.com",
    projectId: "aircold",
    storageBucket: "aircold.firebasestorage.app",
    messagingSenderId: "4322426258",
    appId: "1:4322426258:web:1ea189a051af97f636554b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ===== ESTADO GLOBAL =====
let clientes = [];
let equipos = [];
let servicios = [];
let tecnicos = [];
let currentView = 'panel';
let selectedClienteId = null;
let selectedEquipoId = null;
const fotosNuevas = [null, null, null]; // File objects para subir
const stExt = new Array(13).fill(false); // checklist exterior
const stInt = new Array(10).fill(false); // checklist interior

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
    // Resetear fotos
    fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;
}

// ===== CARGAR DATOS FIREBASE =====
async function cargarDatos() {
    try {
        const [cSnap, eSnap, sSnap, tSnap] = await Promise.all([
            getDocs(query(collection(db, 'clientes'), orderBy('nombre'))),
            getDocs(collection(db, 'equipos')),
            getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc'))),
            getDocs(collection(db, 'tecnicos'))
        ]);
        clientes = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        equipos = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        servicios = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Crear datos de ejemplo si la BD está vacía
        if (clientes.length === 0) {
            await crearDatosEjemplo();
            return;
        }
    } catch (e) {
        console.error('Error cargando datos:', e);
        toast('⚠️ Error de conexión. Verifica tu internet.');
    }
    renderView();
}

// ===== DATOS DE EJEMPLO =====
async function crearDatosEjemplo() {
    toast('📦 Creando datos de ejemplo...');
    try {
        // Cliente ejemplo
        const cliRef = await addDoc(collection(db, 'clientes'), {
            nombre: 'KATTY VELAZCO',
            telefono: '3043361259',
            email: '',
            ciudad: 'Cúcuta',
            direccion: 'Condominio Firenze casa C 22',
            latitud: null,
            longitud: null
        });

        // Técnico ejemplo
        const tecRef = await addDoc(collection(db, 'tecnicos'), {
            nombre: 'ORLANDO ORTIZ',
            telefono: '3174022372'
        });

        // Equipo ejemplo
        const eqRef = await addDoc(collection(db, 'equipos'), {
            clienteId: cliRef.id,
            marca: 'MABE',
            modelo: 'MMI12CABWCCCIII8',
            serie: 'WCCCIII8',
            ubicacion: 'HAB PPAL',
            tipo: 'Split',
            capacidad: '12.000 BTU'
        });

        // Servicio preventivo ejemplo
        const hoy = new Date().toISOString().split('T')[0];
        await addDoc(collection(db, 'servicios'), {
            equipoId: eqRef.id,
            tipo: 'Mantenimiento',
            fecha: hoy,
            tecnico: 'ORLANDO ORTIZ',
            descripcion: 'Mantenimiento preventivo. Limpieza de serpentines, filtros y rejillas. Revisión de drenajes. Sistema funcionando correctamente.',
            proximoMantenimiento: calcProxFecha(hoy),
            fotos: []
        });

        await cargarDatos();
    } catch (e) {
        console.error('Error creando ejemplos:', e);
        renderView();
    }
}

// ===== SUBIR IMAGEN A STORAGE (con compresión) =====
async function subirImagen(file) {
    // Comprimir antes de subir: máx 1024px, calidad 0.78
    const blob = await comprimirImagen(file, 1024, 0.78);
    const nombre = `fotos/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const storageRef = ref(storage, nombre);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
}

function comprimirImagen(file, maxPx, calidad) {
    return new Promise(resolve => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxPx || height > maxPx) {
                if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
                else { width = Math.round(width * maxPx / height); height = maxPx; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(b => resolve(b), 'image/jpeg', calidad);
        };
        img.src = url;
    });
}

// ===== NAVEGACIÓN =====
function goTo(view, cid = null, eid = null) {
    currentView = view;
    selectedClienteId = cid;
    selectedEquipoId = eid;
    closeModal();
    renderView();
    // Actualizar bottom nav
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

    const proximos = servicios
        .filter(s => s.proximoMantenimiento)
        .sort((a, b) => new Date(a.proximoMantenimiento) - new Date(b.proximoMantenimiento))
        .slice(0, 4);

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
                    <div class="panel-box-num">${clientes.filter(c => {
                        const ahora = new Date();
                        return true; // Podrías filtrar por fecha de creación
                    }).length}</div>
                    <div class="panel-box-lbl">EQUIPOS</div>
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
        ${proximos.length ? `
        <div class="prox-mant-card">
            <div class="prox-mant-title">📅 Próximos mantenimientos</div>
            ${proximos.map(s => {
                const e = getEq(s.equipoId);
                const c = getCl(e?.clienteId);
                return `<div class="prox-row">
                    <span style="flex:1;font-size:0.78rem;">${c?.nombre || ''}<br>
                    <span style="color:var(--hint);font-size:0.72rem;">${e?.marca || ''} ${e?.modelo || ''}</span></span>
                    <span class="badge b-amber">${fmtFecha(s.proximoMantenimiento)}</span>
                </div>`;
            }).join('')}
        </div>` : ''}
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
            <div class="ec-name">${e.marca} ${e.modelo}</div>
            <div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie || 'S/N'}</div>
            <div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s) registrado(s)</div>
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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
            <span style="font-size:0.88rem;font-weight:700;">Historial (${ss.length})</span>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
        </div>
        ${ss.length === 0 ? '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1rem;">Sin servicios registrados.</p>' : ''}
        ${ss.map(s => `
        <div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo === 'Mantenimiento' ? 'b-blue' : s.tipo === 'Reparación' ? 'b-red' : 'b-green'}">${s.tipo}</span>
                <span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
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
            <thead><tr>
                <th>Mes</th><th>Fecha</th><th>Cliente</th><th>Equipo</th><th></th>
            </tr></thead>
            <tbody>
            ${MESES.map((mes, idx) => {
                const mp = String(idx + 1).padStart(2, '0');
                const lista = mant.filter(m => m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                if (!lista.length) return `<tr>
                    <td style="color:var(--hint);font-size:0.72rem;background:var(--bg2);">${mes}</td>
                    <td colspan="4" style="color:#cbd5e1;font-size:0.7rem;">—</td>
                </tr>`;
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
                        <input type="file" id="finput${i}" accept="image/*" capture="environment"
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

    // Inicializar
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
                <input type="file" id="finput${idx}" accept="image/*" capture="environment"
                    style="display:none" onchange="previewFoto(this,${idx})">`;
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
            <input type="file" id="finput${idx}" accept="image/*" capture="environment"
                style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick = () => document.getElementById('finput' + idx).click();
    }
}

async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if (!desc) { toast('⚠️ Ingresa el diagnóstico'); return; }

    const btn = document.getElementById('btnGuardarServ');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

    try {
        const tipo = document.getElementById('sTipo').value;
        const proxChk = document.getElementById('proxCheck')?.checked;
        const prox = tipo === 'Mantenimiento' && proxChk
            ? document.getElementById('proxFecha').value
            : null;

        // Subir fotos
        const urlsFotos = [];
        toast('📤 Subiendo fotos...');
        for (const file of fotosNuevas.filter(Boolean)) {
            const url = await subirImagen(file);
            urlsFotos.push(url);
        }

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
        toast('✅ Servicio guardado');
        // Volver al historial
        const e = getEq(eid);
        if (e) goTo('historial', e.clienteId, eid);

    } catch (err) {
        console.error(err);
        toast('⚠️ Error al guardar. Intenta de nuevo.');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
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

function exportarPDFInforme(eid) {
    const diagInforme = document.getElementById('iDiag')?.value || '';
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const extSelec = CK_EXT.filter((_, i) => stExt[i]);
    const intSelec = CK_INT.filter((_, i) => stInt[i]);
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
  .logo-box { border: 2px solid #0f172a; padding: 4px 8px; font-weight: 700; font-size: 1rem; }
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
      <img src="AIRCOLD_LOGO.png" style="height:52px;object-fit:contain;" alt="AIRCOLD" onerror="this.outerHTML='<div style=&quot;font-size:1.1rem;font-weight:700;letter-spacing:2px;&quot;>AIRCOLD</div>'">
    </div>
    <div class="contact">Servicios de Refrigeración<br>Cll. 23N # 2-99 Prados Norte<br>3174022372 – 3232458563</div>
  </div>
  <table class="fields">
    <tr><td><span class="lbl">Entidad</span><br>${c?.nombre || ''}</td><td><span class="lbl">Ubicación del equipo</span><br>${e?.ubicacion || ''}</td></tr>
    <tr><td><span class="lbl">Marca de equipo</span><br>${e?.marca || ''}</td><td><span class="lbl">Modelo y serial</span><br>${e?.modelo || ''} · ${e?.serie || ''}</td></tr>
    <tr><td><span class="lbl">Fecha</span><br>${fecha}</td><td><span class="lbl">Valor</span><br>${valor || 'ΦΦΦ'}</td></tr>
  </table>
  <div class="section-title">Control de Mantenimiento</div>
  <div class="ck-grid">
    <div class="ck-col">
      <div class="ck-head">Unidad exterior (Condensadora)</div>
      ${CK_EXT.map((t, i) => `<div class="ck-row"><div class="cb ${stExt[i] ? 'on' : ''}">${stExt[i] ? '✓' : ''}</div><span>${t}</span></div>`).join('')}
    </div>
    <div class="ck-col">
      <div class="ck-head">Unidad interior (Manejadora)</div>
      ${CK_INT.map((t, i) => `<div class="ck-row"><div class="cb ${stInt[i] ? 'on' : ''}">${stInt[i] ? '✓' : ''}</div><span>${t}</span></div>`).join('')}
    </div>
  </div>
  <div class="diag"><div class="lbl">Diagnóstico técnico:</div>${diagInforme || ''}</div>
  <div class="firmas">
    <div class="firma"><div class="firma-lbl">Técnico</div><div class="firma-line"></div><div class="firma-name">${tec}</div></div>
    <div class="firma"><div class="firma-lbl">Cliente</div><div class="firma-line"></div><div class="firma-name">${cli}</div></div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        win.onload = () => setTimeout(() => win.print(), 300);
    }

    // Volver al servicio con el diagnóstico
    closeModal();
    modalNuevoServicio(eid);
    setTimeout(() => {
        const sDesc = document.getElementById('sDesc');
        if (sDesc && diagInforme) sDesc.value = diagInforme;
        toast('🖨️ PDF generado. Datos del servicio intactos.');
    }, 50);
}

// ============================================
// INFORME PDF HISTORIAL
// ============================================
async function generarInformePDF(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h">
            <h3>📄 Informe PDF</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">
            <div class="info-box" style="margin-bottom:0.65rem;">
                <div style="font-weight:700;">${c?.nombre}</div>
                <div style="font-size:0.82rem;color:var(--muted);">${e?.marca} ${e?.modelo} · ${e?.ubicacion}</div>
                <div style="font-size:0.75rem;color:var(--hint);">${ss.length} servicio(s) incluido(s)</div>
            </div>
            <div style="background:var(--blue-light);border:0.5px solid #93c5fd;border-radius:10px;padding:0.65rem;margin-bottom:0.65rem;font-size:0.8rem;color:#1e3a8a;">
                Las fotos se cargan desde Firebase Storage. El PDF espera a que todas las imágenes carguen.
            </div>
            <div class="fr">
                <div><label class="fl first">Firma técnico</label><input class="fi" id="firmaTec" value="${tecnicos[0]?.nombre || ''}"></div>
                <div><label class="fl first">Firma cliente</label><input class="fi" id="firmaCli" placeholder="Nombre"></div>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="imprimirInformePDF('${eid}')">🖨️ Generar PDF</button>
            </div>
        </div>
    </div>`);
}

function imprimirInformePDF(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const firmaTec = document.getElementById('firmaTec')?.value || '';
    const firmaCli = document.getElementById('firmaCli')?.value || '';

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
      <img src="AIRCOLD_LOGO.png" style="height:55px;object-fit:contain;" alt="AIRCOLD" onerror="this.style.display='none'">
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
      <div style="font-size:11px;font-weight:700;">${firmaTec}</div>
      <div style="font-size:10px;color:#64748b;">TÉCNICO</div>
    </div>
    <div class="firma">
      <div class="firma-line"></div>
      <div style="font-size:11px;font-weight:700;">${firmaCli || '___________'}</div>
      <div style="font-size:10px;color:#64748b;">CLIENTE</div>
    </div>
  </div>
  <div class="footer">Documento generado por AIRCOLD · Sistema de Gestión HVAC · ${new Date().toLocaleDateString('es-ES')}</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        // Esperar imágenes antes de imprimir
        win.onload = () => {
            const imgs = win.document.images;
            if (!imgs.length) { setTimeout(() => win.print(), 300); return; }
            let loaded = 0;
            const check = () => { loaded++; if (loaded >= imgs.length) setTimeout(() => win.print(), 300); };
            Array.from(imgs).forEach(img => {
                if (img.complete) check();
                else { img.onload = check; img.onerror = check; }
            });
        };
    }
    closeModal();
}

// ============================================
// MODAL: QR
// ============================================
function modalQR(eid) {
    const e = getEq(eid);
    const url = `${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    showModal(`<div class="modal" onclick="event.stopPropagation()" style="max-width:340px;">
        <div class="modal-h">
            <h3>📱 Código QR</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b" style="text-align:center;">
            <div style="font-size:0.88rem;font-weight:700;margin-bottom:4px;">${e?.marca} ${e?.modelo}</div>
            <div style="font-size:0.75rem;color:var(--hint);margin-bottom:0.8rem;">📍 ${e?.ubicacion}</div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}"
                style="border-radius:8px;margin-bottom:0.6rem;" alt="QR">
            <p style="font-size:0.65rem;color:var(--hint);word-break:break-all;">${url}</p>
            <div class="modal-foot" style="justify-content:center;margin-top:0.8rem;">
                <button class="btn btn-gray" onclick="closeModal()">Cerrar</button>
                <button class="btn btn-blue" onclick="window.print();toast('🖨️ Imprimiendo...')">🖨️ Imprimir</button>
            </div>
        </div>
    </div>`);
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
            longitud: document.getElementById('cLng')?.value || null
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
// RUTA PÚBLICA QR (historial público)
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
    document.querySelector('.topbar').style.display = 'none';
    document.querySelector('.botnav').style.display = 'none';
    main.style.background = 'white';
    main.innerHTML = `<div style="max-width:600px;margin:0 auto;padding:1.5rem;">
        <div style="text-align:center;margin-bottom:1.5rem;">
            <img src="AIRCOLD_LOGO.png" style="max-height:65px;max-width:200px;object-fit:contain;margin-bottom:6px;" alt="AIRCOLD" onerror="this.outerHTML='<div style=&quot;font-size:1.5rem;font-weight:700;letter-spacing:2px;color:#0f172a;&quot;>AIRCOLD</div>'">
            <div style="font-size:0.75rem;color:#64748b;">Cúcuta · CL 23N #2-99 · 3174022372</div>
        </div>
        <div style="border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem;margin-bottom:1rem;background:#f8fafc;">
            <div style="font-size:1rem;font-weight:700;">📍 ${e.marca} ${e.modelo}</div>
            <div style="font-size:0.82rem;color:#475569;">Ubicación: ${e.ubicacion}</div>
            <div style="font-size:0.78rem;color:#475569;">Cliente: ${c?.nombre}</div>
            <div style="font-size:0.75rem;color:#94a3b8;">Serie: ${e.serie || 'N/A'}</div>
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
window.imprimirInformePDF = imprimirInformePDF;
window.guardarCliente = guardarCliente;
window.guardarEquipo = guardarEquipo;
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
