# Session Handover - Orquestra Auto Detail

## Estado atual (branch `feat/agenda-seguranca-local`, ainda não publicada)

### Feito localmente
1. **Automações de WhatsApp (functions/)**
   - Removido o endpoint público `testWhatsAppNow`, que disparava envios sem autenticação.
   - Gateway exige `WHATSAPP_API_URL` em HTTPS. Sem URL HTTPS ou sem `WHATSAPP_API_KEY`, nada é enviado (falha fechada).
   - Telefones aparecem mascarados nos logs.
   - Lembretes e aniversários agora leem `tenants/{id}/appData/main`. Antes consultavam coleções raiz que não existem, então não encontravam nada.
   - Envios registrados em `tenants/{id}/reminderLog` para não repetir mensagem. A coleção é só do servidor (regras do Firestore).
   - Tenants arquivados não recebem automações.
   - Regras puras em `functions/automationRules.js`, com testes em `automationRules.test.js`.

2. **Agenda (src/)**
   - Lógica de conflito e duração portada do Orquestra One em `src/lib/agenda.js`, com testes em `agenda.test.js`.
   - Formulário de agendamento e disponibilidade do pátio usam a mesma regra.
   - Conflito considera responsável quando informado (sem responsável, vale para a equipe toda).
   - Rótulo do painel corrigido: "Confirmados" (antes dizia "Concluídos").

3. **UX e mobile**
   - Cabeçalho de agenda e botões com área de toque mínima de 44px.
   - Assistente de ajuda começa minimizado em telas até 768px.
   - Título da marca no cabeçalho não quebra no celular.
   - Foco visível e respeito a `prefers-reduced-motion`.

### Pendente (não feito)
- **Migrar agenda para subcoleção por tenant.** Hoje tudo fica num documento só (`appData/main`), com limite de 1 MiB e risco de conflito entre dispositivos. Exige revisão das regras e migração de dados reais. Só com aprovação explícita.
- **Agendamento pelo cliente (app público).** Depende do repositório do Orquestra Studio e da decisão sobre como o cliente se identifica.
- **Campo de responsável** no formulário, para ativar o conflito por profissional.
- **Provedor de WhatsApp.** Z-API ou Evolution ainda não definido.
- **Deploy e publicação.** Nada foi enviado para produção nem feito push.

### Como validar
- `npm run lint` mantém 284 erros, igual à linha de base (o projeto já tinha esses erros antes).
- `npx vite build` passa.
- `node --test src/lib/agenda.test.js` (9 testes).
- `cd functions && npm test` (18 testes).

## Ao retomar
Leia este arquivo e depois `functions/index.js`, `functions/automationRules.js` e `src/lib/agenda.js`.
