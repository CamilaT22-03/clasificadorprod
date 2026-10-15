// Mapa con Leaflet + OpenStreetMap. Busca basureros, contenedores y puntos de reciclaje en 1200 m.
(() => {
  const RADIO = 1200;
  const COLORES = { basurero: '#f2b705', contenedor: '#2e9e4f', reciclaje: '#2f7fd1' };
  const NOMBRES = { basurero: 'Basurero', contenedor: 'Contenedor', reciclaje: 'Punto de reciclaje' };
  const $ = id => document.getElementById(id);
  let mapa, capa;

  function iniciar() {
    mapa = L.map('map').setView([-16.5, -68.15], 12); // La Paz, Bolivia por defecto
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);
    capa = L.layerGroup().addTo(mapa);
  }

  function tipo(tags) {
    if (tags.amenity === 'recycling') return tags.recycling_type === 'container' ? 'contenedor' : 'reciclaje';
    if (tags.amenity === 'waste_disposal') return 'contenedor';
    return 'basurero';
  }

  async function buscar(lat, lon) {
    const estado = $('estado-mapa');
    estado.textContent = 'Buscando…';
    capa.clearLayers();
    mapa.setView([lat, lon], 16);
    L.circleMarker([lat, lon], { radius: 8, color: '#000', fillColor: '#fff', fillOpacity: 1 })
      .addTo(capa).bindPopup('Tú estás aquí');
    const q = `[out:json][timeout:20];(
      node["amenity"="waste_basket"](around:${RADIO},${lat},${lon});
      node["amenity"="recycling"](around:${RADIO},${lat},${lon});
      node["amenity"="waste_disposal"](around:${RADIO},${lat},${lon});
    );out;`;
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
      if (!r.ok) throw new Error(r.status);
      const datos = await r.json();
      for (const el of datos.elements) {
        const t = tipo(el.tags || {});
        L.circleMarker([el.lat, el.lon], { radius: 7, color: '#fff', weight: 2, fillColor: COLORES[t], fillOpacity: 1 })
          .addTo(capa).bindPopup(NOMBRES[t]);
      }
      estado.textContent = datos.elements.length
        ? `${datos.elements.length} lugares en ${RADIO} m.`
        : `No encontré lugares en ${RADIO} m. Prueba otra zona.`;
    } catch {
      estado.textContent = 'No pude consultar el mapa. Reintenta: hace falta internet.';
    }
  }

  async function porCiudad(texto) {
    const estado = $('estado-mapa');
    if (!texto.trim()) return;
    estado.textContent = 'Buscando el lugar…';
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(texto));
      const d = await r.json();
      if (!d.length) return (estado.textContent = 'No encontré ese lugar.');
      buscar(+d[0].lat, +d[0].lon);
    } catch {
      estado.textContent = 'No pude buscar el lugar. Reintenta: hace falta internet.';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    iniciar();
    $('btn-ubicacion').onclick = () => {
      if (!navigator.geolocation) return ($('estado-mapa').textContent = 'Tu navegador no da ubicación.');
      $('estado-mapa').textContent = 'Pidiendo tu ubicación…';
      navigator.geolocation.getCurrentPosition(
        p => buscar(p.coords.latitude, p.coords.longitude),
        () => ($('estado-mapa').textContent = 'No pude obtener tu ubicación. Prueba con una ciudad.')
      );
    };
    $('form-ciudad').onsubmit = e => { e.preventDefault(); porCiudad($('in-ciudad').value); };
  });
})();
