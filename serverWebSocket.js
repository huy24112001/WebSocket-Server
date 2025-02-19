require('dotenv').config();
const {createServer} = require("http");
const {Server} = require("socket.io");
const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("WebSocket Server is running!");
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {origin: "*"},
});

const playersQueue = [];
const matches = [];

io.on("connection", (socket) => {
    console.log("⚡ Client connected:", socket.id);

    socket.on("join_game", ({playerName, avatar}) => {
        const isDuplicate = playersQueue.some(player => player.id === socket.id || player.name === playerName);
        if (!isDuplicate) {
            console.log(`🎮 Player ${playerName} ${avatar} (${socket.id}) joined the queue`);
            playersQueue.push({id: socket.id, name: playerName, avatar: avatar});

            if (playersQueue.length >= 2) {
                const player1 = playersQueue.shift();
                const player2 = playersQueue.shift();
                const matchId = crypto.randomUUID();
                const newMatch = {
                    matchID: matchId,
                    player1: player1,
                    player2: player2,
                    board: Array(9).fill(null), // Bàn cờ 3x3
                    currentPlayer: player1.id // Người chơi bắt đầu
                };

                matches.push(newMatch);

                console.log(`🔥 Match started: ${player1.name} vs ${player2.name}`);

                io.to(player1.id).emit("match_found", {infoMatch: newMatch, isTurn: true, imgOpponent: player2.avatar});
                io.to(player2.id).emit("match_found", {
                    infoMatch: newMatch,
                    isTurn: false,
                    imgOpponent: player1.avatar
                });
            }
        }

    });

    socket.on("make_move", ({matchID, row, col}) => {
        const match = matches.find((m) => m.matchID === matchID);
        if (!match) {
            socket.emit("error", {message: "Trận đấu không tồn tại."});
            return;
        }

        if (socket.id !== match.player1.id && socket.id !== match.player2.id) {
            socket.emit("error", {message: "Bạn không thuộc trận đấu này."});
            return;
        }

        match.currentPlayer = socket.id === match.player1.id ? match.player2.id : match.player1.id;
        const isTurnP1 = match.currentPlayer === match.player1.id

        console.log(matchID + " " + row);

        io.to(match.player1.id).emit("move_made", {row: row, col: col, isTurn: isTurnP1});
        io.to(match.player2.id).emit("move_made", {row: row, col: col, isTurn: !isTurnP1});
    });

    socket.on("cancel_join_game", () => {
        console.log(`🎮 Player (${socket.id}) cancel join game`);
        const index = playersQueue.findIndex((p) => p.id === socket.id);
        if (index !== -1) {
            console.log(`🚫 Removing ${playersQueue[index].name} from queue`);
            playersQueue.splice(index, 1);
        }
        const matchIndex = matches.findIndex(
            (m) => m.player1.id === socket.id || m.player2.id === socket.id
        );
        if (matchIndex !== -1) {
            const match = matches[matchIndex];
            const remainingPlayerId = match.player1.id === socket.id ? match.player2.id : match.player1.id;
            io.to(remainingPlayerId).emit("opponent_left");
            matches.splice(matchIndex, 1);
        }
    });

    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WebSocket Server is running at http://localhost:${PORT}`);
});
