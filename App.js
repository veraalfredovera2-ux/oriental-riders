import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ingresarRider, actualizarEstadoRider, obtenerEnviosDelivery, aceptarEnvioRider, marcarRetiradoLocal, marcarEntregadoCliente } from './servicios';

export default function App() {
  const [rider, setRider] = useState(null);
  const [tel, setTel] = useState('');
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState('disponibles');
  const [envios, setEnvios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [sonando, setSonando] = useState(false);
  const conocidosRef = useRef(null), ctxAudioRef = useRef(null), timerRef = useRef(null), timeoutRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('sesion_oriental_rider').then(s => { if (s) setRider(JSON.parse(s)); });
  }, []);

  useEffect(() => {
    if (!rider?.id) return;
    cargarEnvios();
    const t = setInterval(cargarEnvios, 3000);
    return () => { clearInterval(t); detenerAlarma(); };
  }, [rider?.id, rider?.disponible]);

  function tocarPitido() {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!ctxAudioRef.current) ctxAudioRef.current = new Ctx();
        if (ctxAudioRef.current.state === 'suspended') ctxAudioRef.current.resume();
        const osc = ctxAudioRef.current.createOscillator(), gain = ctxAudioRef.current.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(750, ctxAudioRef.current.currentTime); osc.frequency.setValueAtTime(1050, ctxAudioRef.current.currentTime + 0.16);
        gain.gain.setValueAtTime(0.6, ctxAudioRef.current.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctxAudioRef.current.currentTime + 0.42);
        osc.connect(gain); gain.connect(ctxAudioRef.current.destination); osc.start(); osc.stop(ctxAudioRef.current.currentTime + 0.42);
      }
    } catch (e) {}
  }

  function detenerAlarma() { if (timerRef.current) clearInterval(timerRef.current); if (timeoutRef.current) clearTimeout(timeoutRef.current); timerRef.current = null; timeoutRef.current = null; setSonando(false); }
  function activarAlarma() {
    detenerAlarma(); setSonando(true);
    try { Vibration.vibrate(); } catch (e) {}
    tocarPitido();
    timerRef.current = setInterval(tocarPitido, 900);
    timeoutRef.current = setTimeout(detenerAlarma, 10000);
  }

  async function cargarEnvios() {
    try {
      const lista = await obtenerEnviosDelivery();
      setEnvios(lista || []);
      const libres = (lista || []).filter(p => p.estado === 'Confirmado por local' && !p.rider_id);
      if (conocidosRef.current === null) { conocidosRef.current = libres.map(p => p.id); return; }
      if (libres.some(p => !conocidosRef.current.includes(p.id)) && rider?.disponible !== false) activarAlarma();
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
      setRider(r); tocarPitido();
    } catch (e) { setAviso(e.message); } finally { setCargando(false); }
  }

  async function alternarDisponible() {
    try {
      const nuevo = !rider.disponible;
      await actualizarEstadoRider(rider.id, nuevo);
      const act = { ...rider, disponible: nuevo };
      setRider(act); await AsyncStorage.setItem('sesion_oriental_rider', JSON.stringify(act));
      if (nuevo) tocarPitido(); else detenerAlarma();
    } catch (e) { setAviso(e.message); }
  }

  async function tomarEnvio(ped) {
    setCargando(true);
    try { detenerAlarma(); await aceptarEnvioRider(ped, rider); await cargarEnvios(); setTab('mis_envios'); setAviso('¡Envío asignado! Dirígete al local.'); }
    catch (e) { await cargarEnvios(); setAviso(e.message); } finally { setCargando(false); }
  }

  async function retirarPedido(ped) {
    setCargando(true);
    try { await marcarRetiradoLocal(ped.id); await cargarEnvios(); setAviso('Pedido marcado como RETIRADO. En camino al cliente.'); }
    catch (e) { setAviso(e.message); } finally { setCargando(false); }
  }

  async function entregarPedido(ped) {
    setCargando(true);
    try { await marcarEntregadoCliente(ped); await cargarEnvios(); setAviso('¡Pedido ENTREGADO con éxito!'); }
    catch (e) { setAviso(e.message); } finally { setCargando(false); }
  }

  async function salir() {
    await AsyncStorage.removeItem('sesion_oriental_rider');
    detenerAlarma(); setRider(null);
  }

  if (!rider) {
    return (
      <SafeAreaView style={st.pantalla}>
        <View style={st.cajaLogin}>
          <Text style={st.logo}>🛵 ORIENTAL RIDERS</Text>
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
  const misActivos = envios.filter(p => p.rider_id === rider.id && p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const misCompletados = envios.filter(p => p.rider_id === rider.id && p.estado === 'Completado');
  const gananciaTotal = misCompletados.reduce((acc, p) => acc + Number(p.costo_delivery || 0), 0);

  return (
    <SafeAreaView style={st.pantalla}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={st.fila}>
          <View><Text style={st.sub}>Repartidor,</Text><Text style={st.nombre}>{rider.nombre_completo}</Text></View>
          <TouchableOpacity style={st.btnRojo} onPress={salir}><Text style={st.txtBlanco}>CERRAR SESIÓN</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={[st.btnEstado, { backgroundColor: rider.disponible ? '#2E7D32' : '#444' }]} onPress={alternarDisponible}>
          <Text style={st.txtBlanco}>{rider.disponible ? '🟢 DISPONIBLE PARA REPARTOS' : '🔴 DESCONECTADO (TOCA PARA ACTIVAR)'}</Text>
        </TouchableOpacity>
        {sonando && <TouchableOpacity style={st.bannerAlarma} onPress={detenerAlarma}><Text style={st.txtBlanco}>🔔 ¡NUEVO ENVÍO DISPONIBLE! (TOCA PARA SILENCIAR)</Text></TouchableOpacity>}
        {aviso && <View style={st.alerta}><Text style={st.txtBlanco}>{aviso}</Text><TouchableOpacity onPress={() => setAviso(null)}><Text style={st.txtOro}>OK</Text></TouchableOpacity></View>}
        <View style={st.tabs}>
          <TouchableOpacity style={[st.tab, tab === 'disponibles' && st.tabAct]} onPress={() => setTab('disponibles')}><Text style={st.txtTab}>DISPONIBLES ({libres.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'mis_envios' && st.tabAct]} onPress={() => setTab('mis_envios')}><Text style={st.txtTab}>EN CURSO ({misActivos.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'ganancias' && st.tabAct]} onPress={() => setTab('ganancias')}><Text style={st.txtTab}>GANANCIAS</Text></TouchableOpacity>
        </View>
        {tab === 'disponibles' && (libres.length === 0 ? <Text style={st.vacio}>No hay pedidos listos para recoger ahora.</Text> : libres.map(p => (
          <View key={p.id} style={st.card}>
            <Text style={st.cardTitulo}>🛵 Pedido {p.numero_pedido} • Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
            <Text style={st.cardTxt}>📍 {p.distrito} — {p.direccion}</Text>
            <Text style={st.cardTxt}>👤 {p.clientes?.nombre_completo} ({p.clientes?.telefono})</Text>
            <Text style={st.cardTxt}>💵 Cobrar: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
            <TouchableOpacity style={st.btnOro} onPress={() => tomarEnvio(p)} disabled={cargando}><Text style={st.txtOscuro}>ACEPTAR REPARTO</Text></TouchableOpacity>
          </View>
        )))}
        {tab === 'mis_envios' && (misActivos.length === 0 ? <Text style={st.vacio}>No tienes envíos activos.</Text> : misActivos.map(p => (
          <View key={p.id} style={st.card}>
            <Text style={st.cardTitulo}>📦 {p.numero_pedido} — {p.estado_rider || 'Asignado'}</Text>
            <Text style={st.cardTxt}>📍 {p.distrito} — {p.direccion}</Text>
            <Text style={st.cardTxt}>👤 {p.clientes?.nombre_completo} • Tel: {p.clientes?.telefono}</Text>
            <Text style={st.cardTxt}>💵 Total: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
            {(p.pedido_detalles || []).map(d => <Text key={d.id} style={st.detalle}>• {d.cantidad}x {d.nombre_producto}</Text>)}
            {p.estado_rider === 'En camino a recoger' && <TouchableOpacity style={[st.btnOro, { backgroundColor: '#29B6F6' }]} onPress={() => retirarPedido(p)} disabled={cargando}><Text style={st.txtOscuro}>1. YA RETIRÉ EL PEDIDO DEL LOCAL</Text></TouchableOpacity>}
            <TouchableOpacity style={[st.btnOro, { backgroundColor: '#4CAF50' }]} onPress={() => entregarPedido(p)} disabled={cargando}><Text style={st.txtOscuro}>2. ENTREGADO AL CLIENTE</Text></TouchableOpacity>
          </View>
        )))}
        {tab === 'ganancias' && (
          <View>
            <View style={st.card}><Text style={st.sub}>GANANCIAS ACUMULADAS</Text><Text style={st.monto}>S/ {gananciaTotal.toFixed(2)}</Text><Text style={st.sub}>{misCompletados.length} entregas realizadas</Text></View>
            {misCompletados.map(p => <View key={p.id} style={st.card}><Text style={st.cardTit}>✅ {p.numero_pedido} — {p.distrito}</Text><Text style={st.cardTxt}>Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text></View>)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#0A0A0A' }, cajaLogin: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { color: '#F5B041', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  sub: { color: '#AAA', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  input: { backgroundColor: '#181818', color: '#FFF', borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 14, marginBottom: 12 },
  btnOro: { backgroundColor: '#F5B041', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnRojo: { backgroundColor: '#B71C1C', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnEstado: { padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 12 },
  txtOscuro: { color: '#111', fontWeight: '900', fontSize: 13 }, txtBlanco: { color: '#FFF', fontWeight: '900', fontSize: 12 }, txtOro: { color: '#F5B041', fontWeight: '900' },
  alerta: { backgroundColor: '#222', borderWidth: 1, borderColor: '#F5B041', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  bannerAlarma: { backgroundColor: '#D32F2F', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, nombre: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 14 }, tab: { flex: 1, backgroundColor: '#181818', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  tabAct: { borderColor: '#F5B041', backgroundColor: '#261E0D' }, txtTab: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  vacio: { color: '#777', textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: '#151515', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitulo: { color: '#F5B041', fontWeight: '900', fontSize: 15, marginBottom: 6 }, cardTxt: { color: '#DDD', fontSize: 13, marginBottom: 4 },
  detalle: { color: '#AAA', fontSize: 12, marginLeft: 8 }, monto: { color: '#4CAF50', fontSize: 28, fontWeight: '900', textAlign: 'center', marginVertical: 4 }
});
          
