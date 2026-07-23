const gameClient = {
    socket: null,
    playerName: "",
    phase: "LOBBY",
    playerState: "waiting",
    completionPercentage: 0,
    
    players: [],
    rowHeight: 40,
    buttonArea: null,

    // NEW: Animation loop tracking properties
    animationInterval: null,
    lastFrameTime: 0,

    init: function(engine, serverUrl, name) {
        this.engine = engine;
        this.playerName = name;
        if (this.socket) return; // Prevent multiple init from lobby when game restarts

        this.socket = new WebSocket(serverUrl);

        // FIX: Send the initial "want_to_play" message once the connection is open
        this.socket.addEventListener("open", () => {
            console.log("Connected to server. Sending join request...");
            this.socket.send(JSON.stringify({ 
                action: "want_to_play", 
                name: this.playerName 
            }));
        });

        this.socket.addEventListener("message", (event) => {
            const msg = JSON.parse(event.data);
            if (!msg) return;

            if (msg.type === "BROADCAST_STATE") {
                if (msg.phase === "PLAYING" && this.phase !== "WAITING_FOR_FINISH") {
                    this.setPhase(msg.phase); // ignore transition to PLAYING if we're waiting for finish to avoid UI glitches
                }
                this.updatePlayersList(msg.players);
                if (this.players.length === this.players.filter(p => p.state === "ready").length) {
                    // All players are ready
                    engine.startButton.visible = true;
                } else {
                    engine.startButton.visible = false;
                }

            } else if (msg.type === "GAME_STARTED") {
                this.playerState = "playing";
                this.completionPercentage = 0;
                this.engine.startGame();
            } else if (msg.type === "GAME_OVER" || msg.type === "LOBBY") {
                if (this.playerName === msg.winner) {
                    this.playerState = "winner";
                } else if (this.playerState !== "quit") {
                    this.playerState = "finished";
                }
                this.engine.stopGame(msg.winner);
                this.setPhase("LOBBY");
            }
        });
    },

    setPhase: function(phase) {
        this.phase = phase;
    },
    // NEW: Dedicated calculation step separate from drawing
    update: function() {
        const currentTime = performance.now();
        const duration = 500; // Animation window duration
        let activeAnimations = 0;

        this.players.forEach((player) => {
            if (player.animStart > 0) {
                activeAnimations++;
                const elapsed = currentTime - player.animStart;
                const t = Math.min(1, elapsed / duration);
                
                // Perform the linear interpolation calculation
                player.visualY = player.oldY + (player.targetY - player.oldY) * t;

                if (t >= 1) {
                    player.animStart = 0; // Lock it into place
                    player.visualY = player.targetY;
                }
            }
        });

    },

    updatePlayersList: function(incomingPlayers) {
        const currentTime = performance.now();
        
        // Sort incoming players by completion percentage descending
        incomingPlayers.sort((a, b) => b.progress - a.progress);

        this.players = incomingPlayers.map((player, index) => {
            // FIX: Ensure we match strictly against the static player name string
            const existing = this.players.find(p => p.name === player.name);
            const targetYOffset = index * this.rowHeight;

            let visualY = targetYOffset;
            let animStart = 0;
            let oldY = targetYOffset;

            if (existing) {
                visualY = existing.visualY;
                animStart = existing.animStart;
                oldY = existing.oldY;

                if (existing.targetY !== targetYOffset) {
                    oldY = existing.visualY;
                    animStart = currentTime;
                }
            }

            // Sync your local state cleanly with the server's ground truth
            if (player.name === this.playerName) {
                this.playerState = player.state;
            }

            return {
                name: player.name,
                state: player.state,
                progress: player.progress,
                time: player.time,
                visualY: visualY,
                targetY: targetYOffset,
                oldY: oldY,
                animStart: animStart
            };
        });
    },

    readyToPlay: function(isReady) {
        if (isReady)
            this.socket.send(JSON.stringify({ action: "ready_to_play" }));
        else
            this.socket.send(JSON.stringify({ action: "go_to_lobby" }));
    },
    joinGame: function(key) {
        this.socket.send(JSON.stringify({ action: "join_game" }));
    },
    startGame: function(key) {
        this.socket.send(JSON.stringify({ action: "start_game" }));
    },
    leaveLobby: function(key) {
        this.socket.send(JSON.stringify({ action: "player_quit" }));
        this.socket.close();
        this.returnToSinglePlayer();
    },
    playerQuit: function(key) {
        this.playerState = "quit";
        this.setPhase("WAITING_FOR_FINISH");
        this.socket.send(JSON.stringify({ action: "player_quit" }));
    },

    playerFinished: function() {
        this.playerState = "finished";
        this.setPhase("WAITING_FOR_FINISH");
        this.socket.send(JSON.stringify({ action: "player_finished" }));
    },

    gameFinished: function() {
        this.socket.send(JSON.stringify({ action: "game_finished" }));
    },

    returnToSinglePlayer: function() {
        console.log("Exited multiplayer mode");
        this.setPhase("LOBBY");
        this.playerState = "waiting";
        this.players = [];
    },

    // Simplified Draw Function: Now acts purely as a renderer
    draw: function(ctx, x, y, w, h) {

        const baseFontSize = Math.max(14, Math.floor(h / 12));
        const rosterStartY = y + baseFontSize * 2.5;
        const headerHeight = baseFontSize * 1.1;
        this.rowHeight = baseFontSize * 1.2;
        const neededHeight = (this.players.length+1) * this.rowHeight + headerHeight;

        ctx.fillStyle = "rgba(100, 0, 0, 0.75)";
        ctx.fillRect(x, y, w, neededHeight);
        
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold " + String(baseFontSize * 1.0) + "px sans-serif";
        let statusText = "Waiting for Players...";
        if (this.phase === "PLAYING") statusText = "Match in Progress";
        ctx.fillText(statusText, x + 20, y + headerHeight);


        this.update();
        this.players.forEach((player) => {
            const currentRenderY = rosterStartY + player.visualY;
            // Offset player text slightly to the right to make room for the checkbox
            const textOffsetX = this.phase === "LOBBY" ? 60 : 30;

            ctx.font = String(baseFontSize) + "px sans-serif";
            ctx.fillStyle = player.name === this.playerName ? "#4CAF50" : "#E0E0E0";

            const displayName = player.name + (player.state !== "playing" ? " (" + player.state + ")" : "");
            ctx.fillText(displayName, x + textOffsetX, currentRenderY);

            if (player.state === "playing") {
                const barX = x + w * 0.5;
                const barW = w * 0.4;
                ctx.fillStyle = player.name === this.playerName ? "#4CAF50" : "#2196F3";
                ctx.fillText(`${player.progress}%`, barX + barW / 2, currentRenderY);
            }else{
                if (player.time) {
                    const barX = x + w * 0.5;
                    const barW = w * 0.4;
                    ctx.fillStyle = player.name === this.playerName ? "#4CAF50" : "#2196F3";
                    ctx.fillText(`${player.time/1000} s`, barX + barW / 2, currentRenderY);
                }
            }
        });

    },

    sendProgressUpdate: function(percentage) {
        if (this.phase === "PLAYING" && this.playerState === "playing") {
            this.completionPercentage = percentage;
            this.socket.send(JSON.stringify({
                action: "update_progress",
                progress: percentage
            }));
        }
    }
};