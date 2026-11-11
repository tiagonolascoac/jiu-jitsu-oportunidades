import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/ConfiguracaoPresenca.css';

const GERAL = '__geral__';
const formularioVazio = () => ({
  nomeLocal: 'Local das aulas', latitude: '', longitude: '', raioMetros: 100,
});

function ConfiguracaoPresenca({ user, isAdmin = false, turmas = [] }) {
  const [turmaEscolhida, setTurmaEscolhida] = useState(isAdmin ? GERAL : (turmas[0]?.id || ''));
  const [form, setForm] = useState(formularioVazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [configurada, setConfigurada] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  // O professor só recebe do Dashboard as turmas às quais está vinculado.
  // O administrador pode escolher qualquer turma ou editar o ponto geral legado.
  useEffect(() => {
    setTurmaEscolhida((atual) => {
      if (atual === GERAL && isAdmin) return atual;
      if (turmas.some((turma) => turma.id === atual)) return atual;
      return isAdmin ? GERAL : (turmas[0]?.id || '');
    });
  }, [isAdmin, turmas]);

  const turma = turmas.find((item) => item.id === turmaEscolhida);
  const semTurmas = !isAdmin && turmas.length === 0;
  const pontoGeral = isAdmin && turmaEscolhida === GERAL;

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      setMensagem('');
      setErro('');
      setForm(formularioVazio());
      setConfigurada(false);
      if (!turmaEscolhida || (!pontoGeral && !turma)) {
        setCarregando(false);
        return;
      }
      setCarregando(true);
      const referencia = pontoGeral
        ? doc(db, 'configuracoes', 'presenca')
        : doc(db, 'locaisCheckin', turmaEscolhida);
      try {
        const snap = await getDoc(referencia);
        if (!ativo) return;
        if (snap.exists()) {
          const data = snap.data();
          setForm({
            nomeLocal: data.nomeLocal || 'Local das aulas',
            latitude: data.latitude ?? '',
            longitude: data.longitude ?? '',
            raioMetros: data.raioMetros ?? 100,
          });
          setConfigurada(true);
        }
      } catch (e) {
        console.error('Não foi possível ler local da presença:', e);
        if (ativo) setErro(e.code === 'permission-denied'
          ? 'O Firestore bloqueou a leitura deste local. Confira as regras para locaisCheckin.'
          : 'Não foi possível carregar a configuração. Verifique sua conexão.');
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    carregar();
    return () => { ativo = false; };
  }, [turmaEscolhida, pontoGeral, turma]);

  const usarLocalizacaoAtual = () => {
    setErro('');
    setMensagem('');
    if (capturando || salvando) return;
    if (!navigator.geolocation) {
      setErro('Este navegador não oferece suporte à geolocalização.');
      return;
    }
    if (!window.isSecureContext) {
      setErro('O GPS exige HTTPS. Abra o site oficial pelo navegador.');
      return;
    }
    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCapturando(false);
        const limite = Math.min(100, Math.max(30, Number(form.raioMetros || 100) * 0.75));
        if (!Number.isFinite(coords.accuracy) || coords.accuracy > limite) {
          setErro(`Localização insuficiente (~${Math.round(coords.accuracy)} m de precisão). ` +
            'Nenhuma coordenada foi alterada. Ative a localização precisa e tente novamente no local da aula.');
          return;
        }
        setForm((prev) => ({ ...prev, latitude: coords.latitude.toFixed(7), longitude: coords.longitude.toFixed(7) }));
        setMensagem(`Localização capturada com precisão aproximada de ${Math.round(coords.accuracy)} m.`);
      },
      (e) => {
        setCapturando(false);
        setErro(e.code === 1
          ? 'Localização bloqueada pelo navegador. Libere o acesso ao GPS nas permissões do site.'
          : 'Não foi possível obter sua localização. Ative o GPS e tente novamente.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    if (!turmaEscolhida || (!pontoGeral && !turma)) {
      setErro('Selecione uma turma à qual você tem acesso.');
      return;
    }
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const raioMetros = Number(form.raioMetros);
    if (!form.nomeLocal.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setErro('Informe o nome do local, latitude e longitude válidos.');
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
      || (latitude === 0 && longitude === 0) || form.latitude === '' || form.longitude === '') {
      setErro('Latitude e longitude inválidas. Confira o local da academia.');
      return;
    }
    if (!Number.isFinite(raioMetros) || raioMetros < 20 || raioMetros > 1000) {
      setErro('Defina um raio entre 20 e 1000 metros.');
      return;
    }
    setSalvando(true);
    try {
      const referencia = pontoGeral
        ? doc(db, 'configuracoes', 'presenca')
        : doc(db, 'locaisCheckin', turmaEscolhida);
      const valores = {
        nomeLocal: form.nomeLocal.trim(), latitude, longitude, raioMetros,
        atualizadoPor: user.uid, atualizadoEm: serverTimestamp(), ativo: true,
      };
      if (!pontoGeral) {
        valores.turmaId = turmaEscolhida;
        valores.cidadeId = turma.cidadeId || '';
      }
      await setDoc(referencia, valores, { merge: true });
      setConfigurada(true);
      setMensagem(pontoGeral
        ? 'Local geral atualizado com sucesso.'
        : 'Local desta turma atualizado com sucesso! Os alunos já poderão usar esse ponto no check-in.');
    } catch (e2) {
      console.error('Erro ao salvar local da presença:', e2);
      setErro(e2.code === 'permission-denied'
        ? 'Sem permissão para salvar. O administrador precisa habilitar as regras da coleção locaisCheckin para professores responsáveis.'
        : 'Não foi possível salvar. Verifique sua conexão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="location-page">
      <div className="location-header">
        <span className="eyebrow">{isAdmin ? 'Administrador' : 'Professor'}</span>
        <h2>📍 Local da presença</h2>
        <p>Configure o ponto onde os alunos podem confirmar a presença pelo GPS. Cada turma tem seu próprio local, sem alterar as outras unidades.</p>
      </div>

      <div className="location-card location-escolher-turma">
        <label htmlFor="location-turma">Local que deseja configurar
          <select id="location-turma" value={turmaEscolhida}
            disabled={capturando || salvando || semTurmas}
            onChange={(e) => setTurmaEscolhida(e.target.value)}>
            {isAdmin && <option value={GERAL}>🌐 Local geral (configuração antiga)</option>}
            {turmas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome || item.tipo || 'Turma'}{item.cidadeNome ? ` — ${item.cidadeNome}` : ''}
              </option>
            ))}
            {semTurmas && <option value="">Nenhuma turma vinculada</option>}
          </select>
        </label>
        {semTurmas && <div className="location-message error">Você ainda não possui turmas vinculadas ao seu perfil. Peça ao administrador para atribuir uma turma antes de configurar o check-in.</div>}
        {!semTurmas && !pontoGeral && (
          <div className="location-message location-info">
            {configurada
              ? 'Este local já está configurado para a turma selecionada.'
              : 'Ainda não há um local próprio para esta turma. Até configurar, o check-in utilizará o local geral anterior, caso exista.'}
          </div>
        )}
        {pontoGeral && <div className="location-message location-info">Configuração geral anterior. Para evitar que uma alteração afete cidades diferentes, prefira selecionar uma turma e configurar um local exclusivo.</div>}
      </div>

      {!semTurmas && (
        <form className="location-card" onSubmit={salvar}>
          {carregando && <div className="location-message">Carregando configuração...</div>}
          {erro && <div className="location-message error" role="alert">{erro}</div>}
          {mensagem && <div className="location-message success" role="status">{mensagem}</div>}
          <fieldset className="location-form-fields" disabled={carregando || salvando || capturando}>
            <label>Nome do local
              <input value={form.nomeLocal} onChange={(e) => setForm({ ...form, nomeLocal: e.target.value })}
                placeholder="Ex.: Academia / ginásio" required />
            </label>
            <div className="location-grid">
              <label>Latitude
                <input type="number" step="any" value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-10.0000000" required />
              </label>
              <label>Longitude
                <input type="number" step="any" value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-67.0000000" required />
              </label>
            </div>
            <label>Raio permitido (metros)
              <input type="number" min="20" max="1000" value={form.raioMetros}
                onChange={(e) => setForm({ ...form, raioMetros: e.target.value })} required />
            </label>
          </fieldset>
          <div className="location-actions">
            <button type="button" className="secondary" disabled={capturando || salvando || carregando}
              onClick={usarLocalizacaoAtual}>
              {capturando ? 'Obtendo GPS preciso...' : '📍 Usar minha localização atual'}
            </button>
            <button type="submit" disabled={salvando || capturando || carregando}>
              {salvando ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </div>
          <small className="location-help">Estando fisicamente na academia, use “Usar minha localização atual” para preencher as coordenadas. A precisão precisa ser suficiente para o raio escolhido.</small>
        </form>
      )}
    </div>
  );
}

export default ConfiguracaoPresenca;
