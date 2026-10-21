import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, CalendarClock, Car, CheckCircle, CreditCard, Crown, FileText, Loader2, Lock, Sparkles, Users } from 'lucide-react';
import { useData } from '../context/DataContext';
import { AI_CREDIT_PACKAGES, PLANS, buildAiCreditsPurchaseUrl, getSubscriptionAccess, getTenantAiCredits } from '../services/commercialService';
import './Plans.css';

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '22px'
};

const Plans = () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  const access = getSubscriptionAccess(currentUser);
  const { clientes, agendamentos } = useData();
  const [aiUsage, setAiUsage] = useState({ limit: access.plan.limits.aiCredits || 0, remaining: access.plan.limits.aiCredits || 0, used: 0 });

  const monthlyAppointments = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    return agendamentos.filter((item) => {
      if (!item?.dataStr) return false;
      const [, itemMonth, itemYear] = item.dataStr.split('/');
      return itemMonth === month && itemYear === year;
    }).length;
  }, [agendamentos]);

  const monthlyServiceOrders = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    return agendamentos.filter((item) => {
      if (!item?.osGeneratedAt) return false;
      const parsed = new Date(item.osGeneratedAt);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.toISOString().slice(0, 7) === monthKey;
    }).length;
  }, [agendamentos]);

  const usageCards = [
    {
      icon: Car,
      label: 'Clientes/veiculos',
      used: clientes.length,
      limit: access.plan.limits.vehicles
    },
    {
      icon: CalendarClock,
      label: 'Agendamentos do mes',
      used: monthlyAppointments,
      limit: access.plan.limits.appointments
    },
    {
      icon: FileText,
      label: 'Ordens de servico',
      used: monthlyServiceOrders,
      limit: access.plan.limits.serviceOrders
    },
    {
      icon: Bot,
      label: 'Creditos IA',
      used: aiUsage.used || 0,
      limit: aiUsage.limit ?? access.plan.limits.aiCredits
    }
  ];
  const [wallet, setWallet] = useState({ balance: 0, bonus: 0, included: access.plan.limits.aiCredits || 0, used: 0 });
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [purchaseError, setPurchaseError] = useState("");

  useEffect(() => {
    let active = true;
    getTenantAiCredits(currentUser?.tenantId)
      .then((data) => {
        if (!active) return;
        setWallet(data);
        setAiUsage({ limit: Number(data.included || access.plan.limits.aiCredits || 0), remaining: Number(data.balance || 0), used: Number(data.used || 0) });
      })
      .catch((error) => active && setPurchaseError(error.message || "Não foi possível consultar os créditos."))
      .finally(() => active && setLoadingCredits(false));
    return () => { active = false; };
  }, [currentUser?.tenantId, access.plan.limits.aiCredits]);

  const purchase = (pack) => {
    setPurchaseError("");
    try {
      const externalCustomerId = currentUser?.externalCustomerId || currentUser?.externalId || currentUser?.tenantId;
      if (!externalCustomerId) throw new Error("O cadastro da empresa ainda não possui identificação para compra.");
      const url = buildAiCreditsPurchaseUrl({ packageId: pack.id, credits: pack.credits, externalCustomerId, returnUrl: window.location.href });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setPurchaseError(error.message || "Não foi possível abrir o Portal Orquestra.cs.");
    }
  };

  return (
    <div className="plans-page">
    <div className="page-header"><div><h1 className="page-title">Planos e Assinatura</h1><p className="plans-subtitle">Controle comercial, limites do plano e créditos de inteligência artificial.</p></div></div>
    <section className="card plans-current">
      <div><p className="plans-eyebrow">Plano atual</p><h2>{access.plan.label}</h2><p>{currentUser?.companyName || "Empresa"} · {access.plan.monthlyPrice}/mês</p></div>
      <div className="plans-status-wrap"><span className={`plans-status ${access.blocked ? "is-blocked" : "is-active"}`}>{access.blocked ? <Lock size={16} /> : <CheckCircle size={16} />}{access.status}</span>{currentUser?.nextBillingDate ? <p>Próxima cobrança: {currentUser.nextBillingDate}</p> : null}</div>
      {access.warning ? <div className="plans-warning"><AlertTriangle size={18} /> Pagamento vencido há {access.pastDueDays} dia(s). O bloqueio automático ocorre após 5 dias corridos.</div> : null}
    </section>
    <section className="card ai-wallet-section">
      <header><span className="ai-wallet-icon"><Bot size={19} /></span><div><h2>IA Financeira Orquestra</h2><p>Créditos mensais para análises, resumos e apoio às decisões de caixa.</p></div><span className="ai-plan-tag"><Sparkles size={13} /> {access.plan.label}</span></header>
      <div className="ai-wallet-grid">
        <article className="ai-balance-card"><small>Saldo atual</small>{loadingCredits ? <Loader2 className="plans-spin" size={28} /> : <strong>{wallet.balance}</strong>}<div><span>Usados</span><b>{wallet.used}</b></div><div className="ai-balance-bar"><i style={{ width: `${Math.min(100, wallet.included ? (wallet.balance / wallet.included) * 100 : 0)}%` }} /></div><p>Seu plano renova {wallet.included} crédito(s) por mês. Cada pergunta consome 1 crédito.</p>{wallet.bonus > 0 ? <em>{wallet.bonus} crédito(s) extra(s) acumulado(s)</em> : null}</article>
        {AI_CREDIT_PACKAGES.map((pack) => <article className="ai-package-card" key={pack.id}><span><Sparkles size={12} /> {pack.label}</span><strong>{pack.credits}</strong><p>créditos IA</p><small>Preço confirmado com segurança no Portal Orquestra.cs.</small><button type="button" onClick={() => purchase(pack)}><CreditCard size={15} /> Comprar no Portal</button></article>)}
      </div>
      <p className="ai-purchase-note">O pagamento é concluído no Portal Orquestra.cs. Os créditos entram somente após a confirmação segura do pagamento.</p>
      {purchaseError ? <div className="plans-error" role="alert">{purchaseError}</div> : null}
      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Consumo do plano</h2>
            <p style={{ color: '#aaa', margin: '6px 0 0' }}>Acompanhe limites comerciais antes de precisar ampliar o plano.</p>
          </div>
          <span style={{ color: '#aaa', fontSize: 13 }}>Referência: mês atual</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {usageCards.map((item) => <UsageCard key={item.label} {...item} />)}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        {Object.entries(PLANS).map(([id, plan]) => {
          const active = currentUser?.planId === id;
          const featured = plan.recommended;

          return (
          <article key={id} style={{
            ...cardStyle,
            position: 'relative',
            borderColor: active || featured ? 'var(--primary-color)' : 'rgba(255,255,255,0.08)',
            background: featured ? 'linear-gradient(180deg, rgba(var(--primary-rgb),0.14), rgba(255,255,255,0.03))' : cardStyle.background,
            boxShadow: featured ? '0 18px 45px rgba(0,0,0,0.22)' : 'none'
          }}>
            {featured ? (
              <span style={{ position: 'absolute', top: 14, right: 14, padding: '6px 10px', borderRadius: 999, background: 'var(--primary-color)', color: '#111827', fontSize: 11, fontWeight: 900 }}>
                Mais vendido
              </span>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 22, paddingRight: featured ? 92 : 0 }}>{plan.label}</h3>
              {id === 'premium' ? <Crown color="#facc15" size={22} /> : <Users color="var(--primary-color)" size={22} />}
            </div>
            <strong style={{ display: 'block', fontSize: 26, marginTop: 12 }}>{plan.monthlyPrice}</strong>
            {featured ? <p style={{ color: '#d9f99d', margin: '8px 0 0', fontSize: 13 }}>Plano recomendado para a maioria das esteticas automotivas.</p> : null}
            <div style={{ marginTop: 16, display: 'grid', gap: 8, color: '#ccc', fontSize: 14 }}>
              <span>Usuarios: {plan.limits.users}</span>
              <span>Clientes/veiculos: {plan.limits.vehicles}</span>
              <span>Agendamentos/mes: {plan.limits.appointments}</span>
              <span>Ordens de servico/mes: {plan.limits.serviceOrders}</span>
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
          );
        })}
      </div>
      </section>
    </div>
  );
};

const UsageCard = ({ icon, label, used, limit }) => {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const tone = percent >= 100 ? '#ef4444' : percent >= 80 ? '#f59e0b' : 'var(--primary-color)';
  const status = limit <= 0 ? 'Nao incluido neste plano' : percent >= 100 ? 'Limite atingido' : percent >= 80 ? 'Perto do limite' : 'Dentro do limite';

  return (
    <article style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(var(--primary-rgb), 0.14)', color: 'var(--primary-color)' }}>
            {React.createElement(icon, { size: 19 })}
          </span>
          <strong>{label}</strong>
        </div>
        <span style={{ color: tone, fontWeight: 800, fontSize: 12 }}>{status}</span>
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <strong style={{ fontSize: 28 }}>{used}</strong>
        <span style={{ color: '#aaa' }}>/ {limit}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 12 }}>
        <div style={{ width: `${percent}%`, height: '100%', background: tone }} />
      </div>
    </article>
  );
};

export default Plans;
