import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import Turmas from './Turmas';
import Alunos from './Alunos';
import Presenca from './Presenca';
import Relatorio from './Relatorio';
import Professores from './Professores';
import ConfiguracaoPresenca from './ConfiguracaoPresenca';
import CheckinAluno from './CheckinAluno';
import { CIDADES_ACRE } from '../data/cidadesAcre';
import '../styles/Dashboard.css';

function Dashboard({ user, userType }) {
  const [pagina, setPagina] = useState('inicio');
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [professorCidadeId, setProfessorCidadeId] = useState('');

  const isAdmin = userType === 'admin';
  const isProfessor = userType === 'professor';
  const isStaff = isAdmin || isProfessor;

  const carregarDadosAdmin = useCallback(async () => {
    const [turmasSnapshot, alunosSnapshot, presencasSnapshot] = await Promise.all([
      getDocs(collection(db, 'turmas')),
      getDocs(collection(db, 'alunos')),
      getDocs(collection(db, 'presencas')),
    ]);

    setTurmas(turmasSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setAlunos(alunosSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setPresencas(presencasSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, []);

  const carregarDadosProfessor = useCallback(async () => {
    const professorId = user.uid;
    const perfil = await getDoc(doc(db, 'usuarios', professorId));
    const cidadeId = perfil.exists() ? (perfil.data().cidadeId || '') : '';
    setProfessorCidadeId(cidadeId);

    // Carrega tudo e filtra no cliente para suportar o novo professorIds[] e
    // manter compatibilidade com turmas antigas que ainda possuem professorId.
    const [turmasSnapshot, alunosSnapshot, presencasSnapshot] = await Promise.all([
      getDocs(collection(db, 'turmas')),
      getDocs(collection(db, 'alunos')),
      getDocs(collection(db, 'presencas')),
    ]);

    const todasTurmas = turmasSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const turmasProfessor = todasTurmas.filter((turma) =>
      (!cidadeId || turma.cidadeId === cidadeId) &&
      (turma.professorId === professorId ||
      (Array.isArray(turma.professorIds) && turma.professorIds.includes(professorId)))
    );
    const tiposPermitidos = new Set(turmasProfessor.map((turma) => turma.tipo));
    const todosAlunos = alunosSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const idsTurmas = new Set(turmasProfessor.map(t => t.id));
    const alunosProfessor = todosAlunos.filter((aluno) =>
      (!cidadeId || aluno.cidadeId === cidadeId) &&
      (idsTurmas.has(aluno.turmaId) || aluno.professorId === professorId || (!aluno.turmaId && tiposPermitidos.has(aluno.turma)))
    );

    setTurmas(turmasProfessor);
    setAlunos(alunosProfessor);

    const idsAlunos = new Set(alunosProfessor.map((item) => item.id));
    setPresencas(
      presencasSnapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((presenca) => idsAlunos.has(presenca.alunoId))
    );
  }, [user.uid]);

  const carregarDadosAluno = useCallback(async () => {
    const alunosPorUsuario = query(
      collection(db, 'alunos'),
      where('usuarioId', '==', user.uid)
    );
    let alunoSnapshot = await getDocs(alunosPorUsuario);

    // Compatibilidade com cadastros antigos feitos apenas pelo e-mail.
    if (alunoSnapshot.empty && user.email) {
      const alunosPorEmail = query(
        collection(db, 'alunos'),
        where('email', '==', user.email.toLowerCase())
      );
      alunoSnapshot = await getDocs(alunosPorEmail);
    }

    const alunoLista = alunoSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    setAlunos(alunoLista);

    if (alunoLista.length === 0) {
      setPresencas([]);
      return;
    }

    const alunoId = alunoLista[0].id;
    const presencasSnapshot = await getDocs(
      query(collection(db, 'presencas'), where('alunoId', '==', alunoId))
    );
    setPresencas(
      presencasSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    );
  }, [user.uid, user.email]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro('');

    try {
      if (isAdmin) {
        await carregarDadosAdmin();
      } else if (isProfessor) {
        await carregarDadosProfessor();
      } else {
        await carregarDadosAluno();
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      setErro('Não foi possível carregar os dados. Confira as regras do Firestore e tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [isAdmin, isProfessor, carregarDadosAdmin, carregarDadosProfessor, carregarDadosAluno]);

  useEffect(() => {
    carregarDados();
    if (isAdmin) {
      Promise.all(CIDADES_ACRE.map(c => setDoc(doc(db, 'cidades', c.id), c, { merge:true }))).catch(console.error);
    }
  }, [carregarDados, isAdmin]);

  const resumo = useMemo(() => {
    const ativos = alunos.filter((aluno) => aluno.ativo !== false).length;
    const presentes = presencas.filter((item) => item.status === 'presente').length;
    const frequencia = presencas.length
      ? Math.round((presentes / presencas.length) * 100)
      : 0;

    return {
      alunosAtivos: ativos,
      turmas: turmas.length,
      registros: presencas.length,
      frequencia,
    };
  }, [alunos, turmas, presencas]);

  const trocarPagina = (novaPagina) => {
    setPagina(novaPagina);
    setMenuAberto(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const renderInicioStaff = () => (
    <div className="dashboard-home">
      <div className="welcome-card">
        <div>
          <span className="eyebrow">{isAdmin ? 'Painel do administrador' : 'Painel do professor'}</span>
          <h1>Bem-vindo ao controle das aulas 🥋</h1>
          <p>{isAdmin ? 'Acompanhe todo o projeto, gerencie professores, turmas, alunos e presenças.' : 'Gerencie turmas, alunos e presença em um só lugar.'}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><span>Alunos ativos</span><strong>{resumo.alunosAtivos}</strong></div>
        <div className="stat-card"><span>Turmas</span><strong>{resumo.turmas}</strong></div>
        <div className="stat-card"><span>Registros de presença</span><strong>{resumo.registros}</strong></div>
        <div className="stat-card"><span>Presenças confirmadas</span><strong>{resumo.frequencia}%</strong></div>
      </div>

      <div className="quick-actions">
        <h2>Acesso rápido</h2>
        <div className="quick-actions-grid">
          {isAdmin && <button onClick={() => trocarPagina('professores')}>👨‍🏫 Gerenciar professores</button>}
          <button onClick={() => trocarPagina('presenca')}>✅ Lançar presença</button>
          {isAdmin && <button onClick={() => trocarPagina('config-presenca')}>📍 Configurar local</button>}
          <button onClick={() => trocarPagina('alunos')}>👥 Gerenciar alunos</button>
          <button onClick={() => trocarPagina('turmas')}>🥋 Gerenciar turmas</button>
          <button onClick={() => trocarPagina('relatorio')}>📊 Ver frequência</button>
        </div>
      </div>
    </div>
  );

  const renderAluno = () => {
    const aluno = alunos[0];
    const presentes = presencas.filter((item) => item.status === 'presente').length;
    const ausentes = presencas.filter((item) => item.status === 'ausente' || item.status === 'atrasado').length;
    const frequencia = presencas.length
      ? Math.round((presentes / presencas.length) * 100)
      : 0;

    return (
      <div className="dashboard-home">
        <div className="welcome-card">
          <div>
            <span className="eyebrow">Área do aluno</span>
            <h1>Olá, {aluno?.nome || user.displayName || user.email}</h1>
            <p>Acompanhe aqui seu cadastro e sua frequência nas aulas.</p>
          </div>
        </div>

        {!aluno ? (
          <div className="empty-card">
            <h2>Seu perfil ainda não foi vinculado</h2>
            <p>
              Sua conta foi criada, mas ainda não encontramos um cadastro de aluno correspondente.
              Peça ao professor para conferir o seu e-mail no cadastro.
            </p>
          </div>
        ) : (
          <>
            <CheckinAluno aluno={aluno} user={user} onSuccess={carregarDados} />

            <div className="student-profile-card">
              <div><span>Turma</span><strong>{aluno.turma === 'kids' ? 'Kids' : 'Adulto'}</strong></div>
              <div><span>Faixa</span><strong className="capitalize">{aluno.faixa || 'Branca'}</strong></div>
              <div><span>Status</span><strong>{aluno.ativo === false ? 'Inativo' : 'Ativo'}</strong></div>
            </div>

            <div className="stats-grid student-stats">
              <div className="stat-card"><span>Frequência</span><strong>{frequencia}%</strong></div>
              <div className="stat-card"><span>Presenças</span><strong>{presentes}</strong></div>
              <div className="stat-card"><span>Ausências</span><strong>{ausentes}</strong></div>
            </div>

            <div className="history-card">
              <h2>Últimos registros</h2>
              {presencas.length === 0 ? (
                <p>Nenhuma presença registrada ainda.</p>
              ) : (
                <div className="history-list">
                  {[...presencas]
                    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
                    .slice(0, 10)
                    .map((item) => (
                      <div className="history-row" key={item.id}>
                        <span>{item.data || 'Sem data'}</span>
                        <strong className={`status-${item.status === 'atrasado' ? 'ausente' : item.status}`}>{item.status === 'atrasado' ? 'ausente' : item.status}</strong>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderConteudo = () => {
    if (!isStaff) return renderAluno();

    switch (pagina) {
      case 'professores':
        return isAdmin ? <Professores currentUserId={user.uid} /> : renderInicioStaff();
      case 'turmas':
        return <Turmas turmas={turmas} reload={carregarDados} isAdmin={isAdmin} professorCidadeId={professorCidadeId} />;
      case 'alunos':
        return <Alunos alunos={alunos} turmas={turmas} reload={carregarDados} isAdmin={isAdmin} professorCidadeId={professorCidadeId} />;
      case 'presenca':
        return <Presenca alunos={alunos} turmas={turmas} reload={carregarDados} currentUserId={user.uid} />;
      case 'config-presenca':
        return isAdmin ? <ConfiguracaoPresenca user={user} /> : renderInicioStaff();
      case 'relatorio':
        return <Relatorio alunos={alunos} presencas={presencas} />;
      default:
        return renderInicioStaff();
    }
  };

  if (carregando) {
    return <div className="dashboard-loading">Carregando painel...</div>;
  }

  return (
    <div className="dashboard-container">
      {menuAberto && <div className="sidebar-overlay" onClick={() => setMenuAberto(false)} />}

      <aside className={`sidebar ${menuAberto ? 'aberta' : ''}`}>
        <div className="sidebar-header">
          <div>
            <span className="brand-mark">🥋</span>
            <h2>Jiu-Jitsu</h2>
            <small>Manager</small>
          </div>
          <button className="sidebar-close" onClick={() => setMenuAberto(false)}>×</button>
        </div>

        {isStaff ? (
          <nav className="sidebar-menu">
            <button className={pagina === 'inicio' ? 'ativo' : ''} onClick={() => trocarPagina('inicio')}>🏠 Início</button>
            {isAdmin && <button className={pagina === 'professores' ? 'ativo' : ''} onClick={() => trocarPagina('professores')}>👨‍🏫 Professores</button>}
            {isAdmin && <button className={pagina === 'config-presenca' ? 'ativo' : ''} onClick={() => trocarPagina('config-presenca')}>📍 Local da presença</button>}
            <button className={pagina === 'turmas' ? 'ativo' : ''} onClick={() => trocarPagina('turmas')}>🥋 Turmas</button>
            <button className={pagina === 'alunos' ? 'ativo' : ''} onClick={() => trocarPagina('alunos')}>👥 Alunos</button>
            <button className={pagina === 'presenca' ? 'ativo' : ''} onClick={() => trocarPagina('presenca')}>✅ Presença</button>
            <button className={pagina === 'relatorio' ? 'ativo' : ''} onClick={() => trocarPagina('relatorio')}>📊 Relatório</button>
          </nav>
        ) : (
          <nav className="sidebar-menu">
            <button className="ativo">🏠 Meu painel</button>
          </nav>
        )}

        <div className="sidebar-logout">
          <div className="sidebar-user">
            <span>{isAdmin ? 'Administrador' : isProfessor ? 'Professor' : 'Aluno'}</span>
            <small>{user.email}</small>
          </div>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuAberto(true)}>☰</button>
          <div>
            <strong>{isAdmin ? 'Painel do Administrador' : isProfessor ? 'Painel do Professor' : 'Área do Aluno'}</strong>
            <span>Projeto social de Jiu-Jitsu</span>
          </div>
        </header>

        <section className="content-area">
          {erro && <div className="dashboard-error">{erro}</div>}
          {renderConteudo()}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
