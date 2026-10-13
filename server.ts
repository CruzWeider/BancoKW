import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { DEFAULT_BOARD_SPACES } from './src/data/defaultBoard';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

// ================= DETECÇÃO DE IP DA REDE LOCAL (WI-FI / LAN) =================
function getLocalNetworkIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  // Prioriza IPs típicos de rede local doméstica (192.168.x.x, 10.x.x.x, 172.x.x.x)
  ips.sort((a, b) => {
    const aScore = a.startsWith('192.168.') ? 3 : a.startsWith('10.') ? 2 : 1;
    const bScore = b.startsWith('192.168.') ? 3 : b.startsWith('10.') ? 2 : 1;
    return bScore - aScore;
  });

  return ips;
}

// ================= BANCO DE DADOS LOCAL (PERSISTÊNCIA EM DISCO) =================
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE_PATH = path.resolve(DATA_DIR, 'local_database.json');

interface LocalDatabaseFile {
  version: number;
  updatedAt: number;
  activeRoomId: string;
  roomCounter: number;
  activeState: any | null;
  rooms: any[];
  boardSpaces: any[];
  history: any[];
}

const DEFAULT_DB: LocalDatabaseFile = {
  version: 2,
  updatedAt: Date.now(),
  activeRoomId: 'SALA-001',
  roomCounter: 1,
  activeState: null,
  rooms: [],
  boardSpaces: DEFAULT_BOARD_SPACES,
  history: [],
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let memoryDbCache: LocalDatabaseFile | null = null;

function readLocalDb(): LocalDatabaseFile {
  if (memoryDbCache) return memoryDbCache;
  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const loaded: LocalDatabaseFile = { ...DEFAULT_DB, ...parsed };
      memoryDbCache = loaded;
      return loaded;
    }
  } catch (err) {
    console.error('Erro ao ler banco de dados local:', err);
  }
  const fallback: LocalDatabaseFile = { ...DEFAULT_DB };
  memoryDbCache = fallback;
  return fallback;
}

function writeLocalDb(data: Partial<LocalDatabaseFile>): LocalDatabaseFile {
  try {
    ensureDataDir();
    const current = readLocalDb();
    const updated: LocalDatabaseFile = {
      ...current,
      ...data,
      updatedAt: Date.now(),
    };
    memoryDbCache = updated;
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    broadcastSSE({ type: 'DB_UPDATE', payload: updated });
    return updated;
  } catch (err) {
    console.error('Erro ao salvar no banco de dados local:', err);
    return readLocalDb();
  }
}

// ================= SERVER-SENT EVENTS (TEMPO REAL NA MESMA REDE WI-FI) =================
const sseClients = new Set<express.Response>();

function broadcastSSE(message: any) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

let publicTunnelUrl: string | null = null;

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Envia o estado atual imediatamente ao conectar
  const currentDb = readLocalDb();
  res.write(`data: ${JSON.stringify({ type: 'DB_UPDATE', payload: currentDb })}\n\n`);
  if (publicTunnelUrl) {
    res.write(`data: ${JSON.stringify({ type: 'TUNNEL_READY', url: publicTunnelUrl })}\n\n`);
  }

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

function resolveEffectiveNetworkUrl(req: express.Request, primaryIp: string) {
  const localNetworkUrl = `http://${primaryIp}:${PORT}`;
  const forwardedHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || req.hostname;
  const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || (req.secure ? 'https' : 'http');
  const isCloudHost =
    Boolean(forwardedHost) &&
    !forwardedHost.includes('localhost') &&
    !forwardedHost.includes('127.0.0.1') &&
    !forwardedHost.startsWith('192.168.') &&
    !forwardedHost.startsWith('10.') &&
    !forwardedHost.startsWith('172.');
  const cloudUrl = isCloudHost ? `${forwardedProto}://${forwardedHost}` : null;
  const networkUrl = publicTunnelUrl || cloudUrl || localNetworkUrl;
  return { localNetworkUrl, cloudUrl, networkUrl };
}

// Informações da Rede Local e Link HTTPS Universal (para iPhone / Nuvem / qualquer celular)
app.get('/api/network-info', (req, res) => {
  const ips = getLocalNetworkIPs();
  const primaryIp = ips[0] || req.hostname || 'localhost';
  const { localNetworkUrl, cloudUrl, networkUrl } = resolveEffectiveNetworkUrl(req, primaryIp);
  res.json({
    port: PORT,
    ips,
    primaryIp,
    localNetworkUrl,
    publicTunnelUrl,
    cloudUrl,
    networkUrl,
  });
});

// Healthcheck
app.get('/api/health', (req, res) => {
  const ips = getLocalNetworkIPs();
  const primaryIp = ips[0] || req.hostname || 'localhost';
  const { networkUrl, cloudUrl } = resolveEffectiveNetworkUrl(req, primaryIp);
  res.json({
    status: 'ok',
    service: 'banco-imobiliario-digital',
    dbPath: DB_FILE_PATH,
    publicTunnelUrl,
    cloudUrl,
    networkUrl,
  });
});

// Obter todos os dados do Banco de Dados Local
app.get('/api/db', (_req, res) => {
  const db = readLocalDb();
  res.json(db);
});

