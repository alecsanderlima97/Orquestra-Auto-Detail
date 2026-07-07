import React, { useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const steps = [
  {
    path: '/configuracoes',
    title: 'Configure o perfil da empresa',
    text: 'Comece preenchendo nome, telefone, endereco, PIX e dados que aparecem nas ordens de servico.'
  },
  {
    path: '/catalogo',
    title: 'Cadastre seus servicos',
    text: 'Monte a tabela de servicos com valores, categorias e descricoes para agilizar os agendamentos.'
  },
  {
    path: '/clientes',
    title: 'Adicione clientes e veiculos',
    text: 'Registre proprietarios, contatos e veiculos para manter historico e facilitar novos atendimentos.'
  },
  {
    path: '/agenda',
    title: 'Organize a agenda',
    text: 'Crie agendamentos, acompanhe status e gere ordens de servico para cada atendimento.'
  },
  {
    path: '/financeiro',
    title: 'Acompanhe o financeiro',
    text: 'Controle receitas, despesas e saldo para entender o resultado mensal da estetica automotiva.'
  },
  {
    path: '/estoque',
    title: 'Controle insumos',
    text: 'Cadastre produtos, quantidades minimas e acompanhe alertas de reposicao.'
  },
  {
    path: '/planos',
    title: 'Confira o plano ativo',
    text: 'Veja limites comerciais, creditos de IA e recursos disponiveis para a empresa.'
  }
];

const GuideAssistant = ({ userId }) => {
  const navigate = useNavigate();
  const storageKey = `auto-detail-guide-dismissed-${userId || 'user'}`;
  const [visible, setVisible] = useState(() => localStorage.getItem(storageKey) !== '1');
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const current = steps[step];

  const go = (index) => {
    setStep(index);
    navigate(steps[index].path);
  };

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  };

  return (
    <aside className="guide-assistant">
      <header className="guide-assistant-header">
        <div className="guide-assistant-title">
          <span className="guide-assistant-icon"><Bot size={22} /></span>
          <div>
            <strong>Assistente Orquestra</strong>
            <span>Passo {step + 1} de {steps.length}</span>
          </div>
        </div>
        <button onClick={dismiss} title="Ignorar ajuda" type="button" aria-label="Ignorar ajuda">
          <X size={19} />
        </button>
      </header>
      <div className="guide-assistant-body">
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <div className="guide-assistant-actions">
          <button className="guide-skip" onClick={dismiss} type="button">Ignorar ajuda</button>
          <div>
            <button className="guide-nav" disabled={step === 0} onClick={() => go(step - 1)} title="Passo anterior" type="button">
              <ChevronLeft size={17} />
            </button>
            {step < steps.length - 1 ? (
              <button className="guide-next" onClick={() => go(step + 1)} type="button">
                Proximo <ChevronRight size={16} />
              </button>
            ) : (
              <button className="guide-finish" onClick={dismiss} type="button">Concluir</button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default GuideAssistant;
