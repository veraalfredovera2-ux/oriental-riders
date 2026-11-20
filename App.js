import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Vibration, Platform, Linking, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ingresarRider, actualizarEstadoRider, obtenerEnviosDelivery, aceptarEnvioRider, marcarRetiradoLocal, marcarEntregadoCliente } from './servicios';

const LOGO_RIDER = require('./file_00000000ea0081f48c2e6662ba5fd06d.png');

function generarWavDataUri(silencio = false) {
  const sr = 8000, dur = silencio ? 3 : 1.2, n = Math.floor(sr * dur);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const freq = (Math.floor(t * 4) % 2 === 0) ? 1050 : 780;
    const val = silencio ? 2 : Math.round(Math.sin(2 * Math.PI * freq * t) * 32000);
    v.setInt16(44 + i * 2, val, true);
  }
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes.at(i));
  return 'data:audio/wav;base64,' + btoa(bin);
}

async function registrarSwYNotificarRider(titulo, cuerpo) {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const opciones = { body: cuerpo, vibrate: Array.of(600, 200, 600, 200, 800), tag: 'envio-rider-' + Date.now(), renotify: true, requireInteraction: true, silent: false };
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) { await reg.showNotification(titulo, opciones); return; }
    }
    new Notification(titulo, opciones);
  } catch (e) {}
}

function separarDireccionYLink(direccion) {
  const dir = String(direccion || '').trim();
  const matchUrl = dir.match(/https?:\/\/[^\s|]+/i);
  const url = matchUrl ? matchUrl.at(0) : '';
  const textoLimpio = dir.replace(/\|?\s*https?:\/\/[^\s|]+/gi, '').trim();
  return { textoLimpio: textoLimpio || (url ? 'Ubicación exacta Google Maps' : 'Sin dirección'), url };
}

