import React, { useEffect, useState } from 'react';
import {
  collection, doc, getDoc, getDocsFromServer, query, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { dataHojeAcre } from '../utils/presencaUtils';
import { registrarPresencaUnica } from '../utils/registrarPresenca';
import '../styles/CheckinAluno.css';

const rad = (v) => (v * Math.PI) / 180;
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function registroDoDia(alunoId, data) {
  // Compatibilidade com presenças antigas de IDs automáticos.
  // A consulta já era utilizada pela versão anterior, então não requer novo índice.
  const snap = await getDocsFromServer(
    query(collection(db, 'presencas'), where('alunoId', '==', alunoId))
  );
  const registros = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((registro) => registro.data === data);
  return registros.find((registro) => registro.status === 'presente') || registros[0] || null;
}

function geolocalizar() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEO'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  });
}

function CheckinAluno({ aluno, user, onSuccess }) {
  const alunoId = aluno?.id;
  const [estado, setEstado] = useState('idle');
  const [mensagem, setMensagem] = useState('');
  const [detalhes, setDetalhes] = useState(null);

  useEffect(() => {
    let ativo = true;
    setEstado('idle');
    setMensagem('');
    setDetalhes(null);

    const verificar = async () => {
      if (!alunoId) return;
      try {
        const existente = await registroDoDia(alunoId, dataHojeAcre());
        if (!ativo || !existente) return;
        if (existente.status === 'presente') {
          setEstado('success');
          setMensagem('Sua presença de hoje já está registrada.');
        } else {
          setEstado('already');
          setMensagem('Já existe uma ausência lançada para hoje. Solicite a correção ao professor.');
        }
        if (existente.metodo === 'geolocalizacao') {
          setDetalhes({
            distancia: Number.isFinite(Number(existente.distanciaMetros)) ? Number(existente.distanciaMetros) : null,
            raio: null,
            precisao: Number.isFinite(Number(existente.precisaoMetros)) ? Number(existente.precisaoMetros) : null,
            local: 'Registro encontrado',
          });
        }
      } catch (e) {
        console.error('Erro ao verificar presença:', e);
        if (ativo) {
          setEstado('error');
          setMensagem('Não foi possível verificar sua presença. Verifique sua conexão e tente novamente.');
        }
      }
    };
    verificar();
    return () => { ativo = false; };
  }, [alunoId]);

  const marcarPresenca = async () => {
    if (!aluno || aluno.ativo === false || estado === 'loading') return;
    setEstado('loading');
    setMensagem('Obtendo sua localização...');
    setDetalhes(null);
    try {
      const data = dataHojeAcre();
      const existente = await registroDoDia(aluno.id, data);
      if (existente) {
        setEstado(existente.status === 'presente' ? 'success' : 'already');
        setMensagem(existente.status === 'presente'
          ? 'Sua presença de hoje já está registrada.'
          : 'Já existe uma ausência lançada para hoje. Solicite a correção ao professor.');
        return;
      }

      const configSnap = await getDoc(doc(db, 'configuracoes', 'presenca'));
      if (!configSnap.exists() || configSnap.data().ativo === false) throw new Error('CONFIG');
      const config = configSnap.data();
      if (!Number.isFinite(Number(config.latitude)) || !Number.isFinite(Number(config.longitude))) throw new Error('CONFIG');

      const { coords } = await geolocalizar();
      const distancia = distanciaMetros(coords.latitude, coords.longitude, Number(config.latitude), Number(config.longitude));
      const raio = Number(config.raioMetros || 100);
      setDetalhes({
        distancia: Math.round(distancia), raio, precisao: Math.round(coords.accuracy),
        local: config.nomeLocal || 'Local da aula',
      });
      if (distancia > raio) {
        setEstado('outside');
        setMensagem('Você está fora da área permitida para presença.');
        return;
      }

      // Confere novamente depois do GPS: professor pode ter marcado enquanto o
      // navegador solicitava localização. Transação cobre corrida entre apps novos.
      const existenteAgora = await registroDoDia(aluno.id, data);
      if (existenteAgora) {
        setEstado(existenteAgora.status === 'presente' ? 'success' : 'already');
        setMensagem(existenteAgora.status === 'presente'
          ? 'Sua presença de hoje já está registrada.'
          : 'Já existe uma ausência lançada para hoje. Solicite a correção ao professor.');
        if (onSuccess) await onSuccess();
        return;
      }

      const resultado = await registrarPresencaUnica({
        alunoId: aluno.id,
        data,
        turma: aluno.turma || '',
        turmaSelecionada: aluno.turmaId || '',
        status: 'presente',
        metodo: 'geolocalizacao',
        registradoPor: user.uid,
        dataCriacao: serverTimestamp(),
        distanciaMetros: Math.round(distancia),
        precisaoMetros: Math.round(coords.accuracy),
      });
      if (!resultado.criado && resultado.registro?.status !== 'presente') {
        setEstado('already');
        setMensagem('O professor já registrou uma ausência para hoje. Procure-o para corrigir.');
      } else {
        setEstado('success');
        setMensagem(resultado.criado ? 'Presença confirmada!' : 'Sua presença de hoje já estava registrada.');
      }
      if (onSuccess) await onSuccess();
    } catch (e) {
      console.error('Erro no check-in:', e);
      setEstado('error');
      if (e.message === 'CONFIG') {
        setMensagem('O administrador ainda não configurou o local de presença.');
      } else if (e.message === 'GEO') {
        setMensagem('Este dispositivo não oferece acesso à localização.');
      } else if (e.code === 1 || e.code === 'PERMISSION_DENIED') {
        setMensagem('Permissão de localização negada. Ative a localização para fazer o check-in.');
      } else if (e.code === 'permission-denied') {
        setMensagem('O Firebase não permitiu registrar a presença. Verifique as regras do Firestore.');
      } else {
        setMensagem('Não foi possível registrar a presença. Verifique sua conexão e tente novamente.');
      }
    }
  };

  return (
    <div className={`checkin-card state-${estado}`}>
      <div className="checkin-icon">📍</div>
      <div className="checkin-copy">
        <span>Presença de hoje</span>
        <h2>{estado === 'success' ? '✓ Presença registrada' : estado === 'already' ? 'Registro já existente' : 'Marcar minha presença'}</h2>
        <p>{estado === 'success'
          ? 'Seu check-in de hoje já foi confirmado.'
          : estado === 'already'
            ? 'O professor pode corrigir o lançamento existente.'
            : 'Usaremos sua localização somente para verificar se você está no local da aula.'}</p>
      </div>
      {mensagem && <div className="checkin-message">{mensagem}</div>}
      {detalhes && (
        <div className="checkin-details">
          <span>{detalhes.local}</span>
          {detalhes.distancia !== null && <strong>{detalhes.distancia} m do local</strong>}
          {detalhes.raio !== null && (
            <small>Raio permitido: {detalhes.raio} m • Precisão do aparelho: ~{detalhes.precisao} m</small>
          )}
        </div>
      )}
      {estado !== 'success' && estado !== 'already' && (
        <button type="button" onClick={marcarPresenca} disabled={estado === 'loading' || aluno?.ativo === false}>
          {estado === 'loading' ? 'Verificando localização...' : '📍 Marcar minha presença'}
        </button>
      )}
    </div>
  );
}

export default CheckinAluno;
