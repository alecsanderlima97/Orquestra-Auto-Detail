import React, { useEffect, useState } from "react";
import { Ban, CheckCircle2, Copy, Edit3, Eye, Save, Trash2, TicketPlus } from "lucide-react";
import {
  PLANS,
  SUBSCRIPTION_STATUSES,
  archiveTenant,
  createCommercialInvite,
  listPlatformTenants,
  markTenantPaid,
  updateTenantSubscription
} from "../services/commercialService";

const inputStyle = {
  height: "42px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  padding: "0 12px"
};

const formatDate = (date) => {
  if (!date) return "Nao informado";
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
};

const formatDateTime = (value) => {
  if (!value) return "Nunca acessou";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const statusStyle = (status) => {
  const colors = {
    ativo: ["#14532d", "#86efac"],
    trial: ["#1e3a8a", "#93c5fd"],
    vencido: ["#7c2d12", "#fdba74"],
    bloqueado: ["#7f1d1d", "#fca5a5"],
    cancelado: ["#3f3f46", "#d4d4d8"]
  };
  const [bg, color] = colors[status] || colors.trial;
  return { background: bg, color };
};

const PlatformAdmin = () => {
  const [tenants, setTenants] = useState([]);
  const [editingId, setEditingId] = useState("");
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
    setEditingId("");
    setMessage("Cliente atualizado.");
    await load();
  };

  const setQuickStatus = async (tenant, subscriptionStatus) => {
    await updateTenantSubscription(tenant.id, { subscriptionStatus });
    setMessage(`Status alterado para ${subscriptionStatus}.`);
    await load();
  };

  const setPaid = async (tenant) => {
    await markTenantPaid(tenant);
    setMessage("Pagamento confirmado e proxima cobranca atualizada.");
    await load();
  };

  const removeTenant = async (tenant) => {
    const ok = window.confirm(`Arquivar o cliente ${tenant.name || tenant.companyName}? Ele saira da lista, mas os dados nao serao apagados.`);
    if (!ok) return;
    await archiveTenant(tenant.id);
    setMessage("Cliente arquivado.");
    await load();
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Orquestra.cs</h1>
          <p style={{ color: "#aaa", marginTop: 4 }}>Controle comercial de clientes, planos, status, acesso e convites.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Novo convite comercial</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select style={inputStyle} value={planId} onChange={(event) => setPlanId(event.target.value)}>
            {Object.entries(PLANS).map(([id, plan]) => <option key={id} value={id}>{plan.label}</option>)}
          </select>
          <select style={inputStyle} value={status} onChange={(event) => setStatus(event.target.value)}>
            {SUBSCRIPTION_STATUSES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input style={inputStyle} type="date" value={nextBillingDate} onChange={(event) => setNextBillingDate(event.target.value)} />
          <button className="action-btn" onClick={generateInvite}>
            <TicketPlus size={18} /> Gerar convite
          </button>
        </div>
        {inviteCode ? (
          <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontFamily: "monospace", fontSize: 22 }}>{inviteCode}</strong>
            <button className="action-btn" onClick={() => navigator.clipboard.writeText(inviteCode)}>
              <Copy size={16} /> Copiar
            </button>
          </div>
        ) : null}
        {message ? <p style={{ color: "#a7f3d0" }}>{message}</p> : null}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {tenants.map((tenant) => {
          const billing = tenant.billing || {};
          const effectiveStatus = billing.effectiveStatus || tenant.subscriptionStatus || "trial";
          const editing = editingId === tenant.id;
          const expanded = expandedId === tenant.id;
          const plan = PLANS[tenant.planId] || PLANS.profissional;

          return (
            <section key={tenant.id} className="card" style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  {editing ? (
                    <input style={{ ...inputStyle, minWidth: 280 }} value={tenant.name || ""} onChange={(event) => updateTenantLocal(tenant.id, { name: event.target.value })} />
                  ) : (
                    <h2 style={{ margin: 0 }}>{tenant.name || tenant.companyName || tenant.id}</h2>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ ...statusStyle(effectiveStatus), padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                      {billing.paid ? "pago" : effectiveStatus}
                    </span>
                    <span style={{ background: tenant.online ? "#14532d" : "rgba(255,255,255,0.08)", color: tenant.online ? "#86efac" : "#bbb", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                      {tenant.online ? `online (${tenant.onlineUsers})` : "offline"}
                    </span>
                    {billing.warning ? (
                      <span style={{ background: "#7c2d12", color: "#fdba74", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                        bloqueia em {billing.daysUntilBlock} dia(s)
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="action-btn" onClick={() => setExpandedId(expanded ? "" : tenant.id)} style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Eye size={16} /> Status
                  </button>
                  <button className="action-btn" onClick={() => setEditingId(editing ? "" : tenant.id)} style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Edit3 size={16} /> Editar
                  </button>
                  {editing ? (
                    <button className="action-btn" onClick={() => saveTenant(tenant)}>
                      <Save size={16} /> Salvar
                    </button>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                <Info label="Plano" value={editing ? (
                  <select style={inputStyle} value={tenant.planId || "profissional"} onChange={(event) => updateTenantLocal(tenant.id, { planId: event.target.value })}>
                    {Object.entries(PLANS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
                  </select>
                ) : `${plan.label} - ${plan.monthlyPrice}`} />
                <Info label="Inicio como cliente" value={editing ? <input style={inputStyle} type="date" value={tenant.startDate || ""} onChange={(event) => updateTenantLocal(tenant.id, { startDate: event.target.value })} /> : formatDate(tenant.startDate)} />
                <Info label="Vencimento mensal" value={editing ? <input style={inputStyle} type="number" min="1" max="28" value={tenant.billingDay || 15} onChange={(event) => updateTenantLocal(tenant.id, { billingDay: event.target.value })} /> : `Todo dia ${tenant.billingDay || 15}`} />
                <Info label="Proxima cobranca" value={editing ? <input style={inputStyle} type="date" value={tenant.nextBillingDate || ""} onChange={(event) => updateTenantLocal(tenant.id, { nextBillingDate: event.target.value })} /> : formatDate(tenant.nextBillingDate)} />
                <Info label="Ultimo acesso" value={formatDateTime(tenant.lastAccessAt || tenant.lastSeenAt)} />
              </div>

              {expanded ? (
                <div style={{ background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, color: "#ccc" }}>
                  {billing.paid ? "Cliente em dia." : null}
                  {billing.pastDueDays > 0 ? `Vencido ha ${billing.pastDueDays} dia(s). ` : null}
                  {billing.daysUntilBlock ? `Bloqueio automatico em ${billing.daysUntilBlock} dia(s).` : null}
                  {billing.blocked ? "Acesso bloqueado para o cliente." : null}
                  {!billing.paid && !billing.pastDueDays && !billing.blocked ? "Acompanhe plano, vencimento e acessos deste cliente." : null}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="action-btn" onClick={() => setPaid(tenant)}>
                  <CheckCircle2 size={16} /> Pago
                </button>
                <button className="action-btn" onClick={() => setQuickStatus(tenant, "vencido")} style={{ background: "#92400e" }}>
                  Vencido
                </button>
                <button className="action-btn" onClick={() => setQuickStatus(tenant, effectiveStatus === "bloqueado" ? "ativo" : "bloqueado")} style={{ background: "#7f1d1d" }}>
                  <Ban size={16} /> {effectiveStatus === "bloqueado" ? "Desbloquear" : "Bloquear"}
                </button>
                <button className="action-btn" onClick={() => removeTenant(tenant)} style={{ background: "rgba(220,38,38,0.75)" }}>
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            </section>
          );
        })}
        {!tenants.length ? <div className="card" style={{ color: "#aaa", textAlign: "center" }}>Nenhum cliente encontrado.</div> : null}
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div style={{ display: "grid", gap: 6 }}>
    <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", fontWeight: 800 }}>{label}</span>
    <div style={{ color: "#f5f5f5", minHeight: 42, display: "flex", alignItems: "center" }}>{value}</div>
  </div>
);

export default PlatformAdmin;
