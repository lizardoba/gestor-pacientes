// CONFIGURACIÓN Y VARIABLES GLOBALES
let pacientes = [];
let configGitHub = {
    token: localStorage.getItem('githubToken') || '',
    user: localStorage.getItem('githubUser') || 'lizardoba',
    repo: localStorage.getItem('githubRepo') || 'gestor-pacientes',
    branch: 'main',
    filePath: 'datos-pacientes.json'
};

let fileSHA = null;

// INICIALIZAR APLICACIÓN
document.addEventListener('DOMContentLoaded', () => {
    cargarPacientes();
    actualizarEstadisticas();
    configurarEventos();
    verificarConfigGitHub();
});

function verificarConfigGitHub() {
    if (!configGitHub.token) {
        document.getElementById('alertConfig').style.display = 'block';
    } else {
        document.getElementById('alertConfig').style.display = 'none';
    }
}

function mostrarConfig() {
    document.getElementById('githubConfig').style.display = 'block';
}

function ocultarConfig() {
    document.getElementById('githubConfig').style.display = 'none';
}

function guardarConfigGitHub() {
    configGitHub.token = document.getElementById('githubToken').value;
    configGitHub.user = document.getElementById('githubUser').value;
    configGitHub.repo = document.getElementById('githubRepo').value;
    
    localStorage.setItem('githubToken', configGitHub.token);
    localStorage.setItem('githubUser', configGitHub.user);
    localStorage.setItem('githubRepo', configGitHub.repo);
    
    ocultarConfig();
    verificarConfigGitHub();
    alert('✅ Configuración guardada correctamente');
}

// FUNCIONES DE BÚSQUEDA
function configurarEventos() {
    document.getElementById('searchInput').addEventListener('keyup', buscarPacientes);
    document.getElementById('tipoSearch').addEventListener('change', buscarPacientes);
    document.getElementById('formPaciente').addEventListener('submit', agregarPaciente);
    document.getElementById('btnSync').addEventListener('click', sincronizarGitHub);
}

function buscarPacientes() {
    const busqueda = document.getElementById('searchInput').value.toLowerCase();
    const tipo = document.getElementById('tipoSearch').value;
    const resultados = document.getElementById('resultadosBusqueda');
    
    if (!busqueda) {
        resultados.innerHTML = '';
        return;
    }
    
    let pacientesFiltrados = pacientes.filter(p => {
        if (tipo === 'codigo') return p.codigo.toLowerCase().includes(busqueda);
        if (tipo === 'nombre') return p.nombre.toLowerCase().includes(busqueda);
        if (tipo === 'apellido') return p.apellido.toLowerCase().includes(busqueda);
        return p.codigo.toLowerCase().includes(busqueda) || 
               p.nombre.toLowerCase().includes(busqueda) ||
               p.apellido.toLowerCase().includes(busqueda);
    });
    
    if (pacientesFiltrados.length === 0) {
        resultados.innerHTML = '<p class="empty-message">No se encontraron resultados</p>';
        return;
    }
    
    resultados.innerHTML = pacientesFiltrados.map(p => `
        <div class="search-result-card">
            <strong>${p.codigo}</strong> - ${p.nombre} ${p.apellido}
            <button onclick="mostrarPaciente('${p.codigo}')" class="btn btn-small">Ver</button>
            <button onclick="editarPaciente('${p.codigo}')" class="btn btn-small">Editar</button>
        </div>
    `).join('');
}

// AGREGAR PACIENTE
function agregarPaciente(e) {
    e.preventDefault();
    
    const codigo = document.getElementById('codigo').value;
    if (pacientes.find(p => p.codigo === codigo)) {
        alert('⚠️ Este código de paciente ya existe');
        return;
    }
    
    const nuevoPaciente = {
        codigo: codigo,
        nombre: document.getElementById('nombre').value,
        apellido: document.getElementById('apellido').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value,
        diagnostico: document.getElementById('diagnostico').value,
        tratamiento: document.getElementById('tratamiento').value,
        estado: document.getElementById('estado').value,
        fechaCreacion: new Date().toISOString()
    };
    
    pacientes.push(nuevoPaciente);
    guardarPacientes();
    sincronizarGitHub();
    document.getElementById('formPaciente').reset();
    actualizarLista();
    actualizarEstadisticas();
    alert('✅ Paciente agregado exitosamente');
}

// FUNCIONES DE ALMACENAMIENTO LOCAL
function cargarPacientes() {
    const datos = localStorage.getItem('pacientes');
    if (datos) {
        pacientes = JSON.parse(datos);
        actualizarLista();
    }
}

function guardarPacientes() {
    localStorage.setItem('pacientes', JSON.stringify(pacientes));
}

