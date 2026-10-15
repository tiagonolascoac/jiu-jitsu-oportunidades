import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, doc, getDocsFromServer, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { dataHojeAcre } from '../utils/presencaUtils';
import { registrarPresencaUnica } from '../utils/registrarPresenca';
import AlunoAvatar from './AlunoAvatar';
import '../styles/Presenca.css';

// O nome completo continua preservado no banco e no mini perfil.
function nomeParaChamada(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(' ');
}

function Presenca({ alunos, turmas, reload, currentUserId }) {
  const [presencas, setPresencas] = useState({});
  const [dataSelecionada, setDataSelecionada] = useState(dataHojeAcre());
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [notas, setNotas] = useState({});
  const [presencasRegistradas, setPresencasRegistradas] = useState([]);
  const [carregandoGeo, setCarregandoGeo] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [filtroLista, setFiltroLista] = useState('todos');
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [removendoAlunoId, setRemovendoAlunoId] = useState(null);

  const alunosDaTurma = useMemo(() => {
    if (!turmaSelecionada) return [];
    const turma = turmas.find(t => t.id === turmaSelecionada);
    if (!turma) return [];
    // Respeita a turma exata; alunos antigos, sem turmaId, ainda são suportados.
    return alunos.filter(a =>
      a.turmaId === turma.id ||
      (!a.turmaId && a.turma === turma.tipo &&
        (!a.cidadeId || !turma.cidadeId || a.cidadeId === turma.cidadeId))
    );
  }, [alunos, turmas, turmaSelecionada]);

  useEffect(() => {
    if (!dataSelecionada) return undefined;
    setCarregandoGeo(true);
    setErroCarregamento('');
    setPresencasRegistradas([]);

    // Atualiza a lista do professor quando o aluno faz check-in, sem F5.
    const cancelar = onSnapshot(
      query(collection(db, 'presencas'), where('data', '==', dataSelecionada)),
      (snapshot) => {
        setPresencasRegistradas(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
        setCarregandoGeo(false);
        setErroCarregamento('');
      },
      (error) => {
        console.error('Erro ao acompanhar presenças:', error);
        setPresencasRegistradas([]);
        setCarregandoGeo(false);
        setErroCarregamento('Não foi possível ler as presenças. Não lance novas presenças até corrigir a permissão do Firestore.');
      }
    );
    return () => cancelar();
  }, [dataSelecionada]);

  // O registro vale uma vez por aluno/dia mesmo se foi criado pelo check-in
  // sem turmaSelecionada (versões antigas) ou por outra interface.
  const registrosDaTurma = presencasRegistradas;

  const idsJaRegistrados = useMemo(
    () => new Set(registrosDaTurma.map(item => item.alunoId)),
    [registrosDaTurma]
  );

  const normalizar = (texto = '') => texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const termoBusca = normalizar(buscaAluno.trim());
  const correspondeBusca = (aluno) => !termoBusca || normalizar(aluno.nome).includes(termoBusca);

  const alunosJaRegistrados = alunosDaTurma
    .filter(aluno => idsJaRegistrados.has(aluno.id))
    .filter(correspondeBusca);
  const alunosPendentes = alunosDaTurma
    .filter(aluno => !idsJaRegistrados.has(aluno.id))
    .filter(correspondeBusca);

  const totalConfirmados = alunosDaTurma.filter(aluno => idsJaRegistrados.has(aluno.id)).length;
  const totalPendentes = alunosDaTurma.length - totalConfirmados;

  const handleRemoverPresenca = async (aluno) => {
    if (!turmaSelecionada || !dataSelecionada || removendoAlunoId || salvando || carregandoGeo || erroCarregamento) return;

    setRemovendoAlunoId(aluno.id);
    try {
      // Confere a versão mais recente no servidor para incluir inclusive
      // documentos legados com IDs aleatórios criados antes da correção.
      const snapshot = await getDocsFromServer(
        query(collection(db, 'presencas'), where('data', '==', dataSelecionada))
      );
      const registrosAluno = snapshot.docs.filter(item => item.data().alunoId === aluno.id);

      if (!registrosAluno.length) {
        alert('Não há mais lançamentos deste aluno nessa data. A lista será atualizada automaticamente.');
        return;
      }

      const quantidade = registrosAluno.length;
      const mensagem = `Remover ${quantidade} ${quantidade === 1 ? 'registro' : 'registros'} de ${aluno.nome} em ${dataSelecionada.split('-').reverse().join('/')}?\n\n` +
        (quantidade > 1 ? 'Há registros duplicados. Todos os lançamentos dessa data serão removidos.\n\n' : '') +
        'O aluno voltará para Pendentes e poderá registrar presença novamente. Esta ação não pode ser desfeita.';
      if (!window.confirm(mensagem)) return;

      // Limite conservador: uma única operação atômica evita exclusão parcial.
      if (registrosAluno.length > 450) throw new Error('LIMITE_REGISTROS');
      const lote = writeBatch(db);
      registrosAluno.forEach(item => lote.delete(doc(db, 'presencas', item.id)));
      await lote.commit();

      setPresencas(anterior => {
        const novo = { ...anterior };
        delete novo[aluno.id];
        return novo;
      });
      setNotas(anterior => {
        const novo = { ...anterior };
        delete novo[aluno.id];
        return novo;
      });
      // onSnapshot atualiza a aba Registrados/Pendentes imediatamente.
    } catch (error) {
      console.error('Erro ao remover presença:', error);
      if (error.code === 'permission-denied') {
        alert('O Firestore não permitiu remover essa presença. É necessário autorizar a exclusão para professores responsáveis e administradores nas regras do banco.');
      } else if (error.message === 'LIMITE_REGISTROS') {
        alert('Há registros demais para excluir em uma só operação. Solicite uma limpeza administrativa.');
      } else {
        alert('Não foi possível remover a presença. Confira sua conexão e tente novamente.');
      }
    } finally {
      setRemovendoAlunoId(null);
    }
  };

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
    if (carregandoGeo || erroCarregamento || salvando) {
      alert(erroCarregamento || 'Aguarde o carregamento das presenças.');
      return;
    }
    const selecionados = alunosDaTurma.filter((aluno) => Boolean(presencas[aluno.id]));
    if (selecionados.length === 0) {
      alert('Marque pelo menos uma presença ou ausência antes de salvar.');
      return;
    }

    setSalvando(true);
    try {
      // Verificar novamente no servidor: check-in pode ter acontecido desde a
      // última atualização da interface do professor.
      const snapshotAtual = await getDocsFromServer(
        query(collection(db, 'presencas'), where('data', '==', dataSelecionada))
      );
      const jaRegistrados = new Set(snapshotAtual.docs.map(item => item.data().alunoId));
      const turma = turmas.find(item => item.id === turmaSelecionada);
      let criados = 0;
      let ignorados = 0;

      for (const aluno of selecionados) {
        if (jaRegistrados.has(aluno.id)) {
          ignorados += 1;
          continue;
        }
        const resultado = await registrarPresencaUnica({
          alunoId: aluno.id,
          data: dataSelecionada,
          turmaSelecionada,
          turma: turma?.tipo || aluno.turma || '',
          status: presencas[aluno.id],
          nota: notas[aluno.id] || '',
          dataCriacao: serverTimestamp(),
          metodo: 'manual',
          registradoPor: currentUserId || '',
        });
        if (resultado.criado) criados += 1;
        else ignorados += 1;
        jaRegistrados.add(aluno.id);
      }
      setPresencas({});
      setNotas({});
      if (reload) await reload();
      alert(`${criados} registro(s) salvo(s).${ignorados ? ` ${ignorados} já existia(m) e não foram duplicados.` : ''}`);
    } catch (error) {
      console.error('Erro ao registrar presença:', error);
      alert('Não foi possível concluir a chamada. Confira sua conexão e as regras do Firestore. Registros já gravados não serão duplicados ao tentar novamente.');
    } finally {
      setSalvando(false);
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
              <button className={filtroLista === 'presentes' ? 'ativo' : ''} onClick={() => setFiltroLista('presentes')}>Registrados <span>{totalConfirmados}</span></button>
            </div>
          </div>
        <div className="presenca-lista">
          {carregandoGeo ? (
            <p className="vazio">Verificando presenças já marcadas...</p>
          ) : erroCarregamento ? (
            <p className="vazio" role="alert">{erroCarregamento}</p>
          ) : (
            <>
              {filtroLista !== 'pendentes' && alunosJaRegistrados.length > 0 && (
                <div className="presencas-confirmadas">
                  <div className="presencas-confirmadas-titulo">
                    <h3>✓ Presenças já marcadas</h3>
                    <span>{alunosJaRegistrados.length}</span>
                  </div>
                  <div className="presencas-confirmadas-lista">
                    {alunosJaRegistrados.map(aluno => {
                      const registro = registrosDaTurma.find(p => p.alunoId === aluno.id);
                      return (
                        <div key={aluno.id} className="presenca-confirmada-item">
                          <AlunoAvatar aluno={aluno} size={46} onClick={() => setAlunoSelecionado(aluno)} />
                          <div className="presenca-confirmada-info" onClick={() => setAlunoSelecionado(aluno)}>
                            <strong title={aluno.nome}>{nomeParaChamada(aluno.nome)}</strong>
                            <small>{registro?.metodo === 'geolocalizacao' ? 'Check-in por geolocalização' : 'Lançado pelo professor'}</small>
                          </div>
                          <div className="presenca-confirmada-status">
                            {registro?.status === 'presente' ? '✓ Presente' : '✕ Ausente'}
                            {registro?.metodo === 'geolocalizacao' && Number.isFinite(Number(registro?.distanciaMetros)) && (
                              <small>{registro.distanciaMetros} m do local</small>
                            )}
                          </div>
                          <button
                            type="button"
                            className="presenca-botao-remover"
                            onClick={() => handleRemoverPresenca(aluno)}
                            disabled={Boolean(removendoAlunoId) || salvando || carregandoGeo || Boolean(erroCarregamento)}
                            aria-label={`Remover presença de ${aluno.nome} em ${dataSelecionada}`}
                          >
                            {removendoAlunoId === aluno.id ? 'Removendo...' : 'Remover presença'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filtroLista !== 'presentes' && <h3>Alunos para lançar presença</h3>}
              {filtroLista !== 'presentes' && (alunosPendentes.length === 0 ? (
                <p className="vazio">Todos os alunos desta turma já tiveram a presença registrada nesta data.</p>
              ) : (
                <>
                  <div className="presenca-items">
                    {alunosPendentes.map(aluno => (
                      <div key={aluno.id} className="presenca-item">
                        <AlunoAvatar aluno={aluno} size={58} onClick={() => setAlunoSelecionado(aluno)} />
                        <div className="presenca-info" onClick={() => setAlunoSelecionado(aluno)} role="button" tabIndex="0">
                          <h4 title={aluno.nome}>{nomeParaChamada(aluno.nome)}</h4>
                        </div>
                        <div className="presenca-botoes">
                          <button className={`btn-status ${presencas[aluno.id] === 'presente' ? 'ativo' : ''}`} onClick={() => handleTogglePresenca(aluno.id, 'presente')}>✓ Presente</button>
                          <button className={`btn-status ${presencas[aluno.id] === 'ausente' ? 'ativo' : ''}`} onClick={() => handleTogglePresenca(aluno.id, 'ausente')}>✕ Ausente</button>
                        </div>
                        <input type="text" placeholder="Nota (opcional)" value={notas[aluno.id] || ''} onChange={(e) => setNotas(prev => ({ ...prev, [aluno.id]: e.target.value }))} className="presenca-nota" />
                      </div>
                    ))}
                  </div>
                  <button className="btn-salvar" onClick={handleRegistrarPresencas} disabled={salvando || carregandoGeo || Boolean(erroCarregamento)}>{salvando ? 'Salvando...' : '💾 Registrar Presença'}</button>
                </>
              ))}
              {buscaAluno && alunosJaRegistrados.length === 0 && alunosPendentes.length === 0 && (
                <p className="vazio">Nenhum aluno encontrado para “{buscaAluno}”.</p>
              )}
            </>
          )}
        </div>
        </>
      )}
      {alunoSelecionado && (
        <div className="mini-perfil-overlay" onClick={() => setAlunoSelecionado(null)}>
          <aside className="mini-perfil" onClick={(e) => e.stopPropagation()}>
            <button className="mini-perfil-fechar" onClick={() => setAlunoSelecionado(null)}>×</button>
            <AlunoAvatar aluno={alunoSelecionado} size={112} />
            <h2>{alunoSelecionado.nome}</h2>
            <span className="mini-faixa">Faixa {alunoSelecionado.faixa || 'branca'}{Number(alunoSelecionado.grau) > 0 ? ` • ${alunoSelecionado.grau} ${Number(alunoSelecionado.grau) === 1 ? 'grau' : 'graus'}` : ''}</span>
            <div className="mini-perfil-dados">
              <div><span>E-mail</span><strong>{alunoSelecionado.email || 'Não informado'}</strong></div>
              <div><span>Cidade</span><strong>{alunoSelecionado.cidadeNome || 'Não informada'}</strong></div>
              <div><span>Status</span><strong>{alunoSelecionado.ativo === false ? 'Inativo' : 'Ativo'}</strong></div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default Presenca;
