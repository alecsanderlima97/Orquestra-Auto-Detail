import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, Copy, ExternalLink, Inbox, Link2, Loader2, Save, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { canManageUsers, canWrite, getSubscriptionAccess } from '../services/commercialService';
import {
  getBookingConfig,
  listenPendingRequests,
  publicBookingUrl,
  resolveBookingRequest,
  saveBookingConfig
} from '../services/bookingService';
import { findConflicts, timeRange } from '../lib/agenda';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DEFAULT_FORM = {
  enabled: false,
  slug: '',
  workDays: [1, 2, 3, 4, 5, 6],
  openTime: '08:00',
  closeTime: '18:00',
  slotMinutes: 60,
  capacity: 1,
  minLeadHours: 2,
  maxDaysAhead: 30,
  showPrices: true,
  message: ''
};

const monthKey = (dataStr) => {
  const [, m, y] = String(dataStr || '').split('/');
  return m && y ? `${y}-${m}` : '';
};

const minutesToClock = (total) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

const formatPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : phone;
};

const slugFromName = (name) => String(name || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const BookingRequests = () => {
  const { agendamentos, addAgendamento, clientes, addCliente, servicos, userProfile } = useData();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const tenantId = currentUser?.tenantId;
  const isOwner = currentUser?.role === 'dev' || canManageUsers(currentUser?.role);
  const canHandle = currentUser?.role === 'dev' || canWrite(currentUser?.role);
  const access = getSubscriptionAccess(currentUser);
  const appointmentLimit = access.plan.limits.appointments;

  const [requests, setRequests] = useState([]);
  const [requestsState, setRequestsState] = useState('loading');
  const [busyId, setBusyId] = useState('');
  const [responsavel, setResponsavel] = useState(userProfile?.nome || '');
  const [feedback, setFeedback] = useState('');

  const [form, setForm] = useState(DEFAULT_FORM);
  const [savedConfig, setSavedConfig] = useState(null);
  const [configState, setConfigState] = useState('loading');
  const [configMessage, setConfigMessage] = useState('');

  useEffect(() => {
    if (!tenantId) {
      setRequestsState('ready');
      return undefined;
    }
    return listenPendingRequests(
      tenantId,
      (items) => { setRequests(items); setRequestsState('ready'); },
      () => setRequestsState('error')
    );
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) { setConfigState('ready'); return; }
    getBookingConfig(tenantId)
      .then((config) => {
        setSavedConfig(config);
        setForm(config ? { ...DEFAULT_FORM, ...config } : { ...DEFAULT_FORM, slug: slugFromName(currentUser?.companyName || userProfile?.nome) });
        setConfigState('ready');
      })
      .catch(() => setConfigState('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const responsaveis = useMemo(
    () => Array.from(new Set([userProfile?.nome, ...agendamentos.map((a) => a.responsavel)].filter(Boolean))),
    [agendamentos, userProfile?.nome]
  );

  const approve = async (request) => {
    setFeedback('');
    const nome = responsavel.trim();
    if (!nome) {
      setFeedback('Informe o responsável pelo serviço antes de aprovar.');
      return;
    }
    const candidate = {
      dataStr: request.dataStr,
      horario: request.time,
      duracao: minutesToClock(request.durationMinutes || 120),
      responsavel: nome
    };
    const conflitos = findConflicts(candidate, agendamentos);
    if (conflitos.length > 0) {
      const c = conflitos[0];
      setFeedback(`Conflito: ${nome} já tem serviço em ${timeRange(c)}${c.cliente ? ` (${c.cliente})` : ''}. Escolha outro responsável ou recuse o pedido.`);
      return;
    }
    const monthUsage = agendamentos.filter((a) => monthKey(a.dataStr) === monthKey(request.dataStr)).length;
    if (currentUser?.role !== 'dev' && appointmentLimit > 0 && monthUsage >= appointmentLimit) {
      setFeedback(`Limite do ${access.plan.label} atingido: ${appointmentLimit} agendamentos neste mês.`);
      return;
    }

    setBusyId(request.id);
    try {
      // Marca o pedido primeiro: se falhar, nada entra na agenda.
      await resolveBookingRequest(tenantId, request.id, currentUser.id, { status: 'aprovado' });

      const servico = servicos.find((s) => String(s.id) === String(request.serviceId));
      const telefone = String(request.phone || '');
      const veiculoTexto = request.plate ? `${request.vehicle} (${request.plate})` : request.vehicle;
      const existente = clientes.find((c) => String(c.telefone || '').replace(/\D/g, '').replace(/^55/, '') === telefone.replace(/^55/, ''));
      let clienteId = existente?.id;
      if (!existente) {
        clienteId = addCliente({
          nome: request.name,
          telefone,
          origem: 'Agendamento online',
          veiculos: [{ id: Date.now() + 1, tipo: 'carro', marca: '', modelo: request.vehicle, placa: request.plate || '', cor: '', ano: '', foto: '', avarias: '' }]
        });
      }

      addAgendamento({
        clienteId: clienteId ? String(clienteId) : '',
        cliente: existente?.nome || request.name,
        telefone,
        veiculo: veiculoTexto,
        servicoId: servico ? String(servico.id) : String(request.serviceId),
        servico: request.serviceName,
        categoriaNome: 'Pequeno',
        valor: Number(servico?.preco) || 0,
        valorAdicional: '',
        data: request.date,
        dataStr: request.dataStr,
        horario: request.time,
        duracao: candidate.duracao,
        responsavel: nome,
        status: 'Agendado',
        pagoSinal: false,
        observacoes: request.notes || '',
        origem: 'Agendamento online',
        bookingRequestId: request.id
      });
      setFeedback(`Pedido de ${request.name} aprovado e incluído na agenda. Confirme com o cliente pelo WhatsApp.`);
    } catch {
      setFeedback('Não foi possível aprovar agora. Verifique a conexão e tente novamente.');
    } finally {
      setBusyId('');
    }
  };

  const reject = async (request) => {
    if (!window.confirm(`Recusar o pedido de ${request.name}?`)) return;
    setBusyId(request.id);
    setFeedback('');
    try {
      await resolveBookingRequest(tenantId, request.id, currentUser.id, { status: 'recusado' });
      setFeedback(`Pedido de ${request.name} recusado. Avise o cliente pelo WhatsApp, se necessário.`);
    } catch {
      setFeedback('Não foi possível recusar agora. Tente novamente.');
    } finally {
      setBusyId('');
    }
  };

  const updateForm = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: field === 'slug' ? slugFromName(value) : value }));
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      workDays: prev.workDays.includes(day) ? prev.workDays.filter((d) => d !== day) : [...prev.workDays, day].sort()
    }));
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigMessage('');
    setConfigState('saving');
    try {
      const result = await saveBookingConfig(tenantId, {
        ...form,
        slotMinutes: Number(form.slotMinutes),
        capacity: Number(form.capacity),
        minLeadHours: Number(form.minLeadHours),
        maxDaysAhead: Number(form.maxDaysAhead)
      });
      setSavedConfig(result.config);
      setForm({ ...DEFAULT_FORM, ...result.config });
      setConfigMessage(result.config.enabled ? 'Configuração salva. O link está ativo.' : 'Configuração salva. O link está desligado.');
    } catch (error) {
      setConfigMessage(error.message);
    } finally {
      setConfigState('ready');
    }
  };

  const link = savedConfig?.slug ? publicBookingUrl(savedConfig.slug) : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setConfigMessage('Link copiado.');
    } catch {
      setConfigMessage(link);
    }
  };

  if (!tenantId) {
    return (
      <div className="card">
        <h2>Agendamento online</h2>
        <p>Disponível para contas vinculadas a uma empresa.</p>
      </div>
    );
  }

  return (
    <div className="booking-admin">
      <header className="booking-admin-header">
        <div>
          <h1><CalendarCheck size={26} aria-hidden="true" /> Agendamento online</h1>
          <p>Clientes pedem horário pelo link. A equipe aprova e o serviço entra na agenda.</p>
        </div>
        {link && savedConfig?.enabled ? (
          <div className="booking-link-box">
            <Link2 size={16} aria-hidden="true" />
            <span title={link}>{link.replace(/^https?:\/\//, '')}</span>
            <button type="button" onClick={copyLink} aria-label="Copiar link"><Copy size={16} /></button>
            <a href={link} target="_blank" rel="noreferrer" aria-label="Abrir link"><ExternalLink size={16} /></a>
          </div>
        ) : null}
      </header>

      <section className="card booking-section" aria-labelledby="booking-requests-title">
        <div className="booking-section-head">
          <h2 id="booking-requests-title"><Inbox size={20} aria-hidden="true" /> Solicitações pendentes {requests.length ? <span className="booking-count">{requests.length}</span> : null}</h2>
          {canHandle && requests.length > 0 ? (
            <label className="booking-inline-field">
              <span>Responsável ao aprovar</span>
              <input list="booking-responsaveis" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem vai executar" />
              <datalist id="booking-responsaveis">{responsaveis.map((n) => <option key={n} value={n} />)}</datalist>
            </label>
          ) : null}
        </div>

        {feedback ? <p className="booking-feedback" role="status">{feedback}</p> : null}

        {requestsState === 'loading' && <p className="booking-muted"><Loader2 size={16} className="booking-spin" aria-hidden="true" /> Carregando pedidos…</p>}
        {requestsState === 'error' && <p className="booking-error">Não foi possível carregar os pedidos. Atualize a página.</p>}
        {requestsState === 'ready' && requests.length === 0 && (
          <p className="booking-muted">Nenhum pedido aguardando. {savedConfig?.enabled ? 'Compartilhe o link com seus clientes.' : 'Ative o link abaixo para começar a receber pedidos.'}</p>
        )}

        <ul className="booking-list">
          {requests.map((r) => (
            <li key={r.id} className="booking-item">
              <div className="booking-item-main">
                <strong>{r.name}</strong>
                <span>{r.serviceName}</span>
                <span className="booking-when">{r.dataStr} às {r.time} · {Math.round((r.durationMinutes || 120) / 60 * 10) / 10}h</span>
                <span className="booking-muted">
                  <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noreferrer">{formatPhone(r.phone)}</a>
                  {' · '}{r.vehicle}{r.plate ? ` (${r.plate})` : ''}
                </span>
                {r.notes ? <span className="booking-notes">“{r.notes}”</span> : null}
              </div>
              {canHandle ? (
                <div className="booking-item-actions">
                  <button type="button" className="booking-approve" disabled={busyId === r.id} onClick={() => approve(r)}>
                    {busyId === r.id ? <Loader2 size={16} className="booking-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Aprovar
                  </button>
                  <button type="button" className="booking-reject" disabled={busyId === r.id} onClick={() => reject(r)}>
                    <X size={16} aria-hidden="true" /> Recusar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card booking-section" aria-labelledby="booking-config-title">
        <h2 id="booking-config-title"><Link2 size={20} aria-hidden="true" /> Configuração do link</h2>
        {!isOwner ? (
          <p className="booking-muted">Somente o proprietário pode alterar esta configuração.</p>
        ) : configState === 'loading' ? (
          <p className="booking-muted"><Loader2 size={16} className="booking-spin" aria-hidden="true" /> Carregando…</p>
        ) : configState === 'error' ? (
          <p className="booking-error">Não foi possível carregar a configuração.</p>
        ) : (
          <form className="booking-config" onSubmit={handleSaveConfig}>
            <label className="booking-switch">
              <input type="checkbox" checked={form.enabled} onChange={updateForm('enabled')} />
              <span>Receber pedidos pelo link</span>
            </label>

            <label className="booking-field">
              <span>Endereço do link</span>
              <div className="booking-slug">
                <span>{window.location.host}/agendar/</span>
                <input value={form.slug} onChange={updateForm('slug')} minLength={3} maxLength={40} required />
              </div>
            </label>

            <fieldset className="booking-field">
              <legend>Dias de atendimento</legend>
              <div className="booking-days">
                {WEEKDAYS.map((label, day) => (
                  <button key={label} type="button" aria-pressed={form.workDays.includes(day)} className={form.workDays.includes(day) ? 'active' : ''} onClick={() => toggleDay(day)}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="booking-grid">
              <label className="booking-field"><span>Abre às</span><input type="time" value={form.openTime} onChange={updateForm('openTime')} required /></label>
              <label className="booking-field"><span>Fecha às</span><input type="time" value={form.closeTime} onChange={updateForm('closeTime')} required /></label>
              <label className="booking-field">
                <span>Intervalo entre horários</span>
                <select value={form.slotMinutes} onChange={updateForm('slotMinutes')}>
                  {[30, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </label>
              <label className="booking-field"><span>Atendimentos simultâneos</span><input type="number" min="1" max="10" value={form.capacity} onChange={updateForm('capacity')} /></label>
              <label className="booking-field"><span>Antecedência mínima (horas)</span><input type="number" min="0" max="72" value={form.minLeadHours} onChange={updateForm('minLeadHours')} /></label>
              <label className="booking-field"><span>Agenda aberta por (dias)</span><input type="number" min="1" max="90" value={form.maxDaysAhead} onChange={updateForm('maxDaysAhead')} /></label>
            </div>

            <label className="booking-switch">
              <input type="checkbox" checked={form.showPrices} onChange={updateForm('showPrices')} />
              <span>Mostrar preço "a partir de" nos serviços</span>
            </label>

            <label className="booking-field">
              <span>Mensagem para o cliente (opcional)</span>
              <textarea rows={2} maxLength={300} value={form.message} onChange={updateForm('message')} placeholder="Ex.: Atendemos com hora marcada. Chegue 10 minutos antes." />
            </label>

            {configMessage ? <p className="booking-feedback" role="status">{configMessage}</p> : null}

            <button type="submit" className="booking-save" disabled={configState === 'saving'}>
              {configState === 'saving' ? <Loader2 size={16} className="booking-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Salvar configuração
            </button>
          </form>
        )}
      </section>
    </div>
  );
};

export default BookingRequests;
