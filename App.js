import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, Image, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ingresarRider, obtenerPedidosRider, marcarPedidoEnCamino, completarEntregaRider } from './servicios';

const LOGO_RIDER = require('./file_00000000ea0081f48c2e66d2ba5fd06d.png');
const FONDO = '#0A0A0C';
const TARJETA = '#141418';
const BORDE = '#26262E';
const DORADO = '#FBBF24';
const ROJO = '#DC2626';
const VERDE = '#16A34A';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.style.backgroundColor = FONDO;
  document.body.style.backgroundColor = FONDO;
  document.body.style.margin = '0';
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
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
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
  const [disponible, setDisponible] = useState(true);
  const [tab, setTab] = useState('recoger');
  const [periodo, setPeriodo] = useState('esta_semana');
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('sesion_oriental_rider').then(s => {
      if (s) {
        const p = JSON.parse(s);
        setRider(p);
        if (p?.id) AsyncStorage.getItem(`foto_rider_${p.id}`).then(f => { if (f) setFotoRider(f); });
      }
    });
  }, []);

  useEffect(() => {
    if (!rider?.id) return;
    AsyncStorage.getItem(`foto_rider_${rider.id}`).then(f => { if (f) setFotoRider(f); });
    cargarPedidos();
    const t = setInterval(cargarPedidos, 5000);
    return () => clearInterval(t);
  }, [rider?.id]);

  async function cargarPedidos() {
    if (!rider?.id) return;
    try {
      const res = await obtenerPedidosRider(rider.id);
      setPedidos(res.pedidos || []);
      if (res.perfil) {
        setRider(res.perfil);
        await AsyncStorage.setItem('sesion_oriental_rider', JSON.stringify(res.perfil));
      }
    } catch (e) {}
  }

  async function manejarLogin() {
    setCargando(true);
    try {
      const perfil = await ingresarRider({ telefono, password });
      setRider(perfil);
      await AsyncStorage.setItem('sesion_oriental_rider', JSON.stringify(perfil));
    } catch (e) {
      setAviso({ titulo: 'Error al ingresar', mensaje: e.message });
    } finally {
      setCargando(false);
    }
  }

  async function cambiarFotoRider() {
    try {
      const dataUrl = await seleccionarYComprimirAvatar();
      if (!dataUrl) return;
      setFotoRider(dataUrl);
      if (rider?.id) await AsyncStorage.setItem(`foto_rider_${rider.id}`, dataUrl);
      setAviso({ titulo: 'Foto actualizada', mensaje: 'Tu foto de perfil se guardó correctamente.' });
    } catch (e) {
      setAviso({ titulo: 'Error', mensaje: 'Intenta con una foto más ligera.' });
    }
  }

  async function cerrarSesion() {
    await AsyncStorage.removeItem('sesion_oriental_rider');
    setRider(null);
    setFotoRider(null);
    setPedidos([]);
  }

  function abrirMapaCliente(dir) {
    const match = (dir || '').match(/https:\/\/www\.google\.com\/maps\?q=[^\s|]+/);
    if (match) return Linking.openURL(match).catch(() => {});
    const query = encodeURIComponent(dir || 'Lima, Peru');
    Linking.openURL(`https://google.com{query}`).catch(() => {});
  }
    const modalAviso = aviso && (
    <View style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 999 }}>
      <View style={{ width: '100%', maxWidth: 340, backgroundColor: TARJETA, borderWidth: 1.5, borderColor: DORADO, borderRadius: 16, padding: 18 }}>
        <Text style={{ color: DORADO, fontSize: 16, fontWeight: '900', marginBottom: 6 }}>{aviso.titulo}</Text>
        <Text style={{ color: '#E5E7EB', fontSize: 13, marginBottom: 14 }}>{aviso.mensaje}</Text>
        <TouchableOpacity style={{ backgroundColor: DORADO, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }} onPress={() => setAviso(null)}>
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Entendido</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!rider) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: FONDO, justifyContent: 'center', padding: 22 }}>
        {modalAviso}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 124, height: 124, borderRadius: 62, borderWidth: 2.5, borderColor: DORADO, overflow: 'hidden', backgroundColor: '#141418', marginBottom: 16 }}>
            <Image source={LOGO_RIDER} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          <Text style={{ color: DORADO, fontSize: 26, fontWeight: '900', letterSpacing: 1 }}>ORIENTAL RIDERS</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>App Oficial de Repartidores • Club Sazón</Text>
        </View>

        <TextInput
          style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, marginBottom: 12 }}
          placeholder="Teléfono del repartidor"
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
          value={telefono}
          onChangeText={setTelefono}
        />
        <TextInput
          style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, color: '#FFF', paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, marginBottom: 16 }}
          placeholder="Contraseña"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          style={{ backgroundColor: DORADO, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
          onPress={manejarLogin}
          disabled={cargando}
        >
          <Text style={{ color: '#000', fontSize: 15, fontWeight: '900' }}>{cargando ? 'INGRESANDO...' : 'INICIAR SESIÓN'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const activos = pedidos.filter(p => p.estado !== 'Completado' && p.estado !== 'Cancelado');
  const entregados = pedidos.filter(p => p.estado === 'Completado');
  const paraRecoger = activos.filter(p => p.estado === 'Pendiente');
  const enCamino = activos.filter(p => p.estado !== 'Pendiente');

  const rango = periodo === 'esta_semana'
    ? obtenerRangoSemana(0)
    : periodo === 'semana_pasada'
      ? obtenerRangoSemana(-1)
      : periodo === 'este_mes'
        ? obtenerRangoMes(0)
        : obtenerRangoMes(-1);

  const filtrados = entregados.filter(p => {
    const f = new Date(p.creado_en);
    return f >= rango.inicio && f <= rango.fin;
  });

  const gananciaPeriodo = filtrados.reduce((acc, p) => acc + Number(p.costo_delivery || 0), 0);
  const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const resumenDias = {};
  filtrados.forEach(p => {
    const f = new Date(p.creado_en);
    const key = f.toISOString().slice(0, 10);
    const label = `${diasNombres[f.getDay()]} ${key.slice(8, 10)}/${key.slice(5, 7)}`;
    if (!resumenDias[key]) resumenDias[key] = { label, count: 0, total: 0 };
    resumenDias[key].count += 1;
    resumenDias[key].total += Number(p.costo_delivery || 0);
  });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FONDO }}>
      {modalAviso}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <TouchableOpacity
              onPress={cambiarFotoRider}
              style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: DORADO, overflow: 'hidden', backgroundColor: TARJETA, position: 'relative' }}
            >
              <Image source={fotoRider ? { uri: fotoRider } : LOGO_RIDER} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', paddingVertical: 1 }}>
                <Text style={{ color: DORADO, fontSize: 9, fontWeight: '900' }}>📷 FOTO</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: DORADO, fontSize: 12, fontWeight: '800' }}>Repartidor • {entregados.length} entregados</Text>
              <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '900' }} numberOfLines={1}>{rider.nombre_completo}</Text>
              <TouchableOpacity onPress={cambiarFotoRider}>
                <Text style={{ color: '#9CA3AF', fontSize: 11 }}>Toca tu círculo para subir foto</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={cerrarSesion} style={{ backgroundColor: ROJO, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 }}>
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>SALIR</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10, alignItems: 'center' }}>
          <Text style={{ color: '#E5E7EB', fontSize: 12, fontWeight: '800' }}>
            📅 Horario: {rider.direccion_predeterminada || 'Lun a Dom: 12:00 pm - 10:00 pm'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setDisponible(!disponible)}
          style={{ backgroundColor: disponible ? VERDE : '#374151', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 14 }}
        >
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>
            {disponible ? '🟢 DISPONIBLE PARA REPARTOS' : '⚫ NO DISPONIBLE (DESCANSO)'}
          </Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {[
            { id: 'recoger', label: `RECOGER (${paraRecoger.length})` },
            { id: 'camino', label: `EN CAMINO (${enCamino.length})` },
            { id: 'entregado', label: `ENTREGADO (${entregados.length})` },
            { id: 'ganancias', label: 'GANANCIAS' }
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                backgroundColor: TARJETA,
                borderWidth: 1.5,
                borderColor: tab === t.id ? DORADO : BORDE,
                borderRadius: 10,
                paddingVertical: 9,
                paddingHorizontal: 13,
                marginRight: 8
              }}
            >
              <Text style={{ color: tab === t.id ? DORADO : '#E5E7EB', fontSize: 11, fontWeight: '900' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
                    {(tab === 'recoger' || tab === 'camino') && (
          <View>
            {(tab === 'recoger' ? paraRecoger : enCamino).length === 0 ? (
              <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 24 }}>
                {tab === 'recoger' ? 'No hay pedidos listos para recoger ahora.' : 'No tienes pedidos en camino en este momento.'}
              </Text>
            ) : (
              (tab === 'recoger' ? paraRecoger : enCamino).map(p => (
                <View key={p.id} style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                  <Text style={{ color: DORADO, fontSize: 15, fontWeight: '900' }}>{p.numero_pedido} • {p.perfiles?.nombre_completo || 'Cliente'}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 3 }}>📱 Teléfono: {p.perfiles?.telefono || 'Sin teléfono'}</Text>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', marginTop: 4 }}>📍 {p.distrito} - {p.direccion}</Text>
                  <Text style={{ color: DORADO, fontSize: 13, fontWeight: '900', marginTop: 6 }}>
                    Cobrar: S/ {Number(p.total).toFixed(2)} ({p.metodo_pago}) • Tu ganancia: S/ {Number(p.costo_delivery || 0).toFixed(2)}
                  </Text>
                  <TouchableOpacity style={{ backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10 }} onPress={() => abrirMapaCliente(p.direccion)}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>🗺️ VER RUTA EN GOOGLE MAPS</Text>
                  </TouchableOpacity>
                  {p.estado === 'Pendiente' ? (
                    <TouchableOpacity
                      style={{ backgroundColor: DORADO, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 8 }}
                      onPress={async () => { await marcarPedidoEnCamino(p.id); await cargarPedidos(); setTab('camino'); }}
                    >
                      <Text style={{ color: '#000', fontSize: 12, fontWeight: '900' }}>🛵 CONFIRMAR RECOJO Y SALIR</Text>
                    </TouchableOpacity>
                  ) : p.recibido_cliente ? (
                    <TouchableOpacity
                      style={{ backgroundColor: VERDE, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
                      onPress={async () => {
                        try {
                          await completarEntregaRider(p);
                          await cargarPedidos();
                          setAviso({ titulo: '¡Entrega completada!', mensaje: `Ganancia sumada: +S/ ${Number(p.costo_delivery || 0).toFixed(2)}` });
                        } catch (e) { setAviso({ titulo: 'Aviso', mensaje: e.message }); }
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>✅ MARCAR PEDIDO ENTREGADO</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ backgroundColor: '#261B0A', borderWidth: 1, borderColor: DORADO, borderRadius: 10, padding: 10, marginTop: 8 }}>
                      <Text style={{ color: DORADO, fontSize: 11, fontWeight: '900', textAlign: 'center' }}>
                        ⏳ Esperando que el cliente pulse "PEDIDO RECIBIDO" en su app para finalizar
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'entregado' && (
          <View>
            {entregados.length === 0 ? (
              <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 24 }}>Aún no tienes pedidos entregados.</Text>
            ) : (
              entregados.map(p => (
                <View key={p.id} style={{ backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{p.numero_pedido} • {p.perfiles?.nombre_completo || 'Cliente'}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{p.distrito} - {p.direccion}</Text>
                  <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '900', marginTop: 4 }}>✅ Entregado • Ganancia: +S/ {Number(p.costo_delivery || 0).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'ganancias' && (
          <View>
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
                  style={{ backgroundColor: periodo === pr.id ? DORADO : TARJETA, borderWidth: 1, borderColor: periodo === pr.id ? DORADO : BORDE, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 }}
                >
                  <Text style={{ color: periodo === pr.id ? '#000' : '#FFF', fontSize: 11, fontWeight: '900' }}>{pr.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1, backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>ENTREGAS</Text>
                <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 2 }}>{filtrados.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: TARJETA, borderWidth: 1, borderColor: BORDE, borderRadius: 14, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '800' }}>GANANCIA TOTAL</Text>
                <Text style={{ color: DORADO, fontSize: 22, fontWeight: '900', marginTop: 2 }}>S/ {gananciaPeriodo.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900', marginBottom: 8 }}>Desglose guardado por día:</Text>
            {Object.keys(resumenDias).length === 0 ? (
              <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginTop: 12 }}>Sin ganancias registradas en este periodo.</Text>
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
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
                      }
          
