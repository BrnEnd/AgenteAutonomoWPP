const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { generateGroqResponse } = require('../ai/groq');
const {
  upsertSession,
  updateSessionStatus,
  recordMessage,
  recordEvent,
  updateSessionContext
} = require('../db/repository');

class WhatsAppSession {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.displayName = options.displayName || sessionId;
    this.context = options.context || null;
    this.baseTokensPath = options.baseTokensPath || path.resolve('tokens');
    this.tokensPath = path.join(this.baseTokensPath, sessionId);
    this.autoRestart = options.autoRestart !== undefined ? options.autoRestart : true;
    this.logger = options.logger || pino({ level: options.logLevel || 'info', name: `session-${sessionId}` });

    this.sock = null;
    this.qrCodeData = null;
    this.isConnected = false;
    this.status = 'created';
    this.reconnectTimer = null;
    this.authState = null;
    this.saveCreds = null;

    this.handleConnectionUpdate = this.handleConnectionUpdate.bind(this);
    this.handleCredsUpdate = this.handleCredsUpdate.bind(this);
    this.handleMessagesUpsert = this.handleMessagesUpsert.bind(this);
  }

  async start() {
    this.logger.info('[START] Iniciando sessão...');
    await this.ensureTokensFolder();
    await this.initializeAuthState();

    this.status = 'starting';
    await upsertSession({
      sessionId: this.sessionId,
      displayName: this.displayName,
      context: this.context,
      status: this.status,
      tokensPath: this.tokensPath,
      autoRestart: this.autoRestart
    });

    await this.createSocket();
  }

  async ensureTokensFolder() {
    if (!fs.existsSync(this.tokensPath)) {
      fs.mkdirSync(this.tokensPath, { recursive: true });
      this.logger.debug('[TOKENS] Pasta criada:', this.tokensPath);
    }
  }

  async initializeAuthState() {
    const { state, saveCreds } = await useMultiFileAuthState(this.tokensPath);
    this.authState = state;
    this.saveCreds = saveCreds;
  }

  async createSocket() {
    if (this.sock) {
      this.cleanupSocket();
    }

    if (!this.authState || !this.saveCreds) {
      await this.initializeAuthState();
    }

    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      auth: this.authState,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      version,
      browser: ['Chrome (Linux)', 'Chrome', '121.0.0.0'],
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      qrTimeout: 60000,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      getMessage: async () => undefined
    });

    this.sock.ev.on('connection.update', this.handleConnectionUpdate);
    this.sock.ev.on('creds.update', this.handleCredsUpdate);
    this.sock.ev.on('messages.upsert', this.handleMessagesUpsert);

    await updateSessionStatus(this.sessionId, 'starting');
  }

  cleanupSocket() {
    if (!this.sock) return;

    this.sock.ev.off('connection.update', this.handleConnectionUpdate);
    this.sock.ev.off('creds.update', this.handleCredsUpdate);
    this.sock.ev.off('messages.upsert', this.handleMessagesUpsert);

    if (this.sock.end) {
      this.sock.end();
    }

    this.sock = null;
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.qrCodeData = qr;
      this.status = 'waiting_qr';
      this.logger.info('[QR] Novo QR Code gerado.');
      qrcode.generate(qr, { small: true });
      await updateSessionStatus(this.sessionId, this.status, { last_qr: qr });
      await recordEvent({
        sessionId: this.sessionId,
        type: 'qr_generated',
        payload: { timestamp: new Date().toISOString() }
      });
    }

    if (!connection) {
      return;
    }

    this.logger.debug('[CONNECTION] Update:', connection);

    if (connection === 'open') {
      this.isConnected = true;
      this.status = 'connected';
      this.qrCodeData = null;

      await updateSessionStatus(this.sessionId, this.status, { last_qr: null });
      await recordEvent({
        sessionId: this.sessionId,
        type: 'connected',
        payload: { timestamp: new Date().toISOString() }
      });

      this.logger.info('[STATUS] Sessão conectada ao WhatsApp.');
    }

    if (connection === 'close') {
      this.isConnected = false;
      this.status = 'disconnected';
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      await updateSessionStatus(this.sessionId, this.status);
      await recordEvent({
        sessionId: this.sessionId,
        type: 'connection_closed',
        payload: {
          statusCode,
          message: lastDisconnect?.error?.message,
          timestamp: new Date().toISOString()
        }
      });

      this.logger.warn('[STATUS] Conexão encerrada.', statusCode);

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        this.logger.warn('[STATUS] Sessão desconectada permanentemente. Limpando tokens...');
        this.clearTokens();
        await updateSessionStatus(this.sessionId, 'awaiting_qr');
        if (this.autoRestart) {
          this.scheduleReconnect(3000);
        }
        return;
      }

      if (shouldReconnect && this.autoRestart) {
        this.scheduleReconnect(5000);
      }
    }

    if (connection === 'connecting') {
      this.status = 'connecting';
      await updateSessionStatus(this.sessionId, this.status);
      this.logger.info('[STATUS] Conectando ao WhatsApp...');
    }
  }

  scheduleReconnect(delayMs) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.logger.info(`[STATUS] Reagendando conexão em ${delayMs / 1000}s`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.logger.info('[STATUS] Tentando reconectar sessão...');
      try {
        await this.createSocket();
      } catch (error) {
        this.logger.error('[STATUS] Falha ao reconectar:', error.message);
        await recordEvent({
          sessionId: this.sessionId,
          type: 'reconnect_failed',
          payload: { error: error.message, timestamp: new Date().toISOString() }
        });
        if (this.autoRestart) {
          this.scheduleReconnect(10000);
        }
      }
    }, delayMs);
  }

  async handleCredsUpdate() {
    if (!this.saveCreds) return;
    await this.saveCreds();
    this.logger.debug('[CREDS] Credenciais salvas.');
  }

  async handleMessagesUpsert({ messages, type }) {
    if (type !== 'notify' || !Array.isArray(messages)) return;

    for (const msg of messages) {
      try {
        const remoteJid = msg.key?.remoteJid;

        if (!remoteJid || msg.key.fromMe || remoteJid.includes('@g.us')) continue;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (!text.trim()) continue;

        const sender = remoteJid;

        this.logger.info(`[MESSAGE] Mensagem recebida de ${sender}: ${text}`);

        await recordMessage({
          sessionId: this.sessionId,
          direction: 'incoming',
          remoteJid: sender,
          body: text,
          metadata: { messageId: msg.key.id }
        });

        await this.sock.sendPresenceUpdate('composing', sender);

        const respostaIA = await generateGroqResponse({
          userMessage: text,
          context: this.context,
          logger: this.logger
        });

        await this.sock.sendMessage(sender, { text: respostaIA });

        await recordMessage({
          sessionId: this.sessionId,
          direction: 'outgoing',
          remoteJid: sender,
          body: respostaIA,
          metadata: { inResponseTo: msg.key.id }
        });

        await this.sock.sendPresenceUpdate('paused', sender);
      } catch (error) {
        this.logger.error('[MESSAGE] Erro ao processar mensagem:', error.message);

        await recordEvent({
          sessionId: this.sessionId,
          type: 'message_error',
          payload: { error: error.message, timestamp: new Date().toISOString() }
        });

        try {
          const fallbackJid = msg?.key?.remoteJid;
          if (!fallbackJid) continue;

          await this.sock.sendMessage(fallbackJid, {
            text: 'Desculpe, ocorreu um erro. Tente novamente.'
          });
        } catch (sendError) {
          this.logger.error('[MESSAGE] Falha ao enviar mensagem de erro:', sendError.message);
        }
      }
    }
  }

  async sendMessage(remoteJid, message) {
    if (!this.sock || !this.isConnected) {
      throw new Error('Sessão não está conectada.');
    }

    await this.sock.sendMessage(remoteJid, { text: message });

    await recordMessage({
      sessionId: this.sessionId,
      direction: 'outgoing',
      remoteJid,
      body: message,
      metadata: { triggeredBy: 'api' }
    });
  }

  async stop({ removeTokens = false } = {}) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (error) {
        this.logger.warn('[STOP] Falha ao fazer logout:', error.message);
      }
      this.cleanupSocket();
    }

    if (removeTokens) {
      this.clearTokens();
    }

    this.isConnected = false;
    this.status = 'stopped';
    await updateSessionStatus(this.sessionId, this.status);

    await recordEvent({
      sessionId: this.sessionId,
      type: 'stopped',
      payload: { removeTokens }
    });

    this.logger.info('[STOP] Sessão encerrada.');
  }

  clearTokens() {
    if (!fs.existsSync(this.tokensPath)) return;

    fs.rmSync(this.tokensPath, { recursive: true, force: true });
    this.authState = null;
    this.saveCreds = null;
  }

  getStatus() {
    return {
      sessionId: this.sessionId,
      displayName: this.displayName,
      status: this.status,
      connected: this.isConnected,
      hasQR: Boolean(this.qrCodeData),
      tokensPath: this.tokensPath,
      context: this.context,
      autoRestart: this.autoRestart
    };
  }

  getQr() {
    if (this.isConnected) {
      return { message: 'Sessão já conectada.', connected: true };
    }

    if (!this.qrCodeData) {
      return { message: 'QR Code ainda não disponível.', connected: false };
    }

    return { qr: this.qrCodeData, connected: false };
  }

  async setContext(context) {
    this.context = context;
    await updateSessionContext(this.sessionId, context);
  }
}

module.exports = WhatsAppSession;
