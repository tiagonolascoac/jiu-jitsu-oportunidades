import React, { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { CIDADES_ACRE, nomeCidade } from '../data/cidadesAcre';
import '../styles/Turmas.css';

function Turmas({ turmas, reload, isAdmin = false, professorCidadeId = '' }) {
  const [novaTurma, setNovaTurma] = useState({ nome: '', tipo: 'adulto', horario: '', cidadeId: isAdmin ? '' : professorCidadeId });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [professores, setProfessores] = useState([]);
  const [professoresNovaTurma, setProfessoresNovaTurma] = useState([]);
  const [editandoProfessores, setEditandoProfessores] = useState(null);
  const [selecionados, setSelecionados] = useState([]);

  useEffect(() => {
    const carregarProfessores = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'usuarios'), where('tipo', '==', 'professor')));
        setProfessores(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.ativo !== false));
      } catch (e) {
        console.error('Erro ao carregar professores:', e);
      }
    };
    carregarProfessores();
  }, []);

  const professorIdsDaTurma = (turma) => {
    const ids = Array.isArray(turma.professorIds) ? turma.professorIds : [];
    if (turma.professorId && !ids.includes(turma.professorId)) return [turma.professorId, ...ids];
    return ids;
  };

  const nomeProfessor = (id) => {
    const p = professores.find(item => item.id === id);
    if (p) return p.nome || p.email || 'Professor';
    if (id === auth.currentUser?.uid) return 'Professor responsável';
    return 'Professor';
  };

  const alternarSelecionado = (id, setter) => {
    setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAdicionarTurma = async (e) => {
    e.preventDefault();
    if (!novaTurma.nome.trim()) return alert('Por favor, preencha o nome da turma');
    if (isAdmin && professoresNovaTurma.length === 0) return alert('Selecione pelo menos um professor para a turma.');
    const atuais = professoresNovaTurma.length ? professoresNovaTurma : (auth.currentUser ? [auth.currentUser.uid] : []);
    try {
      await addDoc(collection(db, 'turmas'), {
        ...novaTurma,
        cidadeNome: nomeCidade(novaTurma.cidadeId),
        professorIds: atuais,
        professorId: atuais[0] || auth.currentUser?.uid || '', // compatibilidade temporária
        dataCriacao: new Date(),
      });
      setNovaTurma({ nome: '', tipo: 'adulto', horario: '', cidadeId: isAdmin ? '' : professorCidadeId });
      setProfessoresNovaTurma([]);
      setMostrarForm(false);
      reload();
    } catch (error) {
      console.error('Erro ao adicionar turma:', error);
      alert('Erro ao adicionar turma');
    }
  };

  const abrirProfessores = (turma) => {
    setEditandoProfessores(turma.id);
    setSelecionados(professorIdsDaTurma(turma));
  };

  const salvarProfessores = async (turmaId) => {
    if (selecionados.length === 0) return alert('Selecione pelo menos um professor para a turma.');
    try {
      await updateDoc(doc(db, 'turmas', turmaId), {
        professorIds: selecionados,
        professorId: selecionados[0], // mantém telas/versões antigas compatíveis
      });
      setEditandoProfessores(null);
      await reload();
    } catch (error) {
      console.error('Erro ao atualizar professores:', error);
      alert('Não foi possível atualizar os professores da turma.');
    }
  };

  const handleDeletarTurma = async (turmaId) => {
    if (window.confirm('Tem certeza que deseja remover esta turma?')) {
      try { await deleteDoc(doc(db, 'turmas', turmaId)); reload(); }
      catch (error) { console.error('Erro ao deletar turma:', error); }
    }
  };

  const renderSeletorProfessores = (selecionadosAtuais, setter) => (
    <div className="professores-selector">
      <label>Professores responsáveis</label>
      {professores.length === 0 ? <small>Nenhum professor ativo cadastrado.</small> : (
        <div className="professores-opcoes">
          {professores.filter(p => !novaTurma.cidadeId || p.cidadeId === novaTurma.cidadeId).map(p => (
            <label className={`professor-opcao ${selecionadosAtuais.includes(p.id) ? 'selecionado' : ''}`} key={p.id}>
              <input type="checkbox" checked={selecionadosAtuais.includes(p.id)} onChange={() => alternarSelecionado(p.id, setter)} />
              <span>{p.nome || p.email}</span>
            </label>
          ))}
        </div>
      )}
      <small>{selecionadosAtuais.length} professor(es) selecionado(s)</small>
    </div>
  );

  const renderCard = (turma) => {
    const ids = professorIdsDaTurma(turma);
    const editando = editandoProfessores === turma.id;
    return (
      <div key={turma.id} className="card-turma">
        <h4>{turma.nome}</h4><small>📍 {nomeCidade(turma.cidadeId) || turma.cidadeNome || 'Cidade não definida'}</small>
        <p className="horario">⏰ {turma.horario || 'Sem horário definido'}</p>
        <div className="turma-professores">
          <span className="turma-professores-label">👨‍🏫 Professores</span>
          <div className="professor-tags">
            {ids.length ? ids.map(id => <span className="professor-tag" key={id}>{nomeProfessor(id)}</span>) : <span className="professor-tag vazio-tag">Não definido</span>}
          </div>
        </div>
        {isAdmin && (editando ? (
          <div className="editar-professores">
            {renderSeletorProfessores(selecionados, setSelecionados)}
            <div className="turma-acoes">
              <button className="btn-salvar-professores" onClick={() => salvarProfessores(turma.id)}>Salvar professores</button>
              <button className="btn-cancelar" onClick={() => setEditandoProfessores(null)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button className="btn-professores" onClick={() => abrirProfessores(turma)}>+ Adicionar / editar professores</button>
        ))}
        <button className="btn-deletar" onClick={() => handleDeletarTurma(turma.id)}>Remover</button>
      </div>
    );
  };

  const turmasAdulto = useMemo(() => turmas.filter(t => t.tipo === 'adulto'), [turmas]);
  const turmasKids = useMemo(() => turmas.filter(t => t.tipo === 'kids'), [turmas]);

  return (
    <div className="turmas-container">
      <div className="turmas-header"><h2>Minhas Turmas</h2><button className="btn-adicionar" onClick={() => setMostrarForm(!mostrarForm)}>{mostrarForm ? '✕ Fechar' : '+ Nova Turma'}</button></div>
      {mostrarForm && (
        <form onSubmit={handleAdicionarTurma} className="form-turma">
          <h3>Criar Nova Turma</h3>
          <input type="text" placeholder="Nome da turma (ex: Turma A - Segunda)" value={novaTurma.nome} onChange={e => setNovaTurma({ ...novaTurma, nome: e.target.value })} required />
          <input type="text" placeholder="Horário (ex: 19:30 - 20:30)" value={novaTurma.horario} onChange={e => setNovaTurma({ ...novaTurma, horario: e.target.value })} />
          <select value={novaTurma.cidadeId} disabled={!isAdmin} onChange={e => { setNovaTurma({ ...novaTurma, cidadeId:e.target.value }); setProfessoresNovaTurma([]); }} required>
            <option value="">Selecione a cidade</option>{CIDADES_ACRE.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={novaTurma.tipo} onChange={e => setNovaTurma({ ...novaTurma, tipo: e.target.value })}><option value="adulto">Adulto</option><option value="kids">Kids</option></select>
          {isAdmin && renderSeletorProfessores(professoresNovaTurma, setProfessoresNovaTurma)}
          <button type="submit" className="btn-submit">Criar Turma</button>
        </form>
      )}
      <div className="secoes-turmas">
        <section className="secao-turma"><h3>👨‍🏫 Turmas Adulto ({turmasAdulto.length})</h3><div className="lista-turmas">{turmasAdulto.length ? turmasAdulto.map(renderCard) : <p className="vazio">Nenhuma turma adulto criada</p>}</div></section>
        <section className="secao-turma"><h3>👶 Turmas Kids ({turmasKids.length})</h3><div className="lista-turmas">{turmasKids.length ? turmasKids.map(renderCard) : <p className="vazio">Nenhuma turma kids criada</p>}</div></section>
      </div>
    </div>
  );
}
export default Turmas;
