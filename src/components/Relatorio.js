
import React, { useState } from 'react';
import '../styles/Relatorio.css';

function Relatorio({ alunos, presencas }) {
  const [filtroTurma, setFiltroTurma] = useState('all');
  const [buscaAluno, setBuscaAluno] = useState('');

  const normalizar = (texto = '') => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termoBusca = normalizar(buscaAluno.trim());

  const alunosFiltrados = (filtroTurma === 'all'
    ? alunos
    : alunos.filter(a => a.turma === filtroTurma))
    .filter(a => !termoBusca || normalizar(a.nome).includes(termoBusca));

  const calcularFrequencia = (alunoId) => {
    const pres = presencas.filter(p => p.alunoId === alunoId);

    if (pres.length === 0) return 0;

    const presentes = pres.filter(p => p.status === 'presente').length;

    return Math.round((presentes / pres.length) * 100);
  };

  return (
    <div className="relatorio-container">
      <div className="relatorio-header">
        <h2>Relatório de Frequência</h2>
      </div>

      <div className="relatorio-filter">
        <label>Filtrar por turma:</label>

        <input
          className="relatorio-busca"
          type="search"
          value={buscaAluno}
          onChange={(e) => setBuscaAluno(e.target.value)}
          placeholder="Buscar aluno..."
          aria-label="Buscar aluno"
        />

        <select
          value={filtroTurma}
          onChange={(e) => setFiltroTurma(e.target.value)}
        >
          <option value="all">Todas as turmas</option>
          <option value="adulto">Adulto</option>
          <option value="kids">Kids</option>
        </select>
      </div>

      <div className="relatorio-tabela">
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Turma</th>
              <th>Presentes</th>
              <th>Ausentes</th>
              <th>Frequência</th>
            </tr>
          </thead>

          <tbody>
            {alunosFiltrados.map(aluno => {
              const pres = presencas.filter(
                p => p.alunoId === aluno.id
              );

              const presentes = pres.filter(
                p => p.status === 'presente'
              ).length;

              const ausentes = pres.filter(
                p => p.status === 'ausente' || p.status === 'atrasado'
              ).length;

              const frequencia = calcularFrequencia(aluno.id);

              return (
                <tr key={aluno.id}>
                  <td className="aluno-cell">
                    <span className="aluno-nome">{aluno.nome}</span>
                    <span className="aluno-turma-mobile capitalize">{aluno.turma}</span>
                  </td>

                  <td className="capitalize turma-desktop">
                    {aluno.turma}
                  </td>

                  <td className="presente">
                    {presentes}
                  </td>

                  <td className="ausente">
                    {ausentes}
                  </td>

                  <td
                    className={
                      frequencia >= 80
                        ? 'green'
                        : frequencia >= 60
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {frequencia}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Relatorio;
