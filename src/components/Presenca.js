import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection } from 'firebase/firestore';
import '../styles/Presenca.css';

function Presenca({ alunos, turmas, reload }) {
  const [presencas, setPresencas] = useState({});
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [notas, setNotas] = useState({});

  const alunosDaTurma = turmaSelecionada
    ? alunos.filter(a => a.turma === turmas.find(t => t.id === turmaSelecionada)?.tipo)
    : [];

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
        if (presencas[alunoId]) {
          await addDoc(collection(db, 'presencas'), {
            alunoId,
            turmaSelecionada,
            data: dataSelecionada,
            status: presencas[alunoId],
            nota: notas[alunoId] || '',
            dataCriacao: new Date(),
          });
        }
      }
      alert('Presença registrada com sucesso!');
      setPresencas({});
      setNotas({});
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
          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => setDataSelecionada(e.target.value)}
          />
        </div>
        <div>
          <label>Turma:</label>
          <select value={turmaSelecionada} onChange={(e) => setTurmaSelecionada(e.target.value)}>
            <option value="">Selecione uma turma</option>
            {turmas.map(turma => (
              <option key={turma.id} value={turma.id}>
                {turma.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {turmaSelecionada && (
        <div className="presenca-lista">
          <h3>Alunos</h3>
          {alunosDaTurma.length === 0 ? (
            <p className="vazio">Nenhum aluno nesta turma</p>
          ) : (
            <>
              <div className="presenca-items">
                {alunosDaTurma.map(aluno => (
                  <div key={aluno.id} className="presenca-item">
                    <div className="presenca-info">
                      <h4>{aluno.nome}</h4>
                    </div>
                    <div className="presenca-botoes">
                      <button
                        className={`btn-status ${presencas[aluno.id] === 'presente' ? 'ativo' : ''}`}
                        onClick={() => handleTogglePresenca(aluno.id, 'presente')}
                      >
                        ✓ Presente
                      </button>
                      <button
                        className={`btn-status ${presencas[aluno.id] === 'atrasado' ? 'ativo' : ''}`}
                        onClick={() => handleTogglePresenca(aluno.id, 'atrasado')}
                      >
                        ⏰ Atrasado
                      </button>
                      <button
                        className={`btn-status ${presencas[aluno.id] === 'ausente' ? 'ativo' : ''}`}
                        onClick={() => handleTogglePresenca(aluno.id, 'ausente')}
                      >
                        ✕ Ausente
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Nota (opcional)"
                      value={notas[aluno.id] || ''}
                      onChange={(e) => setNotas(prev => ({ ...prev, [aluno.id]: e.target.value }))}
                      className="presenca-nota"
                    />
                  </div>
                ))}
              </div>
              <button className="btn-salvar" onClick={handleRegistrarPresencas}>
                💾 Registrar Presença
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Presenca;
