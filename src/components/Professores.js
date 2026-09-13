import React, { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Professores.css';

function Professores({ currentUserId }) {
  const [professores, setProfessores] = useState([]);
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

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

      <form className="professor-promote-card" onSubmit={promoverProfessor}>
        <div>
          <h3>Adicionar professor</h3>
          <p>A pessoa precisa criar uma conta no site primeiro. Depois informe o mesmo e-mail aqui.</p>
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
