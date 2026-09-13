import React, { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import './styles/index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);

      try {
        if (!currentUser) {
          setUser(null);
          setUserType(null);
          return;
        }

        setUser(currentUser);

        // Estrutura principal do projeto: usuarios/{uid}.tipo
        const usuarioSnapshot = await getDoc(doc(db, 'usuarios', currentUser.uid));
        if (usuarioSnapshot.exists() && usuarioSnapshot.data().tipo) {
          setUserType(usuarioSnapshot.data().tipo);
          return;
        }

        // Compatibilidade com dados antigos que possam estar na coleção professores.
        const professoresQuery = query(
          collection(db, 'professores'),
          where('usuarioId', '==', currentUser.uid)
        );
        const professoresSnapshot = await getDocs(professoresQuery);
        setUserType(professoresSnapshot.empty ? 'aluno' : 'professor');
      } catch (error) {
        console.error('Erro ao identificar perfil do usuário:', error);
        setUserType('aluno');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '20px',
        color: '#666',
      }}>
        Carregando...
      </div>
    );
  }

  return user ? <Dashboard user={user} userType={userType} /> : <Auth />;
}

export default App;
