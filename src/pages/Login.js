import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('aluno');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      if (isLogin) {
        // Login
        await signInWithEmailAndPassword(auth, email, senha);
        // Buscar tipo de usuário
        const userDoc = await getDoc(doc(db, 'usuarios', auth.currentUser.uid));
        const userType = userDoc.data().tipo;
        navigate(userType === 'professor' ? '/professor' : '/aluno');
      } else {
        // Cadastro
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          email,
          nome,
          tipo,
          criadoEm: new Date(),
        });
        navigate(tipo === 'professor' ? '/professor' : '/aluno');
      }
    } catch (error) {
      setErro(error.message);
    }
    setCarregando(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🥋 Jiu-Jitsu Oportunidades</h1>
        <h2>{isLogin ? 'Login' : 'Cadastro'}</h2>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {!isLogin && (
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="aluno">Aluno</option>
              <option value="professor">Professor</option>
            </select>
          )}
          <button type="submit" disabled={carregando}>
            {carregando ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        {erro && <p className="erro">{erro}</p>}

        <p>
          {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
          <button 
            type="button" 
            className="toggle-btn"
            onClick={() => {
              setIsLogin(!isLogin);
              setErro('');
            }}
          >
            {isLogin ? 'Cadastre-se' : 'Faça login'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
