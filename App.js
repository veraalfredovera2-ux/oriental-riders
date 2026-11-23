import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, Image, Linking, Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ingresarRider, obtenerPedidosRider, aceptarPedidoDisponibleRider,
  marcarPedidoRecogidoRider, notificarLlegadaPuertaRider, completarEntregaRider
} from './servicios';

const ROJO = '#E50914';
const DORADO = '#F59E0B';
const FONDO = '#070709';
const TARJETA = '#121218';
const BORDE = '#242430';
const VERDE = '#16A34A';

const LOGO_RIDER = require('./file_00000000ea0081f48c2e66d2ba5fd06d.png');

function reproducirTimbreRider() {
  try {
    if (Platform.OS !== 'web') {
      Vibration.vibrate();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate();
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const ahora = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ahora + i * 0.16);
      gain.gain.setValueAtTime(0.24, ahora + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, ahora + i * 0.16 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ahora + i * 0.16);
      osc.stop(ahora + i * 0.16 + 0.36);
    });
  } catch (e) {}
}

function seleccionarYComprimirAvatar() {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return resolve(null);
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = (e) => {
      const file = e.target?.files?.item(0);
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 260;
          const scale = Math.min(max / img.width, max / img.height, 1);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(ev.target?.result || null);
        img.src = ev.target?.result;
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  });
}

function obtenerRangoSemana(offsetSemanas = 0) {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diffLunes = (dia === 0 ? -6 : 1 - dia) + offsetSemanas * 7;
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diffLunes, 0, 0, 0);
  const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 23, 59, 59);
  return { inicio, fin };
}

