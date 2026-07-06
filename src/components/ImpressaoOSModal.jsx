import React, { useRef } from 'react';
import { X, Printer, Phone, ArrowLeft, Download, FileCheck } from 'lucide-react';
import { useData } from '../context/DataContext';

const ImpressaoOSModal = ({ isOpen, onClose, agendamento, cliente }) => {
  const { userProfile } = useData();

  if (!isOpen || !agendamento) return null;

  const downloadPDF = async () => {
    const element = document.getElementById('printable-os-preview');
    if (!element || !window.html2canvas || !window.jspdf) {
      alert("Erro ao carregar motor de PDF. Por favor, aguarde 2 segundos.");
      return;
    }

    try {
      const originalStyle = element.style.cssText;
      element.style.height = 'auto';
      element.style.overflow = 'visible';
      element.style.width = '800px';

      const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800
      });

      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`OS-${agendamento.id.toString().padStart(4, '0')}-${(cliente?.nome || agendamento.cliente).split(' ')[0]}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro na geração. Tente novamente.");
    }
  };

  const valorTotal = agendamento.valor || 0;
  const valorSinal = valorTotal * 0.3;
  const valorRestante = valorTotal - (agendamento.pagoSinal ? valorSinal : 0);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#0a0a0a',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      padding: '20px'
    }}>
      {/* Cabeçalho do Modal - Escondido na impressão */}
      <div className="no-print" style={{ width: '100%', maxWidth: '850px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
            color: 'white', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', 
            display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' 
          }}
        >
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
          <FileCheck size={24} color="var(--primary-color)" />
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Ordem de Serviço</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
          <X size={28} />
        </button>
      </div>

      <div id="printable-os-preview" style={{
        backgroundColor: 'white',
        width: '100%',
        maxWidth: '850px',
        height: '75vh',
        overflowY: 'auto',
        borderRadius: '8px',
        padding: '50px',
        color: '#000',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Cabeçalho Original Restaurado */}
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
             {userProfile.foto ? (
               <img src={userProfile.foto} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #000' }} />
             ) : (
               <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '30px', fontWeight: '900' }}>
                 A
               </div>
             )}
             <div>
               <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', fontFamily: 'Oswald', color: '#000', textTransform: 'uppercase' }}>{userProfile.nome || 'EST�TICA AUTOMOTIVA'}</h1>
               <div style={{ fontSize: '10px', color: '#000', marginTop: '6px' }}>
                 <p style={{ margin: '0 0 2px 0' }}>{userProfile.endereco} | <strong>{userProfile.telefone}</strong></p>
                 <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', background: 'rgba(0,0,0,0.05)', padding: '2px 5px', display: 'inline-block' }}>CNPJ: {userProfile.cnpj}</p>
               </div>
             </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: '900', border: '3px solid #000', padding: '8px 18px', borderRadius: '4px', display: 'inline-block' }}>
               OS #{agendamento.osNumber ? agendamento.osNumber.toString().padStart(5, '0') : agendamento.id.toString().slice(-5)}
            </div>
            <p style={{ margin: '5px 0 0 0', fontSize: '10px', color: '#000' }}>
              Emissão: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Informações em Quadros Restauradas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '15px', border: '1px solid #000', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', marginBottom: '5px', textTransform: 'uppercase' }}>Proprietário</div>
            <div style={{ fontSize: '16px', fontWeight: '800' }}>{cliente?.nome || agendamento.cliente}</div>
            <div style={{ fontSize: '12px' }}>TEL: {cliente?.telefone || agendamento.telefone}</div>
          </div>

          <div style={{ padding: '15px', border: '1px solid #000', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', marginBottom: '5px', textTransform: 'uppercase' }}>Veículo</div>
            <div style={{ fontSize: '16px', fontWeight: '800' }}>({agendamento.placa || '---'}) {agendamento.veiculo || 'Não informado'}</div>
            <div style={{ fontSize: '12px' }}>Procedimento: <strong>{agendamento.servico}</strong></div>
          </div>
        </div>

        {/* Tabela de Serviços Restaurada */}
        <div style={{ marginBottom: '30px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '10px 5px', fontSize: '11px' }}>SERVIÇO REALIZADO</th>
                <th style={{ textAlign: 'center', padding: '10px 5px', fontSize: '11px' }}>DATA/HORA</th>
                <th style={{ textAlign: 'right', padding: '10px 5px', fontSize: '11px' }}>VALOR</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '15px 5px', borderBottom: '1px solid #ddd' }}>
                  <div style={{ fontWeight: '800', fontSize: '14px' }}>{agendamento.servico}</div>
                </td>
                <td style={{ padding: '15px 5px', borderBottom: '1px solid #ddd', textAlign: 'center', fontSize: '12px' }}>
                  {agendamento.dataStr} às {agendamento.horario}
                </td>
                <td style={{ padding: '15px 5px', borderBottom: '1px solid #ddd', textAlign: 'right', fontWeight: '800' }}>
                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Checklist Restaurado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '15px', border: '1px solid #000', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Checklist de Entrada</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
               {[
                 'Tapetes', 'Painel OK', 'Porta-Objetos', 'Estepe/Ferram.', 
                 'Antena', 'Nível Comb.', 'Quilometr.', 'Chave Res.'
               ].map(item => (
                 <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                   <div style={{ width: '10px', height: '10px', border: '1px solid #000' }}></div>
                   {item}
                 </div>
               ))}
            </div>
          </div>

          <div style={{ padding: '15px', border: '1px solid #000', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Avarias Identificadas</h3>
            <div style={{ fontSize: '11px', minHeight: '60px', lineHeight: '1.4' }}>
               {agendamento.avarias || "Nenhuma avaria declarada no ato do recebimento."}
            </div>
          </div>
        </div>

        {/* Termos e Financeiro Restaurados */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', marginBottom: '40px' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>Termos de Serviço</h3>
            <div style={{ fontSize: '9px', lineHeight: '1.4', color: '#333' }}>
              1. Não nos responsabilizamos por objetos de valor não declarados. 2. Garantia de 24h para lavagens. 3. Taxa de pátio após 48h de aviso (R$ 50/dia). 4. Autorizado uso de fotos do serviço para portfólio.
            </div>
          </div>
          
          <div style={{ width: '240px' }}>
            <div style={{ border: '2px solid #000', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '11px' }}>
                <span>Subtotal:</span>
                <span>R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                <span>Sinal Pago:</span>
                <span>- R$ {(agendamento.pagoSinal ? valorSinal : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '900' }}>TOTAL À PAGAR:</span>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#000' }}>
                  R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Assinaturas Restauradas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px', fontSize: '10px', fontWeight: 'bold' }}>RESPONSÁVEL TÉCNICO</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '8px', fontSize: '10px', fontWeight: 'bold' }}>ASSINATURA DO CLIENTE</div>
          </div>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '9px', color: '#666' }}>
          Documento gerado pelo Sistema de Estética Automotiva em {new Date().toLocaleString('pt-BR')}
        </div>
      </div>

      {/* Barra de Ações na Parte Inferior - Escondida na impressão */}
      <div className="no-print" style={{ 
        width: '100%', maxWidth: '850px', marginTop: '25px', 
        display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr 1.5fr', gap: '15px' 
      }}>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', 
            padding: '15px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
          }}
        >
          <ArrowLeft size={20} /> Voltar
        </button>

        <button 
          onClick={downloadPDF}
          style={{ 
            background: 'white', color: '#000', border: 'none', 
            padding: '15px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
          }}
        >
          <Download size={20} /> Baixar PDF
        </button>

        <button 
          onClick={() => window.print()}
          style={{ 
            background: '#1a1a1a', color: 'white', border: '1px solid rgba(255,255,255,0.1)', 
            padding: '15px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
          }}
        >
          <Printer size={20} /> Imprimir
        </button>

        <button 
          onClick={() => {
            const msg = `*EST�TICA AUTOMOTIVA*%0A%0A*ORDEM DE SERVIÇO #${agendamento.osNumber ? agendamento.osNumber.toString().padStart(5, '0') : agendamento.id.toString().slice(-5)}*%0A------------------------------%0A*Cliente:* ${cliente?.nome || agendamento.cliente}%0A*Veículo:* ${agendamento.veiculo || '---'}%0A*Serviço:* ${agendamento.servico}%0A*Entrada:* ${agendamento.dataStr} às ${agendamento.horario}%0A------------------------------%0A*SALDO À PAGAR:* R$ ${valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%0A%0A*🔑 Chave PIX (CPF):* %0A%0A_Aguardamos você! Contato: ${userProfile.telefone}_`;
            const phone = (cliente?.telefone || agendamento.telefone || '').replace(/\D/g, '');
            window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg.replace(/%0A/g, '\n'))}`, '_blank');
          }}
          style={{ 
            background: '#25D366', color: 'white', border: 'none', 
            padding: '15px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
          }}
        >
          <Phone size={20} /> Enviar WhatsApp
        </button>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-os-preview, #printable-os-preview * { visibility: visible; }
          #printable-os-preview { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            max-width: none !important;
            height: auto !important; 
            margin: 0 !important; 
            padding: 30px !important; 
            box-shadow: none !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ImpressaoOSModal;



