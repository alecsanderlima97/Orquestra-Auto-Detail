import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, MessageCircle, Instagram, CheckCircle, XCircle, Clock, Edit2, DollarSign, Send, Trash2, AlertCircle, ChevronLeft, ChevronRight, Maximize2, X, FileText, Printer } from 'lucide-react';
import { useData } from '../context/DataContext';
import AgendamentoFormModal from '../components/AgendamentoFormModal';
import ImpressaoOSModal from '../components/ImpressaoOSModal';

// Componente de Calendário Premium Customizado
const CalendarModal = ({ isOpen, onClose, onSelectDate, initialDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate));
  
  if (!isOpen) return null;

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const days = [];
  const totalDays = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

  // Adiciona espaços vazios para o início do mês
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Adiciona os dias do mês
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

  const changeMonth = (offset) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && 
           currentMonth.getMonth() === today.getMonth() && 
           currentMonth.getFullYear() === today.getFullYear();
  };

  const isSelected = (day) => {
    return day === initialDate.getDate() && 
           currentMonth.getMonth() === initialDate.getMonth() && 
           currentMonth.getFullYear() === initialDate.getFullYear();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
      <div style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '30px', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '20px' }}>Selecionar Data</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={() => changeMonth(-1)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
          </span>
          <button onClick={() => changeMonth(1)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}><ChevronRight size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} style={{ color: '#555', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>{d}</div>
          ))}
          {days.map((day, i) => (
            <div 
              key={i} 
              onClick={() => day && onSelectDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
              style={{
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: day ? 'pointer' : 'default',
                borderRadius: '12px',
                fontSize: '14px',
                backgroundColor: isSelected(day) ? 'var(--primary-color)' : (isToday(day) ? 'rgba(var(--primary-rgb), 0.2)' : 'transparent'),
                color: isSelected(day) ? 'white' : (day ? 'white' : 'transparent'),
                border: isToday(day) && !isSelected(day) ? '1px solid var(--primary-color)' : 'none',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => day && !isSelected(day) && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => day && !isSelected(day) && (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Agendamentos = () => {
  const { agendamentos, addAgendamento, updateAgendamento, updateAgendamentoStatus, deleteAgendamento, clientes, servicos, userProfile } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [agendamentoParaEditar, setAgendamentoParaEditar] = useState(null);
  const [agendamentoParaImprimir, setAgendamentoParaImprimir] = useState(null);
  const [filtroData, setFiltroData] = useState(new Date().toLocaleDateString('pt-BR'));
  const [dataVista, setDataVista] = useState(new Date());

  const formatarValor = (valor) => {
    return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    const savedDate = localStorage.getItem('agenda_filtro_data');
    if (savedDate) {
      setFiltroData(savedDate);
      const parts = savedDate.split('/');
      if (parts.length === 3) {
        setDataVista(new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`));
      }
      localStorage.removeItem('agenda_filtro_data');
    }
  }, []);

  const handleSalvarAgendamento = (dados) => {
    if (agendamentoParaEditar) {
      updateAgendamento(agendamentoParaEditar.id, dados);
    } else {
      addAgendamento(dados);
    }
    setIsModalOpen(false);
    setAgendamentoParaEditar(null);
  };

  const setEditando = (agendamento) => {
    setAgendamentoParaEditar(agendamento);
    setIsModalOpen(true);
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'Confirmado': return 'status concluido';
      case 'Cancelado': return 'status cancelado';
      default: return 'status agendado';
    }
  };

  const abrirWhatsAppLembrete = (agendamento) => {
    const valorSinal = (agendamento.valor * 0.3).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const pixLine = userProfile?.pix ? `\n\nChave PIX: ${userProfile.pix}` : '';
    const msg = `Ol� ${agendamento.cliente}! ??\n\nPassando para confirmar seu agendamento na nossa Est�tica Automotiva �s ${agendamento.horario} do dia ${agendamento.dataStr}.\n\nVe�culo: ${agendamento.veiculo || 'Seu Ve�culo'}\n\nPara garantir sua vaga no p�tio, solicitamos o pagamento do sinal de 30% (R$ ${valorSinal}).${pixLine}\n\nPode enviar o comprovante por aqui? Aguardamos voc�! ?`;
    window.open(`https://wa.me/${agendamento.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const navegarDias = (sentido) => {
    const novaData = new Date(dataVista);
    novaData.setDate(novaData.getDate() + (sentido === 'proximo' ? 3 : -3));
    setDataVista(novaData);
  };

  const handleSelectDate = (date) => {
    setDataVista(date);
    setFiltroData(date.toLocaleDateString('pt-BR'));
    setIsCalendarOpen(false);
  };

  const getHorarioFim = (inicio, duracao) => {
    if (!inicio) return '';
    const dur = duracao || '02:00';
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = dur.split(':').map(Number);
    let totalMin = (h1 * 60 + m1) + (h2 * 60 + m2);
    const hFinal = Math.floor(totalMin / 60);
    const mFinal = totalMin % 60;
    return `${hFinal.toString().padStart(2, '0')}:${mFinal.toString().padStart(2, '0')}`;
  };

  const isHorarioOcupado = (horaStr) => {
    const [h, m] = horaStr.split(':').map(Number);
    const timeVal = h * 60 + m;

    return agendamentos.filter(a => a.dataStr === filtroData).some(a => {
      const [hIni, mIni] = a.horario.split(':').map(Number);
      const [hDur, mDur] = (a.duracao || '02:00').split(':').map(Number);
      const start = hIni * 60 + mIni;
      const end = start + (hDur * 60 + mDur);
      return timeVal >= start && timeVal < end;
    });
  };

  // Gerador de Dias para a Régua
  const getDiasRegua = () => {
    const dias = [];
    for (let i = -7; i <= 7; i++) {
      const d = new Date(dataVista);
      d.setDate(d.getDate() + i);
      dias.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
        dia: d.getDate(),
        full: d.toLocaleDateString('pt-BR'),
        mes: d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()
      });
    }
    return dias;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Agenda & Pátio</h1>
          <p style={{ color: '#aaa', marginTop: '8px' }}>Gestão de fluxos e ocupação da estética automotiva</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
             <button className="action-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }} onClick={() => setDataVista(new Date())}>
                Hoje
             </button>
            <button className="action-btn" onClick={() => { setAgendamentoParaEditar(null); setIsModalOpen(true); }}>
                <Plus size={18} /> Novo Agendamento
            </button>
        </div>
      </div>

      {/* KPIs Rápidos do Dia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', borderLeft: '3px solid var(--primary-color)' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>OCUPAÇÃO DO PÁTIO</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: 'white' }}>
                  {agendamentos.filter(a => a.dataStr === filtroData).length} Veículos
              </div>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>PREVISÃO DE FATURAMENTO</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}>
                  {formatarValor(agendamentos.filter(a => a.dataStr === filtroData).reduce((acc, curr) => acc + (curr.valor || 0), 0))}
              </div>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>MÃO DE OBRA ATIVA</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b' }}>
                  {agendamentos.filter(a => a.dataStr === filtroData && a.status === 'Confirmado').length} Concluídos
              </div>
          </div>
      </div>

      {/* Calendário Personalizado */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarIcon size={20} color="var(--primary-color)" />
            <h3 style={{ margin: 0, color: 'var(--text-light)', fontSize: '16px' }}>
              {dataVista.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
            </h3>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{filtroData}</span>
            <button 
              onClick={() => setIsCalendarOpen(true)}
              title="Ver calendário completo"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-light)',
                padding: '8px 16px',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              <Maximize2 size={14} /> Calendário
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => navegarDias('anterior')}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '12px', borderRadius: '14px', cursor: 'pointer' }}
          >
            <ChevronLeft size={24} />
          </button>

          <div style={{ display: 'flex', gap: '12px', flex: 1, overflowX: 'auto', padding: '10px 0', scrollbarWidth: 'none' }}>
            {getDiasRegua().map((d, i) => (
              <div 
                key={i}
                onClick={() => { setFiltroData(d.full); setDataVista(new Date(d.full.split('/').reverse().join('-') + 'T12:00:00')); }}
                style={{
                  minWidth: '65px',
                  padding: '14px 10px',
                  borderRadius: '16px',
                  backgroundColor: filtroData === d.full ? 'var(--primary-color)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: filtroData === d.full ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: filtroData === d.full ? 'white' : '#777',
                }}
              >
                <div style={{ fontSize: '9px', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold' }}>{d.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800' }}>{d.dia}</div>
                <div style={{ fontSize: '8px', marginTop: '4px', fontWeight: 'bold' }}>{d.mes}</div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => navegarDias('proximo')}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '12px', borderRadius: '14px', cursor: 'pointer' }}
          >
            <ChevronRight size={24} />
          </button>
        </div>
        
        <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
          <h4 style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} /> Disponibilidade (07h - 19h)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
            {Array.from({ length: 13 }, (_, i) => {
              const hora = `${(7 + i).toString().padStart(2, '0')}:00`;
              const ocupado = isHorarioOcupado(hora);
              return (
                <div 
                  key={hora}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    textAlign: 'center',
                    background: ocupado ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    color: ocupado ? '#ef4444' : '#10b981',
                    border: '1px solid',
                    borderColor: ocupado ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    fontWeight: 'bold'
                  }}
                >
                  {hora}
                  <div style={{ fontSize: '9px', fontWeight: 'normal', opacity: 0.8 }}>
                    {ocupado ? 'Em Serviço' : 'Livre'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {agendamentos
          .filter(a => a.dataStr === filtroData)
          .sort((a,b) => a.horario.localeCompare(b.horario))
          .map((agendamento) => (
            <div key={agendamento.id} className="card h-hover" style={{ 
              display: 'flex', 
              padding: '20px', 
              gap: '20px',
              alignItems: 'center',
              borderLeft: `4px solid ${agendamento.status === 'Confirmado' ? '#10b981' : agendamento.status === 'Cancelado' ? '#ef4444' : 'var(--primary-color)'}`
            }}>
              {/* Horário */}
              <div style={{ width: '100px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '20px' }}>
                <div style={{ fontSize: '18px', fontWeight: '900', color: 'white' }}>{agendamento.horario}</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>Fim: {getHorarioFim(agendamento.horario, agendamento.duracao)}</div>
              </div>

              {/* Informações do Carro/Cliente */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--primary-color)', fontFamily: 'monospace', background: 'rgba(92,114,73,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    #{agendamento.osNumber ? agendamento.osNumber.toString().padStart(5, '0') : '---'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'white' }}>{agendamento.cliente}</h3>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px' }}>
                    <Plus size={14} /> {agendamento.veiculo || 'Veículo não informado'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px' }}>
                    <FileText size={14} /> {agendamento.servico}
                  </div>
                </div>
              </div>

              {/* Status e Lembrete */}
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                   <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                      R$ {agendamento.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                   </div>
                   <div className={getStatusClass(agendamento.status)} style={{ margin: 0 }}>{agendamento.status}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setAgendamentoParaImprimir(agendamento)} 
                    title="Imprimir OS" 
                    className="action-btn-circle" 
                    style={{ background: 'rgba(37, 211, 102, 0.1)', color: '#25D366' }}
                  >
                    <Printer size={16} />
                  </button>
                  <button 
                    onClick={() => abrirWhatsAppLembrete(agendamento)} 
                    title="Enviar Lembrete" 
                    className="action-btn-circle" 
                    style={{ background: 'rgba(37, 211, 102, 0.1)', color: '#25D366' }}
                  >
                    <Send size={16} />
                  </button>
                  <button 
                    onClick={() => setEditando(agendamento)} 
                    title="Editar" 
                    className="action-btn-circle" 
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      if(window.confirm('Deseja excluir este agendamento?')) {
                        deleteAgendamento(agendamento.id);
                      }
                    }} 
                    title="Excluir" 
                    className="action-btn-circle" 
                    style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Banner de Conflitos */}
          {(() => {
              const agendados = agendamentos.filter(a => a.dataStr === filtroData);
              let conflitos = false;
              for(let i=0; i < agendados.length; i++) {
                  for(let j=i+1; j < agendados.length; j++) {
                      const a = agendados[i]; const b = agendados[j];
                      const [h1, m1] = a.horario.split(':').map(Number);
                      const [d1H, d1M] = (a.duracao || '02:00').split(':').map(Number);
                      const start1 = h1*60 + m1; const end1 = start1 + (d1H*60 + d1M);
                      const [h2, m2] = b.horario.split(':').map(Number);
                      const [d2H, d2M] = (b.duracao || '02:00').split(':').map(Number);
                      const start2 = h2*60 + m2; const end2 = start2 + (d2H*60 + d2M);
                      if (start1 < end2 && start2 < end1) { conflitos = true; break; }
                  }
                  if (conflitos) break;
              }
              if (conflitos) return (
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <AlertCircle size={20} />
                  Atenção: Existem serviços com horários sobrepostos no pátio hoje!
                </div>
              );
          })()}

          {agendamentos.filter(a => a.dataStr === filtroData).length === 0 && (
            <div style={{ textAlign: 'center', padding: '100px 0', color: '#666' }}>
              <CalendarIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>Nenhum agendamento para este dia.</p>
            </div>
          )}
      </div>

      <AgendamentoFormModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setAgendamentoParaEditar(null); }} onSalvar={handleSalvarAgendamento} agendamentoParaEditar={agendamentoParaEditar} clientes={clientes} servicos={servicos} agendamentos={agendamentos} />
      <ImpressaoOSModal isOpen={!!agendamentoParaImprimir} onClose={() => setAgendamentoParaImprimir(null)} agendamento={agendamentoParaImprimir} cliente={clientes.find(c => c.nome === agendamentoParaImprimir?.cliente)} />
      <CalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} onSelectDate={handleSelectDate} initialDate={dataVista} />
    </div>
  );
};

export default Agendamentos;


