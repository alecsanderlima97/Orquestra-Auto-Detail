import React, { createContext, useContext, useState, useEffect } from 'react';

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
  // Funções Auxiliares de Persistência
  const getInitialData = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(scopedKey(key));
      if (!saved || saved === "null" || saved === "undefined") return defaultValue;
      
      try {
        return JSON.parse(saved);
      } catch (parseError) {
        // Se falhar o parse, pode ser que o valor seja apenas uma string sem aspas (ex: premium)
        return saved || defaultValue;
      }
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

  // Efeito para salvar no localStorage
  useEffect(() => {
    localStorage.setItem(scopedKey('servicos'), JSON.stringify(servicos));
    localStorage.setItem(scopedKey('clientes'), JSON.stringify(clientes));
    localStorage.setItem(scopedKey('agendamentos'), JSON.stringify(agendamentos));
    localStorage.setItem(scopedKey('estoque'), JSON.stringify(estoque));
    localStorage.setItem(scopedKey('financeiro'), JSON.stringify(financeiro));
    localStorage.setItem(scopedKey('privacidade'), JSON.stringify(privacidade));
    localStorage.setItem(scopedKey('user'), JSON.stringify(userProfile));
  }, [servicos, clientes, agendamentos, estoque, financeiro, privacidade, userProfile]);

  const addCliente = (cliente) => {
    setClientes(prev => [...prev, { ...cliente, id: Date.now() }]);
  };

  const updateCliente = (id, updatedData) => {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
  };

  const deleteCliente = (id) => {
    setClientes(prev => prev.filter(c => c.id !== id));
  };

  const addAgendamento = (agendamento) => {
    const nextOS = userProfile.osCounter || 1;
    setAgendamentos(prev => [...prev, { 
      ...agendamento, 
      id: Date.now(), 
      osNumber: nextOS,
      pagoSinal: agendamento.pagoSinal || false,
      lembrete24h: false,
      lembrete2h: false
    }]);
    setUserProfile(prev => ({ ...prev, osCounter: nextOS + 1 }));
  };

  const updateAgendamento = (id, updatedData) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, ...updatedData } : a));
  };

  const updateAgendamentoStatus = (id, status) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const updateLembreteStatus = (id, tipo) => {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, [tipo]: true } : a));
  };

  const deleteAgendamento = (id) => {
    setAgendamentos(prev => prev.filter(a => a.id !== id));
  };

  const addServico = (servico) => {
    setServicos(prev => [...prev, { ...servico, id: Date.now() }]);
  };

  const updateServico = (id, updatedData) => {
    setServicos(prev => prev.map(s => s.id === id ? { ...s, ...updatedData } : s));
  };

  const deleteServico = (id) => {
    setServicos(prev => prev.filter(s => s.id !== id));
  };

  const addProduto = (produto) => {
    setEstoque(prev => [...prev, { ...produto, id: Date.now() }]);
  };

  const updateProduto = (id, updatedData) => {
    setEstoque(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));
  };

  const deleteProduto = (id) => {
    setEstoque(prev => prev.filter(p => p.id !== id));
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
    setFinanceiro(prev => [...prev, { ...lancamento, id: Date.now() }]);
  };

  const updateLancamento = (id, updatedData) => {
    setFinanceiro(prev => prev.map(l => l.id === id ? { ...l, ...updatedData } : l));
  };

  const deleteLancamento = (id) => {
    setFinanceiro(prev => prev.filter(l => l.id !== id));
  };

  const exportData = () => {
    const data = {
      servicos,
      clientes,
      agendamentos,
      estoque,
      financeiro
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
      alert('Dados restaurados com sucesso!');
      window.location.reload();
    } catch (e) {
      alert('Nao foi possivel restaurar este backup.');
      window.location.reload();
    }
  };
  return (
    <DataContext.Provider value={{
      clientes, addCliente, updateCliente, deleteCliente,
      agendamentos, addAgendamento, updateAgendamento, updateAgendamentoStatus, deleteAgendamento,
      servicos, addServico, updateServico, deleteServico,
      estoque, addProduto, updateProduto, deleteProduto, movimentarEstoque,
      financeiro, addLancamento, updateLancamento, deleteLancamento,
      privacidade, setPrivacidade,
      theme, setTheme,
      userProfile, setUserProfile,
      exportData, importData,
      updateLembreteStatus
    }}>
      {children}
    </DataContext.Provider>
  );
};




