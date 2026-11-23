export const SUPABASE_URL = 'https://' + 'pripxtsriyxhafevokjg' + '.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_ShY2V3Oh7gB4ZHSBzI5o_Q_GSMxzmds';

const limpiarTel = (t) => String(t || '').replace(/\D/g, '');

async function apiRest(ruta, metodo = 'GET', cuerpo = null) {
  const op = {
    method: metodo,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'return=representation'
    }
  };
  if (cuerpo) op.body = JSON.stringify(cuerpo);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, op);
  const txt = await res.text();
  let datos = {};
  try { datos = txt ? JSON.parse(txt) : []; } catch (e) { throw new Error('Error de formato en servidor'); }
  if (!res.ok) throw new Error(datos.message || datos.error || 'Error en la base de datos');
  return datos;
}

export async function ingresarRider({ telefono, password }) {
  const tel = limpiarTel(telefono);
  if (tel.length < 6) throw new Error('Ingresa un número de teléfono válido.');
  const res = await apiRest(`perfiles?select=*&telefono=eq.${tel}&limit=1`);
  const perfil = Array.isArray(res) && res.length > 0 ? res.at(0) : null;
  if (!perfil) throw new Error('Repartidor no registrado.');
  if (perfil.rol !== 'repartidor') throw new Error('Esta cuenta no tiene permisos de repartidor.');
  if (String(perfil.password_hash || '') !== String(password || '').trim()) {
    throw new Error('Contraseña incorrecta.');
  }
  return perfil;
}

export async function obtenerPedidosRider(riderId) {
  const [todos, perf] = await Promise.all([
    apiRest('pedidos?select=*,perfiles(nombre_completo,telefono),pedido_detalles(*)&order=id.desc'),
    apiRest(`perfiles?select=*&id=eq.${riderId}&limit=1`)
  ]);
  const perfilActual = Array.isArray(perf) && perf.length > 0 ? perf.at(0) : null;
  return {
    pedidos: (todos || []).filter(p => p.rider_id === riderId),
    perfil: perfilActual
  };
}

export async function marcarPedidoEnCamino(pedidoId) {
  await apiRest(`pedidos?id=eq.${pedidoId}`, 'PATCH', {
    estado_rider: 'En camino'
  });
}

export async function completarEntregaRider(ped) {
  if (!ped.recibido_cliente) {
    throw new Error('El cliente aún no confirma "PEDIDO RECIBIDO" en su app.');
  }
  await apiRest(`pedidos?id=eq.${ped.id}`, 'PATCH', {
    estado: 'Completado',
    estado_rider: 'Entregado'
  });
}
