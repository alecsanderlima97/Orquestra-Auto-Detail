import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Clock, 
  Car, 
  Droplets, 
  Sparkles, 
  DollarSign, 
  CreditCard,
  Settings, 
  Calculator as CalcIcon,
  ShieldCheck
} from 'lucide-react';
import { useData } from '../context/DataContext';

const Sidebar = ({ isOpen, onClose, onToggleCalculator }) => {
  const { userProfile } = useData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const location = useLocation();

  const handleNavLinkClick = () => {
    if (window.innerWidth <= 768) {
      onClose();
    }
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="brand-title" style={{ fontFamily: 'sans-serif', textTransform: 'none', letterSpacing: 'normal', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: 0.8, filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.2))', justifyContent: 'center' }}>
          <span style={{ color: '#3b82f6', fontWeight: '900', fontSize: '36px', letterSpacing: '-1px' }}>O</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 'bold', fontSize: '22px', letterSpacing: '0.5px' }}>rquestra.cs</span>
        </div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '-4px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          SISTEMAS PERSONALIZADOS
        </div>
      </div>
      
      <nav className="nav-links">
        <NavLink to="/" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick} end>
          <LayoutDashboard size={20} />
          <span>Painel Principal</span>
        </NavLink>

        <NavLink to="/agenda" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick}>
          <Clock size={20} />
          <span>Agenda de Serviços</span>
        </NavLink>
        
        <NavLink to="/clientes" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick}>
          <Car size={20} />
          <span>Veículos & Clientes</span>
        </NavLink>
        
        <NavLink to="/catalogo" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick}>
          <Sparkles size={20} />
          <span>Tabela de Estética</span>
        </NavLink>

        <NavLink to="/estoque" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick}>
          <Droplets size={20} />
          <span>Insumos & Estoque</span>
        </NavLink>

        <NavLink to="/financeiro" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick}>
          <DollarSign size={20} />
          <span>Fluxo Financeiro</span>
        </NavLink>

        <NavLink to="/planos" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick}>
          <CreditCard size={20} />
          <span>Planos</span>
        </NavLink>

        {currentUser?.role === 'dev' ? (
          <NavLink to="/admin-orquestra" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")} onClick={handleNavLinkClick}>
            <ShieldCheck size={20} />
            <span>Admin Orquestra.cs</span>
          </NavLink>
        ) : null}

      </nav>
      
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button 
          onClick={() => { onToggleCalculator(); handleNavLinkClick(); }}
          className="nav-item" 
          style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', width: '100%', justifyContent: 'flex-start' }}
        >
          <CalcIcon size={20} color="var(--primary-color)" />
          <span>Calculadora</span>
        </button>


        <div style={{ textAlign: 'center', fontSize: '12px', color: '#666', padding: '10px 0' }}>
          v1.2.0
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
