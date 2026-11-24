import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, TextInput, Image, Platform, Linking, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://' + 'pripxtsriyxhafevokjg' + '.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ShY2V3Oh7gB4ZHSBzI5o_Q_GSMxzmds';
const LOGO_RIDERS = require('./file_00000000ea0081f48c2e66d2ba5fd06d.png');

const ROJO = '#E50914';
const DORADO = '#FBBF24';
const FONDO = '#070709';
const TARJETA = '#121216';
const BORDE = '#252530';

const limpiarTel = (t) => {
  const n = String(t || '').replace(/\D/g, '');
  return n.length === 11 && n.startsWith('51') ? n.slice(2) : n;
};

function sonarAlertaRider() {
  try {
    if (Platform.OS !== 'web') {
      Vibration.vibrate();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t = ctx.currentTime;
    [987.77, 1318.51].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.15);
      g.gain.setValueAtTime(0.25, t + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.35);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.36);
    });
  } catch (e) {}
}

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
  try { datos = txt ? JSON.parse(txt) : []; } catch (e) { throw new Error('Error de formato'); }
  if (!res.ok) throw new Error(datos.message || datos.error || 'Error en servidor');
  return datos;
}

async function obtenerBonoPuntosRider() {
  try {
    const res = await apiRest('configuracion_pagos?select=titular&limit=1');
    const raw = (Array.isArray(res) && res.length > 0 ? res.at(0)?.titular : '') || '';
    const partes = String(raw).split('||DEL:');
    if (partes.length < 2) return 10;
    const nums = partes.at(1).split('|');
    const val = nums.at(5) !== undefined ? Number(nums.at(5)) : 10;
    return Number.isFinite(val) && val >= 0 ? val : 10;
  } catch (e) {
    return 10;
  }
}
export default function App() {
  const [rider, setRider] = useState(null);
  const [tel, setTel] = useState('');
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState('disponibles');
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const idsDisponiblesRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('sesion_oriental_riders').then(s => {
      if (s) setRider(JSON.parse(s));
    });
  }, []);

  useEffect(() => {
    if (!rider?.id) return;
    cargarPedidos();
    const timer = setInterval(cargarPedidos, 5000);
    return () => clearInterval(timer);
  }, [rider?.id]);

  useEffect(() => {
    const disp = (pedidos || []).filter(p => p.tipo_entrega === 'DELIVERY' && !p.rider_id && (p.estado === 'Listo' || p.estado_rider === 'Disponible'));
    if (idsDisponiblesRef.current === null) {
      idsDisponiblesRef.current = new Set(disp.map(p => p.id));
      return;
    }
    const nuevos = disp.filter(p => !idsDisponiblesRef.current.has(p.id));
    disp.forEach(p => idsDisponiblesRef.current.add(p.id));
    if (nuevos.length > 0) sonarAlertaRider();
  }, [pedidos]);

  async function cargarPedidos() {
    try {
      const res = await apiRest('pedidos?select=*,perfiles(nombre_completo,telefono),pedido_detalles(*)&order=creado_en.desc');
      setPedidos(res || []);
    } catch (e) {}
  }

  async function iniciarSesion() {
    const t = limpiarTel(tel);
    if (t.length < 6 || !pass.trim()) return alert('Ingresa teléfono y contraseña.');
    setCargando(true);
    try {
      const res = await apiRest(`perfiles?select=*&telefono=eq.${t}&limit=1`);
      const p = Array.isArray(res) && res.length > 0 ? res.at(0) : null;
      if (!p) throw new Error('Motorizado no registrado.');
      if (p.rol !== 'repartidor') throw new Error('Esta cuenta no tiene rol de repartidor.');
      if (String(p.password_hash || '') !== pass.trim()) throw new Error('Contraseña incorrecta.');
      setRider(p);
      await AsyncStorage.setItem('sesion_oriental_riders', JSON.stringify(p));
      sonarAlertaRider();
    } catch (e) {
      alert(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function cerrarSesion() {
    await AsyncStorage.removeItem('sesion_oriental_riders');
    setRider(null);
  }

  async function tomarPedido(ped) {
    setCargando(true);
    try {
      await apiRest(`pedidos?id=eq.${ped.id}`, 'PATCH', {
        rider_id: rider.id,
        rider_nombre: rider.nombre_completo,
        estado_rider: 'Recogiendo en local',
        estado: 'Listo'
      });
      await cargarPedidos();
      setTab('encurso');
    } catch (e) {
      alert(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function actualizarPasoRider(ped, paso) {
    setCargando(true);
    try {
      if (paso === 'En camino') {
        await apiRest(`pedidos?id=eq.${ped.id}`, 'PATCH', {
          estado_rider: 'En camino',
          estado: 'En camino'
        });
      } else if (paso === 'En la puerta') {
        await apiRest(`pedidos?id=eq.${ped.id}`, 'PATCH', {
          estado_rider: 'En la puerta'
        });
      } else if (paso === 'Entregado') {
        if (!ped.recibido_cliente) {
          alert('El cliente aún no ha confirmado "Pedido Recibido" en su app Club Sazón. Pídele que pulse el botón verde en su pantalla.');
          setCargando(false);
          return;
        }
        await apiRest(`pedidos?id=eq.${ped.id}`, 'PATCH', {
          estado_rider: 'Entregado',
          estado: 'Completado'
        });
        const bonoPts = await obtenerBonoPuntosRider();
        if (bonoPts > 0) {
          const perfilAct = await apiRest(`perfiles?select=puntos&id=eq.${rider.id}&limit=1`);
          const ptsActuales = Number((Array.isArray(perfilAct) && perfilAct.at(0)?.puntos) || rider.puntos || 0);
          const nuevosPts = ptsActuales + bonoPts;
          await apiRest(`perfiles?id=eq.${rider.id}`, 'PATCH', { puntos: nuevosPts });
          await apiRest('historial_puntos', 'POST', {
            perfil_id: rider.id,
            cantidad: bonoPts,
            descripcion: `Bono +${bonoPts} pts por entrega ${ped.numero_pedido}`
          });
          const riderAct = { ...rider, puntos: nuevosPts };
          setRider(riderAct);
          await AsyncStorage.setItem('sesion_oriental_riders', JSON.stringify(riderAct));
          alert(`¡Entrega finalizada! Ganaste S/ ${Number(ped.costo_delivery || 0).toFixed(2)} y +${bonoPts} puntos Club Sazón.`);
        } else {
          alert(`¡Entrega finalizada! Ganaste S/ ${Number(ped.costo_delivery || 0).toFixed(2)}.`);
        }
      }
      await cargarPedidos();
    } catch (e) {
      alert(e.message);
    } finally {
      setCargando(false);
    }
  }

  function abrirMapaRuta(ped) {
    const partes = String(ped.direccion || '').split('|');
    const linkMaps = partes.length > 1 ? partes.at(1).trim() : '';
    if (linkMaps.startsWith('http')) {
      Linking.openURL(linkMaps);
    } else {
      const q = encodeURIComponent(`${partes.at(0) || ''} ${ped.distrito || ''}`.trim());
      const mapsBase = 'https://google.com';
      Linking.openURL(`${mapsBase}${q}`);
    }
  }

  function contactarClienteWhatsApp(ped) {
    const telCli = String(ped.perfiles?.telefono || '').replace(/\D/g, '');
    if (!telCli) return alert('El cliente no tiene un teléfono registrado.');
    const telFinal = telCli.length === 9 ? '51' + telCli : telCli;
    const msg = encodeURIComponent(
      `Hola ${ped.perfiles?.nombre_completo || ''}, soy ${rider.nombre_completo}, tu repartidor de El Sazón Oriental. Ya estoy en camino / en la puerta con tu pedido ${ped.numero_pedido}.`
    );
    const baseWa = 'https://wa.me';
    Linking.openURL(`${baseWa}${telFinal}?text=${msg}`);
  }
    if (!rider) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: FONDO, justifyContent: 'center', padding: 22 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Image source={LOGO_RIDERS} style={{ width: 130, height: 130, borderRadius: 24, marginBottom: 12 }} resizeMode="contain" />
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: 1 }}>ORIENTAL RIDERS</Text>
          <Text style={{ color: DORADO, fontSize: 12, fontWeight: '800', marginTop: 4 }}>App Exclusiva para Repartidores</Text>
        </View>
        <TextInput
          style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', padding: 14, marginBottom: 12, fontSize: 15 }}
          placeholder="Número de teléfono"
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
          value={tel}
          onChangeText={setTel}
        />
        <TextInput
          style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', padding: 14, marginBottom: 16, fontSize: 15 }}
          placeholder="Contraseña"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={pass}
          onChangeText={setPass}
        />
        <TouchableOpacity
          style={{ backgroundColor: ROJO, borderRadius: 12, paddingVertical: 15, alignItems: 'center' }}
          onPress={iniciarSesion}
          disabled={cargando}
        >
          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{cargando ? 'INGRESANDO...' : 'INGRESAR A MI TURNO'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const disponibles = pedidos.filter(p => p.tipo_entrega === 'DELIVERY' && !p.rider_id && (p.estado === 'Listo' || p.estado_rider === 'Disponible'));
  const enCurso = pedidos.filter(p => p.rider_id === rider.id && p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const entregados = pedidos.filter(p => p.rider_id === rider.id && p.estado === 'Completado');
  const gananciaDelivery = entregados.reduce((acc, p) => acc + Number(p.costo_delivery || 0), 0);
  const efectivoPendienteCaja = entregados
    .filter(p => p.metodo_pago === 'Efectivo' && p.estado_rider !== 'Liquidado en caja')
    .reduce((acc, p) => acc + Number(p.total || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FONDO }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 34 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDE, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={LOGO_RIDERS} style={{ width: 42, height: 42, borderRadius: 10 }} />
            <View>
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{rider.nombre_completo}</Text>
              <Text style={{ color: DORADO, fontSize: 11, fontWeight: '800' }}>🛵 Motorizado • {rider.puntos || 0} pts</Text>
            </View>
          </View>
          <TouchableOpacity onPress={cerrarSesion} style={{ backgroundColor: '#252530', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>Salir</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: TARJETA, borderWidth: 1.5, borderColor: DORADO, borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '800' }}>HORARIO DE TRABAJO ASIGNADO:</Text>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', marginTop: 2 }}>{rider.direccion_predeterminada || 'Lun a Dom: 12:00 pm - 10:00 pm'}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { id: 'disponibles', label: `Disponibles (${disponibles.length})` },
              { id: 'encurso', label: `En ruta (${enCurso.length})` },
              { id: 'ganancias', label: 'Mis Pagos' },
              { id: 'historial', label: `Historial (${entregados.length})` }
            ].map(t => (
              <TouchableOpacity
                key={t.id}
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: tab === t.id ? ROJO : TARJETA, borderWidth: 1, borderColor: tab === t.id ? ROJO : BORDE }}
                onPress={() => setTab(t.id)}
              >
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
          {tab === 'disponibles' && (
          <View>
            {disponibles.length === 0 ? (
              <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: BORDE }}>
                <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No hay pedidos listos en cocina por ahora.</Text>
              </View>
            ) : (
              disponibles.map(p => (
                <View key={p.id} style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: DORADO }}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>{p.numero_pedido} • {p.perfiles?.nombre_completo || 'Cliente'}</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 13, marginTop: 4 }}>Destino: {p.distrito} - {String(p.direccion || '').split('|').at(0)}</Text>
                  <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 14, marginTop: 4 }}>Tu ganancia delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
                  <Text style={{ color: DORADO, fontSize: 12, marginTop: 2 }}>Cobro al cliente: S/ {Number(p.total || 0).toFixed(2)} ({p.metodo_pago})</Text>
                  <TouchableOpacity style={{ backgroundColor: ROJO, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 }} onPress={() => tomarPedido(p)} disabled={cargando}>
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>🛵 ACEPTAR ENTREGA</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'encurso' && (
          <View>
            {enCurso.length === 0 ? (
              <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: BORDE }}>
                <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No tienes entregas en curso.</Text>
              </View>
            ) : (
              enCurso.map(p => (
                <View key={p.id} style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: ROJO }}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>{p.numero_pedido} • {p.perfiles?.nombre_completo || 'Cliente'}</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 13, marginTop: 4 }}>Tel: {p.perfiles?.telefono || 'No registrado'}</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 13 }}>Dir: {p.distrito} - {String(p.direccion || '').split('|').at(0)}</Text>
                  <Text style={{ color: DORADO, fontWeight: '800', fontSize: 13, marginTop: 4 }}>
                    {p.metodo_pago === 'Efectivo' ? `💵 COBRAR EN EFECTIVO: S/ ${Number(p.total || 0).toFixed(2)}` : `✅ PAGADO CON ${p.metodo_pago.toUpperCase()} (NO COBRAR)`}
                  </Text>
                  <Text style={{ color: p.recibido_cliente ? '#22C55E' : '#F59E0B', fontWeight: '900', fontSize: 12, marginTop: 6 }}>
                    {p.recibido_cliente ? '✅ Cliente ya confirmó recepción en su app' : '⏳ Esperando que el cliente confirme recepción en su app'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#0284C7', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }} onPress={() => abrirMapaRuta(p)}>
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>🗺️ GOOGLE MAPS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#128C7E', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }} onPress={() => contactarClienteWhatsApp(p)}>
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>💬 WHATSAPP</Text>
                    </TouchableOpacity>
                  </View>

                  {p.estado_rider === 'Recogiendo en local' && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 8 }}
                      onPress={() => actualizarPasoRider(p, 'En camino')}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>📦 CONFIRMAR RECOGIDA (EN CAMINO)</Text>
                    </TouchableOpacity>
                  )}

                  {p.estado_rider === 'En camino' && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#D97706', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 8 }}
                      onPress={() => actualizarPasoRider(p, 'En la puerta')}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>🔔 ESTOY AQUÍ (EN LA PUERTA)</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={{ backgroundColor: p.recibido_cliente ? '#16A34A' : '#374151', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
                    onPress={() => actualizarPasoRider(p, 'Entregado')}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>
                      {p.recibido_cliente ? '✅ FINALIZAR ENTREGA (SUMAR GANANCIA)' : '🔒 BLOQUEADO HASTA CONFIRMACIÓN DEL CLIENTE'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'ganancias' && (
          <View>
            <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#16A34A', marginBottom: 12 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '800' }}>TUS GANANCIAS ACUMULADAS (DELIVERY)</Text>
              <Text style={{ color: '#22C55E', fontSize: 28, fontWeight: '900', marginTop: 4 }}>S/ {gananciaDelivery.toFixed(2)}</Text>
              <Text style={{ color: '#D1D5DB', fontSize: 12, marginTop: 4 }}>Entregas completadas: {entregados.length}</Text>
            </View>
            <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: efectivoPendienteCaja > 0 ? ROJO : BORDE }}>
              <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '800' }}>EFECTIVO COBRADO POR RENDIR A CAJA</Text>
              <Text style={{ color: efectivoPendienteCaja > 0 ? ROJO : '#22C55E', fontSize: 26, fontWeight: '900', marginTop: 4 }}>S/ {efectivoPendienteCaja.toFixed(2)}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
                {efectivoPendienteCaja > 0 ? 'Entrega este monto en caja al finalizar tu turno.' : 'No tienes efectivo pendiente por rendir.'}
              </Text>
            </View>
          </View>
        )}

        {tab === 'historial' && (
          <View>
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900', marginBottom: 10 }}>HISTORIAL DE ENTREGAS ({entregados.length})</Text>
            {entregados.length === 0 ? (
              <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: BORDE }}>
                <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Aún no tienes entregas completadas.</Text>
              </View>
            ) : (
              entregados.map(p => (
                <View key={p.id} style={{ backgroundColor: TARJETA, borderRadius: 12, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: BORDE }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>{p.numero_pedido} • {p.perfiles?.nombre_completo || 'Cliente'}</Text>
                    <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 14 }}>+S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 3 }}>{new Date(p.creado_en).toLocaleString()} • {p.metodo_pago}</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 12, marginTop: 3 }}>Destino: {p.distrito} - {String(p.direccion || '').split('|').at(0)}</Text>
                  {p.metodo_pago === 'Efectivo' && (
                    <Text style={{ color: p.estado_rider === 'Liquidado en caja' ? '#22C55E' : ROJO, fontSize: 11, fontWeight: '800', marginTop: 5 }}>
                      {p.estado_rider === 'Liquidado en caja'
                        ? `✅ Efectivo S/ ${Number(p.total || 0).toFixed(2)} liquidado en caja`
                        : `⏳ Efectivo S/ ${Number(p.total || 0).toFixed(2)} pendiente de rendir`}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
            }
                                   
