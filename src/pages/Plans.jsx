import React from 'react';
import { AlertTriangle, Bot, CheckCircle, Crown, Lock, Users } from 'lucide-react';
import { PLANS, getSubscriptionAccess } from '../services/commercialService';

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '22px'
};

const Plans = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const access = getSubscriptionAccess(currentUser);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Planos e Assinatura</h1>
          <p style={{ color: '#aaa', marginTop: 4 }}>Controle comercial, limites do plano e status da empresa.</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Plano atual</p>
            <h2 style={{ margin: '6px 0 0', fontSize: 26 }}>{access.plan.label}</h2>
            <p style={{ color: '#aaa', margin: '6px 0 0' }}>{currentUser?.companyName || 'Empresa'} · {access.plan.monthlyPrice}/mes</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, background: access.blocked ? 'rgba(239,68,68,.15)' : 'rgba(34,197,94,.12)', color: access.blocked ? '#fca5a5' : '#86efac', fontWeight: 800 }}>
              {access.blocked ? <Lock size={16} /> : <CheckCircle size={16} />}
              {access.status}
            </span>
            {currentUser?.nextBillingDate ? <p style={{ color: '#aaa', margin: '8px 0 0' }}>Proxima cobranca: {currentUser.nextBillingDate}</p> : null}
          </div>
        </div>

        {access.warning ? (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: 'rgba(245,158,11,.12)', color: '#fde68a', display: 'flex', gap: 10 }}>
            <AlertTriangle size={18} />
            Pagamento vencido ha {access.pastDueDays} dia(s). O bloqueio automatico ocorre apos 5 dias corridos.
          </div>
        ) : null}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        {Object.entries(PLANS).filter(([id]) => id !== 'profissional').map(([id, plan]) => (
          <article key={id} style={{ ...cardStyle, borderColor: currentUser?.planId === id ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 22 }}>{plan.label}</h3>
              {id === 'premium' ? <Crown color="#facc15" size={22} /> : <Users color="var(--primary-color)" size={22} />}
            </div>
            <strong style={{ display: 'block', fontSize: 26, marginTop: 12 }}>{plan.monthlyPrice}</strong>
            <div style={{ marginTop: 16, display: 'grid', gap: 8, color: '#ccc', fontSize: 14 }}>
              <span>Usuarios: {plan.limits.users}</span>
              <span>Clientes/veiculos: {plan.limits.vehicles}</span>
              <span>Agendamentos/mes: {plan.limits.appointments}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={15} /> IA: {plan.limits.aiCredits} creditos/mes</span>
            </div>
            <div style={{ marginTop: 18, display: 'grid', gap: 9 }}>
              {plan.features.map((feature) => (
                <span key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ddd', fontSize: 14 }}>
                  <CheckCircle size={15} color="#86efac" /> {feature}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Plans;
