require('dotenv').config();
const { createServer } = require("http");
const { Server } = require("socket.io");
const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 5000;

// Thêm route để Render kiểm tra service
app.get("/", (req, res) => {
    res.send("WebSocket Server is running!");
});

const httpServer = createServer(app); // Chạy Express server

const io = new Server(httpServer, {
    cors: { origin: "*" },
});

const playersQueue = [];
const matches = [];

io.on("connection", (socket) => {
    console.log("⚡ Client connected:", socket.id);

    socket.on("join_game", ({ playerName, avatar }) => {
        console.log(`🎮 Player ${playerName} (${socket.id}) joined the queue`);
        playersQueue.push({ id: socket.id, name: playerName, avatar });

        if (playersQueue.length >= 2) {
            const player1 = playersQueue.shift();
            const player2 = playersQueue.shift();
            const matchId = crypto.randomUUID();
            const newMatch = {
                matchID: matchId,
                player1,
                player2,
                board: Array(9).fill(null),
                currentPlayer: player1.id,
            };

            matches.push(newMatch);

            console.log(`🔥 Match started: ${player1.name} vs ${player2.name}`);

            io.to(player1.id).emit("match_found", { infoMatch: newMatch, isTurn: true, imgOpponent: player2.avatar });
            io.to(player2.id).emit("match_found", { infoMatch: newMatch, isTurn: false, imgOpponent: player1.avatar });
        }
    });

    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);

        const index = playersQueue.findIndex((p) => p.id === socket.id);
        if (index !== -1) {
            console.log(`🚫 Removing ${playersQueue[index].name} from queue`);
            playersQueue.splice(index, 1);
        }

        const matchIndex = matches.findIndex((m) => m.player1.id === socket.id || m.player2.id === socket.id);
        if (matchIndex !== -1) {
            const match = matches[matchIndex];
            const remainingPlayerId = match.player1.id === socket.id ? match.player2.id : match.player1.id;
            io.to(remainingPlayerId).emit("opponent_left");
            matches.splice(matchIndex, 1);
        }
    });
});

// Lắng nghe trên PORT do Render cung cấp
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WebSocket Server is running at http://localhost:${PORT}`);
});
