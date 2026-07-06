const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const dayjs = require('dayjs');
require('dayjs/locale/pt-br');

// Inicializa o Firebase Admin
admin.initializeApp();
dayjs.locale('pt-br');

const db = admin.firestore();

// CONFIGURAÇÃO DA API DE WHATSAPP
// A API_KEY será lida com segurança dos Secrets do Firebase
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://orquestracs.com:8080'; 
const WHATSAPP_INSTANCE = process.env.WHATSAPP_INSTANCE || 'Orquestra_Auto_Detail';

/**
 * Função para disparar a mensagem via Gateway
 * Agora preparada para receber configurações dinâmicas no futuro
 */
async function sendWhatsApp(to, message, config = {}) {
    const url = config.url || WHATSAPP_API_URL;
    const key = config.key || process.env.WHATSAPP_API_KEY;
    const instance = config.instance || WHATSAPP_INSTANCE;

    try {
        const cleanNumber = to.replace(/\D/g, '');
        console.log(`[WhatsApp] Enviando para ${cleanNumber} via ${instance}...`);
        
        const response = await axios.post(`${url}/message/sendText/${instance}`, {
            number: cleanNumber,
            text: message,
            linkPreview: true
        }, {
            headers: { 'apikey': key },
            timeout: 10000 // 10 segundos de timeout
        });
        
        console.log(`[WhatsApp] Sucesso ao enviar para ${cleanNumber}`);
        return response.data;
    } catch (error) {
        console.error(`[WhatsApp] Erro ao enviar para ${to}:`, error.response?.data || error.message);
        return null;
    }
}

/**
 * Função de TESTE MANUAL (HTTP)
 * Acesse a URL gerada no deploy para disparar os testes
 */
exports.testWhatsAppNow = functions.https.onRequest(async (req, res) => {
    try {
        const amanhã = dayjs().add(1, 'day').format('DD/MM/YYYY');
        console.log(`[TESTE] Executando disparo manual para: ${amanhã}`);

        const snapshot = await db.collection('agendamentos')
            .where('dataStr', '==', amanhã)
            .get();

        if (snapshot.empty) {
            return res.status(200).send(`Nenhum agendamento encontrado para amanhã (${amanhã}). Crie um agendamento no Firestore para testar.`);
        }

        let enviados = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const msg = `🧪 *TESTE DE AUTOMAÇÃO* 🧪\n\nOlá, *${data.cliente}*! Este é um teste do seu novo sistema de lembretes automáticos para amanhã às ${data.horario}.`;
            const success = await sendWhatsApp(data.telefone, msg);
            if (success) enviados++;
        }

        res.status(200).send(`Teste concluído! Agendamentos de amanhã: ${snapshot.size}. Mensagens enviadas: ${enviados}. Verifique os logs e o WhatsApp.`);
    } catch (error) {
        res.status(500).send(`Erro no teste: ${error.message}`);
    }
});

/**
 * Automação 1: Lembrete de Agendamento (24h antes)
 * Roda todos os dias às 18:00
 */
exports.scheduledAppointmentReminders = functions
    .runWith({ secrets: ['WHATSAPP_API_KEY'] })
    .pubsub
    .schedule('0 18 * * *') // Todo dia às 18:00
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        const amanha = dayjs().add(1, 'day').format('DD/MM/YYYY');
        console.log(`Buscando agendamentos para: ${amanha}`);

        const snapshot = await db.collection('agendamentos')
            .where('dataStr', '==', amanha)
            .where('status', 'not-in', ['Cancelado', 'Concluído'])
            .get();

        if (snapshot.empty) {
            console.log('Nenhum agendamento encontrado para amanhã.');
            return null;
        }

        const promises = snapshot.docs.map(async (doc) => {
            const data = doc.data();
            if (data.lembreteAutomotivoEnviado) return; // Evita duplicidade

            const msg = `Olá, *${data.cliente}*! 🚗✨\n\nPassando para confirmar seu serviço de *${data.servico}* agendado para amanhã, dia *${data.dataStr}* às *${data.horario}*.\n\nPodemos confirmar? Aguardamos você!`;

            const success = await sendWhatsApp(data.telefone, msg);
            if (success) {
                await doc.ref.update({ lembreteAutomotivoEnviado: true });
            }
        });

        await Promise.all(promises);
        console.log('Processamento de lembretes concluído.');
        return null;
    });

/**
 * Automação 2: Lembrete de Aniversário
 * Roda todos os dias às 09:00
 */
exports.scheduledBirthdayWishes = functions
    .runWith({ secrets: ['WHATSAPP_API_KEY'] })
    .pubsub
    .schedule('0 9 * * *') // Todo dia às 09:00
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        const hojeMesDia = dayjs().format('MM-DD');
        console.log(`Buscando aniversariantes do dia: ${hojeMesDia}`);

        const snapshot = await db.collection('clientes').get();

        const aniversariantes = snapshot.docs.filter(doc => {
            const data = doc.data();
            if (!data.dataAniversario) return false;
            return data.dataAniversario.endsWith(hojeMesDia);
        });

        if (aniversariantes.length === 0) {
            console.log('Nenhum aniversariante hoje.');
            return null;
        }

        const promises = aniversariantes.map(async (doc) => {
            const data = doc.data();
            const msg = `Parabéns, *${data.nome}*! 🎂🎉\n*FELIZ ANIVERSÁRIO!* 🥳🎊\n\nMuita saúde, paz, harmonia, sucesso e incontáveis realizações!!! Esperamos que no próximo ano, possamos mais uma vez celebrar muitas conquistas.\n\n— *Orquestra Auto Detail* 🚗✨`;

            await sendWhatsApp(data.telefone, msg);
        });

        await Promise.all(promises);
        console.log('Processamento de aniversários concluído.');
        return null;
    });



