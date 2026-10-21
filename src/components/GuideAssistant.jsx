import React, { useState } from 'react';
import { Bot, CheckCircle2, ChevronLeft, ChevronRight, Circle, Minus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const steps = [
  {
    path: '/configuracoes',
    title: 'Configure o perfil da empresa',
    text: 'Preencha nome comercial, telefone, endereco, PIX e dados que aparecem nas ordens de servico.',
    action: 'Abrir configuracoes'
  },
  {
    path: '/catalogo',
    title: 'Cadastre seus servicos',
    text: 'Monte a tabela de servicos com valores, categorias e descricoes para agilizar orcamentos e agenda.',
    action: 'Ir para servicos'
  },
  {
    path: '/clientes',
    title: 'Adicione clientes e veiculos',
    text: 'Registre proprietarios, contatos e veiculos para manter historico e facilitar novos atendimentos.',
    action: 'Cadastrar cliente'
  },
  {
    path: '/agenda',
    title: 'Organize a agenda',
    text: 'Crie o primeiro agendamento, acompanhe status e gere ordens de servico para cada atendimento.',
    action: 'Abrir agenda'
  },
  {
    path: '/financeiro',
    title: 'Acompanhe o financeiro',
    text: 'Controle receitas, despesas e saldo para entender o resultado mensal da estetica automotiva.',
    action: 'Ver financeiro'
  },
  {
    path: '/estoque',
    title: 'Controle insumos',
    text: 'Cadastre produtos, quantidades minimas e acompanhe alertas de reposicao.',
    action: 'Ver estoque'
  },
  {
    path: '/usuarios',
    title: 'Convide colaboradores',
    text: 'Gere convites internos para Proprietario, Financeiro ou Consulta conforme a funcao de cada pessoa.',
    action: 'Gerar convite'
  },
  {
    path: '/planos',
    title: 'Confira o plano ativo',
    text: 'Veja consumo do Plano Medio, creditos de IA e limites comerciais antes de precisar ampliar.',
    action: 'Ver plano'
  }
];

const GuideAssistant = ({ userId }) => {
  const navigate = useNavigate();
  const storageKey = `auto-detail-guide-dismissed-${userId || 'user'}`;
  const completedKey = `auto-detail-guide-completed-${userId || 'user'}`;
  const [visible, setVisible] = useState(() => localStorage.getItem(storageKey) !== '1');
  const [minimized, setMinimized] = useState(false);
  const [completed, setCompleted] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(completedKey) || '[]');
    } catch {
      return [];
    }
  });
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const current = steps[step];
  const progress = Math.round((completed.length / steps.length) * 100);

  const saveCompleted = (next) => {
    setCompleted(next);
    localStorage.setItem(completedKey, JSON.stringify(next));
  };

  const go = (index) => {
    setStep(index);
    navigate(steps[index].path);
  };

  const completeCurrent = () => {
    const next = completed.includes(step) ? completed : [...completed, step];
    saveCompleted(next);
    navigate(current.path);
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  };

  if (minimized) {
    return (
      <button className="guide-assistant-mini" onClick={() => setMinimized(false)} type="button">
        <Bot size={19} />
        Implantacao {progress}%
      </button>
    );
  }

  return (
    <aside className="guide-assistant">
      <header className="guide-assistant-header">
        <div className="guide-assistant-title">
          <span className="guide-assistant-icon"><Bot size={22} /></span>
          <div>
            <strong>Assistente Orquestra</strong>
            <span>Implantacao guiada · {progress}%</span>
          </div>
        </div>
        <div className="guide-assistant-window-actions">
          <button onClick={() => setMinimized(true)} title="Minimizar" type="button" aria-label="Minimizar">
            <Minus size={17} />
          </button>
          <button onClick={dismiss} title="Ignorar ajuda" type="button" aria-label="Ignorar ajuda">
            <X size={19} />
          </button>
        </div>
      </header>
      <div className="guide-assistant-body">
        <div className="guide-progress">
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className="guide-checklist">
          {steps.map((item, index) => (
            <button key={item.title} className={index === step ? 'active' : ''} onClick={() => go(index)} type="button">
              {completed.includes(index) ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <div className="guide-assistant-actions">
          <button className="guide-skip" onClick={dismiss} type="button">Ignorar ajuda</button>
          <div>
            <button className="guide-nav" disabled={step === 0} onClick={() => go(step - 1)} title="Passo anterior" type="button">
              <ChevronLeft size={17} />
            </button>
            {step < steps.length - 1 ? (
              <button className="guide-next" onClick={completeCurrent} type="button">
                {current.action} <ChevronRight size={16} />
              </button>
            ) : (
              <button className="guide-finish" onClick={() => { completeCurrent(); dismiss(); }} type="button">Concluir</button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default GuideAssistant;

