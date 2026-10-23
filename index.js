const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

// Koyeb automatically passes the PORT environment variable (default 8000)
const PORT = process.env.PORT || 8000;

// HTTP server for health checks (Koyeb pings / for health status)
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'online', clients: wss ? wss.clients.size : 0 }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

// WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

console.log(`[START] Row IRC WebSocket server starting on port ${PORT}...`);

wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[+] Client connected from ${ip} (Total online: ${wss.clients.size})`);

    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (data, isBinary) => {
        try {
            // Broadcast message to all connected clients
            for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data, { binary: isBinary });
                }
            }
        } catch (err) {
            console.error('[!] Error broadcasting message:', err);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[-] Client disconnected (code: ${code}) (Total online: ${wss.clients.size})`);
    });

    ws.on('error', (err) => {
        console.error('[!] Client error:', err);
    });
});

// Heartbeat keep-alive (every 25 seconds) to prevent Koyeb connection drops
const interval = setInterval(() => {
    for (const ws of wss.clients) {
        if (!ws.isAlive) {
            ws.terminate();
            continue;
        }
        ws.isAlive = false;
        ws.ping();
    }
}, 25000);

wss.on('close', () => {
    clearInterval(interval);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ONLINE] Server is listening on port ${PORT}`);
});
