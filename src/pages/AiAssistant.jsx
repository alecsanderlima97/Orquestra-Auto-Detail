import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CalendarClock, Loader2, Megaphone, PackageSearch, Send, Sparkles, TrendingUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import { auth } from '../firebase/firebaseConfig';
import { PLANS, getTenantAiUsage, registerTenantAiUsage } from '../services/commercialService';

const prompts = [
  { id: 'financeiro', icon: TrendingUp, title: 'Resumo financeiro', text: 'Analise entradas, saidas e saldo do mes e sugira melhorias.' },
  { id: 'agenda', icon: CalendarClock, title: 'Agenda inteligente', text: 'Identifique horarios livres e oportunidades para encaixes.' },
  { id: 'campanhas', icon: Megaphone, title: 'Campanhas', text: 'Crie uma campanha de WhatsApp para clientes inativos.' },
  { id: 'estoque', icon: PackageSearch, title: 'Estoque', text: 'Liste itens em baixa e sugira reposicao prioritaria.' },
  { id: 'servicos', icon: Sparkles, title: 'Servicos', text: 'Sugira combos e upgrades para aumentar o ticket medio.' }
];

const initialMessage = {
  role: 'assistant',
  text: 'Ola! Sou o assistente IA do Orquestra Auto Detail. Posso ajudar com agenda, clientes, veiculos, financeiro, estoque, campanhas e servicos.'
};

const AiAssistant = ({ compact = false }) => {
  const { agendamentos, clientes, estoque, financeiro, servicos } = useData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const isPlatformAdmin = currentUser?.role === 'dev';
  const plan = PLANS[currentUser?.planId] || PLANS.medium;
  const aiCredits = isPlatformAdmin ? null : plan.limits.aiCredits || 0;
  const [usage, setUsage] = useState({ limit: aiCredits || 0, remaining: aiCredits || 0, used: 0 });
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([initialMessage]);
  const [loading, setLoading] = useState(false);

  const snapshot = useMemo(() => {
    const lowStock = estoque.filter((item) => Number(item.quantidade) <= Number(item.minimo));
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const monthRevenue = financeiro
      .filter((item) => item.tipo === 'receita' && new Date(`${item.data}T12:00:00`).getMonth() === month && new Date(`${item.data}T12:00:00`).getFullYear() === year)
      .reduce((total, item) => total + Number(item.valor || 0), 0);
    const monthExpenses = financeiro
      .filter((item) => item.tipo === 'despesa' && new Date(`${item.data}T12:00:00`).getMonth() === month && new Date(`${item.data}T12:00:00`).getFullYear() === year)
      .reduce((total, item) => total + Number(item.valor || 0), 0);

    return {
      agendamentos: agendamentos.length,
      clientes: clientes.length,
      despesasMes: monthExpenses,
      estoqueBaixo: lowStock.length,
      receitasMes: monthRevenue,
      servicos: servicos.length
    };
  }, [agendamentos, clientes, estoque, financeiro, servicos]);

  useEffect(() => {
    let alive = true;

    if (isPlatformAdmin) {
      setUsage({ limit: null, remaining: null, used: 0 });
      return () => {
        alive = false;
      };
    }

    getTenantAiUsage(currentUser?.tenantId, currentUser?.planId)
      .then((data) => {
        if (alive) setUsage(data);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [currentUser?.tenantId, currentUser?.planId, isPlatformAdmin]);

  const creditsBlocked = !isPlatformAdmin && (aiCredits <= 0 || usage.remaining <= 0);
  const creditText = isPlatformAdmin
    ? 'Admin Orquestra.cs: uso liberado'
    : `Creditos IA: ${usage.used}/${usage.limit} usados - ${usage.remaining} restantes`;

  const askAssistant = async (text) => {
    const prompt = text.trim();
    if (!prompt || loading || creditsBlocked) return;

    setQuestion('');
    setLoading(true);
    setMessages((items) => [...items, { role: 'user', text: prompt }]);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Entre novamente para usar o assistente.');
      }

      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planLabel: isPlatformAdmin ? 'Admin Orquestra.cs' : plan.label,
          question: prompt,
          snapshot
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Nao foi possivel gerar a analise.');
      }

      if (!isPlatformAdmin) {
        const updatedUsage = await registerTenantAiUsage(currentUser?.tenantId, currentUser?.planId);
        setUsage(updatedUsage);
      }

      setMessages((items) => [...items, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      setMessages((items) => [
        ...items,
        { role: 'assistant', text: err.message || 'Nao foi possivel consultar a IA agora.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    askAssistant(question);
  };

  return (
    <div className={compact ? 'ai-chat-shell compact' : 'ai-chat-shell'}>
      <header className="ai-chat-header">
        <div className="ai-chat-title">
          <span className="ai-chat-icon"><Bot size={22} /></span>
          <div>
            <strong>Assistente IA</strong>
            <span>Orquestra Auto Detail</span>
          </div>
        </div>
        <div className="ai-chat-credit">{creditText}</div>
      </header>

      <section className="ai-chat-metrics">
        <div><strong>{snapshot.clientes}</strong><span>Clientes</span></div>
        <div><strong>{snapshot.agendamentos}</strong><span>Agenda</span></div>
        <div><strong>{snapshot.estoqueBaixo}</strong><span>Estoque baixo</span></div>
        <div><strong>{isPlatformAdmin ? 'Admin' : usage.remaining}</strong><span>Creditos</span></div>
      </section>

      {!isPlatformAdmin && aiCredits <= 0 ? (
        <div className="ai-chat-warning">Seu plano atual nao inclui creditos de IA. Faca upgrade para liberar o assistente.</div>
      ) : null}

      {!isPlatformAdmin && aiCredits > 0 && usage.remaining <= 0 ? (
        <div className="ai-chat-warning">Os creditos de IA deste mes acabaram. Aguarde a renovacao ou solicite ajuste no plano.</div>
      ) : null}

      <div className="ai-chat-prompts">
        {prompts.map((prompt) => {
          const Icon = prompt.icon;
          return (
            <button key={prompt.id} disabled={loading || creditsBlocked} onClick={() => askAssistant(prompt.text)} type="button">
              <Icon size={15} />
              {prompt.title}
            </button>
          );
        })}
      </div>

      <div className="ai-chat-messages">
        {messages.map((message, index) => (
          <div className={`ai-chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
            {message.text}
          </div>
        ))}
        {loading ? (
          <div className="ai-chat-bubble assistant loading">
            <Loader2 size={16} />
            Analisando dados...
          </div>
        ) : null}
      </div>

      <form className="ai-chat-form" onSubmit={submit}>
        <input
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Pergunte sobre agenda, clientes, financeiro ou estoque"
          value={question}
        />
        <button disabled={loading || creditsBlocked || !question.trim()} title="Enviar pergunta" type="submit">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default AiAssistant;
