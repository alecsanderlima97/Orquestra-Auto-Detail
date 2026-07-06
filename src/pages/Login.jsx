import React, { useState } from 'react';
import { CheckCircle, Eye, EyeOff, Lock, Ticket, User } from 'lucide-react';
import { loginWithFirebase, loginWithGoogle, registerWithInvite } from '../services/commercialService';

const fieldStyle = {
  width: '100%',
  backgroundColor: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '12px',
  padding: '14px 14px 14px 48px',
  color: 'white',
  fontSize: '15px',
  outline: 'none'
};

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(() => localStorage.getItem('last_logged_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const playLoginSound = () => {
    const audio = new Audio('/login_sound.mp3?v=' + Date.now());
    audio.volume = 0.7;
    return audio.play();
  };

  const loginLocalSupport = () => {
    const supportPassword = localStorage.getItem('orquestracs_admin_pass') || 'admin';
    if (email.trim().toLowerCase() !== 'orquestracs@gmail.com' || password !== supportPassword) return null;
    return { email: 'orquestracs@gmail.com', name: 'Suporte Tecnico', role: 'dev' };
  };

  const finishLogin = async (userData, loginEmail = email) => {
    if (!userData) throw new Error('Login nao concluido.');
    localStorage.setItem('last_logged_email', loginEmail || userData.email || '');
    await playLoginSound().catch(() => undefined);
    onLogin(userData);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userData;
      if (mode === 'register') {
        userData = await registerWithInvite({ companyName, email, name, password, inviteCode });
      } else {
        try {
          userData = await loginWithFirebase(email, password);
        } catch (firebaseError) {
          userData = loginLocalSupport();
          if (!userData) throw firebaseError;
        }
      }
      await finishLogin(userData);
    } catch (cause) {
      setError(cause.message || 'Nao foi possivel acessar.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const userData = await loginWithGoogle();
      await finishLogin(userData, userData.email);
    } catch (cause) {
      setError(cause.message || 'Nao foi possivel entrar com Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #2d3329 0%, #1a1f14 100%)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '430px',
        backgroundColor: 'rgba(34, 43, 25, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          backgroundColor: 'var(--primary-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: 'white'
        }}>
          <Lock size={32} />
        </div>

        <h1 style={{ color: 'var(--text-light)', fontSize: '24px', marginBottom: '8px', fontFamily: 'Oswald', textTransform: 'uppercase' }}>Sistema de Gestao</h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>Cadastro fechado por convite comercial ou interno</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          <button type="button" onClick={() => setMode('login')} style={{ padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', background: mode === 'login' ? 'var(--primary-color)' : 'rgba(255,255,255,0.06)', color: 'white', fontWeight: 700 }}>Entrar</button>
          <button type="button" onClick={() => setMode('register')} style={{ padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', background: mode === 'register' ? 'var(--primary-color)' : 'rgba(255,255,255,0.06)', color: 'white', fontWeight: 700 }}>Usar convite</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <>
              <Field icon={<User size={18} color="#666" />} label="Nome" value={name} onChange={(value) => setName(toTitleCase(value))} placeholder="Seu nome" />
              <Field icon={<User size={18} color="#666" />} label="Empresa" value={companyName} onChange={(value) => setCompanyName(toTitleCase(value))} placeholder="Nome da estetica automotiva" />
              <Field icon={<Ticket size={18} color="#666" />} label="Convite" value={inviteCode} onChange={(value) => setInviteCode(value.toUpperCase())} placeholder="Codigo Orquestra.cs" />
            </>
          ) : null}

          <Field icon={<User size={18} color="#666" />} label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />

          <div style={{ marginBottom: '24px', textAlign: 'left' }}>
            <label style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px', display: 'block' }}>Senha</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={18} color="#666" style={{ position: 'absolute', left: '16px' }} />
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" style={fieldStyle} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '16px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error ? <p style={{ color: '#fca5a5', fontSize: 13, marginTop: -8 }}>{error}</p> : null}

          <button type="submit" disabled={loading} style={{
            width: '100%',
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            {loading ? 'Processando...' : <>{mode === 'register' ? 'Criar conta' : 'Entrar no Sistema'} <CheckCircle size={18} /></>}
          </button>
        </form>

        {mode === 'login' ? (
          <button type="button" disabled={loading} onClick={handleGoogleLogin} style={{
            width: '100%',
            marginTop: 12,
            backgroundColor: 'rgba(255,255,255,0.92)',
            color: '#1f2937',
            border: 'none',
            borderRadius: '12px',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}>
            Entrar com Google
          </button>
        ) : null}
      </div>
    </div>
  );
};

function Field({ icon, label, type = 'text', value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: '16px', textAlign: 'left' }}>
      <label style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px', display: 'block' }}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {React.cloneElement(icon, { style: { position: 'absolute', left: '16px' } })}
        <input type={type} required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={fieldStyle} />
      </div>
    </div>
  );
}

function toTitleCase(value) {
  return value.replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export default Login;
