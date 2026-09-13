import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import '../styles/Alunos.css';

const FAIXAS = [
  { valor: 'branca', cor: '#FFFFFF', label: 'Branca' },
  { valor: 'azul', cor: '#0099FF', label: 'Azul' },
  { valor: 'roxa', cor: '#9933FF', label: 'Roxa' },
  { valor: 'marrom', cor: '#8B4513', label: 'Marrom' },
  { valor: 'preta', cor: '#000000', label: 'Preta' },
];

function Alunos({ alunos, reload }) {
  const [novoAluno, setNovoAluno] = useState({ 
    nome: '', 
    email: '', 
    turma: 'adulto', 
    faixa: 'branca' 
  });
  const [mostrarForm, setMostrarForm] = useState(false);

  const handleAdicionarAluno = async (e) => {
    e.preventDefault();
    if (!novoAluno.nome.trim()) {
      alert('Por favor, preencha o nome do aluno');
      return;
    }

    try {
      await addDoc(collection(db, 'alunos'), {
        ...novoAluno,
        professorId: auth.currentUser.uid,
        ativo: true,
        dataCriacao: new Date(),
      });
      setNovoAluno({ nome: '', email: '', turma: 'adulto', faixa: 'branca' });
      setMostrarForm(false);
      reload();
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      alert('Erro ao adicionar aluno');
    }
  };

  const handleEditarFaixa = async (alunoId, novaFaixa) => {
    try {
      await updateDoc(doc(db, 'alunos', alunoId), {
        faixa: novaFaixa,
      });
      reload();
    } catch (error) {
      console.error('Erro ao atualizar faixa:', error);
    }
  };

  const handleToggleAtivo = async (alunoId, ativo) => {
    try {
      await updateDoc(doc(db, 'alunos', alunoId), {
        ativo: !ativo,
      });
      reload();
    } catch (error) {
      console.error('Erro ao desativar aluno:', error);
    }
  };

  const handleDeletarAluno = async (alunoId) => {
    if (window.confirm('Tem certeza que deseja remover este aluno permanentemente?')) {
      try {
        await deleteDoc(doc(db, 'alunos', alunoId));
        reload();
      } catch (error) {
        console.error('Erro ao deletar aluno:', error);
      }
    }
  };

  const alunosAtivos = alunos.filter(a => a.ativo);
  const alunosAdulto = alunosAtivos.filter(a => a.turma === 'adulto');
  const alunosKids = alunosAtivos.filter(a => a.turma === 'kids');

  const getFaixaInfo = (faixa) => FAIXAS.find(f => f.valor === faixa) || FAIXAS[0];

  return (
    <div className="alunos-container">
      <div className="alunos-header">
        <h2>Gerenciar Alunos</h2>
        <button className="btn-adicionar" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? '✕ Fechar' : '+ Novo Aluno'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleAdicionarAluno} className="form-aluno">
          <h3>Adicionar Novo Aluno</h3>
          <input
            type="text"
            placeholder="Nome do aluno"
            value={novoAluno.nome}
            onChange={(e) => setNovoAluno({ ...novoAluno, nome: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email (opcional)"
            value={novoAluno.email}
            onChange={(e) => setNovoAluno({ ...novoAluno, email: e.target.value })}
          />
          <select 
            value={novoAluno.turma} 
            onChange={(e) => setNovoAluno({ ...novoAluno, turma: e.target.value })}
          >
            <option value="adulto">Adulto</option>
            <option value="kids">Kids</option>
          </select>
          <select 
            value={novoAluno.faixa} 
            onChange={(e) => setNovoAluno({ ...novoAluno, faixa: e.target.value })}
          >
            {FAIXAS.map(faixa => (
              <option key={faixa.valor} value={faixa.valor}>
                {faixa.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-submit">Adicionar</button>
        </form>
      )}

      <div className="secoes-alunos">
        <section className="secao-turma">
          <h3>👨‍🏫 Turma Adulto ({alunosAdulto.length})</h3>
          <div className="lista-alunos">
            {alunosAdulto.length === 0 ? (
              <p className="vazio">Nenhum aluno nesta turma</p>
            ) : (
              alunosAdulto.map(aluno => {
                const faixaInfo = getFaixaInfo(aluno.faixa);
                return (
                  <div key={aluno.id} className="card-aluno">
                    <div className="aluno-info">
                      <h4>{aluno.nome}</h4>
                      <p className="email">{aluno.email || 'Sem email'}</p>
                    </div>
                    <div className="aluno-faixa">
                      <select 
                        value={aluno.faixa}
                        onChange={(e) => handleEditarFaixa(aluno.id, e.target.value)}
                        className="faixa-select"
                      >
                        {FAIXAS.map(faixa => (
                          <option key={faixa.valor} value={faixa.valor}>
                            {faixa.label}
                          </option>
                        ))}
                      </select>
                      <div 
                        className="faixa-badge"
                        style={{ 
                          backgroundColor: faixaInfo.cor,
                          color: faixaInfo.cor === '#FFFFFF' ? '#000' : '#fff'
                        }}
                      >
                        {faixaInfo.label}
                      </div>
                    </div>
                    <div className="aluno-acoes">
                      <button 
                        className="btn-desativar"
                        onClick={() => handleToggleAtivo(aluno.id, aluno.ativo)}
                        title="Desativar aluno"
                      >
                        👁️
                      </button>
                      <button 
                        className="btn-deletar"
                        onClick={() => handleDeletarAluno(aluno.id)}
                        title="Remover aluno"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="secao-turma">
          <h3>👶 Turma Kids ({alunosKids.length})</h3>
          <div className="lista-alunos">
            {alunosKids.length === 0 ? (
              <p className="vazio">Nenhum aluno nesta turma</p>
            ) : (
              alunosKids.map(aluno => {
                const faixaInfo = getFaixaInfo(aluno.faixa);
                return (
                  <div key={aluno.id} className="card-aluno">
                    <div className="aluno-info">
                      <h4>{aluno.nome}</h4>
                      <p className="email">{aluno.email || 'Sem email'}</p>
                    </div>
                    <div className="aluno-faixa">
                      <select 
                        value={aluno.faixa}
                        onChange={(e) => handleEditarFaixa(aluno.id, e.target.value)}
                        className="faixa-select"
                      >
                        {FAIXAS.map(faixa => (
                          <option key={faixa.valor} value={faixa.valor}>
                            {faixa.label}
                          </option>
                        ))}
                      </select>
                      <div 
                        className="faixa-badge"
                        style={{ 
                          backgroundColor: faixaInfo.cor,
                          color: faixaInfo.cor === '#FFFFFF' ? '#000' : '#fff'
                        }}
                      >
                        {faixaInfo.label}
                      </div>
                    </div>
                    <div className="aluno-acoes">
                      <button 
                        className="btn-desativar"
                        onClick={() => handleToggleAtivo(aluno.id, aluno.ativo)}
                        title="Desativar aluno"
                      >
                        👁️
                      </button>
                      <button 
                        className="btn-deletar"
                        onClick={() => handleDeletarAluno(aluno.id)}
                        title="Remover aluno"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Alunos;
