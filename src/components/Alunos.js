import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, auth, storage } from '../firebase';
import { collection, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CIDADES_ACRE, nomeCidade } from '../data/cidadesAcre';
import { prepararFotoAluno, mensagemErroFotoProfessor } from '../utils/prepararFotoAluno';
import AlunoAvatar from './AlunoAvatar';
import '../styles/Alunos.css';

const FAIXAS = [
  { valor:'branca', label:'Branca' }, { valor:'azul', label:'Azul' },
  { valor:'roxa', label:'Roxa' }, { valor:'marrom', label:'Marrom' }, { valor:'preta', label:'Preta' }
];

function Alunos({ alunos, turmas = [], reload, isAdmin=false, professorCidadeId='' }) {
  const cidadeInicial = isAdmin ? '' : professorCidadeId;
  const valoresIniciais = () => ({nome:'',email:'',cidadeId:cidadeInicial,turmaId:'',faixa:'branca',grau:0});
  const [novoAluno,setNovoAluno]=useState(valoresIniciais);
  const [mostrarForm,setMostrarForm]=useState(false);
  const [busca,setBusca]=useState('');
  const [filtroCidade,setFiltroCidade]=useState('');
  const [filtroTurma,setFiltroTurma]=useState('');
  const [fotoPronta, setFotoPronta] = useState(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroCadastro, setErroCadastro] = useState('');
  const [avisoCadastro, setAvisoCadastro] = useState('');
  const [etapaCadastro, setEtapaCadastro] = useState('');
  // Se falhar o envio, guarda o ID criado para não duplicar o cadastro no retry.
  const [alunoPendenteFoto, setAlunoPendenteFoto] = useState(null);
  const galeriaRef = useRef(null);
  const cameraRef = useRef(null);
  const galeriaEdicaoRef = useRef(null);
  const cameraEdicaoRef = useRef(null);
  const [alunoPerfilId, setAlunoPerfilId] = useState(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState(null);
  const [fotoEdicao, setFotoEdicao] = useState(null);
  const [fotoPreviewEdicao, setFotoPreviewEdicao] = useState('');
  const [preparandoEdicao, setPreparandoEdicao] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState('');
  const [avisoEdicao, setAvisoEdicao] = useState('');

  useEffect(() => {
    return () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview); };
  }, [fotoPreview]);

  useEffect(() => {
    return () => { if (fotoPreviewEdicao) URL.revokeObjectURL(fotoPreviewEdicao); };
  }, [fotoPreviewEdicao]);

  useEffect(() => {
    if (!alunoPerfilId) return undefined;
    const tratarTecla = e => { if (e.key === 'Escape' && !salvandoEdicao && !preparandoEdicao) {
      setAlunoPerfilId(null); setEditandoPerfil(false); setFotoPreviewEdicao('');
    }};
    document.addEventListener('keydown', tratarTecla);
    return () => document.removeEventListener('keydown', tratarTecla);
  }, [alunoPerfilId, salvandoEdicao, preparandoEdicao]);

  const turmasCidade = (cidadeId) => turmas.filter(t => !cidadeId || t.cidadeId === cidadeId);
  const alunoPerfil = alunos.find(a => a.id === alunoPerfilId);
  const limparFotoEdicao = () => {
    setFotoEdicao(null); setFotoPreviewEdicao('');
    if (galeriaEdicaoRef.current) galeriaEdicaoRef.current.value = '';
    if (cameraEdicaoRef.current) cameraEdicaoRef.current.value = '';
  };
  const fecharPerfil = () => {
    if (salvandoEdicao || preparandoEdicao) return;
    setAlunoPerfilId(null); setEditandoPerfil(false); setDadosEdicao(null);
    limparFotoEdicao(); setErroEdicao(''); setAvisoEdicao('');
  };
  const abrirPerfil = aluno => {
    setAlunoPerfilId(aluno.id); setEditandoPerfil(false);
    setErroEdicao(''); setAvisoEdicao(''); limparFotoEdicao();
  };
  const iniciarEdicao = () => {
    if (!alunoPerfil) return;
    setDadosEdicao({
      nome: alunoPerfil.nome || '', email: alunoPerfil.email || '',
      cidadeId: alunoPerfil.cidadeId || (isAdmin ? '' : professorCidadeId),
      turmaId: alunoPerfil.turmaId || '', faixa: alunoPerfil.faixa || 'branca',
      grau: Number(alunoPerfil.grau) || 0, ativo: alunoPerfil.ativo !== false,
    });
    limparFotoEdicao(); setErroEdicao(''); setAvisoEdicao(''); setEditandoPerfil(true);
  };
  const escolherFotoEdicao = async e => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setPreparandoEdicao(true); setErroEdicao('');
    try {
      const blob = await prepararFotoAluno(arquivo);
      setFotoEdicao(blob); setFotoPreviewEdicao(URL.createObjectURL(blob));
    } catch (erro) { setErroEdicao(erro.message || 'Não foi possível preparar a foto.'); }
    finally { setPreparandoEdicao(false); }
  };
  const salvarEdicao = async e => {
    e.preventDefault();
    if (!alunoPerfil || !dadosEdicao || salvandoEdicao || preparandoEdicao) return;
    const nome = dadosEdicao.nome.trim();
    const cidadeId = dadosEdicao.cidadeId;
    const turma = turmas.find(t => t.id === dadosEdicao.turmaId);
    if (!nome) { setErroEdicao('Informe o nome do aluno.'); return; }
    if (!cidadeId || !turma || turma.cidadeId !== cidadeId) {
      setErroEdicao('Selecione uma cidade e uma turma correspondente.'); return;
    }
    if (!isAdmin && professorCidadeId && cidadeId !== professorCidadeId) {
      setErroEdicao('O professor só pode alterar alunos de sua cidade.'); return;
    }
    setSalvandoEdicao(true); setErroEdicao(''); setAvisoEdicao('');
    try {
      const campos = {
        nome, email: dadosEdicao.email.trim().toLowerCase(),
        cidadeId, cidadeNome: nomeCidade(cidadeId),
        turmaId: turma.id, turma: turma.tipo,
        faixa: dadosEdicao.faixa, grau: Number(dadosEdicao.grau) || 0,
        ativo: dadosEdicao.ativo,
      };
      if (fotoEdicao) {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Sessão expirada. Faça login novamente.');
        // Upload pelo professor/admin logado, mesmo quando o aluno não possui conta Auth.
        const caminho = `alunos/${uid}/cadastros/${alunoPerfil.id}/perfil.jpg`;
        const refFoto = ref(storage, caminho);
        await uploadBytes(refFoto, fotoEdicao, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(refFoto);
        campos.fotoUrl = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
        campos.fotoPath = caminho;
      }
      await updateDoc(doc(db, 'alunos', alunoPerfil.id), campos);
      limparFotoEdicao(); setEditandoPerfil(false);
      setAvisoEdicao('Dados do aluno atualizados com sucesso!');
      try { await reload(); } catch (erroReload) {
        console.error('Cadastro alterado, mas a lista não foi atualizada:', erroReload);
        setAvisoEdicao('Dados salvos! Atualize a página para visualizar as alterações.');
      }
    } catch (erro) {
      console.error('Erro ao editar aluno:', erro);
      setErroEdicao(
        ['storage/unauthorized', 'storage/bucket-not-found', 'storage/quota-exceeded'].includes(erro?.code)
          ? mensagemErroFotoProfessor(erro)
          : erro?.code === 'permission-denied'
            ? 'O Firestore não permitiu editar esse aluno. Confira as permissões de professor/Admin.'
            : erro?.message || 'Não foi possível salvar as alterações.'
      );
    } finally { setSalvandoEdicao(false); }
  };
  const turmaNome = a => turmas.find(t=>t.id===a.turmaId)?.nome || (a.turma === 'kids' ? 'Kids' : a.turma === 'adulto' ? 'Adulto' : 'Sem turma');

  const visiveis=useMemo(()=>alunos.filter(a=>{
    const texto=`${a.nome||''} ${a.email||''}`.toLowerCase();
    return texto.includes(busca.toLowerCase()) && (!filtroCidade || a.cidadeId===filtroCidade) && (!filtroTurma || a.turmaId===filtroTurma);
  }),[alunos,busca,filtroCidade,filtroTurma]);

  const limparSelecaoFoto = () => {
    setFotoPronta(null);
    setFotoPreview('');
    if (galeriaRef.current) galeriaRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const selecionarFoto = async evento => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;
    setErroCadastro('');
    setPreparandoFoto(true);
    setEtapaCadastro('Preparando a foto para pré-visualização...');
    try {
      const blob = await prepararFotoAluno(arquivo);
      const url = URL.createObjectURL(blob);
      setFotoPronta(blob);
      setFotoPreview(url);
      } catch (erro) {
      setErroCadastro(erro.message || 'Não foi possível preparar a imagem.');
    } finally {
      setPreparandoFoto(false);
      setEtapaCadastro('');
    }
  };

  const concluirCadastro = async (mensagem) => {
    setNovoAluno(valoresIniciais());
    limparSelecaoFoto();
    setAlunoPendenteFoto(null);
    setMostrarForm(false);
    setErroCadastro('');
    setAvisoCadastro(mensagem);
    setEtapaCadastro('');
    try { await reload(); }
    catch (erro) { console.error('Erro ao atualizar a lista de alunos:', erro); }
  };

  const enviarFotoDoAluno = async (idAluno) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('A sessão expirou. Faça login novamente.');
    if (!fotoPronta) throw new Error('Nenhuma foto selecionada.');
    // O dono do diretório é o PROFESSOR autenticado; o aluno pode não ter UID/Auth.
    const caminho = `alunos/${uid}/cadastros/${idAluno}/perfil.jpg`;
    setEtapaCadastro('Enviando a foto para o Firebase Storage...');
    await uploadBytes(ref(storage, caminho), fotoPronta, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(ref(storage, caminho));
    // O token pode continuar igual em uma substituição; a versão evita foto antiga no cache.
    const fotoUrl = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
    setEtapaCadastro('Vinculando a foto ao perfil do aluno...');
    await updateDoc(doc(db, 'alunos', idAluno), { fotoUrl, fotoPath: caminho });
  };

  const adicionar = async evento => {
    evento.preventDefault();
    if (salvando || preparandoFoto || alunoPendenteFoto) return;
    const turma = turmas.find(t => t.id === novoAluno.turmaId);
    if (!novoAluno.nome.trim() || !novoAluno.cidadeId || !turma || turma.cidadeId !== novoAluno.cidadeId) {
      setErroCadastro('Informe nome, cidade e uma turma dessa cidade.');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setErroCadastro('Sua sessão expirou. Entre novamente no sistema.');
      return;
    }

    setSalvando(true);
    setErroCadastro('');
    setAvisoCadastro('');
    let referenciaAluno;
    try {
      setEtapaCadastro('Cadastrando aluno...');
      referenciaAluno = doc(collection(db, 'alunos'));
      await setDoc(referenciaAluno, {
        ...novoAluno,
        nome: novoAluno.nome.trim(),
        email: novoAluno.email.trim().toLowerCase(),
        grau: Number(novoAluno.grau) || 0,
        cidadeNome: nomeCidade(novoAluno.cidadeId),
        turma: turma.tipo,
        professorId: uid,
        ativo: true,
        dataCriacao: serverTimestamp(),
      });
    } catch (erro) {
      console.error('Erro ao cadastrar aluno:', erro);
      setErroCadastro(erro?.code === 'permission-denied'
        ? 'O Firestore não permitiu criar o aluno. Confira as regras da coleção alunos.'
        : 'Não foi possível criar o cadastro. Tente novamente.');
      setEtapaCadastro('');
      setSalvando(false);
      return;
    }

    if (!fotoPronta) {
      await concluirCadastro('Aluno cadastrado com sucesso!');
      setSalvando(false);
      return;
    }

    try {
      await enviarFotoDoAluno(referenciaAluno.id);
      await concluirCadastro('Aluno cadastrado com foto de perfil!');
    } catch (erro) {
      console.error('Cadastro criado, mas ocorreu falha ao salvar foto:', erro);
      setAlunoPendenteFoto({ id: referenciaAluno.id, nome: novoAluno.nome.trim() });
      setErroCadastro(`O aluno foi cadastrado, mas a foto não foi salva. ${mensagemErroFotoProfessor(erro)}`);
      setEtapaCadastro('');
      // Não recarregar o dashboard aqui: ele desmontaria o formulário e
      // apagaria o ID salvo, impedindo repetir o upload sem duplicar aluno.
    } finally {
      setSalvando(false);
    }
  };

  const tentarFotoNovamente = async () => {
    if (!alunoPendenteFoto || !fotoPronta || salvando) return;
    setSalvando(true);
    setErroCadastro('');
    try {
      await enviarFotoDoAluno(alunoPendenteFoto.id);
      await concluirCadastro(`Foto do aluno ${alunoPendenteFoto.nome} salva com sucesso!`);
    } catch (erro) {
      setErroCadastro(`Não foi possível salvar a foto: ${mensagemErroFotoProfessor(erro)}`);
      setEtapaCadastro('');
    } finally { setSalvando(false); }
  };

  const atualizar=async (aluno, campos)=>{
    const dados={...campos};
    if(campos.cidadeId) dados.cidadeNome=nomeCidade(campos.cidadeId);
    if(campos.turmaId){ const t=turmas.find(x=>x.id===campos.turmaId); if(t) dados.turma=t.tipo; }
    await updateDoc(doc(db,'alunos',aluno.id),dados); reload();
  };

  const fecharOuAbrirFormulario = () => {
    if (salvando || preparandoFoto || alunoPendenteFoto) return;
    setMostrarForm(!mostrarForm);
    setErroCadastro('');
    setAvisoCadastro('');
    limparSelecaoFoto();
    setNovoAluno(valoresIniciais());
  };

  return <div className="alunos-container">
    <div className="alunos-header"><h2>Gerenciar Alunos</h2><button type="button" className="btn-adicionar" onClick={fecharOuAbrirFormulario} disabled={salvando || preparandoFoto || !!alunoPendenteFoto}>{mostrarForm?'✕ Fechar':'+ Novo Aluno'}</button></div>

    {avisoCadastro && <div className="aluno-foto-sucesso" role="status">{avisoCadastro}</div>}

    {mostrarForm && <form onSubmit={adicionar} className="form-aluno">
      <h3>Adicionar Novo Aluno</h3>
      {erroCadastro && <div className="aluno-foto-erro" role="alert">{erroCadastro}</div>}
      {alunoPendenteFoto ? (
        <div className="aluno-foto-recuperacao">
          <strong>Cadastro já criado: {alunoPendenteFoto.nome}</strong>
          <p>A foto ainda não foi vinculada. Você pode tentar novamente sem cadastrar outro aluno.</p>
          <div className="aluno-foto-acoes">
            <button type="button" onClick={tentarFotoNovamente} disabled={salvando}>↻ Tentar enviar foto novamente</button>
            <button type="button" className="aluno-foto-secundario" onClick={() => concluirCadastro('Aluno cadastrado sem foto. Você poderá adicioná-la depois.')} disabled={salvando}>Concluir sem foto</button>
          </div>
        </div>
      ) : <>
        <input placeholder="Nome do aluno" value={novoAluno.nome} onChange={e=>setNovoAluno({...novoAluno,nome:e.target.value})} required disabled={salvando}/>
        <input type="email" placeholder="E-mail (opcional)" value={novoAluno.email} onChange={e=>setNovoAluno({...novoAluno,email:e.target.value})} disabled={salvando}/>
        <select value={novoAluno.cidadeId} disabled={!isAdmin || salvando} onChange={e=>setNovoAluno({...novoAluno,cidadeId:e.target.value,turmaId:''})} required>
          <option value="">Selecione a cidade</option>{CIDADES_ACRE.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={novoAluno.turmaId} onChange={e=>setNovoAluno({...novoAluno,turmaId:e.target.value})} required disabled={salvando}>
          <option value="">Selecione a turma</option>{turmasCidade(novoAluno.cidadeId).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select value={novoAluno.faixa} onChange={e=>setNovoAluno({...novoAluno,faixa:e.target.value,grau:0})} disabled={salvando}>{FAIXAS.map(f=><option key={f.valor} value={f.valor}>{f.label}</option>)}</select>
        <select value={novoAluno.grau} onChange={e=>setNovoAluno({...novoAluno,grau:Number(e.target.value)})} disabled={salvando}>{[0,1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?'grau':'graus'}</option>)}</select>

        <div className="aluno-foto-cadastro">
          <div className="aluno-foto-cabecalho">
            <strong>Foto do aluno <span>(opcional)</span></strong>
            <small>Ideal para alunos sem celular: o professor pode fotografar na hora.</small>
          </div>
          <div className="aluno-foto-conteudo">
            <div className="aluno-foto-previa" aria-label={fotoPreview ? 'Prévia da foto escolhida' : 'Aluno sem foto'}>
              {fotoPreview ? <img src={fotoPreview} alt="Prévia da foto do aluno" /> : <span aria-hidden="true">📷</span>}
            </div>
            <div className="aluno-foto-controles">
              <div className="aluno-foto-acoes">
                <button type="button" onClick={() => galeriaRef.current?.click()} disabled={salvando || preparandoFoto}>🖼️ Escolher foto</button>
                <button type="button" onClick={() => cameraRef.current?.click()} disabled={salvando || preparandoFoto}>📷 Tirar foto</button>
              </div>
              {fotoPreview && <button type="button" className="aluno-foto-remover" onClick={limparSelecaoFoto} disabled={salvando || preparandoFoto}>Remover foto selecionada</button>}
              <small>Fotos JPG, PNG ou WebP de até 8 MB. A imagem será cortada em quadrado e comprimida.</small>
            </div>
          </div>
          <input ref={galeriaRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selecionarFoto} className="aluno-foto-input-oculto" aria-label="Escolher foto da galeria" />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={selecionarFoto} className="aluno-foto-input-oculto" aria-label="Tirar foto com a câmera" />
        </div>

        {etapaCadastro && <p className="aluno-foto-status" role="status">{etapaCadastro}</p>}
        <button type="submit" className="btn-submit" disabled={salvando || preparandoFoto}>{salvando ? 'Salvando cadastro...' : 'Adicionar aluno'}</button>
      </>}
      {alunoPendenteFoto && etapaCadastro && <p className="aluno-foto-status" role="status">{etapaCadastro}</p>}
    </form>}

    <div className="alunos-filtros">
      <input placeholder="🔎 Buscar aluno..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      {isAdmin && <select value={filtroCidade} onChange={e=>{setFiltroCidade(e.target.value);setFiltroTurma('')}}><option value="">Todas as cidades</option>{CIDADES_ACRE.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>}
      <select value={filtroTurma} onChange={e=>setFiltroTurma(e.target.value)}><option value="">Todas as turmas</option>{turmasCidade(filtroCidade || professorCidadeId).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select>
    </div>

    <div className="lista-alunos alunos-gerenciaveis">
      {visiveis.length === 0 ? <p className="vazio">Nenhum aluno encontrado.</p> : visiveis.map(a => (
        <div className="card-aluno aluno-gerencia-card" key={a.id}>
          <div className="aluno-gerencia-identificacao">
            <AlunoAvatar aluno={a} size={50} onClick={() => abrirPerfil(a)} />
            <div className="aluno-info">
              <button type="button" className="aluno-nome-abrir" onClick={() => abrirPerfil(a)} title={`Visualizar perfil de ${a.nome}`}>
                {a.nome}
              </button>
              <p className="email">{a.email || 'Sem e-mail'}</p>
              <small>{nomeCidade(a.cidadeId) || a.cidadeNome || 'Cidade não definida'} • {turmaNome(a)}</small>
            </div>
          </div>
          <div className="aluno-acoes aluno-acoes-lista">
            <button type="button" className="aluno-botao-perfil" onClick={() => abrirPerfil(a)}>Ver perfil <span aria-hidden="true">›</span></button>
            <button type="button" className="btn-desativar" onClick={() => atualizar(a, {ativo: a.ativo === false})}>{a.ativo === false ? 'Ativar' : 'Desativar'}</button>
            {isAdmin && <button type="button" className="btn-deletar" aria-label={`Excluir ${a.nome}`} onClick={async () => {
              if (window.confirm(`Remover ${a.nome} permanentemente?`)) {
                await deleteDoc(doc(db, 'alunos', a.id));
                if (alunoPerfilId === a.id) fecharPerfil();
                reload();
              }
            }}>🗑️</button>}
          </div>
        </div>
      ))}
    </div>

    {alunoPerfil && (
      <div className="alunos-perfil-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fecharPerfil(); }}>
        <aside className="alunos-perfil-lateral" role="dialog" aria-modal="true" aria-label={`Perfil de ${alunoPerfil.nome}`}>
          <button type="button" className="alunos-perfil-fechar" onClick={fecharPerfil} disabled={salvandoEdicao || preparandoEdicao} aria-label="Fechar perfil">×</button>
          {!editandoPerfil ? (
            <>
              <div className="alunos-perfil-cabecalho">
                <AlunoAvatar aluno={alunoPerfil} size={110} />
                <h2>{alunoPerfil.nome}</h2>
                <span className="alunos-perfil-graduacao">Faixa {alunoPerfil.faixa || 'branca'} • {Number(alunoPerfil.grau) || 0} {(Number(alunoPerfil.grau) || 0) === 1 ? 'grau' : 'graus'}</span>
                <span className={`alunos-perfil-status ${alunoPerfil.ativo === false ? 'inativo' : ''}`}>{alunoPerfil.ativo === false ? 'Inativo' : 'Ativo'}</span>
              </div>
              {avisoEdicao && <p className="alunos-perfil-sucesso" role="status">{avisoEdicao}</p>}
              <div className="alunos-perfil-dados">
                <div><span>Nome completo</span><strong>{alunoPerfil.nome}</strong></div>
                <div><span>E-mail</span><strong>{alunoPerfil.email || 'Não informado'}</strong></div>
                <div><span>Cidade</span><strong>{nomeCidade(alunoPerfil.cidadeId) || alunoPerfil.cidadeNome || 'Não informada'}</strong></div>
                <div><span>Turma</span><strong>{turmaNome(alunoPerfil)}</strong></div>
                <div><span>Faixa e grau</span><strong className="alunos-texto-capitalizado">{alunoPerfil.faixa || 'Branca'} • {Number(alunoPerfil.grau) || 0} {(Number(alunoPerfil.grau) || 0) === 1 ? 'grau' : 'graus'}</strong></div>
                <div><span>Status</span><strong>{alunoPerfil.ativo === false ? 'Inativo' : 'Ativo'}</strong></div>
              </div>
              <button type="button" className="alunos-perfil-editar" onClick={iniciarEdicao}>✏️ Editar aluno</button>
            </>
          ) : (
            <form onSubmit={salvarEdicao} className="alunos-perfil-formulario">
              <h2>Editar aluno</h2>
              <p className="alunos-perfil-legenda">Altere os dados e salve para atualizar o cadastro.</p>
              {erroEdicao && <p className="aluno-foto-erro" role="alert">{erroEdicao}</p>}
              <div className="alunos-perfil-foto-edicao">
                <button type="button" className="alunos-perfil-foto-clique" onClick={() => galeriaEdicaoRef.current?.click()} disabled={salvandoEdicao || preparandoEdicao} aria-label="Trocar foto do aluno">
                  <AlunoAvatar aluno={{...alunoPerfil, fotoUrl: fotoPreviewEdicao || alunoPerfil.fotoUrl}} size={106} />
                  <span>📷 Trocar foto</span>
                </button>
                <div className="alunos-perfil-foto-acoes">
                  <button type="button" onClick={() => galeriaEdicaoRef.current?.click()} disabled={salvandoEdicao || preparandoEdicao}>🖼️ Escolher foto</button>
                  <button type="button" onClick={() => cameraEdicaoRef.current?.click()} disabled={salvandoEdicao || preparandoEdicao}>📷 Tirar foto</button>
                  {fotoPreviewEdicao && <button type="button" className="alunos-perfil-cancelar-foto" onClick={limparFotoEdicao} disabled={salvandoEdicao}>Desfazer nova foto</button>}
                </div>
                <input ref={galeriaEdicaoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="aluno-foto-input-oculto" aria-label="Selecionar nova foto do aluno" onChange={escolherFotoEdicao} />
                <input ref={cameraEdicaoRef} type="file" accept="image/*" capture="environment" className="aluno-foto-input-oculto" aria-label="Fotografar aluno" onChange={escolherFotoEdicao} />
              </div>
              <label>Nome completo<input value={dadosEdicao.nome} required maxLength={150} onChange={e => setDadosEdicao({...dadosEdicao, nome: e.target.value})} disabled={salvandoEdicao} /></label>
              <label>E-mail (opcional)<input type="email" value={dadosEdicao.email} onChange={e => setDadosEdicao({...dadosEdicao, email: e.target.value})} disabled={salvandoEdicao} /></label>
              <label>Cidade
                <select value={dadosEdicao.cidadeId} onChange={e => setDadosEdicao({...dadosEdicao, cidadeId: e.target.value, turmaId: ''})} disabled={!isAdmin || salvandoEdicao} required>
                  <option value="">Selecione a cidade</option>
                  {CIDADES_ACRE.map(c => <option value={c.id} key={c.id}>{c.nome}</option>)}
                </select>
              </label>
              <label>Turma
                <select value={dadosEdicao.turmaId} required disabled={salvandoEdicao} onChange={e => setDadosEdicao({...dadosEdicao, turmaId: e.target.value})}>
                  <option value="">Selecione a turma</option>
                  {turmasCidade(dadosEdicao.cidadeId).map(t => <option value={t.id} key={t.id}>{t.nome}</option>)}
                </select>
              </label>
              <div className="alunos-perfil-forma-graduacao">
                <label>Faixa
                  <select value={dadosEdicao.faixa} onChange={e => setDadosEdicao({...dadosEdicao, faixa: e.target.value, grau: 0})} disabled={salvandoEdicao}>{FAIXAS.map(f => <option key={f.valor} value={f.valor}>{f.label}</option>)}</select>
                </label>
                <label>Grau
                  <select value={dadosEdicao.grau} onChange={e => setDadosEdicao({...dadosEdicao, grau: Number(e.target.value)})} disabled={salvandoEdicao}>{[0,1,2,3,4].map(n => <option key={n} value={n}>{n} {n===1 ? 'grau' : 'graus'}</option>)}</select>
                </label>
              </div>
              <label>Status
                <select value={dadosEdicao.ativo ? 'ativo' : 'inativo'} onChange={e => setDadosEdicao({...dadosEdicao, ativo: e.target.value === 'ativo'})} disabled={salvandoEdicao}>
                  <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                </select>
              </label>
              {alunoPerfil.usuarioId && <small className="alunos-perfil-nota">Alterar o e-mail neste cadastro não modifica o endereço usado no login do Firebase Authentication.</small>}
              {preparandoEdicao && <p className="alunos-perfil-salvando" role="status">Preparando foto...</p>}
              {salvandoEdicao && <p className="alunos-perfil-salvando" role="status">Salvando alterações. Aguarde...</p>}
              <div className="alunos-perfil-forma-acoes">
                <button type="button" onClick={() => { if (!salvandoEdicao && !preparandoEdicao) { setEditandoPerfil(false); limparFotoEdicao(); setErroEdicao(''); } }} disabled={salvandoEdicao || preparandoEdicao}>Cancelar</button>
                <button type="submit" disabled={salvandoEdicao || preparandoEdicao}>💾 {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}</button>
              </div>
            </form>
          )}
        </aside>
      </div>
    )}
  </div>;
}
export default Alunos;
