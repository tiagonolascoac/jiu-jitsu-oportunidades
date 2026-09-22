import React, { useCallback, useEffect, useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import { CIDADES_ACRE, nomeCidade } from '../data/cidadesAcre';
import '../styles/Professores.css';

function Professores({ currentUserId }) {
  const [professores, setProfessores] = useState([]);
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [mostrarCriacao, setMostrarCriacao] = useState(false);
  const [mostrarPromocao, setMostrarPromocao] = useState(false);
  const [novoProfessor, setNovoProfessor] = useState({ nome: '', email: '', senha: '', cidadeId: '' });
  const [criando, setCriando] = useState(false);

  const carregarProfessores = useCallback(async () => {
    setCarregando(true);
    setErro('');

    try {
      const snapshot = await getDocs(
        query(collection(db, 'usuarios'), where('tipo', '==', 'professor'))
      );
      setProfessores(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      console.error('Erro ao carregar professores:', error);
      setErro('Não foi possível carregar os professores. Confira as regras do Firestore.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarProfessores();
  }, [carregarProfessores]);

  const promoverProfessor = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');

    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado) return;

    setSalvando(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, 'usuarios'), where('email', '==', emailNormalizado))
      );

      if (snapshot.empty) {
        setErro('Esse e-mail ainda não possui conta. Peça para a pessoa criar uma conta de aluno primeiro.');
        return;
      }

      const usuario = snapshot.docs[0];
      if (usuario.data().tipo === 'admin') {
        setErro('Essa conta já é administradora.');
        return;
      }

      await updateDoc(doc(db, 'usuarios', usuario.id), {
        tipo: 'professor',
        ativo: true,
      });

      setEmail('');
      setSucesso('Conta promovida para professor com sucesso.');
      await carregarProfessores();
    } catch (error) {
      console.error('Erro ao promover professor:', error);
      setErro('Não foi possível promover essa conta. Confira as permissões do Firestore.');
    } finally {
      setSalvando(false);
    }
  };

  const criarProfessor = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');

    const nome = novoProfessor.nome.trim();
    const emailNovo = novoProfessor.email.trim().toLowerCase();
    const senha = novoProfessor.senha;
    const cidadeId = novoProfessor.cidadeId;

    if (!nome || !emailNovo || !cidadeId || senha.length < 6) {
      setErro('Informe nome, e-mail e uma senha inicial com pelo menos 6 caracteres.');
      return;
    }

    setCriando(true);
    let appSecundario;
    try {
      // Uma instância Firebase separada evita que o Admin seja deslogado
      // quando a conta do novo professor for criada.
      appSecundario = initializeApp(firebaseConfig, `criar-professor-${Date.now()}`);
      const authSecundario = getAuth(appSecundario);
      const credencial = await createUserWithEmailAndPassword(authSecundario, emailNovo, senha);

      await setDoc(doc(db, 'usuarios', credencial.user.uid), {
        nome,
        email: emailNovo,
        tipo: 'professor',
        ativo: true,
        cidadeId,
        cidadeNome: nomeCidade(cidadeId),
        criadoEm: new Date(),
        criadoPor: currentUserId || null,
      });

      await signOut(authSecundario);
      setNovoProfessor({ nome: '', email: '', senha: '', cidadeId: '' });
      setMostrarCriacao(false);
      setSucesso('Novo professor criado com sucesso. Ele já pode entrar com o e-mail e a senha inicial.');
      await carregarProfessores();
    } catch (error) {
      console.error('Erro ao criar professor:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErro('Este e-mail já possui uma conta. Use "Adicionar professor" para promovê-la.');
      } else if (error.code === 'auth/weak-password') {
        setErro('A senha inicial precisa ter pelo menos 6 caracteres.');
      } else if (error.code === 'auth/invalid-email') {
        setErro('Informe um e-mail válido.');
      } else {
        setErro('Não foi possível criar o professor. Confira o Authentication e as regras do Firestore.');
      }
    } finally {
      if (appSecundario) {
        try { await deleteApp(appSecundario); } catch (_) {}
      }
      setCriando(false);
    }
  };

  const alternarAtivo = async (professor) => {
    setErro('');
    setSucesso('');
    try {
      await updateDoc(doc(db, 'usuarios', professor.id), {
        ativo: professor.ativo === false,
      });
      await carregarProfessores();
    } catch (error) {
      console.error('Erro ao alterar professor:', error);
      setErro('Não foi possível alterar o status do professor.');
    }
  };

  const removerPermissao = async (professor) => {
    if (professor.id === currentUserId) return;
    if (!window.confirm(`Remover a permissão de professor de ${professor.nome || professor.email}?`)) return;

    setErro('');
    setSucesso('');
    try {
      await updateDoc(doc(db, 'usuarios', professor.id), {
        tipo: 'aluno',
      });
      setSucesso('Permissão de professor removida.');
      await carregarProfessores();
    } catch (error) {
      console.error('Erro ao remover permissão:', error);
      setErro('Não foi possível remover a permissão.');
    }
  };

  return (
    <div className="professores-container">
      <div className="professores-header">
        <div>
          <span className="eyebrow dark">Administração</span>
          <h2>Professores</h2>
          <p>Promova contas já cadastradas para permitir o gerenciamento de aulas e presenças.</p>
        </div>
      </div>

      <div className="professores-top-actions">
        <button
          type="button"
          className="criar-professor-button"
          onClick={() => { setMostrarCriacao(!mostrarCriacao); setMostrarPromocao(false); setErro(''); setSucesso(''); }}
        >
          {mostrarCriacao ? 'Cancelar novo professor' : '+ Criar novo professor'}
        </button>
      </div>

      {mostrarCriacao && (
        <form className="professor-create-card" onSubmit={criarProfessor}>
          <div>
            <h3>Criar novo professor</h3>
            <p>Cria uma conta de acesso diretamente como professor, sem cadastrá-lo como aluno.</p>
          </div>
          <div className="professor-create-grid">
            <input type="text" placeholder="Nome completo" value={novoProfessor.nome}
              onChange={(e) => setNovoProfessor({ ...novoProfessor, nome: e.target.value })} required />
            <input type="email" placeholder="email@exemplo.com" value={novoProfessor.email}
              onChange={(e) => setNovoProfessor({ ...novoProfessor, email: e.target.value })} required />
            <input type="password" placeholder="Senha inicial (mín. 6 caracteres)" minLength="6"
              value={novoProfessor.senha}
              onChange={(e) => setNovoProfessor({ ...novoProfessor, senha: e.target.value })} required />
            <select value={novoProfessor.cidadeId} onChange={(e) => setNovoProfessor({ ...novoProfessor, cidadeId: e.target.value })} required>
              <option value="">Cidade do professor</option>
              {CIDADES_ACRE.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button type="submit" disabled={criando}>
              {criando ? 'Criando...' : 'Criar professor'}
            </button>
          </div>
        </form>
      )}

      <div className="professores-top-actions">
        <button
          type="button"
          className="adicionar-professor-button"
          onClick={() => {
            setMostrarPromocao(!mostrarPromocao);
            setMostrarCriacao(false);
            setErro('');
            setSucesso('');
          }}
        >
          {mostrarPromocao ? 'Cancelar' : '+ Adicionar professor'}
        </button>
      </div>

      {mostrarPromocao && (
        <form className="professor-promote-card" onSubmit={promoverProfessor}>
          <div>
            <h3>Tornar usuário professor</h3>
            <p>Informe o e-mail de uma pessoa que já possui conta no site.</p>
          </div>
          <div className="professor-promote-form">
            <input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Tornar professor'}
            </button>
          </div>
        </form>
      )}

      {erro && <div className="professor-message error">{erro}</div>}
      {sucesso && <div className="professor-message success">{sucesso}</div>}

      <div className="professores-list-card">
        <div className="professores-list-title">
          <h3>Professores cadastrados</h3>
          <span>{professores.length}</span>
        </div>

        {carregando ? (
          <p>Carregando...</p>
        ) : professores.length === 0 ? (
          <p className="professores-empty">Nenhum professor cadastrado.</p>
        ) : (
          <div className="professores-list">
            {professores.map((professor) => (
              <div className="professor-row" key={professor.id}>
                <div className="professor-avatar">
                  {(professor.nome || professor.email || 'P').charAt(0).toUpperCase()}
                </div>
                <div className="professor-info">
                  <strong>{professor.nome || 'Sem nome'}</strong>
                  <span>{professor.email || 'Sem e-mail'}</span>
                </div>
                <select className="professor-cidade-select" value={professor.cidadeId || ''} onChange={async (e) => {
                  await updateDoc(doc(db, 'usuarios', professor.id), { cidadeId: e.target.value, cidadeNome: nomeCidade(e.target.value) });
                  await carregarProfessores();
                }}>
                  <option value="">Definir cidade</option>
                  {CIDADES_ACRE.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <span className={`professor-status ${professor.ativo === false ? 'inativo' : 'ativo'}`}>
                  {professor.ativo === false ? 'Inativo' : 'Ativo'}
                </span>
                <div className="professor-actions">
                  <button type="button" className="secondary" onClick={() => alternarAtivo(professor)}>
                    {professor.ativo === false ? 'Ativar' : 'Desativar'}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removerPermissao(professor)}
                    disabled={professor.id === currentUserId}
                    title={professor.id === currentUserId ? 'Você não pode remover sua própria permissão aqui.' : ''}
                  >
                    Remover permissão
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Professores;
