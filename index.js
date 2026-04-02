const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const bot = new TelegramBot(TOKEN, { polling: true });

let ultimoValor = null;
let historial = [];

async function obtenerDolar() {
  try {
    const { data } = await axios.get('https://www.bna.com.ar/Personas', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.bna.com.ar/',
      }
    });
    const $ = cheerio.load(data);
    
    let compra = null;
    let venta = null;

    $('table tr').each((i, row) => {
      const cols = $(row).find('td');
      const texto = $(cols[0]).text().trim();
      if (texto.includes('Dólar') || texto.includes('Dolar') || texto.includes('U.S.A')) {
        compra = $(cols[1]).text().trim();
        venta = $(cols[2]).text().trim();
      }
    });

    console.log('Compra:', compra, 'Venta:', venta);
    return { compra, venta };
  } catch (err) {
    console.error('Error scraping BNA:', err.message);
    return null;
  }
}

async function verificar() {
  const datos = await obtenerDolar();
  if (!datos || !datos.venta) return;

  const valorActual = `${datos.compra}|${datos.venta}`;
  const ahora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  if (valorActual !== ultimoValor) {
    ultimoValor = valorActual;

    historial.push({ compra: datos.compra, venta: datos.venta, hora: ahora });
    if (historial.length > 10) historial.shift();

    const msg = `💵 *Dólar BNA actualizado*\n\n🟢 Compra: $${datos.compra}\n🔴 Venta: $${datos.venta}\n🕐 Hora: ${ahora}`;
    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
    console.log('Cambio detectado, mensaje enviado.');
  } else {
    console.log('Sin cambios:', valorActual);
  }
}

// Comando /dolar
bot.onText(/\/dolar/, async (msg) => {
  const datos = await obtenerDolar();
  if (!datos || !datos.venta) {
    bot.sendMessage(msg.chat.id, '❌ No pude obtener el valor del dólar. Intentá de nuevo.');
    return;
  }
  const ahora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const resp = `💵 *Dólar BNA ahora*\n\n🟢 Compra: $${datos.compra}\n🔴 Venta: $${datos.venta}\n🕐 Hora: ${ahora}`;
  bot.sendMessage(msg.chat.id, resp, { parse_mode: 'Markdown' });
});

// Comando /historial
bot.onText(/\/historial/, (msg) => {
  if (historial.length === 0) {
    bot.sendMessage(msg.chat.id, '📭 Todavía no hay cambios registrados en esta sesión.');
    return;
  }
  let texto = '📊 *Últimos cambios del día:*\n\n';
  historial.forEach((h, i) => {
    texto += `${i + 1}. 🕐 ${h.hora} — Compra: $${h.compra} | Venta: $${h.venta}\n`;
  });
  bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
});

// Comando /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '👋 *Bot Dólar BNA activo!*\n\nComandos disponibles:\n/dolar — Ver valor actual\n/historial — Ver últimos cambios', { parse_mode: 'Markdown' });
});

console.log('Bot iniciado. Verificando cada 5 minutos...');
verificar();
setInterval(verificar, 5 * 60 * 1000);
