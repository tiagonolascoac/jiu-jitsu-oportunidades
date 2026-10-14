import React from 'react';
import '../styles/AlunoAvatar.css';

const CORES = {
  branca: '#f5f5f5',
  azul: '#1769e0',
  roxa: '#7b2cbf',
  marrom: '#6b351f',
  preta: '#111111',
};

/**
 * O avatar só é um botão quando recebe onClick.
 * Isso permite usá-lo dentro do botão de alterar foto sem aninhar <button>.
 */
export default function AlunoAvatar({ aluno, size = 64, onClick }) {
  const faixa = String(aluno?.faixa || 'branca').toLowerCase();
  const cor = CORES[faixa] || CORES.branca;
  const grau = Math.max(0, Math.min(4, Number(aluno?.grau) || 0));
  const iniciais = String(aluno?.nome || 'A')
    .trim().split(/\s+/).slice(0, 2).map(nome => nome[0]).join('').toUpperCase();

  const tipo = onClick ? 'button' : 'span';
  const props = onClick
    ? { type: 'button', onClick, 'aria-label': `Perfil de ${aluno?.nome || 'aluno'}` }
    : {};

  return React.createElement(
    tipo,
    {
      ...props,
      className: `aluno-avatar${onClick ? ' aluno-avatar-interativo' : ''}`,
      style: { '--avatar-size': `${size}px`, '--faixa-cor': cor },
    },
    <>
      <span className="aluno-avatar-foto">
        {aluno?.fotoUrl
          ? <img src={aluno.fotoUrl} alt="" />
          : <span>{iniciais}</span>}
      </span>
      <i className="faixa-ponta esquerda" />
      <i className="faixa-ponta direita">
        {Array.from({ length: grau }, (_, i) => <b key={i} className="grau-marca" />)}
      </i>
    </>
  );
}
