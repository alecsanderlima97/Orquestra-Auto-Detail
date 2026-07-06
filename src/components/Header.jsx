import React, { useState, useEffect } from 'react';
import { Clock, Calendar as CalendarIcon, User, Sun, Cloud, CloudRain, Snowflake, Settings, LogOut, RefreshCw, Save, Rocket } from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import { useData } from '../context/DataContext';
import { NavLink, useNavigate } from 'react-router-dom';
import MusicPlayer from './MusicPlayer';
import { logoutCommercialUser } from '../services/commercialService';

const Header = () => {
  const [dateTime, setDateTime] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const { temp, condition } = useWeather();
  const { userProfile, exportData } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    if (window.confirm('Tem certeza que deseja sair?')) {
      await logoutCommercialUser().catch(() => undefined);
      localStorage.removeItem('currentUser');
      window.location.reload();
    }
  };

  const handleSave = () => {
    exportData();
    // Você pode adicionar um toast aqui no futuro se desejar
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="main-header">
      <div className="header-info-group">
        <div className="header-item">
          <CalendarIcon size={16} color="var(--primary-color)" />
          {formatDate(dateTime)}
        </div>
        <div className="header-item">
          <Clock size={16} color="var(--primary-color)" />
          {formatTime(dateTime)}
        </div>
        <div className="header-condition">
          {condition === 'sol' && <Sun size={16} />}
          {condition === 'nublado' && <Cloud size={16} />}
          {condition === 'chuva' && <CloudRain size={16} />}
          {condition === 'neve' && <Snowflake size={16} />}
          {temp}°C
        </div>
        <div style={{ height: '32px', width: '1px', background: 'rgba(255,255,255,0.1)', marginLeft: '12px', marginRight: '4px' }}></div>
        <MusicPlayer />
      </div>

      <div className="header-brand" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        fontSize: '24px', 
        fontWeight: '900', 
        textTransform: 'uppercase', 
        letterSpacing: '2px',
        color: '#fff',
        fontFamily: "'Oswald', sans-serif",
        position: 'absolute',
        left: '60%', /* Movido mais para a direita conforme solicitado */
        transform: 'translateX(-50%)'
      }}>
        ESTÉTICA AUTOMOTIVA
      </div>

      <div className="header-user-group" onClick={() => setMenuOpen(!menuOpen)}>
        <div className="header-user-text">
          <div className="header-user-name" style={{ color: 'var(--text-light)', fontWeight: 'bold', fontSize: '14px' }}>{userProfile.nome}</div>
          <div className="header-user-role" style={{ color: 'var(--primary-color)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>{userProfile.cargo}</div>
        </div>
        <div className="header-avatar" style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '50%', 
          backgroundColor: 'var(--primary-color)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden' 
        }}>
          {userProfile.foto ? (
            <img src={userProfile.foto} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <User size={20} />
          )}
        </div>

        {menuOpen && (
          <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
            <NavLink to="/configuracoes" className="dropdown-item" onClick={() => setMenuOpen(false)}>
              <Settings size={16} /> Configurações
            </NavLink>
            <button className="dropdown-item" onClick={() => { handleSave(); setMenuOpen(false); }}>
              <Save size={16} /> Salvar e Backup
            </button>
            <button className="dropdown-item" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Atualizar Sistema
            </button>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item danger" onClick={handleLogout}>
              <LogOut size={16} /> Sair do Sistema
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
