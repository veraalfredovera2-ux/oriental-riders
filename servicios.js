export const SUPABASE_URL = 'https://' + 'pripxtsriyxhafevokjg' + '.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_ShY2V3Oh7gB4ZHSBzI5o_Q_GSMxzmds';

const limpiarTel = (t) => {
  const n = String(t || '').replace(/\D/g, '');
  return n.length === 11 && n.startsWith('51') ? n.slice(2) : n;
};

async function apiRest(ruta, metodo = 'GET', cuerpo = null) {
  const op = {
    method: metodo,
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

export async function ingresarRider(arg1, arg2) {
  const datos = typeof arg1 === 'object' && arg1 !== null
    ? arg1
    : { telefono: arg1, password: arg2 };
  const tel = limpiarTel(datos.telefono);
  const password = datos.password;
  const res = await apiRest(`perfiles?select=*&telefono=eq.${tel}&rol=eq.repartidor&limit=1`);
  const perfil = Array.isArray(res) && res.length > 0 ? res.at(0) : null;
  if (!perfil) throw new Error('Repartidor no encontrado. Verifica tu teléfono.');
  if (String(perfil.password_hash || '') !== String(password || '').trim()) {
    throw new Error('Contraseña incorrecta.');
  }
  return perfil;
}

export async function obtenerPedidosRider(riderId) {
  const [misPeds, libres, perfs] = await Promise.all([
    apiRest(`pedidos?select=*,perfiles(nombre_completo,telefono)&rider_id=eq.${riderId}&order=creado_en.desc`),
    apiRest(`pedidos?select=*,perfiles(nombre_completo,telefono)&tipo_entrega=eq.DELIVERY&estado=eq.Listo&rider_id=is.null&order=creado_en.desc`),
    apiRest(`perfiles?select=*&id=eq.${riderId}&limit=1`)
  ]);
  return {
    pedidos: Array.isArray(misPeds) ? misPeds : [],
    disponibles: Array.isArray(libres) ? libres : [],
    perfil: Array.isArray(perfs) && perfs.length > 0 ? perfs.at(0) : null
  };
}

export async function aceptarPedidoDisponibleRider(pedidoId, rider) {
  const actualizado = await apiRest(`pedidos?id=eq.${pedidoId}&rider_id=is.null`, 'PATCH', {
    rider_id: rider.id,
    rider_nombre: rider.nombre_completo,
    estado_rider: 'Aceptado por repartidor'
  });
  if (!Array.isArray(actualizado) || actualizado.length === 0) {
    throw new Error('Otro repartidor ya tomó este pedido.');
  }
}

export async function marcarPedidoRecogidoRider(pedidoId) {
  await apiRest(`pedidos?id=eq.${pedidoId}`, 'PATCH', {
    estado: 'En camino',
    estado_rider: 'En camino'
  });
}

export async function completarEntregaRider(ped) {
  if (!ped.recibido_cliente) {
    throw new Error('El cliente aún no ha pulsado "Pedido recibido" en su app.');
  }
  await apiRest(`pedidos?id=eq.${ped.id}`, 'PATCH', {
    estado: 'Completado',
    estado_rider: 'Entregado'
  });
}
