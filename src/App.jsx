import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import Agendamentos from './pages/Agendamentos';
import Clientes from './pages/Clientes';
import Catalogo from './pages/Catalogo';
import Estoque from './pages/Estoque';
import Financeiro from './pages/Financeiro';
import Login from './pages/Login';
import BackgroundEffects from './components/BackgroundEffects';
import Settings from './pages/Settings';
import { WeatherProvider } from './context/WeatherContext';
import PlatformAdmin from './pages/PlatformAdmin';
import Plans from './pages/Plans';
import UserPermissions from './pages/UserPermissions';
import { listenAuth } from './services/commercialService';
import PublicBooking from './pages/PublicBooking';
import BookingRequests from './pages/BookingRequests';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Erro ao carregar usuário", e);
      return null;
    }
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
  };

  useEffect(() => {
    return listenAuth((userData) => {
      if (userData) {
        setUser(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
      } else {
        setUser(null);
        localStorage.removeItem('currentUser');
      }
      setAuthChecked(true);
    });
  }, []);

  // Aviso de backup ao fechar a aba
  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Lembre-se de realizar o backup dos seus dados antes de sair!';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  if (!authChecked && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#1a1f14', color: 'white' }}>
        Carregando acesso...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <WeatherProvider>
      <DataProvider currentUser={user}>
      <BackgroundEffects />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agendamentos />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="planos" element={<Plans />} />
            <Route path="usuarios" element={<UserPermissions />} />
            <Route path="configuracoes" element={<Settings />} />
            <Route path="agendamento-online" element={<BookingRequests />} />
            <Route path="admin-orquestra" element={user?.role === 'dev' ? <PlatformAdmin /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </DataProvider>
    </WeatherProvider>
  );
}

// Link público de agendamento (/agendar/:slug): abre sem login e sem o painel.
function publicBookingSlug() {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/^\/agendar\/([a-z0-9-]{3,40})\/?$/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : '';
}

function AppRoot() {
  const slug = publicBookingSlug();
  return slug ? <PublicBooking slug={slug} /> : <App />;
}

export default AppRoot;
