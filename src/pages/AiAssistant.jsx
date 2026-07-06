import React, { useMemo, useState } from 'react';
import { Bot, CalendarClock, Lightbulb, Megaphone, PackageSearch, Send, TrendingUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PLANS } from '../services/commercialService';

const prompts = [
  { id: 'financeiro', icon: TrendingUp, title: 'Resumo financeiro', text: 'Analise entradas, saidas e saldo do mes e sugira melhorias.' },
  { id: 'agenda', icon: CalendarClock, title: 'Agenda inteligente', text: 'Identifique horarios livres e oportunidades para encaixes.' },
  { id: 'campanhas', icon: Megaphone, title: 'Campanhas', text: 'Crie uma campanha de WhatsApp para clientes inativos.' },
  { id: 'estoque', icon: PackageSearch, title: 'Estoque', text: 'Liste itens em baixa e sugira reposicao prioritaria.' },
  { id: 'servicos', icon: Lightbulb, title: 'Servicos', text: 'Sugira combos e upgrades para aumentar o ticket medio.' }
];

const AiAssistant = () => {
  const { agendamentos, clientes, estoque, financeiro, servicos } = useData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const plan = PLANS[currentUser?.planId] || PLANS.medium;
  const aiCredits = plan.limits.aiCredits || 0;
  const [question, setQuestion] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0]);

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

  const previewAnswer = aiCredits <= 0
    ? 'Seu plano atual nao inclui creditos de IA. Faca upgrade para liberar o assistente.'
    : 'Base pronta. A proxima etapa e conectar este painel a uma Function segura com OPENAI_API_KEY protegida.';

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assistente IA</h1>
          <p style={{ color: '#aaa', marginTop: 4 }}>Analises, campanhas e decisoes comerciais para estetica automotiva.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 22 }}>
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <Bot size={26} color="var(--primary-color)" />
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Central inteligente</h2>
              <p style={{ color: '#888', margin: '4px 0 0', fontSize: 13 }}>Escolha uma analise ou escreva sua pergunta.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 18 }}>
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
                  <span style={{ display: 'block', color: '#999', fontSize: 12, marginTop: 4 }}>{prompt.text}</span>
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

          <button className="action-btn" disabled={aiCredits <= 0} style={{ marginTop: 14, opacity: aiCredits <= 0 ? 0.55 : 1 }}>
            <Send size={18} /> Gerar analise
          </button>

          <div style={{ marginTop: 18, borderRadius: 12, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', padding: 16, color: '#ddd', lineHeight: 1.6 }}>
            {previewAnswer}
          </div>
        </section>

        <aside className="card">
          <h3 style={{ marginTop: 0 }}>Creditos IA</h3>
          <strong style={{ fontSize: 34 }}>{aiCredits}</strong>
          <p style={{ color: '#aaa' }}>creditos mensais no plano {plan.label}</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 18, color: '#ccc', fontSize: 14 }}>
            <span>Clientes: {snapshot.clientes}</span>
            <span>Agendamentos: {snapshot.agendamentos}</span>
            <span>Servicos: {snapshot.servicos}</span>
            <span>Estoque baixo: {snapshot.estoqueBaixo}</span>
            <span>Receitas mes: R$ {snapshot.receitasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>Despesas mes: R$ {snapshot.despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AiAssistant;