function obtenerRangoMes(offsetMeses = 0) {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + offsetMeses, 1, 0, 0, 0);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + offsetMeses + 1, 0, 23, 59, 59);
  return { inicio, fin };
}
export default function App() {
  const [rider, setRider] = useState(null);
  const [fotoRider, setFotoRider] = useState(null);
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [disponiblesListos, setDisponiblesListos] = useState([]);
  const [disponible, setDisponible] = useState(true);
  const [periodo, setPeriodo] = useState('esta_semana');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const conteoListosRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('sesion_oriental_rider').then(s => {
      if (s) {
        const parsed = JSON.parse(s);
        setRider(parsed);
        if (parsed?.id) {
          AsyncStorage.getItem(`foto_rider_${parsed.id}`).then(f => { if (f) setFotoRider(f); });
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!rider?.id) return;
    AsyncStorage.getItem(`foto_rider_${rider.id}`).then(f => { if (f) setFotoRider(f); });
    cargarPedidos();
    const t = setInterval(cargarPedidos, 4000);
    return () => clearInterval(t);
  }, [rider?.id]);

  useEffect(() => {
    const cant = (disponiblesListos || []).length;
    if (conteoListosRef.current !== null && cant > conteoListosRef.current && disponible) {
      reproducirTimbreRider();
    }
    conteoListosRef.current = cant;
  }, [disponiblesListos, disponible]);

  async function cambiarFotoRider() {
    try {
      const dataUrl = await seleccionarYComprimirAvatar();
      if (!dataUrl) return;
      setFotoRider(dataUrl);
      if (rider?.id) await AsyncStorage.setItem(`foto_rider_${rider.id}`, dataUrl);
      setAviso({ titulo: 'Foto actualizada', mensaje: 'Tu foto de perfil se guardó correctamente.' });
    } catch (e) { setAviso({ titulo: 'Error', mensaje: 'No se pudo cargar la foto.' }); }
  }

  async function cargarPedidos() {
    if (!rider?.id) return;
    try {
      const data = await obtenerPedidosRider(rider.id);
      setPedidos(data.pedidos || []);
      setDisponiblesListos(data.disponibles || []);
      if (data.perfil) setRider(data.perfil);
    } catch (e) {}
  }

  async function manejarLogin() {
    setCargando(true);
    try {
      const r = await ingresarRider({ telefono, password });
      setRider(r);
      await AsyncStorage.setItem('sesion_oriental_rider', JSON.stringify(r));
    } catch (e) {
      setAviso({ titulo: 'Error al ingresar', mensaje: e.message });
    } finally { setCargando(false); }
  }

  async function cerrarSesion() {
    await AsyncStorage.removeItem('sesion_oriental_rider');
    setRider(null);
    setFotoRider(null);
    setPedidos([]);
    setDisponiblesListos([]);
  }

  function abrirMapaCliente(direccionRaw) {
    const txt = String(direccionRaw || '');
    const url = txt.includes('https://google.com')
      ? 'https://' + txt.split('https://').at(1).split(' ').at(0)
      : `https://google.com/search/?api=1&query=${encodeURIComponent(txt)}`;
    Linking.openURL(url);
  }

  function abrirWhatsAppCliente(p) {
    const tel = String(p.perfiles?.telefono || '').replace(/\D/g, '');
    if (!tel) return setAviso({ titulo: 'Sin teléfono', mensaje: 'Este cliente no tiene teléfono registrado.' });
    const telFinal = tel.length === 9 ? `51${tel}` : tel;
    const msg = encodeURIComponent(`Hola ${p.perfiles?.nombre_completo || ''}, soy ${rider?.nombre_completo || 'tu repartidor'} de El Sazón Oriental 🛵. Ya estoy en la puerta con tu pedido ${p.numero_pedido}.`);
    Linking.openURL(`https://wa.me{telFinal}?text=${msg}`);
  }
    const modalAviso = (
    <>
      {aviso && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 999 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: TARJETA, borderWidth: 1.5, borderColor: ROJO, borderRadius: 16, padding: 18 }}>
            <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 6 }}>{aviso.titulo}</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 14, textAlign: 'center', marginBottom: 14 }}>{aviso.mensaje}</Text>
            <TouchableOpacity onPress={() => setAviso(null)} style={{ backgroundColor: ROJO, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '900' }}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {confirmacion && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.84)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 }}>
          <View style={{ width: '100%', maxWidth: 350, backgroundColor: TARJETA, borderWidth: 1.5, borderColor: DORADO, borderRadius: 16, padding: 20 }}>
            <Text style={{ color: DORADO, fontSize: 11, fontWeight: '900', textAlign: 'center', letterSpacing: 1, marginBottom: 4 }}>CONFIRMAR ACCIÓN</Text>
            <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>{confirmacion.titulo}</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 14, textAlign: 'center', marginBottom: 18 }}>{confirmacion.mensaje}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setConfirmacion(null)} style={{ flex: 1, backgroundColor: '#252530', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#D1D5DB', fontWeight: '800' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const fn = confirmacion.onConfirmar;
                  setConfirmacion(null);
                  if (fn) fn();
                }}
                style={{ flex: 1, backgroundColor: ROJO, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFF', fontWeight: '900' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );

  if (!rider) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: FONDO, justifyContent: 'center', padding: 22 }}>
        {modalAviso}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image source={LOGO_RIDER} style={{ width: 120, height: 120, borderRadius: 60, marginBottom: 12 }} resizeMode="cover" />
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: 1 }}>ORIENTAL RIDERS</Text>
          <Text style={{ color: DORADO, fontSize: 12, fontWeight: '800', marginTop: 2 }}>APP EXCLUSIVA DE REPARTIDORES</Text>
        </View>
        <TextInput
          style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', padding: 14, marginBottom: 12 }}
          placeholder="Teléfono del repartidor"
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
          value={telefono}
          onChangeText={setTelefono}
        />
        <TextInput
          style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', padding: 14, marginBottom: 16 }}
          placeholder="Contraseña"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={manejarLogin} disabled={cargando} style={{ backgroundColor: ROJO, borderRadius: 12, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{cargando ? 'Ingresando...' : 'INGRESAR A MIS REPARTOS'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const enRuta = (pedidos || []).filter(p => p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const entregados = (pedidos || []).filter(p => p.estado === 'Completado');
  const efectivoPorRendir = entregados
    .filter(p => p.metodo_pago === 'Efectivo' && p.estado_rider !== 'Liquidado en caja')
    .reduce((acc, p) => acc + Number(p.total || 0), 0);

  const rango = periodo === 'esta_semana' ? obtenerRangoSemana(0)
    : periodo === 'semana_pasada' ? obtenerRangoSemana(-1)
    : periodo === 'este_mes' ? obtenerRangoMes(0)
    : obtenerRangoMes(-1);

  const filtrados = entregados.filter(p => {
    const f = new Date(p.creado_en || p.created_at || Date.now());
    return f >= rango.inicio && f <= rango.fin;
  });

  const gananciaPeriodo = filtrados.reduce((acc, p) => acc + Number(p.costo_delivery || 0), 0);

  const resumenDias = {};
  filtrados.forEach(p => {
    const f = new Date(p.creado_en || p.created_at || Date.now());
    const clave = f.toISOString().slice(0, 10);
    const etiqueta = f.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });
    if (!resumenDias[clave]) resumenDias[clave] = { label: etiqueta, count: 0, total: 0 };
    resumenDias[clave].count += 1;
    resumenDias[clave].total += Number(p.costo_delivery || 0);
  });
                                        return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FONDO }}>
      {modalAviso}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => {
              reproducirTimbreRider();
              setAviso({ titulo: 'Audio verificado', mensaje: 'El timbre sonará automáticamente cuando cocina publique un pedido listo.' });
            }}
            style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 }}
          >
            <Text style={{ color: DORADO, fontSize: 11, fontWeight: '900' }}>🔔 Timbre</Text>
          </TouchableOpacity>
          <Image source={LOGO_RIDER} style={{ width: 58, height: 58, borderRadius: 29 }} resizeMode="cover" />
          <TouchableOpacity onPress={cargarPedidos} style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>↻</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: '#6B040A', borderWidth: 1.5, borderColor: ROJO, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={cambiarFotoRider}
            style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: DORADO, overflow: 'hidden', backgroundColor: TARJETA, position: 'relative' }}
          >
            <Image source={fotoRider ? { uri: fotoRider } : LOGO_RIDER} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', paddingVertical: 1 }}>
              <Text style={{ color: DORADO, fontSize: 9, fontWeight: '900' }}>📷 FOTO</Text>
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#F3F4F6', fontSize: 11, fontWeight: '900' }}>ORIENTAL RIDERS 🛵</Text>
            <Text style={{ color: DORADO, fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{rider.nombre_completo}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginTop: 3 }}>
              📅 Horario semanal: {rider.direccion_predeterminada || 'Lun a Dom: 12:00 pm - 10:00 pm'}
            </Text>
          </View>

          <View style={{ backgroundColor: ROJO, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' }}>
            <Text style={{ color: DORADO, fontSize: 16, fontWeight: '900' }}>S/ {gananciaPeriodo.toFixed(0)}</Text>
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>Ganancia</Text>
          </View>
        </View>

        {efectivoPorRendir > 0 && (
          <View style={{ backgroundColor: '#261B0A', borderWidth: 1.5, borderColor: DORADO, borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: DORADO, fontSize: 12, fontWeight: '900' }}>💵 EFECTIVO POR RENDIR AL LOCAL</Text>
              <Text style={{ color: '#D1D5DB', fontSize: 11 }}>Entrega este monto en caja para liquidar tu saldo.</Text>
            </View>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>S/ {efectivoPorRendir.toFixed(2)}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => setDisponible(!disponible)}
          style={{ backgroundColor: disponible ? VERDE : '#374151', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 }}
        >
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>
            {disponible ? '🟢 DISPONIBLE PARA REPARTOS' : '⚫ NO DISPONIBLE (DESCANSO)'}
          </Text>
        </TouchableOpacity>

        {disponible && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: DORADO, fontSize: 16, fontWeight: '900', marginBottom: 8 }}>
              🔔 PEDIDOS LISTOS PARA RECOGER ({disponiblesListos.length})
            </Text>
            {disponiblesListos.length === 0 ? (
              <View style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>No hay pedidos nuevos listos en cocina ahora.</Text>
              </View>
            ) : (
              disponiblesListos.map(p => (
                <View key={p.id} style={{ backgroundColor: '#1B150E', borderWidth: 1.5, borderColor: DORADO, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <Text style={{ color: DORADO, fontSize: 15, fontWeight: '900' }}>📦 {p.numero_pedido} • {p.perfiles?.nombre_completo || 'Cliente'}</Text>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', marginTop: 4 }}>📍 Destino: {p.distrito} - {p.direccion}</Text>
                  <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '900', marginTop: 4 }}>
                    Tu ganancia delivery: +S/ {Number(p.costo_delivery || 0).toFixed(2)} • Cobrar: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago})
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: VERDE, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 }}
                    onPress={() => setConfirmacion({
                      titulo: 'Confirmar asignación de reparto',
                      mensaje: `¿Confirmas que aceptarás el pedido ${p.numero_pedido} para recogerlo en el local?`,
                      onConfirmar: async () => {
                        try {
                          await aceptarPedidoDisponibleRider(p.id, rider);
                          await cargarPedidos();
                          setAviso({ titulo: 'Pedido asignado', mensaje: 'Dirígete al local y confirma cuando lo hayas recogido.' });
                        } catch (e) { setAviso({ titulo: 'Aviso', mensaje: e.message }); }
                      }
                    })}
                  >
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>🙋‍♂️ ACEPTAR ESTE PEDIDO</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
        <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', marginBottom: 10 }}>MIS PEDIDOS EN RUTA ({enRuta.length})</Text>
        {enRuta.length === 0 ? (
          <View style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 18 }}>
            <Text style={{ color: '#9CA3AF', fontSize: 13 }}>No tienes entregas activas en este momento.</Text>
          </View>
        ) : (
          enRuta.map(p => (
            <View key={p.id} style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <Text style={{ color: DORADO, fontSize: 15, fontWeight: '900' }}>{p.numero_pedido} • {p.perfiles?.nombre_completo || 'Cliente'}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 3 }}>📱 Teléfono: {p.perfiles?.telefono || 'Sin número'}</Text>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', marginTop: 4 }}>📍 Destino: {p.distrito} - {p.direccion}</Text>
              <Text style={{ color: DORADO, fontSize: 13, fontWeight: '900', marginTop: 6 }}>
                Cobrar: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago}) • Tu ganancia: S/ {Number(p.costo_delivery || 0).toFixed(2)}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }} onPress={() => abrirMapaCliente(p.direccion)}>
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>🗺️ GOOGLE MAPS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#075E54', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }} onPress={() => abrirWhatsAppCliente(p)}>
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>💬 WHATSAPP</Text>
                </TouchableOpacity>
              </View>

              {p.estado !== 'En camino' ? (
                <TouchableOpacity
                  style={{ backgroundColor: DORADO, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
                  onPress={() => setConfirmacion({
                    titulo: 'Confirmar pedido recogido',
                    mensaje: `¿Confirmas que ya recogiste el pedido ${p.numero_pedido} en el local e inicias la ruta de entrega?`,
                    onConfirmar: async () => {
                      try {
                        await marcarPedidoRecogidoRider(p.id);
                        await cargarPedidos();
                        setAviso({ titulo: 'En camino', mensaje: 'Se notificó al cliente que su pedido va en ruta.' });
                      } catch (e) { setAviso({ titulo: 'Aviso', mensaje: e.message }); }
                    }
                  })}
                >
                  <Text style={{ color: '#000', fontSize: 12, fontWeight: '900' }}>🛵 MARCAR COMO RECOGIDO (EN CAMINO)</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {p.estado_rider !== 'En la puerta' && p.recibido_cliente !== true && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#0284C7', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
                      onPress={() => setConfirmacion({
                        titulo: 'Confirmar llegada al domicilio',
                        mensaje: `¿Confirmas que te encuentras en la puerta del domicilio del pedido ${p.numero_pedido}? Se enviará una alerta sonora al cliente.`,
                        onConfirmar: async () => {
                          try {
                            await notificarLlegadaPuertaRider(p.id);
                            await cargarPedidos();
                            setAviso({ titulo: 'Cliente notificado', mensaje: 'Se envió la alerta de llegada al cliente.' });
                          } catch (e) { setAviso({ titulo: 'Aviso', mensaje: e.message }); }
                        }
                      })}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>🚪 ESTOY EN LA PUERTA (AVISAR CLIENTE)</Text>
                    </TouchableOpacity>
                  )}

                  {p.recibido_cliente === true ? (
                    <TouchableOpacity
                      style={{ backgroundColor: VERDE, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
                      onPress={() => setConfirmacion({
                        titulo: 'Confirmar entrega completada',
                        mensaje: `¿Confirmas el cierre de entrega del pedido ${p.numero_pedido} y el registro de tu ganancia?`,
                        onConfirmar: async () => {
                          try {
                            await completarEntregaRider(p);
                            await cargarPedidos();
                            setAviso({ titulo: 'Entrega completada', mensaje: `Se sumó +S/ ${Number(p.costo_delivery || 0).toFixed(2)} a tus ganancias.` });
                          } catch (e) { setAviso({ titulo: 'Aviso', mensaje: e.message }); }
                        }
                      })}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>✅ ENTREGADO (SUMAR GANANCIA)</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ backgroundColor: '#261B0A', borderWidth: 1, borderColor: DORADO, borderRadius: 10, padding: 10, marginTop: 8 }}>
                      <Text style={{ color: DORADO, fontSize: 11, fontWeight: '900', textAlign: 'center' }}>
                        🔒 Bloqueado por seguridad: espera a que el cliente pulse "PEDIDO RECIBIDO" en su app para habilitar ENTREGADO
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          ))
        )}

        <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900', marginBottom: 10 }}>RENDIMIENTO Y GANANCIAS HISTÓRICAS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {[
            { id: 'esta_semana', label: 'Esta semana' },
            { id: 'semana_pasada', label: 'Semana pasada' },
            { id: 'este_mes', label: 'Este mes' },
            { id: 'mes_pasado', label: 'Mes pasado' }
          ].map(pr => (
            <TouchableOpacity
              key={pr.id}
              onPress={() => setPeriodo(pr.id)}
              style={{ backgroundColor: periodo === pr.id ? ROJO : TARJETA, borderWidth: 1, borderColor: periodo === pr.id ? ROJO : BORDE, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 15, marginRight: 8 }}
            >
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{pr.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={{ flex: 1, backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>ENTREGAS COMPLETADAS</Text>
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 2 }}>{filtrados.length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>GANANCIA DEL PERIODO</Text>
            <Text style={{ color: DORADO, fontSize: 22, fontWeight: '900', marginTop: 2 }}>S/ {gananciaPeriodo.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', marginBottom: 8 }}>Desglose guardado por día:</Text>
        {Object.keys(resumenDias).length === 0 ? (
          <View style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Sin entregas registradas en este periodo.</Text>
          </View>
        ) : (
          Object.keys(resumenDias).sort().reverse().map(k => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <View>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{resumenDias[k].label}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{resumenDias[k].count} pedidos entregados</Text>
              </View>
              <Text style={{ color: '#22C55E', fontSize: 15, fontWeight: '900' }}>+ S/ {resumenDias[k].total.toFixed(2)}</Text>
            </View>
          ))
        )}

        <TouchableOpacity onPress={cerrarSesion} style={{ backgroundColor: '#1E1E28', borderWidth: 1, borderColor: BORDE, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 6 }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>↪ Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
