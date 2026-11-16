const ID_PROYECTO = 'pripxtsriyxhafevokjg';
export const SUPABASE_URL = 'https://' + ID_PROYECTO + '.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByaXB4dHNyaXl4aGFmZXZva2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTEzMDMsImV4cCI6MjEwOTQ4NzMwM30.uECAPmu6zRj4hN0Jrfq-3dWT49Dfm9fdM3Vb0HbWfOw';

const limpiarTel = (t) => String(t || '').replace(/\D/g, '');

async function apiRest(ruta, metodo = 'GET', cuerpo = null) {
  const op = { method: metodo, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, Prefer: 'return=representation' } };
  if (cuerpo) op.body = JSON.stringify(cuerpo);
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + ruta, op);
  const txt = await res.text();
  let datos = [];
  try { datos = txt ? JSON.parse(txt) : []; } catch (e) { throw new Error('Error de red (' + res.status + ')'); }
  if (!res.ok) throw new Error(datos.message || datos.error || 'Error ' + res.status);
  return datos;
}

export async function ingresarRider({ telefono, password }) {
  const tel = limpiarTel(telefono);
  const pass = encodeURIComponent(String(password || '').trim());
  const r = await apiRest(`riders?telefono=eq.${tel}&password=eq.${pass}&select=*`);
  if (!r?.length) throw new Error('Teléfono o contraseña de repartidor incorrectos.');
  return r.at(0);
}

export const actualizarEstadoRider = (id, disponible) => apiRest('riders?id=eq.' + id, 'PATCH', { disponible });

export const obtenerEnviosDelivery = () => apiRest('pedidos?tipo_entrega=eq.DELIVERY&order=creado_en.desc&select=*,clientes(nombre_completo,telefono),pedido_detalles(*)');

export async function aceptarEnvioRider(pedido, rider) {
  const actual = await apiRest('pedidos?id=eq.' + pedido.id + '&select=rider_id,estado');
  if (actual?.at(0)?.rider_id) throw new Error('Otro repartidor acaba de tomar este pedido.');
  if (actual?.at(0)?.estado === 'Cancelado') throw new Error('Este pedido fue cancelado.');
  await apiRest('pedidos?id=eq.' + pedido.id, 'PATCH', { rider_id: rider.id, rider_nombre: rider.nombre_completo, rider_telefono: rider.telefono, estado_rider: 'En camino a recoger' });
}

export const marcarRetiradoLocal = (pedidoId) => apiRest('pedidos?id=eq.' + pedidoId, 'PATCH', { estado_rider: 'Retirado - En camino al cliente' });

export async function marcarEntregadoCliente(pedido) {
  await apiRest('pedidos?id=eq.' + pedido.id, 'PATCH', { confirmado_admin: true, recibido_cliente: true, estado: 'Completado', estado_rider: 'Entregado al cliente' });
  const yaDados = await apiRest('movimientos_puntos?pedido_id=eq.' + pedido.id + '&tipo=eq.compra&select=cantidad');
  if (!yaDados?.length) {
    const pts = Math.floor(Number(pedido.subtotal || pedido.total || 0) * 10);
    if (pts > 0) await apiRest('movimientos_puntos', 'POST', { cliente_id: pedido.cliente_id, pedido_id: pedido.id, tipo: 'compra', cantidad: pts, descripcion: 'Compra pedido ' + pedido.numero_pedido + ' (10 pts x sol)' });
  }
}
