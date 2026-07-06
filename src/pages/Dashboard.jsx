import React from 'react';
import { useData } from '../context/DataContext';
import { 
  Package, 
  DollarSign, 
  TriangleAlert, 
  Plus, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Users,
  Eye,
  EyeOff,
  Printer,
  Gift,
  Calendar,
  MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CalendarComponent from '../components/Calendar';
import AutomationReminders from '../components/AutomationReminders';

const Dashboard = () => {
  const { agendamentos, estoque, financeiro, clientes, privacidade, setPrivacidade } = useData();
  const navigate = useNavigate();
  const hoje = new Date().toLocaleDateString('pt-BR');
  const dHoje = new Date();
  const diaMesHoje = `${String(dHoje.getDate()).padStart(2, '0')}/${String(dHoje.getMonth() + 1).padStart(2, '0')}`;

  // Cálculos de Dados
  const atendimentosHoje = agendamentos.filter(a => a.dataStr === hoje);
  const itensBaixoEstoque = estoque.filter(item => item.quantidade <= item.minimo);
  
  const aniversariantesHoje = clientes.filter(c => {
    if (!c.dataAniversario) return false;
    // dataAniversario: YYYY-MM-DD
    const [y, m, d] = c.dataAniversario.split('-');
    return `${d}/${m}` === diaMesHoje;
  });
  
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const totalReceitasManuais = financeiro
    .filter(f => {
      const d = new Date(f.data + 'T12:00:00');
      return f.tipo === 'receita' && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce((acc, curr) => acc + curr.valor, 0);
  
  const totalEntradas = totalReceitasManuais + agendamentos
    .filter(a => {
      if (a.status === 'Cancelado' || !a.dataStr) return false;
      let m, y;
      if (a.dataStr.includes('/')) {
        const match = a.dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          m = parseInt(match[2]) - 1;
          y = parseInt(match[3]);
        } else {
          return false;
        }
      } else {
        const d = new Date((a.data || a.dataStr.split('/').reverse().join('-')) + 'T12:00:00');
        m = d.getMonth();
        y = d.getFullYear();
      }
      return m === mesAtual && y === anoAtual;
    })
    .reduce((acc, curr) => acc + (curr.valor || 0), 0);
  
  const totalSaidas = financeiro
    .filter(f => {
      const d = new Date(f.data + 'T12:00:00');
      return f.tipo === 'despesa' && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    })
    .reduce((acc, curr) => acc + curr.valor, 0);

  const saldo = totalEntradas - totalSaidas;
  const mesNome = agora.toLocaleString('pt-BR', { month: 'long' });
  const mesNomeCapitalizado = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);

  const formatarValor = (valor) => {
    if (privacidade) return 'R$ ••••••';
    return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bem-vindo(a) ao seu Painel!</h1>
          <p style={{ color: '#aaa', marginTop: '4px' }}>Aqui está o resumo da sua Estética Automotiva para hoje, {hoje}.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="action-btn" 
            style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} 
            onClick={() => setPrivacidade(!privacidade)}
            title={privacidade ? "Mostrar Valores" : "Esconder Valores"}
          >
            {privacidade ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          
          <button className="action-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }} onClick={() => navigate('/clientes')}>
            <Users size={18} /> Clientes
          </button>
          <button className="action-btn" onClick={() => navigate('/agenda')}>
            <Plus size={18} /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* Cards de Resumo Financeiro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Receita Mensal</p>
              <h3 style={{ fontSize: '24px', margin: '8px 0', color: 'white' }}>{formatarValor(totalEntradas)}</h3>
            </div>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(163, 184, 142, 0.1)', color: 'var(--primary-color)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Total acumulado em {mesNomeCapitalizado}</p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Despesas</p>
              <h3 style={{ fontSize: '24px', margin: '8px 0', color: 'white' }}>{formatarValor(totalSaidas)}</h3>
            </div>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}>
              <TrendingDown size={20} />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Custos fixos e variáveis</p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #0ea5e9', background: 'linear-gradient(145deg, rgba(25,29,20,0.4) 0%, rgba(14,165,233,0.05) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Saldo em Caixa</p>
              <h3 style={{ fontSize: '24px', margin: '8px 0', color: '#0ea5e9' }}>{formatarValor(saldo)}</h3>
            </div>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Disponível para reinvestimento</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Automação de Lembretes */}
          <AutomationReminders />

          {/* Agenda do Dia */}
          <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={20} color="var(--primary-color)" />
              <h2 style={{ margin: 0, fontSize: '18px' }}>Agenda de Hoje</h2>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>{atendimentosHoje.length} atendimentos</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {atendimentosHoje.length > 0 ? atendimentosHoje.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: '85px', flexShrink: 0 }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '14px' }}>{a.horario}</div>
                  <div style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>OS #{a.osNumber?.toString().padStart(5, '0') || '---'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', color: 'var(--text-light)' }}>{a.cliente}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{a.servico}</div>
                </div>
                <div style={{ textAlign: 'right', marginRight: '16px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-light)', fontSize: '14px' }}>R$ {a.valor?.toLocaleString('pt-BR')}</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>Valor Total</div>
                </div>
                <div className={`status ${a.status === 'Confirmado' ? 'concluido' : 'agendado'}`} style={{ fontSize: '11px' }}>
                  {a.status}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                Nenhum atendimento agendado para hoje.
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Calendário e Alertas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ zIndex: 10, position: 'relative', border: '1px solid var(--primary-color)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--primary-color)' }}>Calendário de Atendimentos</h2>
            <CalendarComponent />
          </div>

            <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(145deg, rgba(219, 39, 119, 0.1) 0%, rgba(219, 39, 119, 0.05) 100%)', border: '1px solid rgba(219, 39, 119, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Gift size={20} color="#db2777" />
                <h2 style={{ margin: 0, fontSize: '18px', color: '#db2777' }}>Aniversariantes do Dia 🎂</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {aniversariantesHoje.length > 0 ? aniversariantesHoje.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(219, 39, 119, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontWeight: 'bold', fontSize: '12px' }}>
                      {c.nome?.[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: 'white', fontWeight: '500' }}>{c.nome}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{c.veiculos?.[0]?.modelo || c.veiculo?.modelo || "Cliente Premium"}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => {
                          const tel = c.telefone?.replace(/\D/g, '');
                          const msg = `Parabéns, *${c.nome}*! 🎂🎉\n*FELIZ ANIVERSÁRIO!* 🥳🎊\n\nMuita saúde, paz, harmonia, sucesso e incontáveis realizações!!! Esperamos que no próximo ano, possamos mais uma vez celebrar muitas conquistas.\n\n— *Orquestra Auto Detail* 🚗✨`;
                          window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        style={{ background: 'none', border: 'none', color: '#25D366', cursor: 'pointer' }}
                        title="Enviar Parabéns"
                      >
                        <MessageCircle size={18} />
                      </button>
                      <button onClick={() => navigate('/clientes')} style={{ background: 'none', border: 'none', color: '#db2777', cursor: 'pointer', fontSize: '12px' }}>VER</button>
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '13px' }}>
                    Nenhum aniversariante hoje.
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Package size={20} color="#f59e0b" />
              <h2 style={{ margin: 0, fontSize: '18px' }}>Alertas de Estoque</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {itensBaixoEstoque.length > 0 ? itensBaixoEstoque.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                  <TriangleAlert size={18} color="#f59e0b" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: 'white', fontWeight: '500' }}>{item.nome}</div>
                    <div style={{ fontSize: '12px', color: '#f59e0b' }}>Restam apenas {item.quantidade} {item.unidade}</div>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#4ade80', fontSize: '14px' }}>
                  ✅ Tudo em dia com o estoque!
                </div>
              )}
            </div>
            
            <button 
              onClick={() => navigate('/estoque')}
              style={{ width: '100%', marginTop: '20px', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}>
              Ver Inventário Completo
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;



