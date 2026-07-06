import React, { useEffect, useState } from "react";
import { Copy, Save, TicketPlus } from "lucide-react";
import {
  PLANS,
  SUBSCRIPTION_STATUSES,
  createCommercialInvite,
  listPlatformTenants,
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

const PlatformAdmin = () => {
  const [tenants, setTenants] = useState([]);
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

  const generateInvite = async () => {
    try {
      const invite = await createCommercialInvite(planId, status, nextBillingDate);
      setInviteCode(invite.code);
      setMessage("Convite comercial gerado.");
    } catch (error) {
      setMessage(error.message || "Não foi possível gerar convite.");
    }
  };

  const saveTenant = async (tenant) => {
    await updateTenantSubscription(tenant.id, {
      planId: tenant.planId,
      subscriptionStatus: tenant.subscriptionStatus,
      nextBillingDate: tenant.nextBillingDate || ""
    });
    setMessage("Cliente atualizado.");
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Orquestra.cs</h1>
          <p style={{ color: "#aaa", marginTop: 4 }}>Controle comercial de clientes, planos, status e convites.</p>
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

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Clientes</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ color: "#aaa", textAlign: "left" }}>
                <th style={{ padding: 12 }}>Empresa</th>
                <th style={{ padding: 12 }}>Plano</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Próxima cobrança</th>
                <th style={{ padding: 12 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <td style={{ padding: 12 }}>{tenant.name || tenant.companyName || tenant.id}</td>
                  <td style={{ padding: 12 }}>
                    <select style={inputStyle} value={tenant.planId || "profissional"} onChange={(event) => setTenants((items) => items.map((item) => item.id === tenant.id ? { ...item, planId: event.target.value } : item))}>
                      {Object.entries(PLANS).map(([id, plan]) => <option key={id} value={id}>{plan.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 12 }}>
                    <select style={inputStyle} value={tenant.subscriptionStatus || "trial"} onChange={(event) => setTenants((items) => items.map((item) => item.id === tenant.id ? { ...item, subscriptionStatus: event.target.value } : item))}>
                      {SUBSCRIPTION_STATUSES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 12 }}>
                    <input style={inputStyle} type="date" value={tenant.nextBillingDate || ""} onChange={(event) => setTenants((items) => items.map((item) => item.id === tenant.id ? { ...item, nextBillingDate: event.target.value } : item))} />
                  </td>
                  <td style={{ padding: 12 }}>
                    <button className="action-btn" onClick={() => saveTenant(tenant)}>
                      <Save size={16} /> Salvar
                    </button>
                  </td>
                </tr>
              ))}
              {!tenants.length ? <tr><td colSpan="5" style={{ padding: 24, color: "#aaa", textAlign: "center" }}>Nenhum cliente encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlatformAdmin;
