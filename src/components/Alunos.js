import React, { useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import { addDoc, collection, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { CIDADES_ACRE, nomeCidade } from '../data/cidadesAcre';
import '../styles/Alunos.css';

const FAIXAS = [
  { valor:'branca', label:'Branca' }, { valor:'azul', label:'Azul' },
  { valor:'roxa', label:'Roxa' }, { valor:'marrom', label:'Marrom' }, { valor:'preta', label:'Preta' }
];

function Alunos({ alunos, turmas = [], reload, isAdmin=false, professorCidadeId='' }) {
  const cidadeInicial = isAdmin ? '' : professorCidadeId;
  const [novoAluno,setNovoAluno]=useState({nome:'',email:'',cidadeId:cidadeInicial,turmaId:'',faixa:'branca'});
  const [mostrarForm,setMostrarForm]=useState(false);
  const [busca,setBusca]=useState('');
  const [filtroCidade,setFiltroCidade]=useState('');
  const [filtroTurma,setFiltroTurma]=useState('');

  const turmasCidade = (cidadeId) => turmas.filter(t => !cidadeId || t.cidadeId === cidadeId);
  const turmaNome = a => turmas.find(t=>t.id===a.turmaId)?.nome || (a.turma === 'kids' ? 'Kids' : a.turma === 'adulto' ? 'Adulto' : 'Sem turma');

  const visiveis=useMemo(()=>alunos.filter(a=>{
    const texto=`${a.nome||''} ${a.email||''}`.toLowerCase();
    return texto.includes(busca.toLowerCase()) && (!filtroCidade || a.cidadeId===filtroCidade) && (!filtroTurma || a.turmaId===filtroTurma);
  }),[alunos,busca,filtroCidade,filtroTurma]);

  const adicionar=async e=>{
    e.preventDefault();
    const turma=turmas.find(t=>t.id===novoAluno.turmaId);
    if(!novoAluno.nome.trim() || !novoAluno.cidadeId || !turma) return alert('Informe nome, cidade e turma.');
    await addDoc(collection(db,'alunos'),{
      ...novoAluno, cidadeNome:nomeCidade(novoAluno.cidadeId),
      turma:turma.tipo, professorId:auth.currentUser.uid, ativo:true, dataCriacao:new Date()
    });
    setNovoAluno({nome:'',email:'',cidadeId:cidadeInicial,turmaId:'',faixa:'branca'});
    setMostrarForm(false); reload();
  };

  const atualizar=async (aluno, campos)=>{
    const dados={...campos};
    if(campos.cidadeId) dados.cidadeNome=nomeCidade(campos.cidadeId);
    if(campos.turmaId){ const t=turmas.find(x=>x.id===campos.turmaId); if(t) dados.turma=t.tipo; }
    await updateDoc(doc(db,'alunos',aluno.id),dados); reload();
  };

  const trocarCidade=async (aluno,cidadeId)=>{
    if(!isAdmin) return;
    await atualizar(aluno,{cidadeId,cidadeNome:nomeCidade(cidadeId),turmaId:'',turma:''});
  };

  return <div className="alunos-container">
    <div className="alunos-header"><h2>Gerenciar Alunos</h2><button className="btn-adicionar" onClick={()=>setMostrarForm(!mostrarForm)}>{mostrarForm?'✕ Fechar':'+ Novo Aluno'}</button></div>

    {mostrarForm && <form onSubmit={adicionar} className="form-aluno">
      <h3>Adicionar Novo Aluno</h3>
      <input placeholder="Nome do aluno" value={novoAluno.nome} onChange={e=>setNovoAluno({...novoAluno,nome:e.target.value})} required/>
      <input type="email" placeholder="E-mail (opcional)" value={novoAluno.email} onChange={e=>setNovoAluno({...novoAluno,email:e.target.value})}/>
      <select value={novoAluno.cidadeId} disabled={!isAdmin} onChange={e=>setNovoAluno({...novoAluno,cidadeId:e.target.value,turmaId:''})} required>
        <option value="">Selecione a cidade</option>{CIDADES_ACRE.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <select value={novoAluno.turmaId} onChange={e=>setNovoAluno({...novoAluno,turmaId:e.target.value})} required>
        <option value="">Selecione a turma</option>{turmasCidade(novoAluno.cidadeId).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
      <select value={novoAluno.faixa} onChange={e=>setNovoAluno({...novoAluno,faixa:e.target.value})}>{FAIXAS.map(f=><option key={f.valor} value={f.valor}>{f.label}</option>)}</select>
      <button className="btn-submit">Adicionar</button>
    </form>}

    <div className="alunos-filtros">
      <input placeholder="🔎 Buscar aluno..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      {isAdmin && <select value={filtroCidade} onChange={e=>{setFiltroCidade(e.target.value);setFiltroTurma('')}}><option value="">Todas as cidades</option>{CIDADES_ACRE.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
      <select value={filtroTurma} onChange={e=>setFiltroTurma(e.target.value)}><option value="">Todas as turmas</option>{turmasCidade(filtroCidade || professorCidadeId).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select>
    </div>

    <div className="lista-alunos alunos-gerenciaveis">
      {visiveis.length===0 ? <p className="vazio">Nenhum aluno encontrado.</p> : visiveis.map(a=><div className="card-aluno aluno-gerencia-card" key={a.id}>
        <div className="aluno-info"><h4>{a.nome}</h4><p className="email">{a.email||'Sem e-mail'}</p><small>{nomeCidade(a.cidadeId)||a.cidadeNome||'Cidade não definida'} • {turmaNome(a)}</small></div>
        <div className="aluno-edicao">
          {isAdmin && <select value={a.cidadeId||''} onChange={e=>trocarCidade(a,e.target.value)}><option value="">Cidade</option>{CIDADES_ACRE.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
          <select value={a.turmaId||''} onChange={e=>atualizar(a,{turmaId:e.target.value})}>
            <option value="">Trocar turma</option>{turmasCidade(a.cidadeId || professorCidadeId).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <select value={a.faixa||'branca'} onChange={e=>atualizar(a,{faixa:e.target.value})}>{FAIXAS.map(f=><option key={f.valor} value={f.valor}>{f.label}</option>)}</select>
        </div>
        <div className="aluno-acoes">
          <button className="btn-desativar" onClick={()=>atualizar(a,{ativo:a.ativo===false})}>{a.ativo===false?'Ativar':'Desativar'}</button>
          {isAdmin && <button className="btn-deletar" onClick={async()=>{if(window.confirm('Remover este aluno permanentemente?')){await deleteDoc(doc(db,'alunos',a.id));reload()}}}>🗑️</button>}
        </div>
      </div>)}
    </div>
  </div>
}
export default Alunos;
