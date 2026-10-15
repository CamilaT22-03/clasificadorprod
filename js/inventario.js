// Inventario guardado en este navegador (localStorage).
const CLAVE = 'reciclaapp-inventario-v1';

const Inventario = {
  leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || []; }
    catch { return []; }
  },
  guardar(filas) {
    try { localStorage.setItem(CLAVE, JSON.stringify(filas)); } catch {}
  },
  agregar({ cantidad, confianza, cajas }) {
    const filas = this.leer();
    filas.unshift({
      id: Date.now() + Math.random().toString(16).slice(2),
      etiqueta: 'Botella',
      fecha: new Date().toISOString(),
      cantidad, confianza, cajas
    });
    this.guardar(filas);
    this.pintar();
  },
  cambiarCantidad(id, cantidad) {
    const filas = this.leer();
    const f = filas.find(x => x.id === id);
    if (f) { f.cantidad = Math.max(0, Math.floor(cantidad) || 0); this.guardar(filas); this.pintar(); }
  },
  borrar(id) {
    this.guardar(this.leer().filter(x => x.id !== id));
    this.pintar();
  },
  vaciar() {
    if (confirm('¿Borrar todo el inventario?')) { this.guardar([]); this.pintar(); }
  },
  total() { return this.leer().reduce((s, f) => s + f.cantidad, 0); },
  pintar() {
    const filas = this.leer();
    const tbody = document.getElementById('tabla');
    tbody.innerHTML = '';
    for (const f of filas) {
      const tr = document.createElement('tr');
      const conf = Math.round(f.confianza * 100);
      const fecha = new Date(f.fecha).toLocaleString('es');
      tr.innerHTML = `<td>${f.etiqueta}<br><small>${fecha}</small></td>
        <td>${conf}%${f.confianza < 0.6 ? ' ⚠️' : ''}</td>
        <td><input type="number" min="0" value="${f.cantidad}" aria-label="Cantidad"></td>
        <td><button aria-label="Borrar fila">✕</button></td>`;
      tr.querySelector('input').onchange = e => this.cambiarCantidad(f.id, +e.target.value);
      tr.querySelector('button').onclick = () => this.borrar(f.id);
      tbody.appendChild(tr);
    }
    const t = this.total();
    document.getElementById('vacio').hidden = filas.length > 0;
    document.getElementById('total-inv').textContent = `${t} botella${t === 1 ? '' : 's'}`;
    document.getElementById('total-top').textContent = t;
  },
  descargar(nombre, texto, tipo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  json() { this.descargar('inventario.json', JSON.stringify(this.leer(), null, 2), 'application/json'); },
  csv() {
    const filas = this.leer();
    const lineas = ['fecha,etiqueta,cantidad,confianza,cajas'];
    for (const f of filas) {
      lineas.push([f.fecha, f.etiqueta, f.cantidad, f.confianza.toFixed(3), `"${JSON.stringify(f.cajas).replace(/"/g, '""')}"`].join(','));
    }
    this.descargar('inventario.csv', lineas.join('\n'), 'text/csv');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Inventario.pintar();
  document.getElementById('btn-json').onclick = () => Inventario.json();
  document.getElementById('btn-csv').onclick = () => Inventario.csv();
  document.getElementById('btn-vaciar').onclick = () => Inventario.vaciar();
});
