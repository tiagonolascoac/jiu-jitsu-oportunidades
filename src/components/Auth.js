import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import '../styles/Auth.css';

const traduzirErro = (codigo) => {
  const mensagens = {
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'E-mail ou senha inválidos.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  };

  return mensagens[codigo] || 'Não foi possível concluir a operação. Tente novamente.';
};

function Auth() {
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [turma, setTurma] = useState('adulto');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  const limparMensagens = () => {
    setErro('');
    setSucesso('');
  };

  const alternarModo = () => {
    limparMensagens();
    setModo((atual) => (atual === 'login' ? 'cadastro' : 'login'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    limparMensagens();
    setCarregando(true);

    try {
      if (modo === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), senha);
        return;
      }

      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        senha
      );

      // Cadastro público cria somente alunos. Professores devem ser convidados
      // e ter o perfil promovido/registrado pela administração do projeto.
      await setDoc(doc(db, 'usuarios', credential.user.uid), {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        tipo: 'aluno',
        turma,
        ativo: true,
        criadoEm: serverTimestamp(),
      });

      // Também cria o perfil na coleção usada pelas telas de presença/relatório.
      await setDoc(doc(db, 'alunos', credential.user.uid), {
        usuarioId: credential.user.uid,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        turma,
        faixa: 'branca',
        ativo: true,
        criadoPeloProprioAluno: true,
        dataCriacao: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro de autenticação:', error);
      setErro(traduzirErro(error.code));
    } finally {
      setCarregando(false);
    }
  };

  const handleEsqueciSenha = async () => {
    limparMensagens();

    if (!email.trim()) {
      setErro('Digite seu e-mail para receber a recuperação de senha.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSucesso('Enviamos um e-mail para redefinição da sua senha.');
    } catch (error) {
      console.error('Erro ao recuperar senha:', error);
      setErro(traduzirErro(error.code));
    }
  };

  return (
    <div className="auth-container">
      <section className="auth-left">
        <div className="auth-left-content">
          <h1>🥋 Jiu-Jitsu Oportunidades</h1>
          <p>
            Presença, turmas e alunos organizados para fortalecer o projeto
            gratuito de Jiu-Jitsu da comunidade.
          </p>
        </div>
      </section>

      <section className="auth-right">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{modo === 'login' ? 'Entrar' : 'Criar conta de aluno'}</h2>

          {erro && <div className="auth-error">{erro}</div>}
          {sucesso && <div className="auth-success">{sucesso}</div>}

          {modo === 'cadastro' && (
            <>
              <input
                type="text"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                disabled={carregando}
              />

              <select
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
                disabled={carregando}
              >
                <option value="adulto">Adulto</option>
                <option value="kids">Kids</option>
              </select>
            </>
          )}

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={carregando}
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={6}
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            disabled={carregando}
          />

          <button type="submit" disabled={carregando}>
            {carregando
              ? 'Aguarde...'
              : modo === 'login'
                ? 'Entrar'
                : 'Criar minha conta'}
          </button>

          {modo === 'login' && (
            <button
              type="button"
              className="auth-secondary-button"
              onClick={handleEsqueciSenha}
              disabled={carregando}
            >
              Esqueci minha senha
            </button>
          )}

          <p className="auth-toggle">
            {modo === 'login' ? 'Ainda não é aluno? ' : 'Já possui uma conta? '}
            <button type="button" className="auth-link-button" onClick={alternarModo}>
              {modo === 'login' ? 'Cadastre-se' : 'Entrar'}
            </button>
          </p>

          {modo === 'cadastro' && (
            <p className="auth-professor-note">
              Professores acessam o sistema por convite da administração.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

export default Auth;
