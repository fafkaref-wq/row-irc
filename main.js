// Deno Deploy Global WebSocket IRC Server for RowProject
const clients = new Set();
const channel = new BroadcastChannel("row_irc_chat");

// Listen for messages broadcasted across any Deno edge servers
channel.onmessage = (event) => {
    const data = event.data;
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
};

Deno.serve((req) => {
    // Check if WebSocket upgrade request
    if (req.headers.get("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket(req);

        socket.onopen = () => {
            clients.add(socket);
            console.log(`[+] Client connected (local: ${clients.size})`);
        };

        socket.onmessage = (event) => {
            // 1. Send locally to other connected clients
            for (const client of clients) {
                if (client !== socket && client.readyState === WebSocket.OPEN) {
                    client.send(event.data);
                }
            }
            // 2. Broadcast globally across Deno network
            channel.postMessage(event.data);
        };

        socket.onclose = () => {
            clients.delete(socket);
            console.log(`[-] Client disconnected (local: ${clients.size})`);
        };

        socket.onerror = (err) => {
            console.error("Socket error:", err);
            clients.delete(socket);
        };

        return response;
    }

    // Health check endpoint
    return new Response(
        JSON.stringify({
            status: "online",
            server: "RowProject Deno IRC",
            clients_online: clients.size,
        }),
        {
            headers: { "Content-Type": "application/json" },
        }
    );
});
