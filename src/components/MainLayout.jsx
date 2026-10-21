import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Calculator from './Calculator';
import Footer from './Footer';
import GuideAssistant from './GuideAssistant';
import AiAssistant from '../pages/AiAssistant';
import { AlertTriangle, Bot, X } from 'lucide-react';
import { getSubscriptionAccess } from '../services/commercialService';

const MainLayout = () => {
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const access = getSubscriptionAccess(currentUser);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-container">
      {/* Botão Hambúrguer Mobile */}
      <button className="mobile-menu-btn" onClick={toggleSidebar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ width: '24px', height: '2px', background: 'currentColor' }}></div>
          <div style={{ width: '24px', height: '2px', background: 'currentColor' }}></div>
          <div style={{ width: '24px', height: '2px', background: 'currentColor' }}></div>
        </div>
      </button>

      {/* Overlay para fechar ao clicar fora */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`} 
        onClick={closeSidebar}
      ></div>

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={closeSidebar}
        onToggleCalculator={() => setShowCalculator(!showCalculator)} 
      />
      
      <div className="content-wrapper">
        <Header />
        <main className="main-content">
          {access.blocked && currentUser?.role !== 'dev' ? (
            <BlockedSubscription access={access} currentUser={currentUser} />
          ) : (
            <>
              {currentUser?.role !== 'dev' ? <BillingReminder access={access} currentUser={currentUser} /> : null}
              <Outlet />
            </>
          )}
        </main>
        <Footer />
      </div>

      {showCalculator && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          animation: 'slideUp 0.3s ease-out'
        }}>
          <Calculator onClose={() => setShowCalculator(false)} />
        </div>
      )}

      {!access.blocked || currentUser?.role === 'dev' ? (
        <>
          <GuideAssistant userId={currentUser?.id} />

          <button
            className="ai-floating-btn"
            onClick={() => setShowAssistant(true)}
            title="Abrir Assistente IA"
            aria-label="Abrir Assistente IA"
          >
            <Bot size={24} />
          </button>

          {showAssistant ? (
            <div className="ai-panel-overlay" onClick={() => setShowAssistant(false)}>
              <section className="ai-floating-panel" onClick={(event) => event.stopPropagation()}>
                <button
                  className="ai-panel-close"
                  onClick={() => setShowAssistant(false)}
                  title="Fechar Assistente IA"
                  aria-label="Fechar Assistente IA"
                >
                  <X size={18} />
                </button>
                <AiAssistant compact />
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      <style>
        {`
          @keyframes slideUp {
            from { transform: translateY(100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

const BillingReminder = ({ access, currentUser }) => {
  if (!currentUser?.nextBillingDate || !access.warning) return null;

  const supportMessage = encodeURIComponent(`Ola, quero regularizar a assinatura do Orquestra Auto Detail. Empresa: ${currentUser?.companyName || 'Cliente'}. Vencimento: ${currentUser.nextBillingDate}.`);
  const supportUrl = `https://wa.me/5515998478705?text=${supportMessage}`;
  const isPastDue = access.pastDueDays > 0;
  const isDueToday = access.dueInDays === 0;
  const text = isPastDue
    ? `Sua assinatura venceu ha ${access.pastDueDays} dia(s). O acesso sera bloqueado apos 5 dias corridos do vencimento.`
    : isDueToday
      ? 'Sua assinatura vence hoje. Regularize para evitar o bloqueio automatico.'
      : `Sua assinatura vence em ${access.dueInDays} dia(s). Regularize para manter o acesso ativo.`;

  return (
    <div className="billing-reminder">
      <div>
        <strong><AlertTriangle size={17} /> Aviso de assinatura</strong>
        <p>{text}</p>
      </div>
      <a href={supportUrl} target="_blank" rel="noreferrer">Falar com suporte</a>
    </div>
  );
};

const BlockedSubscription = ({ access, currentUser }) => (
  <div className="card" style={{ maxWidth: 760, margin: '40px auto', textAlign: 'center', padding: 32 }}>
    <h1 style={{ marginTop: 0, fontSize: 30 }}>Acesso temporariamente bloqueado</h1>
    <p style={{ color: '#bbb', lineHeight: 1.7 }}>
      A empresa <strong>{currentUser?.companyName || 'cliente'}</strong> esta com status <strong>{access.status}</strong>.
      {access.reason === 'vencido_5_dias' ? ` O pagamento venceu ha ${access.pastDueDays} dias corridos.` : ''}
    </p>
    <p style={{ color: '#aaa' }}>Entre em contato com a Orquestra.cs para regularizar o plano e liberar o acesso.</p>
    <a className="action-btn" href="https://wa.me/5515998478705" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', marginTop: 16 }}>
      Falar com suporte
    </a>
  </div>
);

export default MainLayout;
