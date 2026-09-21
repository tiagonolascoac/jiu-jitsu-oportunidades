import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/ConfiguracaoPresenca.css';

const CONFIG_REF = doc(db, 'configuracoes', 'presenca');

function ConfiguracaoPresenca({ user }) {
  const [form, setForm] = useState({ nomeLocal: 'Local das aulas', latitude: '', longitude: '', raioMetros: 100 });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(CONFIG_REF);
        if (snap.exists()) {
          const data = snap.data();
          setForm({
            nomeLocal: data.nomeLocal || 'Local das aulas',
            latitude: data.latitude ?? '',
            longitude: data.longitude ?? '',
            raioMetros: data.raioMetros ?? 100,
          });
        }
      } catch (e) {
        console.error(e);
        setErro('Não foi possível carregar a configuração de presença.');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const usarLocalizacaoAtual = () => {
    setErro('');
    setMensagem('');
    if (!navigator.geolocation) {
      setErro('Este navegador não oferece suporte à geolocalização.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((prev) => ({ ...prev, latitude: coords.latitude.toFixed(7), longitude: coords.longitude.toFixed(7) }));
        setMensagem(`Localização capturada com precisão aproximada de ${Math.round(coords.accuracy)} m.`);
      },
      () => setErro('Não foi possível obter sua localização. Verifique a permissão de localização do navegador.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const raioMetros = Number(form.raioMetros);
    if (!form.nomeLocal.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setErro('Informe o nome do local, latitude e longitude válidos.');
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setErro('Latitude ou longitude fora do intervalo válido.');
      return;
    }
    if (!Number.isFinite(raioMetros) || raioMetros < 20 || raioMetros > 1000) {
      setErro('Defina um raio entre 20 e 1000 metros.');
      return;
    }
    setSalvando(true);
    try {
      await setDoc(CONFIG_REF, {
        nomeLocal: form.nomeLocal.trim(), latitude, longitude, raioMetros,
        atualizadoPor: user.uid, atualizadoEm: serverTimestamp(), ativo: true,
      }, { merge: true });
      setMensagem('Configuração de presença salva com sucesso.');
    } catch (e2) {
      console.error(e2);
      setErro('Não foi possível salvar. Confira as permissões do Firestore.');
    } finally { setSalvando(false); }
  };

  if (carregando) return <div className="location-card">Carregando configuração...</div>;

  return (
    <div className="location-page">
      <div className="location-header">
        <span className="eyebrow">Administrador</span>
        <h2>Local de presença</h2>
        <p>O aluno só poderá fazer check-in quando estiver dentro do raio configurado. Professores e administradores continuam podendo lançar presença manualmente.</p>
      </div>
      <form className="location-card" onSubmit={salvar}>
        {erro && <div className="location-message error">{erro}</div>}
        {mensagem && <div className="location-message success">{mensagem}</div>}
        <label>Nome do local<input value={form.nomeLocal} onChange={(e) => setForm({ ...form, nomeLocal: e.target.value })} placeholder="Ex.: Academia / CEMEF" /></label>
        <div className="location-grid">
          <label>Latitude<input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-10.0000000" /></label>
          <label>Longitude<input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-67.0000000" /></label>
        </div>
        <label>Raio permitido (metros)<input type="number" min="20" max="1000" value={form.raioMetros} onChange={(e) => setForm({ ...form, raioMetros: e.target.value })} /></label>
        <div className="location-actions">
          <button type="button" className="secondary" onClick={usarLocalizacaoAtual}>📍 Usar minha localização atual</button>
          <button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar configuração'}</button>
        </div>
        <small className="location-help">Dica: estando fisicamente no local da aula, use “Usar minha localização atual” para preencher as coordenadas automaticamente.</small>
      </form>
    </div>
  );
}
export default ConfiguracaoPresenca;
