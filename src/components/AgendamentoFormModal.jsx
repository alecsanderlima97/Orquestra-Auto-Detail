import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Clock, User, BookOpen, QrCode, Copy, CheckCircle, Car, AlertCircle, Search, DollarSign } from 'lucide-react';
import { capitalize } from '../utils/masks';
import { useData } from '../context/DataContext';

const AgendamentoFormModal = ({ isOpen, onClose, onSalvar, clientes, servicos, agendamentos, agendamentoParaEditar }) => {
  const { userProfile } = useData();
  const [formData, setFormData] = useState({
    clienteId: '',
    veiculoId: '',
    servicoId: '',
    categoriaNome: 'Pequeno', // Pequeno (base), Médio, Grande / SUV
    data: new Date().toISOString().split('T')[0],
    horario: '09:00',
    status: 'Agendado',
    pagoSinal: false,
    buscaTerm: '',
    duracao: '02:00', // HH:mm
    observacoes: ''
  });

  const [valorSinal, setValorSinal] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (agendamentoParaEditar) {
        const cliente = clientes.find(c => c.nome === agendamentoParaEditar.cliente);
        const servico = servicos.find(s => agendamentoParaEditar.servico.includes(s.nome));
        
        let cat = 'Pequeno';
        if (agendamentoParaEditar.servico.includes('(Médio)')) cat = 'Médio';
        if (agendamentoParaEditar.servico.includes('(Grande / SUV)')) cat = 'Grande / SUV';

        const vId = agendamentoParaEditar.veiculoId || (cliente?.veiculos?.[0]?.id || '');

        setFormData({
          clienteId: cliente?.id || '',
          veiculoId: vId,
          buscaTerm: cliente?.nome || '',
          servicoId: servico?.id || '',
          categoriaNome: cat,
          data: agendamentoParaEditar.dataStr.split('/').reverse().join('-'),
          horario: agendamentoParaEditar.horario,
          duracao: agendamentoParaEditar.duracao || '02:00',
          status: agendamentoParaEditar.status,
          pagoSinal: agendamentoParaEditar.pagoSinal || false,
          valorAdicional: agendamentoParaEditar.valorAdicional || '',
          observacoes: agendamentoParaEditar.observacoes || ''
        });
      } else {
        setFormData({
          clienteId: '',
          veiculoId: '',
          servicoId: '',
          categoriaNome: 'Pequeno',
          data: new Date().toISOString().split('T')[0],
          horario: '09:00',
          duracao: '02:00',
          status: 'Agendado',
          pagoSinal: false,
          buscaTerm: '',
          valorAdicional: '',
          observacoes: ''
        });
      }
    }
  }, [isOpen, agendamentoParaEditar, clientes, servicos]);

  useEffect(() => {
    const servico = servicos.find(s => s.id.toString() === formData.servicoId.toString());
    if (servico) {
      let valor = servico.preco;
      
      if (formData.categoriaNome !== 'Pequeno') {
        const cat = servico.categorias?.find(c => c.nome === formData.categoriaNome);
        if (cat) valor = cat.valor;
      }
      
      const vTotal = valor + (parseFloat(formData.valorAdicional) || 0);
      setValorTotal(vTotal);
      setValorSinal(vTotal * 0.3);

      // Sugere duração se for novo agendamento ou se mudou o serviço
      if (!agendamentoParaEditar && servico.tempoEstimado) {
          const hours = parseInt(servico.tempoEstimado);
          if (!isNaN(hours)) {
              const durStr = `${hours.toString().padStart(2, '0')}:00`;
              setFormData(prev => ({ ...prev, duracao: durStr }));
          }
      }
    } else {
      setValorTotal(0);
      setValorSinal(0);
    }
  }, [formData.servicoId, formData.categoriaNome, formData.valorAdicional, servicos, agendamentoParaEditar]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    let { name, value, type, checked } = e.target;
    if (type === 'text') value = capitalize(value);
    const val = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: val };
      if (name === 'clienteId') {
        const cliente = clientes.find(c => c.id.toString() === value.toString());
        if (cliente) {
          newData.buscaTerm = cliente.nome;
          // Seleciona automaticamente o primeiro veículo se houver apenas um
          if (cliente.veiculos?.length > 0) {
            newData.veiculoId = cliente.veiculos[0].id.toString();
          }
        }
      }
      if (name === 'pagoSinal' && val === true) {
        newData.status = 'Confirmado';
      } else if (name === 'pagoSinal' && val === false && prev.status === 'Confirmado') {
        newData.status = 'Agendado';
      }
      return newData;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataStrFinal = new Date(formData.data + 'T12:00:00').toLocaleDateString('pt-BR');
    
    // Verificação de Conflito de Horário
    const [hIni, mIni] = formData.horario.split(':').map(Number);
    const [dHH, dMM] = formData.duracao.split(':').map(Number);
    const novoInicio = hIni * 60 + mIni;
    const novoFim = novoInicio + (dHH * 60 + dMM);

    const conflito = agendamentos.some(a => {
      // Ignora o próprio agendamento se for edição e ignora cancelados
      if (agendamentoParaEditar && a.id === agendamentoParaEditar.id) return false;
      if (a.status === 'Cancelado') return false;
      if (a.dataStr !== dataStrFinal) return false;

      const [ah, am] = a.horario.split(':').map(Number);
      const [adh, adm] = (a.duracao || '02:00').split(':').map(Number);
      const aInicio = ah * 60 + am;
      const aFim = aInicio + (adh * 60 + adm);

      return novoInicio < aFim && aInicio < novoFim;
    });

    if (conflito) {
      alert('⚠️ CONFLITO DE HORÁRIO: Já existe um serviço agendado neste período para esta data. Por favor, escolha outro horário ou dia.');
      return;
    }

    const cliente = clientes.find(c => c.id.toString() === formData.clienteId.toString());
    const servico = servicos.find(s => s.id.toString() === formData.servicoId.toString());
    const veiculo = cliente?.veiculos?.find(v => v.id.toString() === formData.veiculoId.toString());
    
    let nomeServicoFinal = servico?.nome || '';
    if (formData.categoriaNome !== 'Pequeno') {
      nomeServicoFinal += ` (${formData.categoriaNome})`;
    }

    onSalvar({
      ...formData,
      cliente: cliente?.nome || '',
      telefone: cliente?.telefone?.replace(/\D/g, '') || '',
      veiculo: veiculo ? `${veiculo.modelo} (${veiculo.placa})` : 'Veículo não selecionado',
      servico: nomeServicoFinal,
      valor: valorTotal,
      dataStr: dataStrFinal
    });
  };

  const selectedServico = servicos.find(s => s.id.toString() === formData.servicoId.toString());
  const selectedCliente = clientes.find(c => c.id.toString() === formData.clienteId.toString());
  const currentVeiculo = selectedCliente?.veiculos?.find(v => v.id.toString() === formData.veiculoId.toString()) || selectedCliente?.veiculos?.[0];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '650px', padding: '32px', maxHeight: '95vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ color: 'var(--text-light)', margin: 0, fontFamily: 'Oswald', letterSpacing: '1px' }}>
              {agendamentoParaEditar ? 'EDITAR AGENDAMENTO' : 'NOVA ORDEM DE SERVIÇO'}
            </h2>
            <p style={{ color: '#666', fontSize: '12px', margin: '4px 0 0 0' }}>Estética Automotiva & Detailing</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>Buscar Cliente</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
                  <Search size={18} color="#888" style={{ marginRight: '10px' }} />
                  <select name="clienteId" value={formData.clienteId} onChange={handleChange} required
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-light)', width: '100%', outline: 'none', cursor: 'pointer' }}>
                    <option value="" style={{ background: '#111' }}>Selecione o proprietário...</option>
                    {clientes.map(c => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {selectedCliente && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'block', color: 'var(--primary-color)', fontSize: '11px', fontWeight: 'bold' }}>SELECIONE O VEÍCULO</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                  {selectedCliente.veiculos?.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, veiculoId: v.id.toString() }))}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: formData.veiculoId?.toString() === v.id.toString() ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                        background: formData.veiculoId?.toString() === v.id.toString() ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(0,0,0,0.2)',
                        color: formData.veiculoId?.toString() === v.id.toString() ? 'var(--primary-color)' : '#888',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Car size={16} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.modelo}</div>
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>{v.placa} • {v.cor}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>Procedimento *</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
                <BookOpen size={18} color="#888" style={{ marginRight: '10px' }} />
                <select name="servicoId" value={formData.servicoId} onChange={handleChange} required
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-light)', width: '100%', outline: 'none', cursor: 'pointer' }}>
                  <option value="" style={{ background: '#111' }}>O que será feito?</option>
                  {[...new Set(servicos.map(s => s.categoria || 'LAVAGEM'))].map(cat => (
                    <optgroup key={cat} label={cat} style={{ background: '#222', color: 'var(--primary-color)' }}>
                      {servicos.filter(s => (s.categoria || 'LAVAGEM') === cat).map(s => (
                        <option key={s.id} value={s.id} style={{ background: '#111', color: 'white' }}>{s.nome}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>Data da Entrada *</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
                <Calendar size={18} color="#888" style={{ marginRight: '10px' }} />
                <input type="date" name="data" value={formData.data} onChange={handleChange} required
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-light)', width: '100%', outline: 'none' }} />
              </div>
            </div>
          </div>

          {selectedServico && (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ display: 'block', marginBottom: '12px', color: 'var(--primary-color)', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Porte do Veículo / Categoria de Preço</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { id: 'Pequeno', valor: selectedServico.preco },
                  ...(selectedServico.categorias || [])
                ].map((cat) => (
                  <button 
                    key={cat.nome || cat.id}
                    type="button"
                    onClick={() => handleChange({ target: { name: 'categoriaNome', value: cat.nome || cat.id } })}
                    style={{ 
                      flex: 1, padding: '12px 8px', borderRadius: '8px', cursor: 'pointer', border: '1px solid',
                      backgroundColor: formData.categoriaNome === (cat.nome || cat.id) ? 'var(--primary-color)' : 'rgba(0,0,0,0.3)',
                      color: formData.categoriaNome === (cat.nome || cat.id) ? 'white' : '#666',
                      borderColor: formData.categoriaNome === (cat.nome || cat.id) ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)',
                      fontSize: '12px', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '4px'
                    }}
                  >
                    <span style={{ fontWeight: 'bold' }}>{cat.nome || cat.id}</span>
                    <span style={{ opacity: 0.8 }}>R$ {cat.valor.toLocaleString('pt-BR')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>Horário de Entrada *</label>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', 
                padding: '10px' 
              }}>
                <Clock size={18} color="#888" style={{ marginRight: '10px' }} />
                <input type="time" name="horario" value={formData.horario} onChange={handleChange} required
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-light)', width: '100%', outline: 'none' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>Duração Prevista *</label>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', 
                padding: '10px' 
              }}>
                <Clock size={18} color="var(--primary-color)" style={{ marginRight: '10px' }} />
                <input type="time" name="duracao" value={formData.duracao} onChange={handleChange} required
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-light)', width: '100%', outline: 'none' }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>Valor Adicional / Flexível</label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
                <DollarSign size={18} color="#888" style={{ marginRight: '10px' }} />
                <input type="number" name="valorAdicional" value={formData.valorAdicional} onChange={handleChange} placeholder="0.00"
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-light)', width: '100%', outline: 'none' }} />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px' }}>Observações da Ordem de Serviço</label>
            <textarea 
              name="observacoes" 
              value={formData.observacoes} 
              onChange={handleChange} 
              placeholder="Ex: Cliente relatou barulho na suspensão, entregar até as 18h..."
              style={{ 
                width: '100%', 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '8px', 
                padding: '12px', 
                color: 'var(--text-light)', 
                outline: 'none',
                minHeight: '80px',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ textAlign: 'right', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
             <div style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>INVESTIMENTO TOTAL</div>
             <div style={{ color: 'var(--primary-color)', fontSize: '28px', fontWeight: 'bold', fontFamily: 'Oswald' }}>
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
             </div>
          </div>

          {valorSinal > 0 && (
            <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '15px' }}>Sinal de Agendamento (30%)</h4>
                  <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '12px' }}>Garante a vaga no pátio e reserva de produtos.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>R$ {valorSinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
                   <QrCode size={90} color="black" />
                </div>
                <div style={{ flex: 1 }}>
                  <button type="button" onClick={() => navigator.clipboard.writeText(userProfile?.pix || '')} disabled={!userProfile?.pix} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', width: '100%', padding: '12px', borderRadius: '10px', cursor: userProfile?.pix ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
                    <Copy size={16} /> {userProfile?.pix ? 'Copiar Chave PIX' : 'Configure a chave PIX no perfil'}
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', cursor: 'pointer', color: formData.pagoSinal ? 'var(--primary-color)' : '#aaa' }}>
                    <input type="checkbox" name="pagoSinal" checked={formData.pagoSinal} onChange={handleChange} style={{ width: '20px', height: '20px', accentColor: 'var(--primary-color)' }} />
                    <span style={{ fontSize: '14px', fontWeight: formData.pagoSinal ? 'bold' : 'normal' }}>
                      {formData.pagoSinal ? 'SINAL RECEBIDO ✓' : 'Sinal já foi pago?'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px',
            position: 'sticky',
            bottom: '-32px', // Ajustado para o padding do modal
            backgroundColor: 'rgba(34, 43, 25, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '20px 0 0 0',
            marginTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            zIndex: 10
          }}>
            <button type="button" onClick={onClose} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', cursor: 'pointer', fontWeight: '600' }}>
              FECHAR
            </button>
            <button type="submit" className="action-btn" style={{ padding: '12px 30px' }}>
              <Save size={18} /> {agendamentoParaEditar ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR ORDEM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgendamentoFormModal;


