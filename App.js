import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, TextInput, Image, Linking, Platform, StatusBar, Modal, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const SUPABASE_URL = 'https://' + 'pripxtsriyxhafevokjg' + '.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ShY2V3Oh7gB4ZHSBzI5o_Q_GSMxzmds';
const RIDERS_PROJECT_ID = 'd8ac579b-f688-4459-ba90-641b868c9d79';
const ROJO = '#E50914';
const DORADO = '#F5B841';
const FONDO = '#070709';
const TARJETA = '#121218';
const BORDE = '#23232F';
const LOGO_RIDERS = require('./file_00000000ea0081f48c2e66d2ba5fd06d.png');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

async function registrarPushRider(riderId) {
  if (Platform.OS === 'web' || !riderId) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pedidos-sazon', {
        name: 'Alertas de Entregas Oriental Riders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: new Array(0, 400, 200, 400, 200, 500),
        lightColor: '#E50914',
        sound: 'default',
        bypassDnd: true,
        enableVibrate: true
      });
    }
    const { status: estActual } = await Notifications.getPermissionsAsync();
    let estFinal = estActual;
    if (estActual !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      estFinal = status;
    }
    if (estFinal === 'granted') {
      const tokenObj = await Notifications.getExpoPushTokenAsync({ projectId: RIDERS_PROJECT_ID });
      const token = tokenObj?.data;
      if (token) {
        await fetch(`${SUPABASE_URL}/rest/v1/perfiles?id=eq.${riderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          },
          body: JSON.stringify({ push_token: token })
        });
      }
    }
  } catch (e) {}
}

function sonarAlertaRider() {
  try {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(new Array(0, 400, 200, 400, 200, 500));
      Notifications.scheduleNotificationAsync({
        content: {
          title: '🛵 ¡Nuevo pedido listo en cocina!',
          body: 'Tienes un delivery listo para recoger en El Sazón Oriental.',
          sound: 'default',
          channelId: 'pedidos-sazon'
        },
        trigger: null
      }).catch(() => {});
    }
  } catch (e) {}
}
const limpiarTel = (t) => {
  const n = String(t || '').replace(/\D/g, '');
  return n.length === 11 && n.startsWith('51') ? n.slice(2) : n;
};

async function api(ruta, metodo = 'GET', cuerpo = null) {
  const op = {
    method: metodo,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=representation' }
  };
  if (cuerpo) op.body = JSON.stringify(cuerpo);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, op);
  const txt = await r.text();
  const data = txt ? JSON.parse(txt) : [];
  if (!r.ok) throw new Error(data.message || 'Error en servidor');
  return data;
}

export default function App() {
  const [rider, setRider] = useState(null);
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [puntos, setPuntos] = useState(0);
  const [puntosPorEntrega, setPuntosPorEntrega] = useState(10);
  const [tab, setTab] = useState('disponibles');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [sonidoOn, setSonidoOn] = useState(true);
  const idsDisponiblesRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('session_oriental_rider').then(s => {
      if (s) setRider(JSON.parse(s));
    });
  }, []);

  useEffect(() => {
    if (!rider?.id) return;
    registrarPushRider(rider.id);
    cargarTodo();
    const t = setInterval(cargarTodo, 4000);
    return () => clearInterval(t);
  }, [rider?.id]);

  async function cargarTodo() {
    try {
      const [peds, perfs, cfg] = await Promise.all([
        api('pedidos?select=*,perfiles(nombre_completo,telefono),pedido_detalles(*)&order=creado_en.desc&limit=120'),
        api(`perfiles?select=puntos&id=eq.${rider.id}&limit=1`),
        api('configuracion_pagos?select=titular&limit=1')
      ]);
      const lista = Array.isArray(peds) ? peds : [];
      const disp = lista.filter(p => p.tipo_entrega === 'DELIVERY' && p.estado === 'Listo' && !p.rider_id);
      if (idsDisponiblesRef.current === null) {
        idsDisponiblesRef.current = new Set(disp.map(d => d.id));
      } else {
        const nuevos = disp.filter(d => !idsDisponiblesRef.current.has(d.id));
        idsDisponiblesRef.current = new Set(disp.map(d => d.id));
        if (nuevos.length > 0 && sonidoOn) sonarAlertaRider();
      }
      setPedidos(lista);
      if (Array.isArray(perfs) && perfs.length > 0) setPuntos(Number(perfs.at(0).puntos || 0));
      if (Array.isArray(cfg) && cfg.length > 0) {
        const partes = String(cfg.at(0).titular || '').split('||DEL:');
        if (partes.length > 1) {
          const ptsCfg = partes.at(1).split('|').at(5);
          if (ptsCfg !== undefined) setPuntosPorEntrega(Number(ptsCfg));
        }
      }
    } catch (e) {}
  }
    async function ingresar() {
    const tel = limpiarTel(telefono);
    if (tel.length < 6 || !password.trim()) return setAviso({ t: 'Campos requeridos', m: 'Ingresa tu teléfono y contraseña asignada.' });
    setCargando(true);
    try {
      const res = await api(`perfiles?select=*&telefono=eq.${tel}&rol=eq.repartidor&limit=1`);
      const p = Array.isArray(res) && res.length > 0 ? res.at(0) : null;
      if (!p) throw new Error('No existe un repartidor con ese teléfono.');
      if (String(p.password_hash || '') !== password.trim()) throw new Error('Contraseña incorrecta.');
      setRider(p);
      await AsyncStorage.setItem('session_oriental_rider', JSON.stringify(p));
    } catch (e) {
      setAviso({ t: 'Acceso denegado', m: e.message });
    } finally {
      setCargando(false);
    }
  }

  async function salir() {
    await AsyncStorage.removeItem('session_oriental_rider');
    setRider(null);
    idsDisponiblesRef.current = null;
  }

  async function aceptarPedido(ped) {
    setCargando(true);
    try {
      await api(`pedidos?id=eq.${ped.id}`, 'PATCH', {
        rider_id: rider.id,
        rider_nombre: rider.nombre_completo,
        estado: 'En camino',
        estado_rider: 'En camino'
      });
      await cargarTodo();
      setTab('en_curso');
      setAviso({ t: 'Pedido aceptado', m: `Ahora estás llevando el pedido ${ped.numero_pedido}.` });
    } catch (e) { setAviso({ t: 'Error', m: e.message }); } finally { setCargando(false); }
  }

  async function avisarEnPuerta(ped) {
    setCargando(true);
    try {
      await api(`pedidos?id=eq.${ped.id}`, 'PATCH', { estado_rider: 'En la puerta' });
      await cargarTodo();
      setAviso({ t: 'Cliente notificado', m: 'Se envió la alerta sonando al cliente de que estás en la puerta.' });
    } catch (e) { setAviso({ t: 'Error', m: e.message }); } finally { setCargando(false); }
  }

  async function finalizarEntrega(ped) {
    if (!ped.recibido_cliente) {
      return setAviso({ t: 'Espera confirmación', m: 'El cliente debe tocar "Pedido recibido" en su app primero.' });
    }
    setCargando(true);
    try {
      await api(`pedidos?id=eq.${ped.id}`, 'PATCH', { estado: 'Completado', estado_rider: 'Entregado' });
      const regalo = Math.max(0, Number(puntosPorEntrega || 0));
      if (regalo > 0) {
        const nuevoSaldo = puntos + regalo;
        await api(`perfiles?id=eq.${rider.id}`, 'PATCH', { puntos: nuevoSaldo });
        await api('historial_puntos', 'POST', {
          cliente_id: rider.id,
          tipo: 'bono',
          cantidad: regalo,
          descripcion: `Entrega completada ${ped.numero_pedido}`
        });
      }
      await cargarTodo();
      setAviso({ t: '¡Entrega completada!', m: regalo > 0 ? `Ganaste +${regalo} puntos de regalo.` : 'Entrega registrada con éxito.' });
    } catch (e) { setAviso({ t: 'Error', m: e.message }); } finally { setCargando(false); }
  }
    const modalAviso = (
    <Modal transparent animationType="fade" visible={Boolean(aviso)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        {aviso && (
          <View style={{ width: '100%', maxWidth: 360, backgroundColor: TARJETA, borderWidth: 1.5, borderColor: DORADO, borderRadius: 18, padding: 20, alignItems: 'center' }}>
            <Text style={{ color: DORADO, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>{aviso.t}</Text>
            <Text style={{ color: '#E5E7EB', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{aviso.m}</Text>
            <TouchableOpacity style={{ backgroundColor: ROJO, borderRadius: 12, paddingVertical: 12, width: '100%', alignItems: 'center' }} onPress={() => setAviso(null)}>
              <Text style={{ color: '#FFF', fontWeight: '900' }}>Entendido</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );

  if (!rider) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: FONDO, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 10 }}>
        {modalAviso}
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Image source={LOGO_RIDERS} style={{ width: 130, height: 130, borderRadius: 24, marginBottom: 12 }} resizeMode="contain" />
            <Text style={{ color: DORADO, fontSize: 24, fontWeight: '900', letterSpacing: 1 }}>ORIENTAL RIDERS</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>App Oficial de Motorizados • El Sazón Oriental</Text>
          </View>
          <View style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 18, padding: 18 }}>
            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '800', marginBottom: 6 }}>TELÉFONO REGISTRADO</Text>
            <TextInput style={{ backgroundColor: '#0A0A0E', color: '#FFF', borderWidth: 1, borderColor: BORDE, borderRadius: 12, padding: 14, marginBottom: 14 }} placeholder="Ej. 987654321" placeholderTextColor="#6B7280" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '800', marginBottom: 6 }}>CONTRASEÑA ASIGNADA</Text>
            <TextInput style={{ backgroundColor: '#0A0A0E', color: '#FFF', borderWidth: 1, borderColor: BORDE, borderRadius: 12, padding: 14, marginBottom: 18 }} placeholder="Tu contraseña" placeholderTextColor="#6B7280" secureTextEntry value={password} onChangeText={setPassword} />
            <TouchableOpacity style={{ backgroundColor: ROJO, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }} onPress={ingresar} disabled={cargando}>
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{cargando ? 'INGRESANDO...' : 'INGRESAR COMO REPARTIDOR'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const disponibles = pedidos.filter(p => p.tipo_entrega === 'DELIVERY' && p.estado === 'Listo' && !p.rider_id);
  const enCurso = pedidos.filter(p => p.rider_id === rider.id && p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const entregados = pedidos.filter(p => p.rider_id === rider.id && p.estado === 'Completado');
  const efectivoPorRendir = entregados.filter(p => p.metodo_pago === 'Efectivo' && p.estado_rider !== 'Liquidado en caja').reduce((a, p) => a + Number(p.total || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FONDO, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 10 }}>
      {modalAviso}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <View style={{ backgroundColor: TARJETA, borderWidth: 1.5, borderColor: DORADO, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Image source={LOGO_RIDERS} style={{ width: 42, height: 42, borderRadius: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: DORADO, fontSize: 16, fontWeight: '900' }} numberOfLines={1}>{rider.nombre_completo}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{rider.direccion_predeterminada || 'Turno activo'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { const n = !sonidoOn; setSonidoOn(n); if (n) sonarAlertaRider(); }} style={{ backgroundColor: sonidoOn ? '#16A34A' : '#374151', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 10 }}>{sonidoOn ? '🔔 SONIDO' : '🔕 MUDO'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: '#1E1A10', borderWidth: 1, borderColor: DORADO, borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>MIS PUNTOS REGALO</Text>
              <Text style={{ color: DORADO, fontSize: 18, fontWeight: '900' }}>★ {puntos} pts</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#1E1212', borderWidth: 1, borderColor: ROJO, borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>EFECTIVO EN CAJA</Text>
              <Text style={{ color: efectivoPorRendir > 0 ? '#EF4444' : '#22C55E', fontSize: 18, fontWeight: '900' }}>S/ {efectivoPorRendir.toFixed(2)}</Text>
            </View>
          </View>
        </View>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {[
            { id: 'disponibles', label: `Listos (${disponibles.length})` },
            { id: 'en_curso', label: `En ruta (${enCurso.length})` },
            { id: 'historial', label: `Entregados (${entregados.length})` }
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{ flex: 1, backgroundColor: tab === t.id ? ROJO : TARJETA, borderWidth: 1, borderColor: tab === t.id ? ROJO : BORDE, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 12 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {(tab === 'disponibles' ? disponibles : tab === 'en_curso' ? enCurso : entregados).length === 0 ? (
          <View style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center' }}>
              {tab === 'disponibles' ? 'No hay pedidos listos en cocina ahora.' : tab === 'en_curso' ? 'No tienes entregas activas en ruta.' : 'Aún no registras entregas completadas.'}
            </Text>
          </View>
        ) : (
          (tab === 'disponibles' ? disponibles : tab === 'en_curso' ? enCurso : entregados).map(p => {
            const partesDir = String(p.direccion || '').split('|');
            const dirTexto = partesDir.at(0) || 'Dirección GPS';
            const linkMaps = partesDir.length > 1 ? partesDir.at(1) : `https://google.com{encodeURIComponent(dirTexto + ' ' + (p.distrito || ''))}`;
            const telCli = String(p.perfiles?.telefono || '').replace(/\D/g, '');
            const waUrl = telCli ? `https://wa.me{telCli.length === 9 ? '51' + telCli : telCli}?text=${encodeURIComponent(`Hola ${p.perfiles?.nombre_completo || ''}, soy ${rider.nombre_completo} de Oriental Riders. Ya estoy en camino con tu pedido ${p.numero_pedido}.`)}` : '';
            return (
              <View key={p.id} style={{ backgroundColor: TARJETA, borderWidth: 1.5, borderColor: tab === 'en_curso' ? DORADO : BORDE, borderRadius: 16, padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: DORADO, fontSize: 16, fontWeight: '900' }}>{p.numero_pedido}</Text>
                  <View style={{ backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{p.estado_rider || p.estado}</Text>
                  </View>
                </View>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Cliente: {p.perfiles?.nombre_completo || 'Cliente'} ({p.perfiles?.telefono || ''})</Text>
                <Text style={{ color: '#D1D5DB', fontSize: 13, marginTop: 4 }}>Dirección: {p.distrito} - {dirTexto}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>Pago: {p.metodo_pago} • Total: S/ {Number(p.total).toFixed(2)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={{ flex: 1, backgroundColor: '#0284C7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }} onPress={() => Linking.openURL(linkMaps)}>
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 11 }}>🗺️ GOOGLE MAPS</Text>
                  </TouchableOpacity>
                  {!!waUrl && (
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#128C7E', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }} onPress={() => Linking.openURL(waUrl)}>
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 11 }}>💬 WHATSAPP</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {tab === 'disponibles' && (
                  <TouchableOpacity style={{ backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 }} onPress={() => aceptarPedido(p)} disabled={cargando}>
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>🛵 ACEPTAR Y RECOGER PEDIDO</Text>
                  </TouchableOpacity>
                )}
                {tab === 'en_curso' && (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    <TouchableOpacity style={{ backgroundColor: '#D97706', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }} onPress={() => avisarEnPuerta(p)} disabled={cargando}>
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>🔔 ESTOY EN LA PUERTA (TIMBRAR)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: p.recibido_cliente ? '#16A34A' : '#374151', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }} onPress={() => finalizarEntrega(p)} disabled={cargando}>
                      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>
                        {p.recibido_cliente ? '✅ COMPLETAR ENTREGA (+PUNTOS)' : '⏳ ESPERANDO RECEPCIÓN DEL CLIENTE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
        <TouchableOpacity style={{ backgroundColor: '#1E1E28', borderWidth: 1, borderColor: BORDE, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 }} onPress={salir}>
          <Text style={{ color: '#9CA3AF', fontWeight: '900' }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
