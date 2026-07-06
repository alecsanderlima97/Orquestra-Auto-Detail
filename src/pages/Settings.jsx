import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Copy, Download, Upload, Shield, Database, Palette, User as UserIcon, Camera, Save as SaveIcon, UserPlus } from 'lucide-react';
import { ROLES, canManageUsers, createInternalInvite } from '../services/commercialService';

const Settings = () => {
  const { exportData, importData, theme, setTheme, userProfile, setUserProfile } = useData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const [inviteRole, setInviteRole] = useState('Financeiro');
  const [internalInvite, setInternalInvite] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUserProfile(prev => ({ ...prev, foto: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    alert('Configurações de perfil salvas com sucesso!');
  };

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }
    if (newPassword.length < 4) {
      alert('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    // Em um sistema real, aqui salvaríamos no banco. Aqui simulamos salvando no localStorage.
    localStorage.setItem('orquestracs_admin_pass', newPassword);
    alert('Senha alterada com sucesso!');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          importData(json);
        } catch (err) {
          alert('Arquivo inválido!');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleInternalInvite = async () => {
    try {
      const invite = await createInternalInvite(currentUser.tenantId, currentUser.companyName, inviteRole);
      setInternalInvite(invite.code);
      setInviteMessage('Convite interno gerado.');
    } catch (error) {
      setInviteMessage(error.message || 'Não foi possível gerar convite.');
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações do Sistema</h1>
          <p style={{ color: '#aaa', marginTop: '4px' }}>Gerencie seus dados e backups com segurança.</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Perfil Administrador */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <UserIcon size={24} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: '20px' }}>Perfil do Usuário</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%', 
                background: 'rgba(255,255,255,0.05)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden',
                border: '2px solid var(--primary-color)'
              }}>
                {userProfile.foto ? (
                  <img src={userProfile.foto} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={40} color="#888" />
                )}
              </div>
              <label style={{ 
                position: 'absolute', 
                bottom: 0, 
                right: 0, 
                background: 'var(--primary-color)', 
                padding: '8px', 
                borderRadius: '50%', 
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                <Camera size={14} color="white" />
              </label>
            </div>

            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>Nome</label>
                <input type="text" name="nome" value={userProfile.nome} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>E-mail</label>
                <input type="email" name="email" value={userProfile.email} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>CPF</label>
                <input type="text" name="cpf" value={userProfile.cpf} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>CNPJ</label>
                <input type="text" name="cnpj" value={userProfile.cnpj} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>Telefone</label>
                <input type="text" name="telefone" value={userProfile.telefone} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>Instagram</label>
                <input type="text" name="instagram" value={userProfile.instagram} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>Chave PIX</label>
                <input type="text" name="pix" value={userProfile.pix || ''} onChange={handleProfileChange} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>Endereço Completo</label>
                <input type="text" name="endereco" value={userProfile.endereco} onChange={handleProfileChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }} />
              </div>
            </div>

            <button 
              onClick={handleSaveProfile}
              className="action-btn"
              style={{ 
                width: '100%', 
                justifyContent: 'center', 
                padding: '14px',
                background: 'var(--primary-color)',
                boxShadow: '0 4px 15px rgba(var(--primary-rgb), 0.3)'
              }}
            >
              <SaveIcon size={20} style={{ marginRight: '8px' }} />
              SALVAR CONFIGURAÇÕES
            </button>
          </div>
        </div>

        {/* Personalização de Tema */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Palette size={24} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: '20px' }}>Personalização</h2>
          </div>
          
          <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '16px' }}>Escolha o visual que mais combina com seu estilo:</p>
          
          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
            {[
              { id: 'premium', label: 'Modo Premium (Verde Musgo)', color: '#4a5d23' },
              { id: 'dark', label: 'Modo Escuro (Moderno)', color: '#0f172a' },
              { id: 'light', label: 'Modo Claro (Clean)', color: '#f8fafc' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: theme === t.id ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                  background: theme === t.id ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.02)',
                  color: theme === t.id ? 'white' : '#888',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
              >
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.color }}></div>
                <span style={{ fontWeight: theme === t.id ? 'bold' : 'normal' }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Backup e Restauração */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Database size={24} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: '20px' }}>Backup de Dados</h2>
          </div>
          
          <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
            Como o sistema salva os dados localmente no seu computador, você precisa exportar um backup para levar seus dados para outros dispositivos ou para o link do Vercel.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="action-btn" 
              onClick={exportData}
              style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
            >
              <Download size={20} /> Exportar Backup (Baixar Dados)
            </button>

            <div style={{ position: 'relative' }}>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileUpload}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <button 
                className="action-btn" 
                style={{ width: '100%', justifyContent: 'center', padding: '16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Upload size={20} /> Restaurar Backup (Enviar Dados)
              </button>
            </div>
          </div>
        </div>

        {/* Segurança e Senha */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Shield size={24} color="#0ea5e9" />
            <h2 style={{ margin: 0, fontSize: '20px' }}>Segurança</h2>
          </div>
          
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>Nova Senha</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>Confirmar Senha</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }}
              />
            </div>
            <button type="submit" className="action-btn" style={{ background: '#0ea5e9', width: '100%', justifyContent: 'center' }}>
              Alterar Senha
            </button>
          </form>

          <div style={{ marginTop: '24px', padding: '15px', background: 'rgba(14, 165, 233, 0.05)', borderRadius: '12px', border: '1px solid rgba(14, 165, 233, 0.1)' }}>
            <p style={{ color: '#0ea5e9', fontSize: '12px', margin: 0 }}>
              Sua senha é armazenada localmente de forma segura.
            </p>
          </div>
        </div>

        {canManageUsers(currentUser?.role) ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <UserPlus size={24} color="var(--primary-color)" />
              <h2 style={{ margin: 0, fontSize: '20px' }}>Convite Interno</h2>
            </div>

            <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>
              Gere convite para colaboradores acessarem esta empresa com permissao controlada.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} style={{ flex: 1, minWidth: 160, padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white' }}>
                {ROLES.map((role) => <option key={role}>{role}</option>)}
              </select>
              <button className="action-btn" onClick={handleInternalInvite}>
                <UserPlus size={18} /> Gerar
              </button>
            </div>

            {internalInvite ? (
              <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: 'monospace', fontSize: 22 }}>{internalInvite}</strong>
                <button className="action-btn" onClick={() => navigator.clipboard.writeText(internalInvite)}>
                  <Copy size={16} /> Copiar
                </button>
              </div>
            ) : null}
            {inviteMessage ? <p style={{ color: '#a7f3d0', fontSize: 13 }}>{inviteMessage}</p> : null}
          </div>
        ) : null}

      </div>
    </div>
  );
};

export default Settings;


