import React, { useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/CheckinAluno.css';

const rad = (v) => (v * Math.PI) / 180;
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const hojeLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function CheckinAluno({ aluno, user, onSuccess }) {
  const [estado, setEstado] = useState('idle');
  const [mensagem, setMensagem] = useState('');
  const [detalhes, setDetalhes] = useState(null);

  const marcarPresenca = async () => {
    if (!aluno || aluno.ativo === false) return;
    setEstado('loading'); setMensagem('Obtendo sua localização...'); setDetalhes(null);
    try {
      const configSnap = await getDoc(doc(db, 'configuracoes', 'presenca'));
      if (!configSnap.exists() || configSnap.data().ativo === false) throw new Error('CONFIG');
      const config = configSnap.data();
      if (!Number.isFinite(Number(config.latitude)) || !Number.isFinite(Number(config.longitude))) throw new Error('CONFIG');

      const existentes = await getDocs(query(collection(db, 'presencas'), where('alunoId', '==', aluno.id)));
      const dataHoje = hojeLocal();
      if (existentes.docs.some((d) => d.data().data === dataHoje)) {
        setEstado('success'); setMensagem('Sua presença de hoje já está registrada.'); return;
      }
      if (!navigator.geolocation) throw new Error('GEO');

      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        try {
          const distancia = distanciaMetros(coords.latitude, coords.longitude, Number(config.latitude), Number(config.longitude));
          const raio = Number(config.raioMetros || 100);
          setDetalhes({ distancia: Math.round(distancia), raio, precisao: Math.round(coords.accuracy), local: config.nomeLocal || 'Local da aula' });
          if (distancia > raio) {
            setEstado('outside'); setMensagem(`Você está fora da área permitida para presença.`); return;
          }
          await addDoc(collection(db, 'presencas'), {
            alunoId: aluno.id,
            turma: aluno.turma || '',
            data: dataHoje,
            status: 'presente',
            metodo: 'geolocalizacao',
            registradoPor: user.uid,
            dataCriacao: serverTimestamp(),
            distanciaMetros: Math.round(distancia),
            precisaoMetros: Math.round(coords.accuracy),
          });
          setEstado('success'); setMensagem('Presença confirmada!');
          if (onSuccess) await onSuccess();
        } catch (e) { console.error(e); setEstado('error'); setMensagem('Não foi possível registrar a presença. Tente novamente.'); }
      }, (geoError) => {
        console.error(geoError); setEstado('error');
        setMensagem(geoError.code === 1 ? 'Permissão de localização negada. Ative a localização para fazer o check-in.' : 'Não foi possível obter sua localização. Tente novamente em um local com melhor sinal.');
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    } catch (e) {
      console.error(e); setEstado('error');
      setMensagem(e.message === 'CONFIG' ? 'O administrador ainda não configurou o local de presença.' : 'Não foi possível iniciar o check-in.');
    }
  };

  return (
    <div className={`checkin-card state-${estado}`}>
      <div className="checkin-icon">📍</div>
      <div className="checkin-copy"><span>Presença de hoje</span><h2>Marcar minha presença</h2><p>Usaremos sua localização somente para verificar se você está no local da aula.</p></div>
      {mensagem && <div className="checkin-message">{mensagem}</div>}
      {detalhes && <div className="checkin-details"><span>{detalhes.local}</span><strong>{detalhes.distancia} m do local</strong><small>Raio permitido: {detalhes.raio} m • Precisão do aparelho: ~{detalhes.precisao} m</small></div>}
      <button onClick={marcarPresenca} disabled={estado === 'loading' || aluno?.ativo === false}>{estado === 'loading' ? 'Verificando localização...' : estado === 'success' ? '✓ Presença registrada' : '📍 Marcar minha presença'}</button>
    </div>
  );
}
export default CheckinAluno;
