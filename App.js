import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, TextInput, Image, Platform, Linking, Vibration, Modal, StatusBar } from 'react-native';
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
      Vibration.vibrate(new Array(0, 350, 150, 350, 150, 450));
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(new Array(350, 150, 350, 150, 450));
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t = ctx.currentTime;
    new Array(987.77, 1318.51).forEach((f, i) => {
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
    const raw = (Array.isArray(res) && res.length > 0 ? res.at(0).titular : '') || '';
    const partes = String(raw).split('||DEL:');
    if (partes.length < 2) return 10;
    const nums = partes.at(1).split('|');
    const val = nums.at(5) !== undefined ? Number(nums.at(5)) : 10;
    return Number.isFinite(val) && val >= 0 ? val : 10;
  } catch (e) {
    return 10;
  }
}

function VentanaAvisoRider({ aviso, onCerrar }) {
  return (
    <Modal transparent animationType="fade" visible={Boolean(aviso)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: TARJETA, borderRadius: 18, borderWidth: 1.5, borderColor: DORADO, padding: 20, alignItems: 'center' }}>
          <Image source={LOGO_RIDERS} style={{ width: 52, height: 52, borderRadius: 12, marginBottom: 10 }} />
          <Text style={{ color: DORADO, fontWeight: '900', fontSize: 17, textAlign: 'center', marginBottom: 6 }}>{aviso?.titulo}</Text>
          <Text style={{ color: '#E5E7EB', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 16 }}>{aviso?.mensaje}</Text>
          <TouchableOpacity style={{ width: '100%', backgroundColor: ROJO, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }} onPress={onCerrar}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>ENTENDIDO</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
export default function App() {
  const [rider, setRider] = useState(null);
  const [tel, setTel] = useState('');
  const [clave, setClave] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [tab, setTab] = useState('disponibles');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const conocidosRef = useRef(null);

  const mostrarAviso = (titulo, mensaje) => setAviso({ titulo, mensaje });

  useEffect(() => {
    AsyncStorage.getItem('session_oriental_rider').then(s => {
      if (s) setRider(JSON.parse(s));
    });
  }, []);

  useEffect(() => {
    if (!rider?.id) return;
    cargarTodo();
    const t = setInterval(cargarTodo, 4000);
    return () => clearInterval(t);
  }, [rider?.id]);

  async function cargarTodo() {
    try {
      const [peds, perfs] = await Promise.all([
        apiRest('pedidos?select=*,perfiles(nombre_completo,telefono),pedido_detalles(*)&tipo_entrega=eq.DELIVERY&order=creado_en.desc'),
        apiRest(`perfiles?select=puntos&id=eq.${rider.id}&limit=1`)
      ]);
      const lista = peds || [];
      if (conocidosRef.current === null) {
        conocidosRef.current = new Set(lista.filter(p => p.estado === 'Listo' && !p.rider_id).map(p => p.id));
      } else {
        const nuevos = lista.filter(p => p.estado === 'Listo' && !p.rider_id && !conocidosRef.current.has(p.id));
        lista.forEach(p => { if (p.estado === 'Listo' && !p.rider_id) conocidosRef.current.add(p.id); });
        if (nuevos.length > 0) sonarAlertaRider();
      }
      setPedidos(lista);
      if (Array.isArray(perfs) && perfs.length > 0) {
        setRider(prev => prev ? { ...prev, puntos: Number(perfs.at(0).puntos || 0) } : prev);
      }
    } catch (e) {}
  }

  async function ingresarRider() {
    const tLimpio = limpiarTel(tel);
    if (tLimpio.length < 6 || !clave.trim()) return mostrarAviso('Datos incompletos', 'Ingresa tu teléfono y contraseña.');
    setCargando(true);
    try {
      const res = await apiRest(`perfiles?select=*&telefono=eq.${tLimpio}&limit=1`);
      const perfil = Array.isArray(res) && res.length > 0 ? res.at(0) : null;
      if (!perfil || perfil.rol !== 'repartidor') throw new Error('Esta cuenta no está registrada como repartidor.');
      if (String(perfil.password_hash || '') !== clave.trim()) throw new Error('Contraseña incorrecta.');
      setRider(perfil);
      await AsyncStorage.setItem('session_oriental_rider', JSON.stringify(perfil));
    } catch (e) {
      mostrarAviso('Error de acceso', e.message);
    } finally {
      setCargando(false);
    }
  }

  async function cerrarSesion() {
    await AsyncStorage.removeItem('session_oriental_rider');
    setRider(null);
    setPedidos([]);
  }
    async function tomarPedido(p) {
    setCargando(true);
    try {
      await apiRest(`pedidos?id=eq.${p.id}`, 'PATCH', {
        rider_id: rider.id,
        rider_nombre: rider.nombre_completo,
        estado_rider: 'Asignado',
        estado: 'En camino'
      });
      await cargarTodo();
      setTab('activos');
      mostrarAviso('Pedido tomado', `Has aceptado el pedido ${p.numero_pedido}.`);
    } catch (e) {
      mostrarAviso('Error', e.message);
    } finally {
      setCargando(false);
    }
  }

  async function cambiarEstadoEntrega(p, nuevoEstadoRider) {
    setCargando(true);
    try {
      if (nuevoEstadoRider === 'Entregado') {
        const bonoPuntos = await obtenerBonoPuntosRider();
        await apiRest(`pedidos?id=eq.${p.id}`, 'PATCH', {
          estado_rider: 'Entregado',
          estado: 'Completado'
        });
        const [perf] = await apiRest(`perfiles?select=puntos&id=eq.${rider.id}&limit=1`);
        const ptsActual = Number(perf?.puntos || 0);
        await apiRest(`perfiles?id=eq.${rider.id}`, 'PATCH', { puntos: ptsActual + bonoPuntos });
        await cargarTodo();
        mostrarAviso('¡Entrega completada!', `Ganaste +${bonoPuntos} puntos y se registró tu tarifa de delivery.`);
      } else {
        await apiRest(`pedidos?id=eq.${p.id}`, 'PATCH', { estado_rider: nuevoEstadoRider });
        await cargarTodo();
        if (nuevoEstadoRider === 'En la puerta') {
          mostrarAviso('Cliente notificado', 'Se envió la alerta de llegada al cliente. Pídele que confirme recepción.');
        }
      }
    } catch (e) {
      mostrarAviso('Error', e.message);
    } finally {
      setCargando(false);
    }
  }

  function abrirMaps(dirRaw) {
    const partes = String(dirRaw || '').split('|');
    const url = partes.length > 1 ? partes.at(1).trim() : `https://google.com{encodeURIComponent(partes.at(0) || '')}`;
    Linking.openURL(url);
  }

  function abrirWhatsApp(telCli, numPed) {
    const limpio = limpiarTel(telCli);
    if (!limpio) return mostrarAviso('Sin teléfono', 'Este cliente no tiene teléfono registrado.');
    const msg = `Hola, soy ${rider.nombre_completo}, tu repartidor de El Sazón Oriental con tu pedido ${numPed}.`;
    Linking.openURL(`https://wa.me{limpio}?text=${encodeURIComponent(msg)}`);
  }
    if (!rider) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: FONDO, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 0, justifyContent: 'center', padding: 20 }}>
        <VentanaAvisoRider aviso={aviso} onCerrar={() => setAviso(null)} />
        <View style={{ backgroundColor: TARJETA, borderRadius: 20, borderWidth: 1.5, borderColor: ROJO, padding: 22 }}>
          <Image source={LOGO_RIDERS} style={{ width: 96, height: 96, borderRadius: 20, alignSelf: 'center', marginBottom: 12 }} />
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>ORIENTAL RIDERS</Text>
          <Text style={{ color: DORADO, fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 18 }}>Panel Exclusivo de Motorizados</Text>
          <TextInput style={{ backgroundColor: '#1B1B22', borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', padding: 13, marginBottom: 10 }} placeholder="Teléfono registrado" placeholderTextColor="#6B7280" keyboardType="phone-pad" value={tel} onChangeText={setTel} />
          <TextInput style={{ backgroundColor: '#1B1B22', borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', padding: 13, marginBottom: 14 }} placeholder="Contraseña" placeholderTextColor="#6B7280" secureTextEntry value={clave} onChangeText={setClave} />
          <TouchableOpacity style={{ backgroundColor: ROJO, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }} onPress={ingresarRider} disabled={cargando}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{cargando ? 'INGRESANDO...' : 'INGRESAR A MIS RUTAS'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hoy = new Date().toDateString();
  const disponibles = pedidos.filter(p => p.estado === 'Listo' && !p.rider_id);
  const misActivos = pedidos.filter(p => p.rider_id === rider.id && p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const misCompletados = pedidos.filter(p => p.rider_id === rider.id && p.estado === 'Completado');
  const ganadosHoy = misCompletados.filter(p => new Date(p.creado_en).toDateString() === hoy).reduce((a, p) => a + Number(p.costo_delivery || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FONDO, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 0 }}>
      <VentanaAvisoRider aviso={aviso} onCerrar={() => setAviso(null)} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 34 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDE, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={LOGO_RIDERS} style={{ width: 42, height: 42, borderRadius: 10 }} />
            <View>
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{rider.nombre_completo}</Text>
              <Text style={{ color: DORADO, fontSize: 11, fontWeight: '800' }}>🛵 Motorizado • {rider.puntos || 0} pts</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => { sonarAlertaRider(); mostrarAviso('🔔 Sonido activo', 'Las alertas sonoras y vibración de nuevos pedidos están activadas.'); }} style={{ backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 11 }}>🔔 SONIDO</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cerrarSesion} style={{ backgroundColor: '#252530', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={{ flex: 1, backgroundColor: TARJETA, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: BORDE }}>
            <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>DELIVERY HOY</Text>
            <Text style={{ color: '#22C55E', fontSize: 18, fontWeight: '900', marginTop: 2 }}>S/ {ganadosHoy.toFixed(2)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: TARJETA, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: BORDE }}>
            <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>ENTREGAS HOY</Text>
            <Text style={{ color: DORADO, fontSize: 18, fontWeight: '900', marginTop: 2 }}>{misCompletados.filter(p => new Date(p.creado_en).toDateString() === hoy).length}</Text>
          </View>
        </View>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {[
            { id: 'disponibles', label: `Disponibles (${disponibles.length})` },
            { id: 'activos', label: `En ruta (${misActivos.length})` },
            { id: 'historial', label: `Historial (${misCompletados.length})` }
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={{ flex: 1, backgroundColor: tab === t.id ? ROJO : TARJETA, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: tab === t.id ? ROJO : BORDE }}>
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 11 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'disponibles' && (disponibles.length === 0 ? (
          <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 24, alignItems: 'center' }}><Text style={{ color: '#9CA3AF' }}>No hay pedidos listos en cocina por ahora.</Text></View>
        ) : disponibles.map(p => (
          <View key={p.id} style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: DORADO }}>
            <Text style={{ color: DORADO, fontWeight: '900', fontSize: 15 }}>{p.numero_pedido} • Delivery S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
            <Text style={{ color: '#FFF', fontWeight: '700', marginTop: 4 }}>Cliente: {p.perfiles?.nombre_completo || 'Cliente'} ({p.perfiles?.telefono || ''})</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 12, marginTop: 2 }}>Dir: {p.distrito} - {String(p.direccion || '').split('|').at(0)}</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>Cobro: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
            <TouchableOpacity style={{ backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 }} onPress={() => tomarPedido(p)} disabled={cargando}>
              <Text style={{ color: '#FFF', fontWeight: '900' }}>🛵 TOMAR PEDIDO</Text>
            </TouchableOpacity>
          </View>
        )))}

        {tab === 'activos' && (misActivos.length === 0 ? (
          <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 24, alignItems: 'center' }}><Text style={{ color: '#9CA3AF' }}>No tienes entregas activas en este momento.</Text></View>
        ) : misActivos.map(p => (
          <View key={p.id} style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: ROJO }}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>{p.numero_pedido} • {p.estado_rider}</Text>
            <Text style={{ color: DORADO, fontWeight: '800', marginTop: 4 }}>Cliente: {p.perfiles?.nombre_completo} • Tel: {p.perfiles?.telefono}</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 12, marginTop: 2 }}>Dirección: {p.distrito} - {String(p.direccion || '').split('|').at(0)}</Text>
            <Text style={{ color: '#22C55E', fontWeight: '900', marginTop: 4 }}>Total: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#0284C7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }} onPress={() => abrirMaps(p.direccion)}>
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>🗺️ GOOGLE MAPS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#128C7E', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }} onPress={() => abrirWhatsApp(p.perfiles?.telefono, p.numero_pedido)}>
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>💬 WHATSAPP</Text>
              </TouchableOpacity>
            </View>
            {p.estado_rider !== 'En la puerta' && (
              <TouchableOpacity style={{ backgroundColor: '#D97706', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={() => cambiarEstadoEntrega(p, 'En la puerta')} disabled={cargando}>
                <Text style={{ color: '#FFF', fontWeight: '900' }}>📍 YA LLEGUÉ / ESTOY EN LA PUERTA</Text>
              </TouchableOpacity>
            )}
            {p.recibido_cliente ? (
              <TouchableOpacity style={{ backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={() => cambiarEstadoEntrega(p, 'Entregado')} disabled={cargando}>
                <Text style={{ color: '#FFF', fontWeight: '900' }}>✅ FINALIZAR ENTREGA (+PUNTOS)</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: '#1E1E28', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: DORADO }}>
                <Text style={{ color: DORADO, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>⏳ Esperando que el cliente pulse "Pedido recibido" en su app para finalizar.</Text>
              </View>
            )}
          </View>
        )))}

        {tab === 'historial' && (misCompletados.length === 0 ? (
          <View style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 24, alignItems: 'center' }}><Text style={{ color: '#9CA3AF' }}>Aún no tienes entregas completadas.</Text></View>
        ) : misCompletados.map(p => (
          <View key={p.id} style={{ backgroundColor: TARJETA, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: BORDE }}>
            <Text style={{ color: '#FFF', fontWeight: '900' }}>{p.numero_pedido} • Delivery S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{new Date(p.creado_en).toLocaleString()} • {p.metodo_pago} • {p.estado_rider}</Text>
          </View>
        )))}
      </ScrollView>
    </SafeAreaView>
  );
          }
                                 
