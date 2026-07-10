const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function verifyFirebaseToken(token) {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

  if (!apiKey) {
    return { ok: true, mode: 'unverified' };
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });

  if (!response.ok) {
    return { ok: false };
  }

  const data = await response.json();
  return { ok: Array.isArray(data.users) && data.users.length > 0 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY nao configurada no servidor.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Login obrigatorio para usar o assistente.' });
  }

  const tokenStatus = await verifyFirebaseToken(token);
  if (!tokenStatus.ok) {
    return res.status(401).json({ error: 'Sessao invalida. Entre novamente.' });
  }

  const { question, snapshot, planLabel } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Informe uma pergunta valida.' });
  }

  const openAiResponse = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: [
            'Voce e o Assistente IA do Orquestra Auto Detail, um sistema SaaS para estetica automotiva.',
            'Responda sempre em portugues do Brasil, com clareza, organizacao e foco pratico.',
            'Use tom profissional, simples e direto. Evite resposta longa, confusa ou motivacional demais.',
            'Nao invente numeros, clientes, agendamentos, valores ou dados que nao estejam no resumo recebido.',
            'Se faltar informacao, diga exatamente qual informacao falta e como o usuario pode verificar.',
            'Priorize a rotina real de uma estetica automotiva: agenda, clientes, veiculos, servicos, financeiro, estoque, planos e atendimento.',
            'Formato obrigatorio da resposta:',
            '1. Comece com uma resposta direta em 1 frase.',
            '2. Se houver analise, use no maximo 3 topicos curtos.',
            '3. Termine com "Proximo passo:" e uma acao objetiva.',
            'Regras de estilo:',
            '- Nao use markdown pesado.',
            '- Nao use tabelas, salvo se o usuario pedir.',
            '- Nao use termos tecnicos desnecessarios.',
            '- Nao entregue varias possibilidades soltas; recomende o caminho mais simples.',
            '- Para mensagens ao cliente final, escreva um texto pronto para copiar.',
            '- Para duvidas operacionais, diga onde clicar dentro do sistema quando for possivel.'
          ].join('\n')
        },
        {
          role: 'user',
          content: JSON.stringify({
            pergunta: question,
            plano: planLabel,
            resumoDoSistema: snapshot
          })
        }
      ]
    })
  });

  const data = await openAiResponse.json();

  if (!openAiResponse.ok) {
    return res.status(openAiResponse.status).json({
      error: data?.error?.message || 'Falha ao gerar resposta da IA.'
    });
  }

  return res.status(200).json({
    answer: data.choices?.[0]?.message?.content || 'Nao foi possivel gerar uma resposta agora.'
  });
}
