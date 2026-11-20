const ID_PROYECTO = 'pripxtsriyxhafevokjg';
const SUPABASE_URL = 'https://' + ID_PROYECTO + '.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ShY2V3Oh7gB4ZHSBzI5o_Q_GSMxzmds';

const limpiarTel = (t) => String(t || '').replace(/\D/g, '');

async function apiRest(ruta, metodo = 'GET', cuerpo = null) {
  const op = { method: metodo, cache: 'no-store', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Prefer: 'return=representation' } };
  if (cuerpo) op.body = JSON.stringify(cuerpo);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, op);
  const txt = await res.text();
  let datos = [];
  try { datos = txt ? JSON.parse(txt) : []; } catch (e) { throw new Error('Error de formato en servidor'); }
  if (!res.ok) throw new Error(datos.message || datos.error || 'Error en la base de datos');
  return datos;
}

export async function ingresarRider({ telefono, password }) {
  const tel = limpiarTel(telefono);
  const res = await apiRest(`riders?telefono=eq.${tel}&password=eq.${encodeURIComponent(password)}&select=*`);
  if (!res?.length) throw new Error('Teléfono o contraseña de repartidor incorrectos.');
  const rider = res.at(0);
  if (rider.activo === false) throw new Error('Tu cuenta de repartidor está desactivada.');
  return rider;
}

export const actualizarEstadoRider = (id, disponible) => apiRest(`riders?id=eq.${id}`, 'PATCH', { disponible: Boolean(disponible) });

export const obtenerEnviosDelivery = () => apiRest('pedidos?tipo_entrega=eq.DELIVERY&order=creado_en.desc&select=*,clientes(nombre_completo),pedido_detalles(*)');

export async function aceptarEnvioRider(pedido, rider) {
  const actual = await apiRest(`pedidos?id=eq.${pedido.id}&select=rider_id,estado`);
  const reg = actual.at(0);
  if (!reg || reg.estado !== 'Confirmado por local' || reg.rider_id) {
    throw new Error('Otro repartidor ya tomó este pedido o fue cancelado.');
  }
  await apiRest(`pedidos?id=eq.${pedido.id}`, 'PATCH', { rider_id: rider.id, rider_nombre: rider.nombre_completo, estado_rider: 'Asignado al repartidor' });
}

export const marcarRetiradoLocal = (id) => apiRest(`pedidos?id=eq.${id}`, 'PATCH', { estado_rider: 'En camino a recoger' });

export async function marcarEntregadoCliente(pedido) {
  const actual = await apiRest(`pedidos?id=eq.${pedido.id}&select=recibido_cliente,estado`);
  const reg = actual.at(0);
  if (reg?.estado === 'Cancelado') throw new Error('Este pedido fue cancelado.');
  if (!reg?.recibido_cliente) {
    throw new Error('Pide al cliente que pulse "YA RECIBÍ MI PEDIDO" en su app primero.');
  }
  await apiRest(`pedidos?id=eq.${pedido.id}`, 'PATCH', { estado_rider: 'Entregado por rider', estado: 'Completado' });
}
