import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import Turmas from '../components/Turmas';
import Alunos from '../components/Alunos';
import RegistroPresenca from '../components/RegistroPresenca';
import '../styles/ProfessorDashboard.css';

function ProfessorDashboard() {
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [professorId] = useState(auth.currentUser.uid);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Carregar turmas
      const turmasQuery = query(
        collection(db, 'turmas'),
        where('professorId', '==', professorId)
      );
      const turmasSnapshot = await getDocs(turmasQuery);
      setTurmas(turmasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Carregar alunos
      const alunosQuery = query(
        collection(db, 'alunos'),
        where('professorId', '==', professorId)
      );
      const alunosSnapshot = await getDocs(alunosQuery);
      setAlunos(alunosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      setCarregando(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setCarregando(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (carregando) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div className="professor-dashboard">
      <nav className="navbar">
        <h1>🥋 Painel do Professor</h1>
        <div className="nav-links">
          <Link to="turmas">Turmas</Link>
          <Link to="alunos">Alunos</Link>
          <Link to="presenca">Registro de Presença</Link>
          <button onClick={handleLogout} className="logout-btn">Sair</button>
        </div>
      </nav>

      <Routes>
        <Route path="turmas" element={<Turmas turmas={turmas} reload={carregarDados} />} />
        <Route path="alunos" element={<Alunos alunos={alunos} reload={carregarDados} />} />
        <Route path="presenca" element={<RegistroPresenca turmas={turmas} reload={carregarDados} />} />
        <Route path="/" element={<Turmas turmas={turmas} reload={carregarDados} />} />
      </Routes>
    </div>
  );
}

export default ProfessorDashboard;
