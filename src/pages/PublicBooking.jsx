import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Car, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { createBookingRequest, getPublicAvailability, getPublicBookingInfo } from '../services/bookingService';
import { todayDate } from '../lib/agenda';
import './PublicBooking.css';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function maskPhone(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskPlate(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}h` : '', m ? `${m}min` : ''].filter(Boolean).join(' ');
}

const currency = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PublicBooking = ({ slug }) => {
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsState, setSlotsState] = useState('idle'); // idle | loading | ready | error
  const [time, setTime] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', vehicle: '', plate: '', notes: '', website: '', consent: false });
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(null);

  const today = todayDate();

  useEffect(() => {
    document.title = 'Agendar serviço';
    getPublicBookingInfo(slug)
      .then((data) => {
        setInfo(data);
        document.title = `Agendar · ${data.companyName}`;
      })
      .catch((error) => setLoadError(error.message));
  }, [slug]);

  useEffect(() => {
    setTime('');
    if (!serviceId || !date) {
      setSlots([]);
      setSlotsState('idle');
      return undefined;
    }
    let active = true;
    setSlotsState('loading');
    getPublicAvailability(slug, serviceId, date)
      .then((data) => {
        if (!active) return;
        setSlots(data.slots || []);
        setSlotsState('ready');
      })
      .catch(() => active && setSlotsState('error'));
    return () => { active = false; };
  }, [slug, serviceId, date]);

  const service = useMemo(() => info?.services.find((s) => s.id === serviceId), [info, serviceId]);
  const maxDate = info ? addDays(today, info.maxDaysAhead) : '';
  const closedDay = date && info && !info.workDays.includes(new Date(`${date}T12:00:00`).getDay());

  const update = (field) => (e) => {
    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (field === 'phone') value = maskPhone(value);
    if (field === 'plate') value = maskPlate(value);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!service || !date || !time) {
      setSubmitError('Escolha o serviço, a data e o horário.');
      return;
    }
    setSending(true);
    try {
      const result = await createBookingRequest({ slug, serviceId, date, time, ...form });
      setDone({ protocol: result.protocol, service: service.nome, date, time });
    } catch (error) {
      setSubmitError(error.message);
      // Horário pode ter sido ocupado: recarrega a lista.
      if (date && serviceId) getPublicAvailability(slug, serviceId, date).then((d) => setSlots(d.slots || [])).catch(() => undefined);
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <main className="pb-page">
        <section className="pb-card pb-center" role="alert">
          <CalendarCheck size={36} aria-hidden="true" />
          <h1>Agendamento indisponível</h1>
          <p>{loadError} Fale diretamente com a empresa para agendar.</p>
        </section>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="pb-page">
        <section className="pb-card pb-center" aria-busy="true">
          <Loader2 className="pb-spin" size={28} aria-hidden="true" />
          <p>Carregando agenda…</p>
        </section>
      </main>
    );
  }

  if (done) {
    return (
      <main className="pb-page">
        <section className="pb-card pb-center" role="status">
          <CheckCircle2 size={44} className="pb-success-icon" aria-hidden="true" />
          <h1>Pedido enviado!</h1>
          <p>
            <strong>{done.service}</strong><br />
            {formatDate(done.date)} às {done.time}
          </p>
          <p>A equipe da <strong>{info.companyName}</strong> vai confirmar o horário pelo WhatsApp. O agendamento só vale depois dessa confirmação.</p>
          {done.protocol ? <p className="pb-muted">Protocolo: {done.protocol}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="pb-page">
      <header className="pb-header">
        <p className="pb-eyebrow">Agendamento online</p>
        <h1>{info.companyName}</h1>
        <p className="pb-muted">
          Atendimento de {info.workDays.map((d) => WEEKDAYS[d]).join(', ')}, das {info.openTime} às {info.closeTime}.
        </p>
        {info.message ? <p className="pb-message">{info.message}</p> : null}
      </header>

      <form className="pb-card" onSubmit={handleSubmit} noValidate>
        <fieldset className="pb-step">
          <legend><span className="pb-step-number">1</span> Serviço</legend>
          {info.services.length === 0 ? (
            <p className="pb-muted">Nenhum serviço disponível para agendamento online no momento.</p>
          ) : (
            <div className="pb-services">
              {info.services.map((s) => (
                <label key={s.id} className={`pb-service ${serviceId === s.id ? 'selected' : ''}`}>
                  <input type="radio" name="service" value={s.id} checked={serviceId === s.id} onChange={() => setServiceId(s.id)} />
                  <span className="pb-service-name">{s.nome}</span>
                  <span className="pb-service-meta">
                    <Clock size={14} aria-hidden="true" /> {formatDuration(s.duracaoMinutos)}
                    {s.precoAPartirDe != null ? <> · a partir de {currency(s.precoAPartirDe)}</> : null}
                  </span>
                  {s.descricao ? <span className="pb-service-desc">{s.descricao}</span> : null}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="pb-step" disabled={!serviceId}>
          <legend><span className="pb-step-number">2</span> Data e horário</legend>
          <label className="pb-field">
            <span>Data</span>
            <input type="date" value={date} min={today} max={maxDate} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <div className="pb-slots" aria-live="polite">
            {slotsState === 'idle' && <p className="pb-muted">Escolha o serviço e a data para ver os horários livres.</p>}
            {slotsState === 'loading' && <p className="pb-muted"><Loader2 className="pb-spin" size={16} aria-hidden="true" /> Buscando horários…</p>}
            {slotsState === 'error' && <p className="pb-error">Não foi possível carregar os horários. Tente outra data.</p>}
            {slotsState === 'ready' && slots.length === 0 && (
              <p className="pb-muted">{closedDay ? 'Não há atendimento neste dia.' : 'Sem horários livres nesta data. Tente outro dia.'}</p>
            )}
            {slotsState === 'ready' && slots.length > 0 && (
              <div className="pb-slot-grid" role="radiogroup" aria-label="Horários disponíveis">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    role="radio"
                    aria-checked={time === slot}
                    className={`pb-slot ${time === slot ? 'selected' : ''}`}
                    onClick={() => setTime(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="pb-step" disabled={!time}>
          <legend><span className="pb-step-number">3</span> Seus dados</legend>
          <label className="pb-field">
            <span>Nome completo</span>
            <input type="text" value={form.name} onChange={update('name')} autoComplete="name" maxLength={80} required />
          </label>
          <label className="pb-field">
            <span>WhatsApp com DDD</span>
            <input type="tel" inputMode="numeric" value={form.phone} onChange={update('phone')} autoComplete="tel-national" placeholder="(11) 98888-7777" required />
          </label>
          <div className="pb-row">
            <label className="pb-field">
              <span><Car size={14} aria-hidden="true" /> Modelo do veículo</span>
              <input type="text" value={form.vehicle} onChange={update('vehicle')} maxLength={80} placeholder="Ex.: Onix 2020" required />
            </label>
            <label className="pb-field">
              <span>Placa (opcional)</span>
              <input type="text" value={form.plate} onChange={update('plate')} placeholder="ABC1D23" autoCapitalize="characters" />
            </label>
          </div>
          <label className="pb-field">
            <span>Observações (opcional)</span>
            <textarea value={form.notes} onChange={update('notes')} maxLength={300} rows={2} />
          </label>
          {/* Campo-armadilha contra robôs: invisível para pessoas. */}
          <label className="pb-honeypot" aria-hidden="true">
            Site
            <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={update('website')} />
          </label>
          <label className="pb-consent">
            <input type="checkbox" checked={form.consent} onChange={update('consent')} required />
            <span>
              Concordo que <strong>{info.companyName}</strong> use meu nome, WhatsApp e dados do veículo
              somente para confirmar e realizar este agendamento.
            </span>
          </label>
        </fieldset>

        {submitError ? <p className="pb-error" role="alert">{submitError}</p> : null}

        <button className="pb-submit" type="submit" disabled={sending || !time || !form.consent}>
          {sending ? <><Loader2 className="pb-spin" size={18} aria-hidden="true" /> Enviando…</> : 'Solicitar agendamento'}
        </button>
        <p className="pb-muted pb-small">O horário fica reservado até a empresa confirmar pelo WhatsApp.</p>
      </form>
    </main>
  );
};

export default PublicBooking;
