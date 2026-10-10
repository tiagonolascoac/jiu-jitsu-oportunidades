import React from 'react';
import '../styles/AlunoAvatar.css';

const CORES = {
  branca: '#f5f5f5',
  azul: '#1769e0',
  roxa: '#7b2cbf',
  marrom: '#6b351f',
  preta: '#111111',
};

export default function AlunoAvatar({ aluno, size = 64, onClick }) {
  const faixa = String(aluno?.faixa || 'branca').toLowerCase();
  const cor = CORES[faixa] || CORES.branca;
  const iniciais = String(aluno?.nome || 'A').trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
  return (
    <button type="button" className="aluno-avatar" style={{'--avatar-size':`${size}px`,'--faixa-cor':cor}} onClick={onClick} aria-label={`Perfil de ${aluno?.nome || 'aluno'}`}>
      <span className="aluno-avatar-foto">
        {aluno?.fotoUrl ? <img src={aluno.fotoUrl} alt="" /> : <span>{iniciais}</span>}
      </span>
      <i className="faixa-ponta esquerda" /><i className="faixa-ponta direita" />
    </button>
  );
}