// ACTUALIZAR LISTA DE PACIENTES
function actualizarLista() {
    const lista = document.getElementById('listaPacientes');
    if (pacientes.length === 0) {
        lista.innerHTML = '<p class="empty-message">No hay pacientes registrados</p>';
        return;
    }
    
    lista.innerHTML = pacientes.map(p => `
        <div class="patient-card">
            <div class="patient-header">
                <h3>${p.codigo} - ${p.nombre} ${p.apellido}</h3>
                <span class="estado-badge estado-${p.estado.toLowerCase()}">${p.estado}</span>
            </div>
            <div class="patient-info">
                <p><strong>Email:</strong> ${p.email || 'N/A'}</p>
                <p><strong>Teléfono:</strong> ${p.telefono || 'N/A'}</p>
                <p><strong>Tratamiento:</strong> ${p.tratamiento}</p>
                <p><strong>Diagnóstico:</strong> ${p.diagnostico || 'N/A'}</p>
            </div>
            <div class="patient-actions">
                <button onclick="editarPaciente('${p.codigo}')" class="btn btn-secondary">✏️ Editar</button>
                <button onclick="eliminarPaciente('${p.codigo}')" class="btn btn-danger">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

// ESTADÍSTICAS
function actualizarEstadisticas() {
    const total = pacientes.length;
    const activos = pacientes.filter(p => p.estado === 'Activo').length;
    const completados = pacientes.filter(p => p.estado === 'Completado').length;
    
    document.getElementById('totalPacientes').textContent = total;
    document.getElementById('pacientesActivos').textContent = activos;
    document.getElementById('pacientesCompletados').textContent = completados;
}

// SINCRONIZACIÓN CON GITHUB
async function sincronizarGitHub() {
    if (!configGitHub.token) {
        alert('⚠️ Configura tu token de GitHub primero');
        mostrarConfig();
        return;
    }
    
    const statusEl = document.getElementById('statusSync');
    const btnSync = document.getElementById('btnSync');
    
    try {
        statusEl.textContent = '⏳ Sincronizando...';
        btnSync.disabled = true;
        
        // Obtener SHA del archivo actual si existe
        await obtenerSHA();
        
        // Preparar contenido
        const contenido = JSON.stringify(pacientes, null, 2);
        const datosBase64 = btoa(unescape(encodeURIComponent(contenido)));
        
        // Construir URL de la API
        const url = `https://api.github.com/repos/${configGitHub.user}/${configGitHub.repo}/contents/${configGitHub.filePath}`;
        
        // Preparar payload
        const payload = {
            message: `Actualización de datos - ${new Date().toLocaleString('es-ES')}`,
            content: datosBase64,
            branch: configGitHub.branch
        };
        
        if (fileSHA) {
            payload.sha = fileSHA;
        }
        
        // Hacer PUT request
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${configGitHub.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const data = await response.json();
            fileSHA = data.content.sha;
            statusEl.textContent = '✅ Sincronizado';
            setTimeout(() => {
                statusEl.textContent = '';
                btnSync.disabled = false;
            }, 3000);
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Error en la sincronización');
        }
    } catch (error) {
        console.error('Error:', error);
        statusEl.textContent = `❌ Error: ${error.message}`;
        btnSync.disabled = false;
    }
}

async function obtenerSHA() {
    try {
        const url = `https://api.github.com/repos/${configGitHub.user}/${configGitHub.repo}/contents/${configGitHub.filePath}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${configGitHub.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            fileSHA = data.sha;
        }
    } catch (error) {
        console.error('Error obteniendo SHA:', error);
    }
}

// EXPORTAR E IMPORTAR
function exportarJSON() {
    const dataStr = JSON.stringify(pacientes, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pacientes-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function importarJSON() {
    document.getElementById('fileInput').click();
}

document.getElementById('fileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                pacientes = JSON.parse(event.target.result);
                guardarPacientes();
                actualizarLista();
                actualizarEstadisticas();
                sincronizarGitHub();
                alert('✅ Datos importados exitosamente');
            } catch (error) {
                alert('❌ Error al importar: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
});

// ELIMINAR PACIENTE
function eliminarPaciente(codigo) {
    if (confirm(`¿Eliminar a ${codigo}?`)) {
        pacientes = pacientes.filter(p => p.codigo !== codigo);
        guardarPacientes();
        sincronizarGitHub();
        actualizarLista();
        actualizarEstadisticas();
        alert('✅ Paciente eliminado');
    }
}

// EDITAR PACIENTE (placeholder)
function editarPaciente(codigo) {
    alert('Función de edición en desarrollo');
}

// MOSTRAR PACIENTE
function mostrarPaciente(codigo) {
    const paciente = pacientes.find(p => p.codigo === codigo);
    if (paciente) {
        alert(`Paciente: ${paciente.nombre} ${paciente.apellido}\nEstado: ${paciente.estado}\nTratamiento: ${paciente.tratamiento}`);
    }
}
