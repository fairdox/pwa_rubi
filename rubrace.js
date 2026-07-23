const designWidth = 390;
const designHeight = 797;
const CHECKED = '☑';
const UNCHECKED = '☐';

class RubRace {
    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = designWidth;
        this.canvas.height = designHeight;
        this.ctx = canvas.getContext('2d');

        this.colors = {
            'R': '#B71234',
            'O': '#FF5800',
            'Y': '#FFD500',
            'G': '#009B48',
            'B': '#0046AD',
            'W': '#FFFFFF'
        };



        this.highScores = [];
        this.startTime = 0;
        this.elapsedTime = 0; // in milliseconds

        this.targetPattern = [];
        this.playerBoard = [];
        this.emptyPos = { row: -1, col: -1 };
        this.multiplayer = false;
        this.loadHighScores();
        this.initGame();

        window.addEventListener('resize', () => this.resize());
        this.keyHelper = new KeyHelper(canvas);
        this.setupTouchHandlers(this, canvas, this.keyHelper);
        this.setupMouseHandlers(this, canvas, this.keyHelper);
        this.resize();
        this.quitButton=this.keyHelper.addKey({
            label: 'Quit',
            x: designWidth - 110,
            y: 0,
            width: 100,
            visible: false,
            callback: () => {this.quitGame();}
        });
        this.readyButton=this.keyHelper.addKey({
            label: UNCHECKED,
            text: 'Ready to play:',
            isToggle: true,
            x: designWidth - 110,
            y: 150,
            width: 30,
            visible: false,
            callback: () => {this.readyToPlay(); }
        });
        this.startButton=this.keyHelper.addKey({
            label: 'Start Game',
            x: designWidth - 110,
            y: 180,
            width: 100,
            visible: false,
            callback: () => {gameClient.startGame(); }
        });

    }

    changeReadyButtonVisibility(visible) {
        if (visible) {
            this.readyButton.visible = true;
        } else {
            this.readyButton.visible = false;
        }
    }

    readyToPlay() {
        if (this.readyButton.label === UNCHECKED)
            gameClient.readyToPlay(true);
        else
            gameClient.readyToPlay(false);
    }


    setupTouchHandlers(engine, canvas, keyHelper) {

        // Helper to extract the first touch point's coordinates safely
        function getTouchCoords(event) {
            if (event.touches && event.touches.length > 0) {
                return {
                    clientX: event.touches[0].clientX,
                    clientY: event.touches[0].clientY
                };
            } else if (event.changedTouches && event.changedTouches.length > 0) {
                // For touchend/touchcancel, the touch that left the screen is in changedTouches
                return {
                    clientX: event.changedTouches[0].clientX,
                    clientY: event.changedTouches[0].clientY
                };
            }
            return null;
        }

        // 1. Handle Press Down (Triggers the 3D button depression)
        canvas.addEventListener('touchstart', function(e) {
            // Prevent default browser behavior like scrolling or zooming on mobile
            e.preventDefault(); 
            
            const coords = getTouchCoords(e);
            if (coords) {
                keyHelper.onPressDown(coords.clientX, coords.clientY);
            }
            engine.handleTouch(e);
        }, { passive: false });

        // 2. Handle Release/Tap (Executes callbacks and updates toggle state)
        canvas.addEventListener('touchend', function(e) {
            e.preventDefault();
            
            const coords = getTouchCoords(e);
            if (coords) {
                // onTap returns the key object if hit, or null if tapped outside
                const pressedKey = keyHelper.onTap(coords.clientX, coords.clientY);
                
                if (pressedKey) {
                    console.log(`Key interacted: ${pressedKey.label} (ID: ${pressedKey.id})`);
                }
            }
        }, { passive: false });

        // 3. Handle Cancel (Safely resets button state if a gesture interrupts the app)
        canvas.addEventListener('touchcancel', function(e) {
            e.preventDefault();
            keyHelper.onPressCancel();
        }, { passive: false });
    }

    setupMouseHandlers(engine, canvas, keyHelper) {
        canvas.addEventListener('mousedown', function(e) {
            keyHelper.onPressDown(e.clientX, e.clientY);
            engine.handleTouch(e);
        });

        canvas.addEventListener('mouseup', function(e) {
            keyHelper.onTap(e.clientX, e.clientY);
        });

        canvas.addEventListener('mouseleave', function(e) {
            keyHelper.onPressCancel();
    });
}

    init(multiplayer = false, serverUrl = null, playerName = null) {
        this.multiplayer = multiplayer;
        this.serverUrl = serverUrl;
        this.playerName = playerName;
        gameClient.init(this, this.serverUrl, this.playerName);
        gameClient.setPhase('START_MENU');
        this.draw();
    }

    initGame() {
        const colorKeys = Object.keys(this.colors);
        let tilePool = [];
        colorKeys.forEach(color => {
            for (let i = 0; i < 4; i++) {
                tilePool.push(color);
            }
        });

        this.shuffleArray(tilePool);

        const emptyIndex = Math.floor(Math.random() * 25);
        let poolIndex = 0;

        this.playerBoard = [];
        for (let r = 0; r < 5; r++) {
            let row = [];
            for (let c = 0; c < 5; c++) {
                if (r * 5 + c === emptyIndex) {
                    row.push(null);
                    this.emptyPos = { row: r, col: c };
                } else {
                    row.push(tilePool[poolIndex++]);
                }
            }
            this.playerBoard.push(row);
        }

        this.generateTargetPattern();
    }

    generateTargetPattern() {
        let flatBoard = [];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.playerBoard[r][c] !== null) {
                    flatBoard.push(this.playerBoard[r][c]);
                }
            }
        }
        this.shuffleArray(flatBoard);

        this.targetPattern = [];
        let index = 0;
        for (let r = 0; r < 3; r++) {
            let row = [];
            for (let c = 0; c < 3; c++) {
                row.push(flatBoard[index++]);
            }
            this.targetPattern.push(row);
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    startLobby() {
        this.initGame();
        gameClient.setPhase('LOBBY');
        this.quitButton.visible = false;
        this.changeReadyButtonVisibility(true)
        this.startButton.visible = false;
    }


    startGame() {
        this.initGame();
        gameClient.setPhase('PLAYING');
        this.winnerName = null;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.quitButton.visible = true;
        this.changeReadyButtonVisibility(false);
        this.startButton.visible = false;
        this.drawSquareGameArea();
    }

    quitGame() {
        if (this.multiplayer) {
            gameClient.playerQuit();
            // this.startLobby();
        } else {
            gameClient.setPhase('START_MENU');
            this.loadHighScores();
        }
        this.quitButton.visible = false;
        this.changeReadyButtonVisibility(true);
        this.startButton.visible = false;

    }

    // called by gameClient when server declares the winner
    stopGame(winner_name) {
        if (this.multiplayer) {98
            gameClient.setPhase('GAME_OVER');
            this.winnerName = winner_name;
            this.quitButton.visible = false;
            this.changeReadyButtonVisibility(true);
            this.readyToPlay();
        } else {
            gameClient.setPhase('GAME_OVER');
        }
        this.saveScore(this.elapsedTime);
    }

    updateCompletionPercentage() {
        if (!this.multiplayer)  return;
        let matchingTiles = 0;
        const totalTiles = 9;

        // Iterate through the 3x3 target pattern
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                // The target maps to the inner center of the 5x5 player board (offset by 1)
                const playerTile = this.playerBoard[r + 1][c + 1];
                const targetTile = this.targetPattern[r][c];

                if (playerTile === targetTile) {
                    matchingTiles++;
                }
            }
        }

        // Calculate the percentage and round it to the nearest whole number
        if (gameClient && typeof gameClient.sendProgressUpdate === "function") {
            gameClient.sendProgressUpdate(Math.round((matchingTiles / totalTiles) * 100));
            if (matchingTiles >2) {
                gameClient.playerFinished();
            }
        }
    }

    loadHighScores() {
        const data = localStorage.getItem('rubrace_highscores');
        this.highScores = data ? JSON.parse(data) : [];
    }

    quitMultiplayer() {
        gameClient.setPhase('START_MENU');
    }

    saveScore(ms) {
        const formattedTime = this.formatTime(ms);
        this.highScores.push({ ms: ms, timeStr: formattedTime, date: new Date().toLocaleDateString() });
        
        // Sort ascending (fastest time first)
        this.highScores.sort((a, b) => a.ms - b.ms);
        
        // Keep only top 10 scores
        if (this.highScores.length > 10) {
            this.highScores = this.highScores.slice(0, 10);
        }
        
        localStorage.setItem('rubrace_highscores', JSON.stringify(this.highScores));
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    resize() {
        this.isLandscape = window.innerWidth > window.innerHeight;
        const app = document.getElementById("app");
        if (this.isLandscape) {
            app.style.transform = "translate(-50%, -50%) rotate(-90deg)";
        } else {
            app.style.transform = "translate(-50%, -50%) rotate(0deg)";
        }        
        const vw = window.visualViewport?.width || window.innerWidth;
        const vh = window.visualViewport?.height || window.innerHeight;

        const usableWidth  = this.isLandscape ? vh : vw;
        const usableHeight = this.isLandscape ? vw : vh;

        const scale = Math.min(
            usableWidth / designWidth,
            usableHeight / designHeight
        );

        this.canvas.style.width  = (designWidth * scale) + 'px';
        this.canvas.style.height = (designHeight * scale) + 'px';

        this.scale = 1; 
        this.scaleH = 1;
        this.drawSquareGameArea();
    }

    draw() {
        requestAnimationFrame(() => this.draw());
        // Background
        this.ctx.fillStyle = "#0000AAFF";
        const playersAreaHeight = this.canvas.height / 3 ;
        const playerAreaY = 0;
        const w = this.canvas.width;
        this.ctx.fillRect(0, playerAreaY, w,playersAreaHeight);

        if (gameClient.playerState === 'playing') {
            this.elapsedTime = Date.now() - this.startTime;
            const displayTime = this.formatTime(this.elapsedTime);
            // Draw Timer (mm:ss) centered 
            // Call the unified drawer
            this.keyHelper.drawText(this.ctx, displayTime, w / 2, playersAreaHeight + 5, {
                font: "bold 22px monospace",
                color: "#FFD500",
                align: "center",
                baseline: "top",
                clearBefore: true, // Erase background behind text
                padding: 4         // Custom padding size parameter
            });
        }

        if (gameClient) {
            gameClient.draw(this.ctx, 0, playerAreaY, w, playersAreaHeight);
            if (this.oldphase !== gameClient.phase) {
                console.log("Game phase changed from " + this.oldphase + " to " + gameClient.phase);
                this.oldphase = gameClient.phase;
                if ((gameClient.playerState === "ready" || gameClient.playerState === "waiting")
                     && gameClient.phase==="PLAYING" ) {
                    this.startButton.label = 'Join game';
                    this.startButton.callback= () => {gameClient.joinGame();};
                    this.startButton.visible = true;
                }else{
                    this.startButton.label = 'Start game';
                    this.startButton.callback= () => {gameClient.startGame();};
                }
            }
            if (this.oldPlayerState !== gameClient.playerState) {
                console.log("Player state changed from " + this.oldPlayerState + " to " + gameClient.playerState);
                this.oldPlayerState = gameClient.playerState;
                if (gameClient.playerState === "lobby") {
                    this.readyButton.label = UNCHECKED;
                }else{
                    this.readyButton.label = CHECKED;
                }
            }
        }


        this.keyHelper.draw();
    }

    drawSquareGameArea() {
        // --- Render Top Game Elements ---
        this.padding = 4;
        const borderRadius = 6;
        const topAreaHeight = designHeight / 3;

        // 3x3 Target Pattern Layout
        const targetTileSize = 40;
        const targetGridSize = (targetTileSize * 3) + (this.padding * 2);
        const targetStartX = (designWidth - targetGridSize) / 2;
        const targetStartY = topAreaHeight + 32;

        this.ctx.fillStyle = "#111111";
        this.ctx.fillRect(targetStartX - 8, targetStartY - 8, targetGridSize + 16, targetGridSize + 16);

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const colorCode = this.targetPattern[r][c];
                const x = targetStartX + c * (targetTileSize + this.padding);
                const y = targetStartY + r * (targetTileSize + this.padding);
                
                this.ctx.fillStyle = this.colors[colorCode] || "#333333";
                this.drawRoundedRect(x, y, targetTileSize, targetTileSize, borderRadius);
            }
        }

        // --- Render Bottom Play Grid ---
        this.playerTileSize = designWidth/5 - this.padding - 4;
        this.playerGridSize = (this.playerTileSize * 5) + (this.padding * 4);
        this.playerStartX = (designWidth - this.playerGridSize) / 2;
        this.playerStartY = targetStartY + targetGridSize + 22;

        this.ctx.fillStyle = "#111111";
        this.ctx.fillRect(this.playerStartX - 10, this.playerStartY - 10, this.playerGridSize + 20, this.playerGridSize + 20);

        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const colorCode = this.playerBoard[r][c];
                const x = this.playerStartX + c * (this.playerTileSize + this.padding);
                const y = this.playerStartY + r * (this.playerTileSize + this.padding);

                if (colorCode !== null) {
                    this.ctx.fillStyle = this.colors[colorCode];
                    this.drawRoundedRect(x, y, this.playerTileSize, this.playerTileSize, borderRadius);
                } else {
                    this.ctx.fillStyle = "#222222";
                    this.ctx.fillRect(x, y, this.playerTileSize, this.playerTileSize);
                }
            }
        }
        if (!this.multiplayer) {
            // --- Render Overlay Screens ---
            if (gameClient.phase === 'START_MENU' ||
                gameClient.phase === 'GAME_OVER'  ) {
                this.drawOverlay();
            }
        }        
    }
        
    drawOverlay() {
        // Semi-transparent overlay block
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        this.ctx.fillRect(0, 0, designWidth, designHeight);

        this.ctx.textAlign = "center";
        
        // Header Text
        if (gameClient.phase === 'START_MENU') {
            this.ctx.fillStyle = "#009B48"; // Retro Green
            this.ctx.font = "bold 32px monospace";
            this.ctx.fillText("RUBIK RACE", designWidth / 2, 130);
        } else if (gameClient.phase === 'LOBBY') {
            this.ctx.fillStyle = "#009B48"; // Retro Green
            this.ctx.font = "bold 32px monospace";
            this.ctx.fillText("MULTIPLAYER LOBBY", designWidth / 2, 130);
        } else {
            this.ctx.fillStyle = "#B71234"; // Retro Red
            this.ctx.font = "bold 32px monospace";
            this.ctx.fillText("GAME FINISHED!", designWidth / 2, 110);
            if (this.multiplayer && this.winnerName) {
                this.ctx.fillStyle = "#FFD500"; // Gold
                this.ctx.font = "bold 42px monospace";
                this.ctx.fillText("Winner: "+this.winnerName, designWidth / 2, 150);
            }

            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "20px monospace";
            this.ctx.fillText(`YOUR TIME: ${this.formatTime(this.elapsedTime)}`, designWidth / 2, 150);
        }

        // Leaderboard Title
        this.ctx.fillStyle = "#FF5800"; // Orange
        this.ctx.font = "22px monospace";
        this.ctx.fillText("YOUR BEST TIMES", designWidth / 2, 220);

        // Render Leaderboard Items
        this.ctx.font = "18px monospace";
        let startY = 260;
        const rowHeight = 32;

        if (this.highScores.length === 0) {
            this.ctx.fillStyle = "#888888";
            this.ctx.fillText("NO SCORES YET", designWidth / 2, startY + 40);
        } else {
            this.highScores.forEach((score, index) => {
                const currentY = startY + (index * rowHeight);
                
                // Flashy colors for top 3 positions
                if (index === 0) this.ctx.fillStyle = "#FFD500";      // Gold
                else if (index === 1) this.ctx.fillStyle = "#DDDDDD"; // Silver
                else if (index === 2) this.ctx.fillStyle = "#CD7F32"; // Bronze
                else this.ctx.fillStyle = "#0046AD";                  // Blue

                // Left-aligned Rank/Date & Right-aligned Time via padded structure
                const rankStr = `${(index + 1).toString().padStart(2, '0')}.`;
                this.ctx.textAlign = "left";
                this.ctx.fillText(rankStr, 45, currentY);
                this.ctx.fillText(score.date, 95, currentY);
                
                this.ctx.textAlign = "right";
                this.ctx.fillText(score.timeStr, designWidth - 45, currentY);
            });
        }

        if (gameClient.phase === 'START_MENU') {
            // Call-to-action Footer
            this.ctx.textAlign = "center";
            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "bold 20px monospace";

            // Quick blink calculation using timestamps
            if (Math.floor(Date.now() / 600) % 2 === 0) {
                this.ctx.fillText("TAP SCREEN TO START", designWidth / 2, 680);
            }
        }
    }

    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
        // This overlays a 30% white layer to make any base color look pastel/softer
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        this.ctx.fill();
        this.ctx.strokeStyle = "rgba(0,0,0,0.15)";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    handleTouch(e) {
        // Handle Tap-To-Start state changes
        if (gameClient.phase === 'START_MENU' || gameClient.phase === 'GAME_OVER') {
            if (this.multiplayer) {
                this.startLobby();
            } else {
                this.startGame();
            }
            return;
        }

        if (gameClient.playerState !== 'playing') return;

        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        let canvasX = clientX - rect.left;
        let canvasY = clientY - rect.top;

        if (this.isLandscape) {
            const temp = canvasX;
            canvasX = canvasY;
            canvasY = rect.height - temp;
        }

        const finalX = canvasX * (designWidth / rect.width);
        const finalY = canvasY * (designHeight / rect.height);
        this.processGridClick(finalX, finalY);
    }

    processGridClick(x, y) {

        if (x >= this.playerStartX && x < this.playerStartX + this.playerGridSize &&
            y >= this.playerStartY && y < this.playerStartY + this.playerGridSize) {
            
            const col = Math.floor((x - this.playerStartX) / (this.playerTileSize + this.padding));
            const row = Math.floor((y - this.playerStartY) / (this.playerTileSize + this.padding));

            if (row >= 0 && row < 5 && col >= 0 && col < 5) {
                this.tryMoveTile(row, col);
            }
        }
    }

    tryMoveTile(clickedRow, clickedCol) {
        const emptyRow = this.emptyPos.row;
        const emptyCol = this.emptyPos.col;

        if (clickedRow === emptyRow || clickedCol === emptyCol) {
            const rowDir = Math.sign(clickedRow - emptyRow);
            const colDir = Math.sign(clickedCol - emptyCol);

            let currRow = emptyRow;
            let currCol = emptyCol;

            while (currRow !== clickedRow || currCol !== clickedCol) {
                const nextRow = currRow + rowDir;
                const nextCol = currCol + colDir;

                this.playerBoard[currRow][currCol] = this.playerBoard[nextRow][nextCol];

                currRow = nextRow;
                currCol = nextCol;
            }

            this.playerBoard[clickedRow][clickedCol] = null;
            this.emptyPos = { row: clickedRow, col: clickedCol };
            this.updateCompletionPercentage();
            this.drawSquareGameArea();
        }
    }
}