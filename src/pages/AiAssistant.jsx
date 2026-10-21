import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CalendarClock, Loader2, Megaphone, PackageSearch, Send, Sparkles, TrendingUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PLANS, askAiAssistantSecure, getTenantAiCredits } from '../services/commercialService';

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
  const [usage, setUsage] = useState({ balance: aiCredits || 0, bonus: 0, included: aiCredits || 0, used: 0 });
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
      setUsage({ balance: null, bonus: null, included: null, used: 0 });
      return () => {
        alive = false;
      };
    }

    getTenantAiCredits(currentUser?.tenantId)
      .then((data) => {
        if (alive) setUsage(data);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [currentUser?.tenantId, currentUser?.planId, isPlatformAdmin]);

  const creditsBlocked = !isPlatformAdmin && usage.balance <= 0;
  const creditText = isPlatformAdmin
    ? 'Admin Orquestra.cs: uso liberado'
    : `Créditos IA: ${usage.balance} disponíveis · ${usage.used} usados · ${usage.bonus} extras`;

  const askAssistant = async (text) => {
    const prompt = text.trim();
    if (!prompt || loading || creditsBlocked) return;

    setQuestion('');
    setLoading(true);
    setMessages((items) => [...items, { role: 'user', text: prompt }]);

    try {
      const data = await askAiAssistantSecure({
        tenantId: currentUser?.tenantId,
        question: prompt,
        snapshot
      });
      if (!isPlatformAdmin && data.wallet) setUsage(data.wallet);

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
        <div><strong>{isPlatformAdmin ? 'Admin' : usage.balance}</strong><span>Créditos</span></div>
      </section>

      {!isPlatformAdmin && aiCredits <= 0 && usage.balance <= 0 ? (
        <div className="ai-chat-warning">Seu plano atual não inclui créditos mensais de IA. Faça upgrade ou compre créditos extras na tela de Planos.</div>
      ) : null}

      {!isPlatformAdmin && aiCredits > 0 && usage.balance <= 0 ? (
        <div className="ai-chat-warning">Os créditos de IA acabaram. Aguarde a renovação mensal ou compre créditos extras na tela de Planos.</div>
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
