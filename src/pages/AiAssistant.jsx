import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CalendarClock, Lightbulb, Megaphone, PackageSearch, Send, TrendingUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import { auth } from '../firebase/firebaseConfig';
import { PLANS, getTenantAiUsage, registerTenantAiUsage } from '../services/commercialService';

const prompts = [
  { id: 'financeiro', icon: TrendingUp, title: 'Resumo financeiro', text: 'Analise entradas, saidas e saldo do mes e sugira melhorias.' },
  { id: 'agenda', icon: CalendarClock, title: 'Agenda inteligente', text: 'Identifique horarios livres e oportunidades para encaixes.' },
  { id: 'campanhas', icon: Megaphone, title: 'Campanhas', text: 'Crie uma campanha de WhatsApp para clientes inativos.' },
  { id: 'estoque', icon: PackageSearch, title: 'Estoque', text: 'Liste itens em baixa e sugira reposicao prioritaria.' },
  { id: 'servicos', icon: Lightbulb, title: 'Servicos', text: 'Sugira combos e upgrades para aumentar o ticket medio.' }
];

const AiAssistant = ({ compact = false }) => {
  const { agendamentos, clientes, estoque, financeiro, servicos } = useData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const plan = PLANS[currentUser?.planId] || PLANS.medium;
  const aiCredits = plan.limits.aiCredits || 0;
  const [usage, setUsage] = useState({ limit: aiCredits, remaining: aiCredits, used: 0 });
  const [question, setQuestion] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
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
    getTenantAiUsage(currentUser?.tenantId, currentUser?.planId)
      .then((data) => {
        if (alive) setUsage(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [currentUser?.tenantId, currentUser?.planId]);

  const previewAnswer = aiCredits <= 0
    ? 'Seu plano atual nao inclui creditos de IA. Faca upgrade para liberar o assistente.'
    : usage.remaining <= 0
      ? 'Os creditos de IA deste mes acabaram. Aguarde a renovacao ou faca upgrade de plano.'
    : 'Pronto para gerar analises com IA usando os dados resumidos do seu sistema.';

  const handleGenerate = async () => {
    const prompt = (question || selectedPrompt.text).trim();

    if (!prompt || aiCredits <= 0 || usage.remaining <= 0) return;

    setLoading(true);
    setError('');
    setAnswer('');

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
          planLabel: plan.label,
          question: prompt,
          snapshot
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Nao foi possivel gerar a analise.');
      }

      const updatedUsage = await registerTenantAiUsage(currentUser?.tenantId, currentUser?.planId);
      setUsage(updatedUsage);
      setAnswer(data.answer);
    } catch (err) {
      setError(err.message || 'Falha ao gerar a analise.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div className="page-header" style={compact ? { marginBottom: 18 } : undefined}>
        <div>
          <h1 className="page-title" style={compact ? { fontSize: 22 } : undefined}>Assistente IA</h1>
          <p style={{ color: '#aaa', marginTop: 4 }}>Analises, campanhas e decisoes comerciais.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) 320px', gap: 22 }}>
        <section className={compact ? '' : 'card'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <Bot size={26} color="var(--primary-color)" />
            <div>
              <h2 style={{ margin: 0, fontSize: compact ? 18 : 22 }}>Central inteligente</h2>
              <p style={{ color: '#888', margin: '4px 0 0', fontSize: 13 }}>Escolha uma analise ou escreva sua pergunta.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 18 }}>
            {prompts.map((prompt) => {
              const Icon = prompt.icon;
              const active = selectedPrompt.id === prompt.id;
              return (
                <button
                  key={prompt.id}
                  onClick={() => setSelectedPrompt(prompt)}
                  style={{
                    background: active ? 'rgba(var(--primary-rgb), 0.18)' : 'rgba(255,255,255,0.03)',
                    border: active ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    color: 'white',
                    cursor: 'pointer',
                    padding: 14,
                    textAlign: 'left'
                  }}
                >
                  <Icon size={18} color="var(--primary-color)" />
                  <strong style={{ display: 'block', marginTop: 8 }}>{prompt.title}</strong>
                  {!compact ? <span style={{ display: 'block', color: '#999', fontSize: 12, marginTop: 4 }}>{prompt.text}</span> : null}
                </button>
              );
            })}
          </div>

          <textarea
            value={question || selectedPrompt.text}
            onChange={(event) => setQuestion(event.target.value)}
            rows={5}
            style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'white', padding: 14, resize: 'vertical' }}
          />

          <div style={{ marginTop: 10, color: '#aaa', fontSize: 13 }}>
            Creditos IA: {usage.used}/{usage.limit} usados - {usage.remaining} restantes
          </div>

          <button
            className="action-btn"
            disabled={aiCredits <= 0 || usage.remaining <= 0 || loading}
            onClick={handleGenerate}
            style={{ marginTop: 14, opacity: aiCredits <= 0 || usage.remaining <= 0 || loading ? 0.55 : 1 }}
          >
            <Send size={18} /> {loading ? 'Gerando...' : 'Gerar analise'}
          </button>

          <div style={{ marginTop: 18, borderRadius: 12, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', padding: 16, color: '#ddd', lineHeight: 1.6 }}>
            {error || answer || previewAnswer}
          </div>
        </section>

        {!compact ? <aside className="card">
          <h3 style={{ marginTop: 0 }}>Creditos IA</h3>
          <strong style={{ fontSize: 34 }}>{usage.remaining}</strong>
          <p style={{ color: '#aaa' }}>{usage.used}/{usage.limit} usados no mes - plano {plan.label}</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 18, color: '#ccc', fontSize: 14 }}>
            <span>Clientes: {snapshot.clientes}</span>
            <span>Agendamentos: {snapshot.agendamentos}</span>
            <span>Servicos: {snapshot.servicos}</span>
            <span>Estoque baixo: {snapshot.estoqueBaixo}</span>
            <span>Receitas mes: R$ {snapshot.receitasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>Despesas mes: R$ {snapshot.despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </aside> : null}
      </div>
    </div>
  );
};

export default AiAssistant;
