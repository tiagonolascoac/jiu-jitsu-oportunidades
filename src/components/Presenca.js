import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import '../styles/Presenca.css';

function Presenca({ alunos, turmas, reload, currentUserId }) {
  const [presencas, setPresencas] = useState({});
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [notas, setNotas] = useState({});
  const [presencasGeo, setPresencasGeo] = useState([]);
  const [carregandoGeo, setCarregandoGeo] = useState(false);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [filtroLista, setFiltroLista] = useState('todos');

  const alunosDaTurma = useMemo(() => {
    if (!turmaSelecionada) return [];
    const turma = turmas.find(t => t.id === turmaSelecionada);
    return alunos.filter(a => a.turma === turma?.tipo);
  }, [alunos, turmas, turmaSelecionada]);

  useEffect(() => {
    let ativo = true;

    const carregarPresencasGeo = async () => {
      if (!dataSelecionada) return;
      setCarregandoGeo(true);
      try {
        const snapshot = await getDocs(
          query(collection(db, 'presencas'), where('data', '==', dataSelecionada))
        );
        if (!ativo) return;
        setPresencasGeo(
          snapshot.docs
            .map(item => ({ id: item.id, ...item.data() }))
            .filter(item => item.metodo === 'geolocalizacao' && item.status === 'presente')
        );
      } catch (error) {
        console.error('Erro ao carregar presenças por geolocalização:', error);
        if (ativo) setPresencasGeo([]);
      } finally {
        if (ativo) setCarregandoGeo(false);
      }
    };

    carregarPresencasGeo();
    return () => { ativo = false; };
  }, [dataSelecionada]);

  const idsComPresencaGeo = useMemo(
    () => new Set(presencasGeo.map(item => item.alunoId)),
    [presencasGeo]
  );

  const normalizar = (texto = '') => texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const termoBusca = normalizar(buscaAluno.trim());
  const correspondeBusca = (aluno) => !termoBusca || normalizar(aluno.nome).includes(termoBusca);

  const alunosComPresencaGeo = alunosDaTurma
    .filter(aluno => idsComPresencaGeo.has(aluno.id))
    .filter(correspondeBusca);
  const alunosPendentes = alunosDaTurma
    .filter(aluno => !idsComPresencaGeo.has(aluno.id))
    .filter(correspondeBusca);

  const totalConfirmados = alunosDaTurma.filter(aluno => idsComPresencaGeo.has(aluno.id)).length;
  const totalPendentes = alunosDaTurma.length - totalConfirmados;

  const handleTogglePresenca = (alunoId, status) => {
    setPresencas(prev => ({
      ...prev,
      [alunoId]: prev[alunoId] === status ? null : status
    }));
  };

  const handleRegistrarPresencas = async () => {
    if (!turmaSelecionada) {
      alert('Selecione uma turma');
      return;
    }

    try {
      for (const alunoId in presencas) {
        if (presencas[alunoId] && !idsComPresencaGeo.has(alunoId)) {
          await addDoc(collection(db, 'presencas'), {
            alunoId,
            turmaSelecionada,
            data: dataSelecionada,
            status: presencas[alunoId],
            nota: notas[alunoId] || '',
            dataCriacao: serverTimestamp(),
            metodo: 'manual',
            registradoPor: currentUserId || '',
          });
        }
      }
      alert('Presença registrada com sucesso!');
      setPresencas({});
      setNotas({});
      if (reload) await reload();
    } catch (error) {
      console.error('Erro ao registrar presença:', error);
      alert('Erro ao registrar presença');
    }
  };

  return (
    <div className="presenca-container">
      <div className="presenca-header">
        <h2>Registrar Presença</h2>
      </div>

      <div className="presenca-filters">
        <div>
          <label>Data:</label>
          <input type="date" value={dataSelecionada} onChange={(e) => setDataSelecionada(e.target.value)} />
        </div>
        <div>
          <label>Turma:</label>
          <select value={turmaSelecionada} onChange={(e) => setTurmaSelecionada(e.target.value)}>
            <option value="">Selecione uma turma</option>
            {turmas.map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
          </select>
        </div>
      </div>

      {turmaSelecionada && (
        <>
          <div className="presenca-toolbar">
            <input
              type="search"
              value={buscaAluno}
              onChange={(e) => setBuscaAluno(e.target.value)}
              placeholder="Buscar aluno..."
              aria-label="Buscar aluno"
            />
            <div className="presenca-tabs">
              <button className={filtroLista === 'todos' ? 'ativo' : ''} onClick={() => setFiltroLista('todos')}>Todos <span>{alunosDaTurma.length}</span></button>
              <button className={filtroLista === 'pendentes' ? 'ativo' : ''} onClick={() => setFiltroLista('pendentes')}>Pendentes <span>{totalPendentes}</span></button>
              <button className={filtroLista === 'presentes' ? 'ativo' : ''} onClick={() => setFiltroLista('presentes')}>Presentes <span>{totalConfirmados}</span></button>
            </div>
          </div>
        <div className="presenca-lista">
          {carregandoGeo ? (
            <p className="vazio">Verificando presenças já marcadas...</p>
          ) : (
            <>
              {filtroLista !== 'pendentes' && alunosComPresencaGeo.length > 0 && (
                <div className="presencas-confirmadas">
                  <div className="presencas-confirmadas-titulo">
                    <h3>✓ Presenças já marcadas</h3>
                    <span>{alunosComPresencaGeo.length}</span>
                  </div>
                  <div className="presencas-confirmadas-lista">
                    {alunosComPresencaGeo.map(aluno => {
                      const registro = presencasGeo.find(p => p.alunoId === aluno.id);
                      return (
                        <div key={aluno.id} className="presenca-confirmada-item">
                          <div>
                            <strong>{aluno.nome}</strong>
                            <small>Check-in por geolocalização</small>
                          </div>
                          <div className="presenca-confirmada-status">
                            ✓ Presente
                            {Number.isFinite(Number(registro?.distanciaMetros)) && (
                              <small>{registro.distanciaMetros} m do local</small>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filtroLista !== 'presentes' && <h3>Alunos para lançar presença</h3>}
              {filtroLista !== 'presentes' && (alunosPendentes.length === 0 ? (
                <p className="vazio">Todos os alunos desta turma já marcaram presença por geolocalização.</p>
              ) : (
                <>
                  <div className="presenca-items">
                    {alunosPendentes.map(aluno => (
                      <div key={aluno.id} className="presenca-item">
                        <div className="presenca-info"><h4>{aluno.nome}</h4></div>
                        <div className="presenca-botoes">
                          <button className={`btn-status ${presencas[aluno.id] === 'presente' ? 'ativo' : ''}`} onClick={() => handleTogglePresenca(aluno.id, 'presente')}>✓ Presente</button>
                          <button className={`btn-status ${presencas[aluno.id] === 'atrasado' ? 'ativo' : ''}`} onClick={() => handleTogglePresenca(aluno.id, 'atrasado')}>⏰ Atrasado</button>
                          <button className={`btn-status ${presencas[aluno.id] === 'ausente' ? 'ativo' : ''}`} onClick={() => handleTogglePresenca(aluno.id, 'ausente')}>✕ Ausente</button>
                        </div>
                        <input type="text" placeholder="Nota (opcional)" value={notas[aluno.id] || ''} onChange={(e) => setNotas(prev => ({ ...prev, [aluno.id]: e.target.value }))} className="presenca-nota" />
                      </div>
                    ))}
                  </div>
                  <button className="btn-salvar" onClick={handleRegistrarPresencas}>💾 Registrar Presença</button>
                </>
              ))}
              {buscaAluno && alunosComPresencaGeo.length === 0 && alunosPendentes.length === 0 && (
                <p className="vazio">Nenhum aluno encontrado para “{buscaAluno}”.</p>
              )}
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}

export default Presenca;
