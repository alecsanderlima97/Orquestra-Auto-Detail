import React, { useEffect, useState } from "react";
import { Archive, CheckCircle2, Copy, Eye, RefreshCw, Save, TicketPlus } from "lucide-react";
import {
  PLANS,
  SUBSCRIPTION_STATUSES,
  archiveTenant,
  createCommercialInvite,
  listPlatformTenants,
  markTenantPaid,
  updateTenantSubscription
} from "../services/commercialService";

const adminWrap = {
  background: "#f6f8fb",
  color: "#020617",
  margin: "-40px",
  minHeight: "calc(100vh - 80px)",
  paddingBottom: 28
};

const inputStyle = {
  height: 34,
  borderRadius: 5,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#020617",
  padding: "0 10px",
  width: "100%"
};

const buttonDark = {
  height: 34,
  borderRadius: 5,
  border: "none",
  background: "#020617",
  color: "#fff",
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
};

const formatDate = (date) => {
  if (!date) return "Sem registro";
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
};

const formatDateTime = (value) => {
  if (!value) return "Sem registro";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const situationLabel = (tenant) => {
  const billing = tenant.billing || {};
  if (!tenant.nextBillingDate) return { text: "Sem vencimento", tone: "muted" };
  if (billing.blocked) return { text: "Bloqueado", tone: "danger" };
  if (billing.pastDueDays > 0) return { text: `Vencido ha ${billing.pastDueDays} dia(s)`, tone: "warn" };
  const due = new Date(`${tenant.nextBillingDate}T23:59:59`);
  const days = Math.max(0, Math.ceil((due.getTime() - Date.now()) / 86400000));
  return { text: `Em dia: vence em ${days} dia(s)`, tone: "ok" };
};

const badgeStyle = (tone) => {
  const map = {
    ok: { background: "#bbf7d0", color: "#166534" },
    warn: { background: "#fed7aa", color: "#9a3412" },
    danger: { background: "#fecaca", color: "#991b1b" },
    muted: { background: "#eef2f7", color: "#475569" },
    online: { background: "#bbf7d0", color: "#166534" },
    offline: { background: "#eef2f7", color: "#475569" }
  };
  return {
    ...(map[tone] || map.muted),
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 25,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.15
  };
};

const PlatformAdmin = () => {
  const [tenants, setTenants] = useState([]);
  const [expandedId, setExpandedId] = useState("");
  const [planId, setPlanId] = useState("profissional");
  const [status, setStatus] = useState("trial");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setTenants(await listPlatformTenants());
  };

  useEffect(() => {
    load().catch(() => setMessage("Configure o Firebase para carregar clientes."));
  }, []);

  const updateTenantLocal = (tenantId, updates) => {
    setTenants((items) => items.map((item) => item.id === tenantId ? { ...item, ...updates } : item));
  };

  const generateInvite = async () => {
    try {
      const invite = await createCommercialInvite(planId, status, nextBillingDate);
      setInviteCode(invite.code);
      setMessage("Convite comercial gerado.");
    } catch (error) {
      setMessage(error.message || "Nao foi possivel gerar convite.");
    }
  };

  const saveTenant = async (tenant) => {
    await updateTenantSubscription(tenant.id, {
      billingDay: Number(tenant.billingDay || 15),
      name: tenant.name || tenant.companyName || tenant.id,
      nextBillingDate: tenant.nextBillingDate || "",
      planId: tenant.planId,
      startDate: tenant.startDate || "",
      subscriptionStatus: tenant.subscriptionStatus
    });
    setMessage("Cliente atualizado.");
    await load();
  };

  const setPaid = async (tenant) => {
    await markTenantPaid(tenant);
    setMessage("Pagamento confirmado.");
    await load();
  };

  const removeTenant = async (tenant) => {
    const ok = window.confirm(`Arquivar ${tenant.name || tenant.companyName}? Os dados ficam guardados, mas ele sai desta lista.`);
    if (!ok) return;
    await archiveTenant(tenant.id);
    setMessage("Cliente arquivado.");
    await load();
  };

  return (
    <div style={adminWrap}>
      <header style={{ background: "#fff7df", borderBottom: "1px solid #fde68a", padding: "14px 18px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>Admin Orquestra.cs</h1>
          <p style={{ margin: "6px 0 0", color: "#334155", fontSize: 12 }}>Controle comercial dos clientes, convites, planos e status de assinatura.</p>
        </div>
        <button style={{ ...buttonDark, background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1" }} onClick={load}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </header>

      <section style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: 18 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Novo convite comercial</h2>
        <p style={{ margin: "6px 0 14px", color: "#475569", fontSize: 12 }}>Use este convite para a cliente criar a propria empresa com o plano liberado por voce.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <select style={inputStyle} value={planId} onChange={(event) => setPlanId(event.target.value)}>
            {Object.entries(PLANS).map(([id, plan]) => <option key={id} value={id}>{plan.label} - {plan.monthlyPrice}</option>)}
          </select>
          <select style={inputStyle} value={status} onChange={(event) => setStatus(event.target.value)}>
            {SUBSCRIPTION_STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input style={inputStyle} type="date" value={nextBillingDate} onChange={(event) => setNextBillingDate(event.target.value)} />
          <button style={buttonDark} onClick={generateInvite}>
            <TicketPlus size={14} /> Gerar convite
          </button>
        </div>
        {inviteCode || message ? (
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", color: "#166534", fontSize: 12 }}>
            {inviteCode ? <strong style={{ color: "#020617", fontFamily: "monospace", fontSize: 18 }}>{inviteCode}</strong> : null}
            {inviteCode ? <button style={{ ...buttonDark, height: 30 }} onClick={() => navigator.clipboard.writeText(inviteCode)}><Copy size={13} /> Copiar</button> : null}
            {message ? <span>{message}</span> : null}
          </div>
        ) : null}
      </section>

      <section style={{ padding: 18 }}>
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#334155", textAlign: "left" }}>
                <Th>Cliente</Th>
                <Th>Plano</Th>
                <Th>Status</Th>
                <Th>Vencimento</Th>
                <Th>Inscricao</Th>
                <Th>Situacao calculada</Th>
                <Th>Ultimo acesso</Th>
                <Th>Online</Th>
                <Th>Creditos IA</Th>
                <Th>Acao</Th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const plan = PLANS[tenant.planId] || PLANS.profissional;
                const sit = situationLabel(tenant);
                const aiLimit = plan.limits.aiCredits || 0;

                return (
                  <React.Fragment key={tenant.id}>
                    <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                      <Td>
                        <strong style={{ display: "block", color: "#020617", fontSize: 13 }}>{tenant.name || tenant.companyName || tenant.id}</strong>
                        <span style={{ color: "#64748b", fontSize: 11 }}>{tenant.id}</span>
                      </Td>
                      <Td>
                        <select style={inputStyle} value={tenant.planId || "profissional"} onChange={(event) => updateTenantLocal(tenant.id, { planId: event.target.value })}>
                          {Object.entries(PLANS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
                        </select>
                      </Td>
                      <Td>
                        <select style={inputStyle} value={tenant.subscriptionStatus || "trial"} onChange={(event) => updateTenantLocal(tenant.id, { subscriptionStatus: event.target.value })}>
                          {SUBSCRIPTION_STATUSES.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Td>
                      <Td>
                        <input style={inputStyle} type="date" value={tenant.nextBillingDate || ""} onChange={(event) => updateTenantLocal(tenant.id, { nextBillingDate: event.target.value })} />
                      </Td>
                      <Td>
                        <input style={inputStyle} type="date" value={tenant.startDate || ""} onChange={(event) => updateTenantLocal(tenant.id, { startDate: event.target.value })} />
                      </Td>
                      <Td><span style={badgeStyle(sit.tone)}>{sit.text}</span></Td>
                      <Td>{formatDateTime(tenant.lastAccessAt || tenant.lastSeenAt)}</Td>
                      <Td><span style={badgeStyle(tenant.online ? "online" : "offline")}>{tenant.online ? `Online agora` : "Offline"}</span></Td>
                      <Td>{aiLimit ? `${aiLimit}/${aiLimit}` : "0/0"}</Td>
                      <Td>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button style={buttonDark} onClick={() => saveTenant(tenant)}><Save size={13} /> Salvar</button>
                          <button style={{ ...buttonDark, background: "#166534" }} onClick={() => setPaid(tenant)} title="Marcar como pago"><CheckCircle2 size={13} /></button>
                          <button style={{ ...buttonDark, background: "#475569" }} onClick={() => setExpandedId(expandedId === tenant.id ? "" : tenant.id)} title="Ver detalhes"><Eye size={13} /></button>
                          <button style={{ ...buttonDark, background: "#991b1b" }} onClick={() => removeTenant(tenant)} title="Arquivar cliente"><Archive size={13} /></button>
                        </div>
                      </Td>
                    </tr>
                    {expandedId === tenant.id ? (
                      <tr style={{ background: "#f8fafc" }}>
                        <td colSpan="10" style={{ padding: "12px 14px", color: "#334155", borderTop: "1px solid #e5e7eb" }}>
                          Inicio: {formatDate(tenant.startDate)} | Vencimento mensal: dia {tenant.billingDay || 15} | Ultima presenca: {formatDateTime(tenant.lastSeenAt)} | Usuarios: {tenant.users?.length || 0}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
              {!tenants.length ? (
                <tr><td colSpan="10" style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Nenhum cliente encontrado.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const Th = ({ children }) => <th style={{ padding: "12px 14px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>{children}</th>;
const Td = ({ children }) => <td style={{ padding: "11px 14px", verticalAlign: "middle", color: "#0f172a" }}>{children}</td>;

export default PlatformAdmin;
