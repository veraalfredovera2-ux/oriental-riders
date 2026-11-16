import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Vibration, Platform, Linking } from 'react-native';
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

  function abrirEnMaps(direccion, distrito) {
    const destino = encodeURIComponent(`${direccion || ''}, ${distrito || ''}, Lima, Peru`);
    Linking.openURL(`https://google.com{destino}`);
  }

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
  const esPendiente = (est) => est === 'Pendiente' || est === 'Pendiente de confirmación';

  useEffect(() => {
    const pendientes = (pedidos || []).filter(p => esPendiente(p.estado));
    if (conocidosRef.current === null) { conocidosRef.current = pendientes.map(p => p.id); return; }
    if (pendientes.some(p => !conocidosRef.current.includes(p.id)) && audioListo) activarAlarma10Seg();
    if (pendientes.length === 0) detenerAlarma();
    conocidosRef.current = pendientes.map(p => p.id);
  }, [pedidos, audioListo]);

  function tocarPitidoWeb() {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!ctxAudioRef.current) ctxAudioRef.current = new Ctx();
        if (ctxAudioRef.current.state === 'suspended') ctxAudioRef.current.resume();
        const osc = ctxAudioRef.current.createOscillator(), gain = ctxAudioRef.current.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(880, ctxAudioRef.current.currentTime); osc.frequency.setValueAtTime(1100, ctxAudioRef.current.currentTime + 0.18);
        gain.gain.setValueAtTime(0.6, ctxAudioRef.current.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctxAudioRef.current.currentTime + 0.45);
        osc.connect(gain); gain.connect(ctxAudioRef.current.destination); osc.start(); osc.stop(ctxAudioRef.current.currentTime + 0.45);
      }
    } catch (e) {}
  }

  function detenerAlarma() { if (timerRef.current) clearInterval(timerRef.current); if (timeoutRef.current) clearTimeout(timeoutRef.current); timerRef.current = null; timeoutRef.current = null; setSonando(false); }
  function activarAlarma10Seg() {
    detenerAlarma(); setSonando(true);
    try { Vibration.vibrate(); } catch (e) {}
    try { if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') new Notification('🔔 Club Sazón', { body: '¡Llegó un nuevo pedido!' }); } catch (e) {}
    tocarPitidoWeb();
    timerRef.current = setInterval(tocarPitidoWeb, 900);
    timeoutRef.current = setTimeout(detenerAlarma, 10000);
  }

  function estiloEstado(est) {
    if (esPendiente(est)) return { badge: { borderColor: '#F5B041', backgroundColor: '#2B210B' }, texto: { color: '#F5B041' } };
    if (est === 'Completado') return { badge: { borderColor: '#4CAF50', backgroundColor: '#132615' }, texto: { color: '#4CAF50' } };
    if (est === 'Cancelado') return { badge: { borderColor: '#E53935', backgroundColor: '#2A1215' }, texto: { color: '#E53935' } };
    return { badge: { borderColor: '#29B6F6', backgroundColor: '#0E2433' }, texto: { color: '#29B6F6' } };
  }

  async function elegirFoto(destino) {
    try {
      setSubiendoImg(true);
      const url = await subirImagenGaleria();
      if (!url) return;
      if (destino === 'prod') setEditProd(prev => ({ ...prev, imagen_url: url }));
      if (destino === 'promo') setEditPromo(prev => ({ ...prev, imagen_url: url }));
      mostrarAviso('Foto cargada', 'La imagen se subió correctamente.');
    } catch (e) { mostrarAviso('Error al subir', e.message); } finally { setSubiendoImg(false); }
  }

  async function cargarTodoAdmin() { try { const [p, r, pr, c, sc, rd] = await Promise.all([obtenerCatalogo(false), obtenerRecompensas(false), obtenerPromociones(false), obtenerConfigPagos(), obtenerSolicitudesCanje(), obtenerRidersAdmin()]); setProductos(p || []); setRecompensas(r || []); setPromociones(pr || []); setCfgPagos(c); setSolicitudesCanje(sc || []); setRiders(rd || []); } catch (e) {} }
  async function guardarProd() { if (editProd.nombre.trim()) try { await guardarProductoAdmin(editProd); setEditProd(null); await cargarTodoAdmin(); mostrarAviso('Guardado', 'Producto actualizado.'); } catch (e) { mostrarAviso('Error', e.message); } }
  async function borrarProd(id) { try { await eliminarProductoAdmin(id); setEditProd(null); await cargarTodoAdmin(); mostrarAviso('Eliminado', 'Plato eliminado del menú.'); } catch (e) { mostrarAviso('Error', e.message); } }
  async function guardarRider() { if (!editRider.nombre_completo.trim() || !editRider.telefono.trim() || !editRider.password.trim()) return mostrarAviso('Faltan datos', 'Completa nombre, teléfono y contraseña.'); try { await guardarRiderAdmin(editRider); setEditRider(null); await cargarTodoAdmin(); mostrarAviso('Guardado', 'Repartidor actualizado.'); } catch (e) { mostrarAviso('Error', e.message); } }
  async function borrarRider(id) { try { await eliminarRiderAdmin(id); setEditRider(null); await cargarTodoAdmin(); mostrarAviso('Eliminado', 'Repartidor eliminado.'); } catch (e) { mostrarAviso('Error', e.message); } }
  async function cambiarHorarioRapido(prod, nuevoTurno, nuevaDisp) { try { await guardarProductoAdmin({ ...prod, turno: nuevoTurno, disponible: nuevaDisp }); await cargarTodoAdmin(); } catch (e) { mostrarAviso('Error', e.message); } }
  async function guardarRec() { if (!editRec.titulo.trim() || !String(editRec.puntos_requeridos).trim()) return mostrarAviso('Faltan datos', 'Escribe título y puntos.'); try { await guardarRecompensaAdmin(editRec); setEditRec(null); await cargarTodoAdmin(); mostrarAviso('Guardado', 'Premio actualizado.'); } catch (e) { mostrarAviso('Error', e.message); } }
  async function guardarPromo() { if (!editPromo.titulo.trim()) return mostrarAviso('Faltan datos', 'Escribe el título.'); try { await guardarPromocionAdmin(editPromo); setEditPromo(null); await cargarTodoAdmin(); mostrarAviso('Guardado', 'Guardado correctamente.'); } catch (e) { mostrarAviso('Error', e.message); } }
  async function entregarCanje(id) { try { await confirmarEntregaCanje(id); await cargarTodoAdmin(); mostrarAviso('Entregado', 'Canje entregado.'); } catch (e) { mostrarAviso('Error', e.message); } }
  async function guardarPagos() { try { await guardarConfigPagos(cfgPagos); mostrarAviso('Guardado', 'QR actualizados.'); } catch (e) { mostrarAviso('Error', e.message); } }
    const libres = envios.filter(p => p.estado === 'Confirmado por local' && !p.rider_id);
  const misEnCamino = envios.filter(p => p.rider_id === rider.id && p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const misEntregados = envios.filter(p => p.rider_id === rider.id && p.estado === 'Completado');
  const gananciaTotal = misEntregados.reduce((acc, p) => acc + Number(p.costo_delivery || 0), 0);

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
          <TouchableOpacity style={[st.tab, tab === 'recoger' && st.tabAct]} onPress={() => setTab('recoger')}><Text style={st.txtTab}>RECOGER ({libres.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'en_camino' && st.tabAct]} onPress={() => setTab('en_camino')}><Text style={st.txtTab}>EN CAMINO ({misEnCamino.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'entregado' && st.tabAct]} onPress={() => setTab('entregado')}><Text style={st.txtTab}>ENTREGADO ({misEntregados.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'ganancias' && st.tabAct]} onPress={() => setTab('ganancias')}><Text style={st.txtTab}>GANANCIAS</Text></TouchableOpacity>
        </View>

        {tab === 'recoger' && (libres.length === 0 ? <Text style={st.vacio}>No hay pedidos listos para recoger ahora.</Text> : libres.map(p => (
          <View key={p.id} style={st.card}>
            <Text style={st.cardTitulo}>🛵 Pedido {p.numero_pedido} • Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
            <TouchableOpacity onPress={() => abrirEnMaps(p.direccion, p.distrito)}><Text style={st.linkMaps}>📍 {p.distrito} — {p.direccion} (VER EN MAPS 🗺️)</Text></TouchableOpacity>
            <Text style={st.cardTxt}>👤 {p.clientes?.nombre_completo} ({p.clientes?.telefono})</Text>
            <Text style={st.cardTxt}>💵 Cobrar: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
            <TouchableOpacity style={st.btnOro} onPress={() => tomarEnvio(p)} disabled={cargando}><Text style={st.txtOscuro}>ACEPTAR Y RECOGER PEDIDO</Text></TouchableOpacity>
          </View>
        )))}

        {tab === 'en_camino' && (misEnCamino.length === 0 ? <Text style={st.vacio}>No tienes entregas en camino.</Text> : misEnCamino.map(p => (
          <View key={p.id} style={st.card}>
            <Text style={st.cardTitulo}>📦 {p.numero_pedido} — {p.estado_rider || 'Asignado'}</Text>
            <TouchableOpacity style={st.btnMaps} onPress={() => abrirEnMaps(p.direccion, p.distrito)}>
              <Text style={st.txtBlanco}>🗺️ ABRIR GOOGLE MAPS: {p.direccion} ({p.distrito})</Text>
            </TouchableOpacity>
            <Text style={st.cardTxt}>👤 {p.clientes?.nombre_completo} • Tel: {p.clientes?.telefono}</Text>
            <Text style={st.cardTxt}>💵 Total: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})</Text>
            {(p.pedido_detalles || []).map(d => <Text key={d.id} style={st.detalle}>• {d.cantidad}x {d.nombre_producto}</Text>)}
            {p.estado_rider === 'En camino a recoger' && <TouchableOpacity style={[st.btnOro, { backgroundColor: '#29B6F6' }]} onPress={() => retirarPedido(p)} disabled={cargando}><Text style={st.txtOscuro}>1. YA RETIRÉ EL PEDIDO DEL LOCAL</Text></TouchableOpacity>}
            <TouchableOpacity style={[st.btnOro, { backgroundColor: '#4CAF50' }]} onPress={() => entregarPedido(p)} disabled={cargando}><Text style={st.txtOscuro}>2. ENTREGADO AL CLIENTE</Text></TouchableOpacity>
          </View>
        )))}

        {tab === 'entregado' && (misEntregados.length === 0 ? <Text style={st.vacio}>Aún no tienes pedidos entregados.</Text> : misEntregados.map(p => (
          <View key={p.id} style={st.card}>
            <Text style={st.cardTitulo}>✅ Pedido {p.numero_pedido} — ENTREGADO</Text>
            <Text style={st.cardTxt}>📍 {p.distrito} — {p.direccion}</Text>
            <Text style={st.cardTxt}>👤 Cliente: {p.clientes?.nombre_completo}</Text>
            <Text style={[st.cardTxt, { color: '#4CAF50', fontWeight: '800' }]}>💰 Ganancia Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
          </View>
        )))}

        {tab === 'ganancias' && (
          <View>
            <View style={st.card}><Text style={st.sub}>GANANCIAS ACUMULADAS EN DELIVERIES</Text><Text style={st.monto}>S/ {gananciaTotal.toFixed(2)}</Text><Text style={st.sub}>{misEntregados.length} entregas realizadas</Text></View>
            {misEntregados.map(p => <View key={p.id} style={st.card}><Text style={st.cardTitulo}>✅ {p.numero_pedido} — {p.distrito}</Text><Text style={st.cardTxt}>Delivery: S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text></View>)}
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
  btnMaps: { backgroundColor: '#1565C0', padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  linkMaps: { color: '#4FC3F7', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline', marginBottom: 6 },
  btnEstado: { padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 12 },
  txtOscuro: { color: '#111', fontWeight: '900', fontSize: 13 }, txtBlanco: { color: '#FFF', fontWeight: '900', fontSize: 12 }, txtOro: { color: '#F5B041', fontWeight: '900' },
  alerta: { backgroundColor: '#222', borderWidth: 1, borderColor: '#F5B041', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  bannerAlarma: { backgroundColor: '#D32F2F', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, nombre: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 4, marginBottom: 14 }, tab: { flex: 1, backgroundColor: '#181818', paddingVertical: 10, paddingHorizontal: 2, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  tabAct: { borderColor: '#F5B041', backgroundColor: '#261E0D' }, txtTab: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  vacio: { color: '#777', textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: '#151515', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitulo: { color: '#F5B041', fontWeight: '900', fontSize: 15, marginBottom: 6 }, cardTxt: { color: '#DDD', fontSize: 13, marginBottom: 4 },
  detalle: { color: '#AAA', fontSize: 12, marginLeft: 8 }, monto: { color: '#4CAF50', fontSize: 28, fontWeight: '900', textAlign: 'center', marginVertical: 4 }
});
          