// Sincronizar / Salvar dados no Banco de Dados Local
app.post('/api/db/sync', (req, res) => {
  try {
    const payload = req.body || {};
    const updated = writeLocalDb(payload);
    res.json({ success: true, updatedAt: updated.updatedAt, db: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao salvar no banco local', message: err?.message });
  }
});

// Cadastro atômico de jogador vindo de qualquer celular conectado na mesma rede
app.post('/api/players/register', (req, res) => {
  try {
    const { player } = req.body;
    if (!player || !player.id || !player.name) {
      return res.status(400).json({ error: 'Dados do jogador inválidos.' });
    }

    const currentDb = readLocalDb();
    if (!currentDb.activeState) {
      return res.status(400).json({ error: 'Nenhuma sala ativa no momento.' });
    }

    const existingPlayers = currentDb.activeState.players || [];
    const alreadyExists = existingPlayers.some((p: any) => p.id === player.id);

    const updatedPlayers = alreadyExists
      ? existingPlayers.map((p: any) => (p.id === player.id ? player : p))
      : [...existingPlayers, { ...player, balance: currentDb.activeState.initialBalance || player.balance }];

    const updatedActiveState = {
      ...currentDb.activeState,
      players: updatedPlayers,
    };

    // Atualiza também o registro da sala na lista de rooms
    const updatedRooms = (currentDb.rooms || []).map((r: any) =>
      r.roomId === updatedActiveState.roomId
        ? { ...r, players: updatedPlayers }
        : r
    );

    const updated = writeLocalDb({
      activeState: updatedActiveState,
      rooms: updatedRooms,
    });

    res.json({ success: true, activeState: updated.activeState, player });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao cadastrar jogador na rede', message: err?.message });
  }
});

// Limpar / Resetar Banco de Dados Local
app.post('/api/db/reset', (_req, res) => {
  try {
    const fresh: LocalDatabaseFile = {
      ...DEFAULT_DB,
      updatedAt: Date.now(),
    };
    ensureDataDir();
    memoryDbCache = fresh;
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(fresh, null, 2), 'utf-8');
    broadcastSSE({ type: 'DB_UPDATE', payload: fresh });
    res.json({ success: true, db: fresh });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao resetar banco local', message: err?.message });
  }
});

// Gemini AI Property Card Recognition Route
app.post('/api/parse-property-card', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Chave GEMINI_API_KEY não configurada no ambiente.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptText = `Você é um assistente especialista em jogos de tabuleiro imobiliários.
Analise minuciosamente a fotografia deste cartão de propriedade físico do jogo.
Identifique e extraia com exatidão todas as informações impressas no cartão:
1. Nome da propriedade/cidade no topo (ex: "ROMA", etc.)
2. CASA ($): custo de construção de 1 casa (ex: 30) -> houseCost
3. HOTEL ($): custo de construção de 1 hotel (ex: 60) -> hotelCost
4. ALUGUEL ($): valor do aluguel simples sem casas (ex: 20) -> baseRent
5. COM 1 CASA ($): valor do aluguel com 1 casa (ex: 60) -> rent1House
6. COM 2 CASAS ($): valor do aluguel com 2 casas (ex: 100) -> rent2Houses
7. COM HOTEL ($): valor do aluguel com hotel (ex: 160) -> rentHotel
8. HIPOTECA ($): valor da hipoteca (ex: 80) -> mortgageValue
9. Preço de compra (price): se não estiver impresso no cartão, retorne 0.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Nome oficial impresso no topo da carta física (ex: ROMA)' },
            price: { type: Type.NUMBER, description: 'Valor de compra da propriedade (0 se não estiver impresso na carta)' },
            houseCost: { type: Type.NUMBER, description: 'Valor impresso em CASA ($) - custo para construir casa' },
            hotelCost: { type: Type.NUMBER, description: 'Valor impresso em HOTEL ($) - custo para construir hotel' },
            baseRent: { type: Type.NUMBER, description: 'Valor impresso em ALUGUEL ($)' },
            rent1House: { type: Type.NUMBER, description: 'Valor impresso em COM 1 CASA ($)' },
            rent2Houses: { type: Type.NUMBER, description: 'Valor impresso em COM 2 CASAS ($)' },
            rentHotel: { type: Type.NUMBER, description: 'Valor impresso em COM HOTEL ($)' },
            mortgageValue: { type: Type.NUMBER, description: 'Valor impresso em HIPOTECA ($)' },
          },
          required: ['name', 'baseRent', 'rent1House', 'rent2Houses', 'rentHotel', 'houseCost', 'hotelCost', 'mortgageValue'],
        },
      },
    });

    const textOutput = response.text?.trim() || '{}';
    const parsedData = JSON.parse(textOutput);

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('Erro na rota /api/parse-property-card:', err);
    return res.status(500).json({
      error: 'Falha ao analisar a foto da carta com IA.',
      message: err?.message || 'Erro desconhecido',
    });
  }
});

function startCloudflareTunnel() {
  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const binPath = path.resolve(__dirname, binName);
  if (!fs.existsSync(binPath)) return;

  try {
    const child = spawn(binPath, ['tunnel', '--url', `http://localhost:${PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && match[0] && publicTunnelUrl !== match[0]) {
        publicTunnelUrl = match[0];
        console.log(`Link HTTPS Universal (iPhone / Qualquer Celular): ${publicTunnelUrl}`);
        broadcastSSE({ type: 'TUNNEL_READY', url: publicTunnelUrl });
      }
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);
    child.on('error', (err) => {
      console.warn('Aviso ao iniciar cloudflared:', err.message);
    });
  } catch (err) {
    console.warn('Não foi possível iniciar o túnel HTTPS:', err);
  }
}

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: true,
        allowedHosts: true,
        watch: {
          ignored: ['**/data/**', '**/local_database.json'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const ips = getLocalNetworkIPs();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    if (ips.length > 0) {
      console.log(`Acesso na Rede Local (Wi-Fi): http://${ips[0]}:${PORT}`);
    }
    startCloudflareTunnel();
  });
}

startServer();
