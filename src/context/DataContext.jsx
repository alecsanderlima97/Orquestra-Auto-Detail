import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseReady } from '../firebase/firebaseConfig';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children, currentUser }) => {
  const tenantId = currentUser?.tenantId || currentUser?.email || 'local';
  const scopedKey = (key) => `estetica:${tenantId}:${key}`;
  const cloudDataRef = useMemo(() => (currentUser?.tenantId && firebaseReady && db ? doc(db, `tenants/${currentUser.tenantId}/appData/main`) : null), [currentUser?.tenantId]);
  const cloudLoadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  const storageKeys = (key) => [
    scopedKey(key),
    currentUser?.email ? `estetica:${currentUser.email}:${key}` : '',
    `estetica:local:${key}`,
    key,
    `alis${'son'}_${key}`,
    key === 'servicos' ? `alis${'son'}_servicos_final` : ''
  ].filter(Boolean);

  // Funções Auxiliares de Persistência
  const getInitialData = (key, defaultValue) => {
    try {
      for (const storageKey of storageKeys(key)) {
        const saved = localStorage.getItem(storageKey);
        if (!saved || saved === "null" || saved === "undefined") continue;

        try {
          return JSON.parse(saved);
        } catch (parseError) {
          return saved || defaultValue;
        }
      }
      return defaultValue;
    } catch (e) {
      console.error(`Erro ao carregar ${key}`, e);
      return defaultValue;
    }
  };  const [servicos, setServicos] = useState(() => getInitialData('servicos', [
    { 
      id: 1, 
      nome: 'Limpeza Técnica', 
      categoria: 'ESTÉTICA',
      preco: 150, 
      tempoEstimado: '3h', 
      descricao: 'Limpeza interna e externa detalhada, com aplicação de selante nos pneus, proteção nos plásticos internos, proteção nas caixas de rodas e selante na pintura.',
      categorias: [{ nome: 'Médio', valor: 180 }, { nome: 'Grande / SUV', valor: 220 }]
    },
    { 
      id: 2, 
      nome: 'Limpeza Detalhada', 
      categoria: 'ESTÉTICA',
      preco: 250, 
      tempoEstimado: '5h', 
      descricao: 'Limpeza interna e externa minuciosa com detalhamento em emblemas, maçanetas e retrovisores. Inclui proteção em caixas de rodas, selante nos pneus e proteção de pintura com enceramento à máquina. Realizamos descontaminação de plásticos, bancos e estofados, revitalização de plásticos internos e externos. Brindes: lixo car + 1 aromatizante personalizado.',
      categorias: [{ nome: 'Médio', valor: 300 }, { nome: 'Grande / SUV', valor: 350 }]
    },
    { 
      id: 3, 
      nome: 'Limpeza Completa Detalhada (Motor + Chassi)', 
      categoria: 'MOTOR',
      preco: 300, 
      tempoEstimado: '6h', 
      descricao: 'Incluso limpeza detalhada de motor e chassi, com aplicação de proteção técnica contra oxidação e ferrugem.',
      categorias: [{ nome: 'Médio', valor: 350 }, { nome: 'Grande / SUV', valor: 400 }]
    },
    { 
      id: 4, 
      nome: 'Higienização Completa', 
      categoria: 'INTERIOR',
      preco: 800, 
      tempoEstimado: '8h', 
      descricao: 'Remoção técnica de bancos, carpetes e borrachas. Incluso troca do filtro de ar-condicionado, limpeza profunda e acabamento com proteção interna e externa + brindes exclusivos.',
      categorias: [{ nome: 'Médio', valor: 950 }, { nome: 'Grande / SUV', valor: 1100 }]
    },
    { 
      id: 5, 
      nome: 'Limpeza de Ar-condicionado', 
      categoria: 'INTERIOR',
      preco: 150, 
      tempoEstimado: '1h', 
      descricao: 'Limpeza técnica do sistema com substituição do filtro e aplicação de granada higienizadora.',
      categorias: []
    },
    { 
      id: 6, 
      nome: 'Restauração de Faróis', 
      categoria: 'PINTURA',
      preco: 260, 
      tempoEstimado: '2h', 
      descricao: 'Incluso lixamento técnico à máquina e aplicação de proteção em polímero contra raios solares UV. Durabilidade com garantia de 2 anos.',
      categorias: []
    },
    { 
      id: 7, 
      nome: 'Higienização de Bancos Avulsos', 
      categoria: 'INTERIOR',
      preco: 300, 
      tempoEstimado: '3h', 
      descricao: 'Processo de higienização profunda para bancos em estofados ou tecidos.',
      categorias: []
    },
    { 
      id: 8, 
      nome: 'Limpeza Externa com Proteção', 
      categoria: 'LAVAGEM',
      preco: 80, 
      tempoEstimado: '1h', 
      descricao: 'Lavagem externa com proteção na pintura, aplicação de selante nos pneus e limpeza técnica dos tapetes.',
      categorias: [{ nome: 'Médio', valor: 100 }, { nome: 'Grande / SUV', valor: 120 }]
    },
    { 
      id: 9, 
      nome: 'Instalação de Som Automotivo', 
      categoria: 'ACESSÓRIOS',
      preco: 0, 
      tempoEstimado: '---', 
      descricao: 'Instalação profissional de sistemas de som. Favor levar o veículo até a loja para a realização do orçamento.',
      categorias: []
    },
    { 
      id: 10, 
      nome: 'Polimento Técnico', 
      categoria: 'PINTURA',
      preco: 800, 
      tempoEstimado: '10h', 
      descricao: 'Polimento técnico na pintura com limpeza interna e externa completa. Inclui proteção em todas as superfícies do veículo e brinde personalizado.',
      categorias: [{ nome: 'Médio', valor: 1000 }, { nome: 'Grande / SUV', valor: 1300 }]
    },
    { 
      id: 11, 
      nome: 'Polimento Comercial', 
      categoria: 'PINTURA',
      preco: 500, 
      tempoEstimado: '6h', 
      descricao: 'Focado na remoção de riscos superficiais e restauração do brilho no verniz. Acompanha limpeza externa detalhada.',
      categorias: [{ nome: 'Médio', valor: 650 }, { nome: 'Grande / SUV', valor: 800 }]
    },
    { 
      id: 12, 
      nome: 'Polimento em Motos', 
      categoria: 'MOTOS',
      preco: 300, 
      tempoEstimado: '4h', 
      descricao: 'Incluso limpeza técnica detalhada, proteção nos plásticos, selante nos pneus e limpeza técnica do kit relação.',
      categorias: []
    },
    { 
      id: 13, 
      nome: 'Vitrificação de Pintura (Carro ou Moto)', 
      categoria: 'PINTURA',
      preco: 1000, 
      tempoEstimado: '12h', 
      descricao: 'Proteção de alta performance com garantia de 3 anos. (Moto: R$ 500,00 | Carro: R$ 1.000,00).',
      categorias: [{ nome: 'SUV / Grande', valor: 1400 }]
    },
    { 
      id: 14, 
      nome: 'Limpeza Técnica de Motos', 
      categoria: 'MOTOS',
      preco: 130, 
      tempoEstimado: '2h', 
      descricao: 'Proteção com verniz de motor, selante na pintura e nos pneus, revitalização de plásticos + brinde.',
      categorias: []
    },
    { 
      id: 15, 
      nome: 'Limpeza Detalhada de Motos', 
      categoria: 'MOTOS',
      preco: 220, 
      tempoEstimado: '4h', 
      descricao: 'Detalhamento das relações e remoção das carenagens para maior acesso à limpeza. Inclui proteção nos pneus, pintura e motor com verniz contra oxidação, além de revitalização de plásticos.',
      categorias: []
    },
    { 
      id: 16, 
      nome: 'Remoção de Chuva Ácida nos Vidros', 
      categoria: 'VIDROS',
      preco: 100, 
      tempoEstimado: '2h', 
      descricao: 'Tratamento nos vidros para garantir a maior visibilidade possível e segurança ao dirigir.',
      categorias: []
    }
  ]));

  const [clientes, setClientes] = useState(() => getInitialData('clientes', []));

  const [agendamentos, setAgendamentos] = useState(() => getInitialData('agendamentos', []));

  const [estoque, setEstoque] = useState(() => getInitialData('estoque', [
    { id: 1, nome: 'Shampoo Automotivo PH Neutro (5L)', categoria: 'Lavagem', quantidade: 3, minimo: 1, unidade: 'galão', dataEntrada: '2026-04-01', dataSaida: '' },
    { id: 2, nome: 'Cera de Carnaúba Premium (200g)', categoria: 'Acabamento', quantidade: 5, minimo: 2, unidade: 'un', dataEntrada: '2026-04-01', dataSaida: '' },
    { id: 3, nome: 'APC - Limpador Multiuso (5L)', categoria: 'Limpeza Interna', quantidade: 2, minimo: 1, unidade: 'galão', dataEntrada: '2026-04-01', dataSaida: '' },
    { id: 4, nome: 'Toalhas de Microfibra 40x40', categoria: 'Acessórios', quantidade: 12, minimo: 20, unidade: 'un', dataEntrada: '2026-04-01', dataSaida: '' },
    { id: 5, nome: 'Composto Polidor Corte (1kg)', categoria: 'Polimento', quantidade: 1, minimo: 1, unidade: 'un', dataEntrada: '2026-04-01', dataSaida: '' }
  ]));

  const [financeiro, setFinanceiro] = useState(() => getInitialData('financeiro', []));

  const [privacidade, setPrivacidade] = useState(() => {
    const saved = localStorage.getItem(scopedKey('privacidade'));
    return saved ? JSON.parse(saved) : false;
  });

  const [theme, setTheme] = useState(() => getInitialData('theme', 'premium'));

  const [userProfile, setUserProfile] = useState(() => {
    const defaultProfile = {
      nome: currentUser?.name || currentUser?.companyName || 'Novo Cliente',
      cargo: currentUser?.role || 'Propriet�rio',
      cpf: '',
      nascimento: '',
      endereco: '',
      email: currentUser?.email || '',
      telefone: '',
      cnpj: '',
      instagram: '',
      osCounter: 1,
      foto: null
    };
    try {
      const saved = localStorage.getItem(scopedKey('user'));
      return saved ? { ...defaultProfile, ...JSON.parse(saved) } : defaultProfile;
    } catch (e) {
      return defaultProfile;
    }
  });

  const [auditLogs, setAuditLogs] = useState(() => getInitialData('auditLogs', []));

  const activeOnly = (items) => items.filter((item) => !item?.deletedAt);
  const visibleClientes = useMemo(() => activeOnly(clientes), [clientes]);
  const visibleAgendamentos = useMemo(() => activeOnly(agendamentos), [agendamentos]);
  const visibleServicos = useMemo(() => activeOnly(servicos), [servicos]);
  const visibleEstoque = useMemo(() => activeOnly(estoque), [estoque]);
  const visibleFinanceiro = useMemo(() => activeOnly(financeiro), [financeiro]);

  const registerAudit = (action, entity, entityId, label = '') => {
    const entry = {
      id: Date.now() + Math.random(),
      action,
      entity,
      entityId,
      label,
      userEmail: currentUser?.email || '',
      userName: currentUser?.name || currentUser?.companyName || '',
      createdAt: new Date().toISOString()
    };
    setAuditLogs((prev) => [entry, ...prev].slice(0, 500));
  };

  const softDelete = (setter, items, entity, id, labelFallback) => {
    const item = items.find((entry) => entry.id === id);
    setter((prev) => prev.map((entry) => entry.id === id ? {
      ...entry,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.email || currentUser?.id || 'usuario'
    } : entry));
    registerAudit('soft_delete', entity, id, labelFallback(item));
  };

  // Aplica o tema ao body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(scopedKey('theme'), theme);
  }, [theme]);

  // Efeito para migrar/corrigir agendamentos (numeração OS)
  useEffect(() => {
    const agendamentosSemNumero = agendamentos.some(a => !a.osNumber);
    
    if (agendamentosSemNumero) {
      let counter = 1;
      setAgendamentos(prev => prev.map(a => {
        if (!a.osNumber) {
          const num = counter++;
          return { ...a, osNumber: num };
        }
        if (a.osNumber >= counter) counter = a.osNumber + 1;
        return a;
      }));
      setUserProfile(prev => ({ ...prev, osCounter: counter }));
    }
  }, [agendamentos]);

  // Efeito para migrar/corrigir categorias nos serviços salvos
  useEffect(() => {
    // Migra clientes para múltiplos veículos se necessário
    const precisaMigrarVeiculos = clientes.some(c => c.veiculo && !c.veiculos);
    if (precisaMigrarVeiculos) {
      setClientes(prev => prev.map(c => {
        if (c.veiculo && !c.veiculos) {
          const { veiculo, ...rest } = c;
          return { ...rest, veiculos: [{ ...veiculo, id: Date.now() + Math.random() }] };
        }
        return c;
      }));
    }

    const precisaAjustar = servicos.some(s => !s.categoria || (s.nome === 'Limpeza Técnica' && s.categoria === 'MOTOR'));
    
    if (precisaAjustar) {
      setServicos(prev => prev.map(s => {
        let novaCat = s.categoria;
        
        // Correção específica solicitada pelo usuário
        if (s.nome === 'Limpeza Técnica' && (!s.categoria || s.categoria === 'MOTOR')) {
          novaCat = 'ESTÉTICA';
        } 
        // Preenchimento de categorias faltantes baseado no nome (heurística para dados antigos)
        else if (!s.categoria) {
          if (s.nome.toLowerCase().includes('polimento') || s.nome.toLowerCase().includes('vitrificação')) novaCat = 'PINTURA';
          else if (s.nome.toLowerCase().includes('lavagem') || s.nome.toLowerCase().includes('detalhada')) novaCat = 'LAVAGEM';
          else if (s.nome.toLowerCase().includes('higienização') || s.nome.toLowerCase().includes('couro') || s.nome.toLowerCase().includes('ar-condicionado')) novaCat = 'INTERIOR';
          else if (s.nome.toLowerCase().includes('moto')) novaCat = 'MOTOS';
          else if (s.nome.toLowerCase().includes('chuva ácida')) novaCat = 'VIDROS';
          else if (s.nome.toLowerCase().includes('som') || s.nome.toLowerCase().includes('film')) novaCat = 'ACESSÓRIOS';
          else novaCat = 'ESTÉTICA';
        }
        
        return { ...s, categoria: novaCat };
      }));
    }
  }, [servicos]);

  const buildCloudData = () => ({
    agendamentos,
    clientes,
    estoque,
    financeiro,
    privacidade,
    servicos,
    theme,
    userProfile,
    auditLogs
  });

  useEffect(() => {
    cloudLoadedRef.current = false;
    if (!cloudDataRef) {
      cloudLoadedRef.current = true;
      return undefined;
    }

    let alive = true;
    getDoc(cloudDataRef)
      .then((snapshot) => {
        if (!alive) return;

        if (snapshot.exists()) {
          const cloud = snapshot.data();
          if (Array.isArray(cloud.servicos)) setServicos(cloud.servicos);
          if (Array.isArray(cloud.clientes)) setClientes(cloud.clientes);
          if (Array.isArray(cloud.agendamentos)) setAgendamentos(cloud.agendamentos);
          if (Array.isArray(cloud.estoque)) setEstoque(cloud.estoque);
          if (Array.isArray(cloud.financeiro)) setFinanceiro(cloud.financeiro);
          if (typeof cloud.privacidade === 'boolean') setPrivacidade(cloud.privacidade);
          if (cloud.theme) setTheme(cloud.theme);
          if (cloud.userProfile) setUserProfile((prev) => ({ ...prev, ...cloud.userProfile }));
        } else {
          setDoc(cloudDataRef, { ...buildCloudData(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
        }

        cloudLoadedRef.current = true;
      })
      .catch(() => {
        cloudLoadedRef.current = true;
      });

    return () => {
      alive = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [cloudDataRef]);

  // Efeito para salvar no localStorage
  useEffect(() => {
    localStorage.setItem(scopedKey('servicos'), JSON.stringify(servicos));
    localStorage.setItem(scopedKey('clientes'), JSON.stringify(clientes));
    localStorage.setItem(scopedKey('agendamentos'), JSON.stringify(agendamentos));
    localStorage.setItem(scopedKey('estoque'), JSON.stringify(estoque));
    localStorage.setItem(scopedKey('financeiro'), JSON.stringify(financeiro));
    localStorage.setItem(scopedKey('privacidade'), JSON.stringify(privacidade));
    localStorage.setItem(scopedKey('user'), JSON.stringify(userProfile));
    localStorage.setItem(scopedKey('auditLogs'), JSON.stringify(auditLogs));

    if (!cloudDataRef || !cloudLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setDoc(cloudDataRef, { ...buildCloudData(), updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    }, 700);
  }, [servicos, clientes, agendamentos, estoque, financeiro, privacidade, userProfile, auditLogs, cloudDataRef]);

  const addCliente = (cliente) => {
    const id = Date.now();
    setClientes(prev => [...prev, { ...cliente, id }]);
    registerAudit('create', 'cliente', id, cliente?.nome || cliente?.name || 'Cliente');
  };

  const updateCliente = (id, updatedData) => {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
    registerAudit('update', 'cliente', id, updatedData?.nome || updatedData?.name || 'Cliente');
  };

  const deleteCliente = (id) => {
    softDelete(setClientes, clientes, 'cliente', id, (item) => item?.nome || item?.name || 'Cliente');
  };

  const addAgendamento = (agendamento) => {
    const nextOS = userProfile.osCounter || 1;
    const id = Date.now();
    setAgendamentos(prev => [...prev, { 
      ...agendamento, 
      id, 
      osNumber: nextOS,
      pagoSinal: agendamento.pagoSinal || false,
      lembrete24h: false,
      lembrete2h: false
    }]);
    setUserProfile(prev => ({ ...prev, osCounter: nextOS + 1 }));
    registerAudit('create', 'agendamento', id, agendamento?.cliente || 'Agendamento');
  };

  const updateAgendamento = (id, updatedData) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, ...updatedData } : a));
    registerAudit('update', 'agendamento', id, updatedData?.cliente || 'Agendamento');
  };

  const updateAgendamentoStatus = (id, status) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const updateLembreteStatus = (id, tipo) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, [tipo]: true } : a));
  };

  const deleteAgendamento = (id) => {
    softDelete(setAgendamentos, agendamentos, 'agendamento', id, (item) => item?.cliente || 'Agendamento');
  };

  const addServico = (servico) => {
    const id = Date.now();
    setServicos(prev => [...prev, { ...servico, id }]);
    registerAudit('create', 'servico', id, servico?.nome || 'Servico');
  };

  const updateServico = (id, updatedData) => {
    setServicos(prev => prev.map(s => s.id === id ? { ...s, ...updatedData } : s));
    registerAudit('update', 'servico', id, updatedData?.nome || 'Servico');
  };

  const deleteServico = (id) => {
    softDelete(setServicos, servicos, 'servico', id, (item) => item?.nome || 'Servico');
  };

  const addProduto = (produto) => {
    const id = Date.now();
    setEstoque(prev => [...prev, { ...produto, id }]);
    registerAudit('create', 'estoque', id, produto?.nome || 'Produto');
  };

  const updateProduto = (id, updatedData) => {
    setEstoque(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));
    registerAudit('update', 'estoque', id, updatedData?.nome || 'Produto');
  };

  const deleteProduto = (id) => {
    softDelete(setEstoque, estoque, 'estoque', id, (item) => item?.nome || 'Produto');
  };

  const movimentarEstoque = (id, quantidade, tipo) => {
    const hoje = new Date().toISOString().split('T')[0];
    setEstoque(prev => prev.map(p => {
      if (p.id === id) {
        const novaQuantidade = tipo === 'entrada' 
          ? (parseInt(p.quantidade) || 0) + parseInt(quantidade)
          : Math.max(0, (parseInt(p.quantidade) || 0) - parseInt(quantidade));
        
        return {
          ...p,
          quantidade: novaQuantidade,
          ...(tipo === 'entrada' ? { dataEntrada: hoje } : { dataSaida: hoje })
        };
      }
      return p;
    }));
  };

  const addLancamento = (lancamento) => {
    const id = Date.now();
    setFinanceiro(prev => [...prev, { ...lancamento, id }]);
    registerAudit('create', 'financeiro', id, lancamento?.descricao || lancamento?.categoria || 'Lancamento');
  };

  const updateLancamento = (id, updatedData) => {
    setFinanceiro(prev => prev.map(l => l.id === id ? { ...l, ...updatedData } : l));
    registerAudit('update', 'financeiro', id, updatedData?.descricao || updatedData?.categoria || 'Lancamento');
  };

  const deleteLancamento = (id) => {
    softDelete(setFinanceiro, financeiro, 'financeiro', id, (item) => item?.descricao || item?.categoria || 'Lancamento');
  };

  const exportData = () => {
    const data = {
      servicos,
      clientes,
      agendamentos,
      estoque,
      financeiro,
      auditLogs
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_auto_detail_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const getBackupValue = (jsonData, key) => {
    const legacyKey = 'alis' + 'son_' + key;
    const valenKey = 'valen_' + key;
    return jsonData[key] || jsonData[legacyKey] || jsonData[valenKey];
  };

  const importData = (jsonData) => {
    try {
      const servicosBackup = getBackupValue(jsonData, 'servicos');
      const clientesBackup = getBackupValue(jsonData, 'clientes');
      const agendamentosBackup = getBackupValue(jsonData, 'agendamentos');
      const estoqueBackup = getBackupValue(jsonData, 'estoque');
      const financeiroBackup = getBackupValue(jsonData, 'financeiro');

      if (servicosBackup) setServicos(servicosBackup);
      if (clientesBackup) setClientes(clientesBackup);
      if (agendamentosBackup) setAgendamentos(agendamentosBackup);
      if (estoqueBackup) setEstoque(estoqueBackup);
      if (financeiroBackup) setFinanceiro(financeiroBackup);
      if (Array.isArray(jsonData.auditLogs)) setAuditLogs(jsonData.auditLogs);
      alert('Dados restaurados com sucesso!');
      window.location.reload();
    } catch (e) {
      alert('Nao foi possivel restaurar este backup.');
      window.location.reload();
    }
  };
  return (
    <DataContext.Provider value={{
      clientes: visibleClientes, addCliente, updateCliente, deleteCliente,
      agendamentos: visibleAgendamentos, addAgendamento, updateAgendamento, updateAgendamentoStatus, deleteAgendamento,
      servicos: visibleServicos, addServico, updateServico, deleteServico,
      estoque: visibleEstoque, addProduto, updateProduto, deleteProduto, movimentarEstoque,
      financeiro: visibleFinanceiro, addLancamento, updateLancamento, deleteLancamento,
      privacidade, setPrivacidade,
      theme, setTheme,
      userProfile, setUserProfile,
      auditLogs, exportData, importData,
      updateLembreteStatus
    }}>
      {children}
    </DataContext.Provider>
  );
};




