import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import '../styles/Turmas.css';

function Turmas({ turmas, reload }) {
  const [novaTurma, setNovaTurma] = useState({ 
    nome: '', 
    tipo: 'adulto',
    horario: ''
  });
  const [mostrarForm, setMostrarForm] = useState(false);

  const handleAdicionarTurma = async (e) => {
    e.preventDefault();
    if (!novaTurma.nome.trim()) {
      alert('Por favor, preencha o nome da turma');
      return;
    }

    try {
      await addDoc(collection(db, 'turmas'), {
        ...novaTurma,
        professorId: auth.currentUser.uid,
        dataCriacao: new Date(),
      });
      setNovaTurma({ nome: '', tipo: 'adulto', horario: '' });
      setMostrarForm(false);
      reload();
    } catch (error) {
      console.error('Erro ao adicionar turma:', error);
      alert('Erro ao adicionar turma');
    }
  };

  const handleDeletarTurma = async (turmaId) => {
    if (window.confirm('Tem certeza que deseja remover esta turma?')) {
      try {
        await deleteDoc(doc(db, 'turmas', turmaId));
        reload();
      } catch (error) {
        console.error('Erro ao deletar turma:', error);
      }
    }
  };

  const turmasAdulto = turmas.filter(t => t.tipo === 'adulto');
  const turmasKids = turmas.filter(t => t.tipo === 'kids');

  return (
    <div className="turmas-container">
      <div className="turmas-header">
        <h2>Minhas Turmas</h2>
        <button className="btn-adicionar" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? '✕ Fechar' : '+ Nova Turma'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleAdicionarTurma} className="form-turma">
          <h3>Criar Nova Turma</h3>
          <input
            type="text"
            placeholder="Nome da turma (ex: Turma A - Segunda)"
            value={novaTurma.nome}
            onChange={(e) => setNovaTurma({ ...novaTurma, nome: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Horário (ex: 19:30 - 20:30)"
            value={novaTurma.horario}
            onChange={(e) => setNovaTurma({ ...novaTurma, horario: e.target.value })}
          />
          <select 
            value={novaTurma.tipo} 
            onChange={(e) => setNovaTurma({ ...novaTurma, tipo: e.target.value })}
          >
            <option value="adulto">Adulto</option>
            <option value="kids">Kids</option>
          </select>
          <button type="submit" className="btn-submit">Criar Turma</button>
        </form>
      )}

      <div className="secoes-turmas">
        <section className="secao-turma">
          <h3>👨‍🏫 Turmas Adulto ({turmasAdulto.length})</h3>
          <div className="lista-turmas">
            {turmasAdulto.length === 0 ? (
              <p className="vazio">Nenhuma turma adulto criada</p>
            ) : (
              turmasAdulto.map(turma => (
                <div key={turma.id} className="card-turma">
                  <h4>{turma.nome}</h4>
                  <p className="horario">⏰ {turma.horario || 'Sem horário definido'}</p>
                  <button 
                    className="btn-deletar"
                    onClick={() => handleDeletarTurma(turma.id)}
                  >
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="secao-turma">
          <h3>👶 Turmas Kids ({turmasKids.length})</h3>
          <div className="lista-turmas">
            {turmasKids.length === 0 ? (
              <p className="vazio">Nenhuma turma kids criada</p>
            ) : (
              turmasKids.map(turma => (
                <div key={turma.id} className="card-turma">
                  <h4>{turma.nome}</h4>
                  <p className="horario">⏰ {turma.horario || 'Sem horário definido'}</p>
                  <button 
                    className="btn-deletar"
                    onClick={() => handleDeletarTurma(turma.id)}
                  >
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Turmas;
