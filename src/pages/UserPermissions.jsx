import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, ShieldCheck, UserCog, UserPlus, Users } from 'lucide-react';
import {
  ROLES,
  canManageUsers,
  createInternalInvite,
  getSubscriptionAccess,
  listTenantInvites,
  listTenantUsers,
  updateTenantUserRole
} from '../services/commercialService';

const roleDescriptions = {
  Proprietario: 'Acesso total, convites, configuracoes, financeiro e operacao.',
  Financeiro: 'Pode operar o sistema e cuidar dos dados financeiros.',
  Consulta: 'Acesso de leitura para acompanhar informacoes sem editar.'
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: 'white'
};

const UserPermissions = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const canManage = canManageUsers(currentUser?.role) || currentUser?.role === 'dev';
  const access = getSubscriptionAccess(currentUser);
  const userLimit = access.plan.limits.users || 0;
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteRole, setInviteRole] = useState('Financeiro');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!currentUser?.tenantId || !canManage) return;
    setLoading(true);
    setMessage('');
    try {
      const [tenantUsers, tenantInvites] = await Promise.all([
        listTenantUsers(currentUser.tenantId),
        listTenantInvites(currentUser.tenantId)
      ]);
      setUsers(tenantUsers);
      setInvites(tenantInvites.filter((invite) => invite.status === 'Ativo'));
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generateInvite = async () => {
    try {
      const activeInvites = invites.filter((invite) => invite.status === 'Ativo').length;
      const projectedUsers = users.length + activeInvites + 1;
      if (currentUser?.role !== 'dev' && userLimit > 0 && projectedUsers > userLimit) {
        setMessage(`Limite do ${access.plan.label} atingido: ${userLimit} usuario(s). Cancele convites ativos, remova usuarios ou solicite upgrade.`);
        return;
      }
      const invite = await createInternalInvite(currentUser.tenantId, currentUser.companyName, inviteRole);
      setInviteCode(invite.code);
      setMessage('Convite interno gerado.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel gerar convite.');
    }
  };

  const changeRole = async (userId, role) => {
    await updateTenantUserRole(currentUser.tenantId, userId, role);
    setMessage('Permissao atualizada.');
    await load();
  };

  if (!canManage) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Usuarios e Permissoes</h1>
        </div>
        <div className="card" style={{ maxWidth: 720 }}>
          <ShieldCheck size={28} color="var(--primary-color)" />
          <h2>Acesso restrito</h2>
          <p style={{ color: '#aaa' }}>Somente o perfil Proprietario pode gerenciar usuarios, permissoes e convites internos.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios e Permissoes</h1>
          <p style={{ color: '#aaa', marginTop: 4 }}>Controle quem acessa a empresa e qual permissao cada pessoa possui.</p>
        </div>
        <button className="action-btn" onClick={load} disabled={loading}>
          <RefreshCw size={18} /> Atualizar
        </button>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(360px, 1.4fr)', gap: 24 }}>
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <UserPlus size={24} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: 20 }}>Novo convite interno</h2>
          </div>
          <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.6 }}>
            Gere um codigo para colaborador criar acesso nesta empresa. O convite expira em 7 dias.
          </p>
          <p style={{ color: '#aaa', fontSize: 13, margin: '10px 0 0' }}>
            Uso do plano: {users.length + invites.length}/{userLimit} usuario(s), incluindo convites ativos.
          </p>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} style={inputStyle}>
              {ROLES.map((role) => <option key={role}>{role}</option>)}
            </select>
            <p style={{ margin: 0, color: '#aaa', fontSize: 13 }}>{roleDescriptions[inviteRole]}</p>
            <button className="action-btn" onClick={generateInvite} disabled={currentUser?.role !== 'dev' && userLimit > 0 && users.length + invites.length >= userLimit} style={{ justifyContent: 'center' }}>
              <UserPlus size={18} /> Gerar convite
            </button>
          </div>

          {inviteCode ? (
            <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: 'rgba(var(--primary-rgb), 0.12)', border: '1px solid rgba(var(--primary-rgb), 0.22)' }}>
              <span style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6 }}>Codigo do convite</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: 'monospace', fontSize: 24, color: 'white' }}>{inviteCode}</strong>
                <button className="action-btn" onClick={() => navigator.clipboard.writeText(inviteCode)}>
                  <Copy size={16} /> Copiar
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <Users size={24} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: 20 }}>Usuarios vinculados</h2>
          </div>
          <div className="table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Perfil</th>
                  <th>Ultimo acesso</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name || user.email}</strong>
                      <span style={{ display: 'block', color: '#888', fontSize: 12 }}>{user.email}</span>
                    </td>
                    <td>
                      <select value={user.role || 'Consulta'} onChange={(event) => changeRole(user.id, event.target.value)} style={inputStyle}>
                        {ROLES.map((role) => <option key={role}>{role}</option>)}
                      </select>
                    </td>
                    <td style={{ color: '#aaa' }}>{formatDateTime(user.lastSeenAt || user.updatedAt)}</td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: 28, color: '#888' }}>Nenhum usuario encontrado.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <UserCog size={24} color="var(--primary-color)" />
          <h2 style={{ margin: 0, fontSize: 20 }}>Convites ativos</h2>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {invites.map((invite) => (
            <div key={invite.code} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <strong style={{ fontFamily: 'monospace' }}>{invite.code}</strong>
                <span style={{ color: '#aaa', marginLeft: 10 }}>{invite.role}</span>
              </div>
              <button className="action-btn" onClick={() => navigator.clipboard.writeText(invite.code)}>
                <Copy size={16} /> Copiar
              </button>
            </div>
          ))}
          {!invites.length ? <p style={{ color: '#888', margin: 0 }}>Nenhum convite ativo no momento.</p> : null}
        </div>
      </section>

      {message ? <p style={{ color: '#a7f3d0', fontWeight: 800 }}>{message}</p> : null}
    </div>
  );
};

const formatDateTime = (value) => {
  if (!value) return 'Sem registro';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export default UserPermissions;