export default function App() {
  const [rider, setRider] = useState(null);
  const [tel, setTel] = useState('');
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState('recoger');
  const [envios, setEnvios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [sonando, setSonando] = useState(false);
  const conocidosRef = useRef(null), audioSirenaRef = useRef(null), audioFondoRef = useRef(null), timeoutRef = useRef(null), wakeRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
        const aSirena = new window.Audio(generarWavDataUri(false));
        aSirena.loop = true;
        audioSirenaRef.current = aSirena;
        const aFondo = new window.Audio(generarWavDataUri(true));
        aFondo.loop = true;
        aFondo.volume = 0.02;
        audioFondoRef.current = aFondo;
      } catch (e) {}
    }
    AsyncStorage.getItem('sesion_oriental_rider').then(s => { if (s) setRider(JSON.parse(s)); });
  }, []);

  useEffect(() => {
    if (!rider?.id) return;
    try { if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
    if (rider.disponible !== false) { activarWakeLock(); iniciarKeepAliveFondo(); } else { liberarWakeLock(); detenerKeepAliveFondo(); }
    cargarEnvios();
    const t = setInterval(cargarEnvios, 3000);
    return () => { clearInterval(t); detenerAlarma(); liberarWakeLock(); detenerKeepAliveFondo(); };
  }, [rider?.id, rider?.disponible]);

  function iniciarKeepAliveFondo() {
    try {
      if (audioFondoRef.current && audioFondoRef.current.paused) audioFondoRef.current.play().catch(() => {});
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.metadata = new window.MediaMetadata({ title: 'Oriental Riders • Disponible', artist: 'Alertas Activas en Segundo Plano' });
        navigator.mediaSession.playbackState = 'playing';
      }
    } catch (e) {}
  }
  function detenerKeepAliveFondo() {
    try {
      if (audioFondoRef.current) { audioFondoRef.current.pause(); audioFondoRef.current.currentTime = 0; }
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
  async function activarWakeLock() { try { if (Platform.OS === 'web' && navigator?.wakeLock && !wakeRef.current) wakeRef.current = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function liberarWakeLock() { try { if (wakeRef.current) { wakeRef.current.release(); wakeRef.current = null; } } catch (e) {} }

  function abrirEnMaps(direccion, distrito) {
    const info = separarDireccionYLink(direccion);
    const url = info.url || `https://google.com{encodeURIComponent([info.textoLimpio, distrito, 'Lima, Perú'].filter(Boolean).join(', '))}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(url);
      return;
    }
    Linking.openURL(url);
  }
  function tocarPitidoPrueba() {
    try {
      if (audioSirenaRef.current) {
        audioSirenaRef.current.currentTime = 0;
        audioSirenaRef.current.play().catch(() => {});
        setTimeout(() => { if (!sonando && audioSirenaRef.current) { audioSirenaRef.current.pause(); audioSirenaRef.current.currentTime = 0; } }, 700);
      }
    } catch (e) {}
  }

  function detenerAlarma() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    try { if (audioSirenaRef.current) { audioSirenaRef.current.pause(); audioSirenaRef.current.currentTime = 0; } } catch (e) {}
    setSonando(false);
  }

  function activarAlarma() {
    detenerAlarma(); setSonando(true);
    try { Vibration.vibrate(Array.of(600, 200, 600, 200, 800)); } catch (e) {}
    try { if (audioSirenaRef.current) { audioSirenaRef.current.currentTime = 0; audioSirenaRef.current.play().catch(() => {}); } } catch (e) {}
    timeoutRef.current = setTimeout(detenerAlarma, 15000);
  }

  async function cargarEnvios() {
    try {
      const lista = await obtenerEnviosDelivery();
      setEnvios(lista || []);
      const libres = (lista || []).filter(p => p.estado === 'Confirmado por local' && !p.rider_id);
      if (conocidosRef.current === null) { conocidosRef.current = libres.map(p => p.id); return; }
      const nuevos = libres.filter(p => !conocidosRef.current.includes(p.id));
      if (nuevos.length > 0 && rider?.disponible !== false) {
        activarAlarma();
        const ult = nuevos.at(0);
        const dirInfo = separarDireccionYLink(ult?.direccion);
        registrarSwYNotificarRider(
          `¡Nuevo Delivery ${ult?.numero_pedido || ''}!`,
          `${ult?.distrito || ''} • ${dirInfo.textoLimpio} • Delivery: S/ ${Number(ult?.costo_delivery || 0).toFixed(2)}`
        );
      }
      if (libres.length === 0) detenerAlarma();
      conocidosRef.current = libres.map(p => p.id);
    } catch (e) {}
  }

  async function entrar() {
    if (!tel.trim() || !pass.trim()) return setAviso('Ingresa teléfono y contraseña.');
    setCargando(true);
    try {
      const r = await ingresarRider({ telefono: tel, password: pass });
      await AsyncStorage.setItem('sesion_oriental_rider', JSON.stringify(r));
      try { if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) {}
      setRider(r); iniciarKeepAliveFondo(); tocarPitidoPrueba();
    } catch (e) { setAviso(e.message); } finally { setCargando(false); }
  }

  async function alternarDisponible() {
    try {
      const nuevo = !rider.disponible;
      await actualizarEstadoRider(rider.id, nuevo);
      const act = { ...rider, disponible: nuevo };
      setRider(act); await AsyncStorage.setItem('sesion_oriental_rider', JSON.stringify(act));
      if (nuevo) {
        iniciarKeepAliveFondo();
        tocarPitidoPrueba();
        try {
          if (Platform.OS === 'web' && 'Notification' in window) {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') registrarSwYNotificarRider('Alertas en segundo plano activas', 'Recibirás notificaciones con sonido incluso con la pantalla apagada.');
          }
        } catch (e) {}
      } else { detenerKeepAliveFondo(); detenerAlarma(); }
    } catch (e) { setAviso(e.message); }
  }

  async function tomarEnvio(ped) {
    setCargando(true);
    try { detenerAlarma(); await aceptarEnvioRider(ped, rider); await cargarEnvios(); setTab('en_camino'); setAviso('Pedido asignado. Retíralo en el local.'); }
    catch (e) { await cargarEnvios(); setAviso(e.message); } finally { setCargando(false); }
  }

  async function retirarPedido(ped) {
    setCargando(true);
    try { await marcarRetiradoLocal(ped.id); await cargarEnvios(); setAviso('Pedido retirado. ¡Buen viaje!'); }
    catch (e) { setAviso(e.message); } finally { setCargando(false); }
  }

  async function entregarPedido(ped) {
    setCargando(true);
    try { await marcarEntregadoCliente(ped); await cargarEnvios(); setTab('entregado'); setAviso('¡Entrega completada y ganancia acreditada!'); }
    catch (e) { setAviso(e.message); } finally { setCargando(false); }
  }

  async function salir() {
    await AsyncStorage.removeItem('sesion_oriental_rider');
    detenerKeepAliveFondo(); detenerAlarma(); setRider(null);
  }
    if (!rider) {
    return (
      <SafeAreaView style={st.pantalla}>
        <View style={st.cajaLogin}>
          <Image source={LOGO_RIDER} style={st.logoImg} />
          <Text style={st.logo}>ORIENTAL RIDERS</Text>
          <Text style={st.sub}>App Oficial de Repartidores • Club Sazón</Text>
          <TextInput style={st.input} placeholder="Teléfono del repartidor" placeholderTextColor="#777" keyboardType="phone-pad" value={tel} onChangeText={setTel} />
          <TextInput style={st.input} placeholder="Contraseña" placeholderTextColor="#777" secureTextEntry value={pass} onChangeText={setPass} />
          <TouchableOpacity style={st.btnOro} onPress={entrar} disabled={cargando}><Text style={st.txtOscuro}>{cargando ? 'INGRESANDO...' : 'INICIAR SESIÓN'}</Text></TouchableOpacity>
          {aviso && <View style={st.alerta}><Text style={st.txtBlanco}>{aviso}</Text><TouchableOpacity onPress={() => setAviso(null)}><Text style={st.txtOro}>OK</Text></TouchableOpacity></View>}
        </View>
      </SafeAreaView>
    );
  }

  const libres = envios.filter(p => p.estado === 'Confirmado por local' && !p.rider_id);
  const misEnCamino = envios.filter(p => p.rider_id === rider.id && p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const misEntregados = envios.filter(p => p.rider_id === rider.id && p.estado === 'Completado');
  const gananciaTotal = misEntregados.reduce((acc, p) => acc + Number(p.costo_delivery || 0), 0);

  return (
    <SafeAreaView style={st.pantalla}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={st.fila}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Image source={LOGO_RIDER} style={st.logoMini} />
            <View style={{ flex: 1 }}>
              <Text style={st.subIzq}>Repartidor • {misEntregados.length} entregados</Text>
              <Text style={st.nombre}>{rider.nombre_completo}</Text>
            </View>
          </View>
          <TouchableOpacity style={st.btnRojo} onPress={salir}><Text style={st.txtBlanco}>SALIR</Text></TouchableOpacity>
        </View>
        <View style={st.tarjetaHorario}>
          <Text style={st.txtHorario}>Horario: {rider.hora_entrada || '18:30'} - {rider.hora_salida || '23:50'} • {rider.dias_libres || 'Sin días libres'}</Text>
        </View>
        <TouchableOpacity style={[st.btnEstado, { backgroundColor: rider.disponible ? '#2E7D32' : '#444' }]} onPress={alternarDisponible}>
          <Text style={st.txtBlanco}>{rider.disponible ? '🟢 DISPONIBLE PARA REPARTOS' : '🔴 DESCONECTADO (TOCA PARA ACTIVAR)'}</Text>
        </TouchableOpacity>
        {sonando && <TouchableOpacity style={st.bannerAlarma} onPress={detenerAlarma}><Text style={st.txtBlanco}>🚨 ¡NUEVO ENVÍO DISPONIBLE! (TOCA PARA SILENCIAR)</Text></TouchableOpacity>}
        {aviso && <View style={st.alerta}><Text style={st.txtBlanco}>{aviso}</Text><TouchableOpacity onPress={() => setAviso(null)}><Text style={st.txtOro}>OK</Text></TouchableOpacity></View>}
        <View style={st.tabs}>
          <TouchableOpacity style={[st.tab, tab === 'recoger' && st.tabAct]} onPress={() => setTab('recoger')}><Text style={st.txtTab}>RECOGER ({libres.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'en_camino' && st.tabAct]} onPress={() => setTab('en_camino')}><Text style={st.txtTab}>EN CAMINO ({misEnCamino.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'entregado' && st.tabAct]} onPress={() => setTab('entregado')}><Text style={st.txtTab}>ENTREGADO ({misEntregados.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'ganancias' && st.tabAct]} onPress={() => setTab('ganancias')}><Text style={st.txtTab}>GANANCIAS</Text></TouchableOpacity>
        </View>
        {tab === 'recoger' && (libres.length === 0 ? <Text style={st.vacio}>No hay pedidos listos para recoger ahora.</Text> : libres.map(p => {
          const dirInfo = separarDireccionYLink(p.direccion);
          return (
            <View key={p.id} style={st.card}>
              <Text style={st.cardTitulo}>📦 Pedido {p.numero_pedido} • Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
              <Text style={st.cardTxt}>📍 Distrito: {p.distrito || 'Sin distrito'}</Text>
              <Text style={st.cardTxt}>🏠 Dirección: {dirInfo.textoLimpio}</Text>
              <TouchableOpacity onPress={() => abrirEnMaps(p.direccion, p.distrito)}>
                <Text style={st.linkMaps}>🗺️ ABRIR UBICACIÓN EN GOOGLE MAPS</Text>
              </TouchableOpacity>
              <Text style={st.cardTxt}>👤 Cliente: {p.clientes?.nombre_completo || 'Cliente'}</Text>
              <Text style={st.cardTxt}>💵 Cobrar: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
              <TouchableOpacity style={st.btnOro} onPress={() => tomarEnvio(p)} disabled={cargando}><Text style={st.txtOscuro}>ACEPTAR Y RECOGER PEDIDO</Text></TouchableOpacity>
            </View>
          );
        }))}

        {tab === 'en_camino' && (misEnCamino.length === 0 ? <Text style={st.vacio}>No tienes entregas en camino.</Text> : misEnCamino.map(p => {
          const dirInfo = separarDireccionYLink(p.direccion);
          const clienteYaRecibio = Boolean(p.recibido_cliente);
          return (
            <View key={p.id} style={st.card}>
              <Text style={st.cardTitulo}>🛵 {p.numero_pedido} — {p.estado_rider || 'Asignado'}</Text>
              <Text style={st.cardTxt}>📍 Distrito: {p.distrito || 'Sin distrito'}</Text>
              <Text style={st.cardTxt}>🏠 Dirección: {dirInfo.textoLimpio}</Text>
              <TouchableOpacity style={st.btnMaps} onPress={() => abrirEnMaps(p.direccion, p.distrito)}>
                <Text style={st.txtBlanco}>🗺️ ABRIR EN GOOGLE MAPS</Text>
              </TouchableOpacity>
              <Text style={st.cardTxt}>👤 Cliente: {p.clientes?.nombre_completo || 'Cliente'}</Text>
              <Text style={st.cardTxt}>💵 Total: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
              {!!p.notas && <Text style={[st.cardTxt, { color: '#F5B041' }]}>📝 Nota: {p.notas}</Text>}
              {(p.pedido_detalles || []).map(d => <Text key={d.id} style={st.detalle}>• {d.cantidad}x {d.nombre_producto}</Text>)}
              {p.estado_rider !== 'En camino a recoger' && (
                <TouchableOpacity style={[st.btnOro, { backgroundColor: '#29B6F6' }]} onPress={() => retirarPedido(p)} disabled={cargando}><Text style={st.txtOscuro}>1. YA RETIRÉ EL PEDIDO DEL LOCAL</Text></TouchableOpacity>
              )}
              {clienteYaRecibio ? (
                <TouchableOpacity style={[st.btnOro, { backgroundColor: '#4CAF50' }]} onPress={() => entregarPedido(p)} disabled={cargando}><Text style={st.txtOscuro}>2. ENTREGADO AL CLIENTE (ACREDITAR GANANCIA)</Text></TouchableOpacity>
              ) : (
                <View style={st.cajaEsperaCli}>
                  <Text style={st.txtEsperaCli}>⏳ Esperando que el cliente pulse "YA RECIBÍ MI PEDIDO" en su app para habilitar el botón Entregado.</Text>
                </View>
              )}
            </View>
          );
        }))}

        {tab === 'entregado' && (misEntregados.length === 0 ? <Text style={st.vacio}>Aún no tienes pedidos entregados confirmados.</Text> : misEntregados.map(p => {
          const dirInfo = separarDireccionYLink(p.direccion);
          return (
            <View key={p.id} style={st.card}>
              <Text style={st.cardTitulo}>✅ Pedido {p.numero_pedido} — COMPLETADO</Text>
              <Text style={st.cardTxt}>📍 {p.distrito || ''} • {dirInfo.textoLimpio}</Text>
              <Text style={st.cardTxt}>👤 Cliente: {p.clientes?.nombre_completo || 'Cliente'}</Text>
              <Text style={[st.cardTxt, { color: '#4CAF50', fontWeight: '800' }]}>💰 Ganancia Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
            </View>
          );
        }))}

        {tab === 'ganancias' && (
          <View>
            <View style={st.card}>
              <Text style={st.sub}>GANANCIAS CONFIRMADAS EN DELIVERIES</Text>
              <Text style={st.monto}>S/ {gananciaTotal.toFixed(2)}</Text>
              <Text style={st.sub}>Total entregados confirmados: {misEntregados.length} pedidos</Text>
            </View>
            {misEntregados.map(p => <View key={p.id} style={st.card}><Text style={st.cardTitulo}>✅ {p.numero_pedido} - {p.distrito}</Text><Text style={st.cardTxt}>Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text></View>)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0A0A0A' }, cajaLogin: { flex: 1, justifyContent: 'center', padding: 24 },
  logoImg: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#F5B041' },
  logoMini: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#F5B041' },
  logo: { color: '#F5B041', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  sub: { color: '#AAA', fontSize: 13, textAlign: 'center', marginBottom: 12 }, subIzq: { color: '#F5B041', fontSize: 11, fontWeight: '800' },
  tarjetaHorario: { backgroundColor: '#161616', borderWidth: 1, borderColor: '#2E2E2E', borderRadius: 8, padding: 8, marginTop: 10 },
  txtHorario: { color: '#DDD', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  input: { backgroundColor: '#181818', color: '#FFF', borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 14, marginBottom: 12 },
  btnOro: { backgroundColor: '#F5B041', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnRojo: { backgroundColor: '#B71C1C', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnMaps: { backgroundColor: '#1565C0', padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  linkMaps: { color: '#4FC3F7', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline', marginVertical: 6 },
  btnEstado: { padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 10 },
  cajaEsperaCli: { backgroundColor: '#0E2433', borderWidth: 1, borderColor: '#29B6F6', padding: 10, borderRadius: 8, marginTop: 8 },
  txtEsperaCli: { color: '#29B6F6', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  txtOscuro: { color: '#0A0A0A', fontWeight: '900', fontSize: 13 }, txtBlanco: { color: '#FFF', fontWeight: '900', fontSize: 12 }, txtOro: { color: '#F5B041', fontWeight: '900' },
  alerta: { backgroundColor: '#222', borderWidth: 1, borderColor: '#F5B041', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  bannerAlarma: { backgroundColor: '#D32F2F', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, nombre: { color: '#FFF', fontSize: 19, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 4, marginBottom: 14 }, tab: { flex: 1, backgroundColor: '#181818', paddingVertical: 10, paddingHorizontal: 2, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  tabAct: { borderColor: '#F5B041', backgroundColor: '#261E0D' }, txtTab: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  vacio: { color: '#777', textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: '#151515', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitulo: { color: '#F5B041', fontWeight: '900', fontSize: 15, marginBottom: 6 }, cardTxt: { color: '#DDD', fontSize: 13, marginBottom: 4 },
  detalle: { color: '#AAA', fontSize: 12, marginLeft: 8 }, monto: { color: '#4CAF50', fontSize: 28, fontWeight: '900', textAlign: 'center', marginVertical: 4 }
});
