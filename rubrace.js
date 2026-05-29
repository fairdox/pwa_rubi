const designWidth = 390;
const designHeight = 797;

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

        // Game States: 'START_MENU', 'PLAYING', 'GAME_OVER'
        this.gameState = 'START_MENU';
        this.highScores = [];
        this.startTime = 0;
        this.elapsedTime = 0; // in milliseconds
        this.timerInterval = null;

        this.targetPattern = [];
        this.playerBoard = [];
        this.emptyPos = { row: -1, col: -1 };

        this.loadHighScores();
        this.initGame();

        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.handleTouch(e));
        this.resize();
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

    startGame() {
        this.initGame();
        this.gameState = 'PLAYING';
        this.startTime = Date.now();
        this.elapsedTime = 0;

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.elapsedTime = Date.now() - this.startTime;
            this.draw();
        }, 200);

        this.draw();
    }

    checkWinCondition() {
        // The target 3x3 must match the inner 3x3 of the 5x5 player board (rows 1-3, columns 1-3)
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (this.playerBoard[r + 1][c + 1] !== this.targetPattern[r][c]) {
                    return false;
                }
            }
        }
        return true;
    }

    handleWin() {
        clearInterval(this.timerInterval);
        this.gameState = 'GAME_OVER';
        this.saveScore(this.elapsedTime);
        this.draw();
    }

    loadHighScores() {
        const data = localStorage.getItem('rubrace_highscores');
        this.highScores = data ? JSON.parse(data) : [];
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

        this.draw();
    }

    draw() {
        // Main Background
        this.ctx.fillStyle = "#0000";
        this.ctx.fillRect(0, 0, designWidth, designHeight);

        // --- Render Top Game Elements ---
        const padding = 4;
        const borderRadius = 6;

        // Draw Timer (mm:ss) centered at the very top
        this.ctx.fillStyle = "#FFD500";
        this.ctx.font = "bold 28px monospace";
        this.ctx.textAlign = "center";
        const displayTime = this.formatTime(this.elapsedTime);
        this.ctx.fillText(displayTime, designWidth / 2, 45);

        // 3x3 Target Pattern Layout
        const targetTileSize = 50;
        const targetGridSize = (targetTileSize * 3) + (padding * 2);
        const targetStartX = (designWidth - targetGridSize) / 2;
        const targetStartY = 85;

        this.ctx.fillStyle = "#111111";
        this.ctx.fillRect(targetStartX - 8, targetStartY - 8, targetGridSize + 16, targetGridSize + 16);

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const colorCode = this.targetPattern[r][c];
                const x = targetStartX + c * (targetTileSize + padding);
                const y = targetStartY + r * (targetTileSize + padding);
                
                this.ctx.fillStyle = this.colors[colorCode] || "#333333";
                this.drawRoundedRect(x, y, targetTileSize, targetTileSize, borderRadius);
            }
        }

        // --- Render Bottom Play Grid ---
        const playerTileSize = 70;
        const playerGridSize = (playerTileSize * 5) + (padding * 4);
        const playerStartX = (designWidth - playerGridSize) / 2;
        const playerStartY = 400;

        this.ctx.fillStyle = "#111111";
        this.ctx.fillRect(playerStartX - 10, playerStartY - 10, playerGridSize + 20, playerGridSize + 20);

        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const colorCode = this.playerBoard[r][c];
                const x = playerStartX + c * (playerTileSize + padding);
                const y = playerStartY + r * (playerTileSize + padding);

                if (colorCode !== null) {
                    this.ctx.fillStyle = this.colors[colorCode];
                    this.drawRoundedRect(x, y, playerTileSize, playerTileSize, borderRadius);
                } else {
                    this.ctx.fillStyle = "#222222";
                    this.ctx.fillRect(x, y, playerTileSize, playerTileSize);
                }
            }
        }

        // --- Render Overlay Screens ---
        if (this.gameState === 'START_MENU' || this.gameState === 'GAME_OVER') {
            this.drawOverlay();
        }
    }

    drawOverlay() {
        // Semi-transparent overlay block
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        this.ctx.fillRect(0, 0, designWidth, designHeight);

        this.ctx.textAlign = "center";
        
        // Header Text
        if (this.gameState === 'START_MENU') {
            this.ctx.fillStyle = "#009B48"; // Retro Green
            this.ctx.font = "bold 32px monospace";
            this.ctx.fillText("RUBIK RACE", designWidth / 2, 130);
        } else {
            this.ctx.fillStyle = "#B71234"; // Retro Red
            this.ctx.font = "bold 32px monospace";
            this.ctx.fillText("GAME FINISHED!", designWidth / 2, 110);

            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "20px monospace";
            this.ctx.fillText(`YOUR TIME: ${this.formatTime(this.elapsedTime)}`, designWidth / 2, 150);
        }

        // Leaderboard Title
        this.ctx.fillStyle = "#FF5800"; // Orange
        this.ctx.font = "22px monospace";
        this.ctx.fillText("TOP 10 LEADERBOARD", designWidth / 2, 220);

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

        // Call-to-action Footer
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.font = "bold 20px monospace";
        
        // Quick blink calculation using timestamps
        if (Math.floor(Date.now() / 600) % 2 === 0) {
            this.ctx.fillText("TAP SCREEN TO START", designWidth / 2, 680);
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
        
        this.ctx.strokeStyle = "rgba(0,0,0,0.15)";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    handleTouch(e) {
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        // Handle Tap-To-Start state changes
        if (this.gameState === 'START_MENU' || this.gameState === 'GAME_OVER') {
            this.startGame();
            return;
        }

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
        const padding = 4;
        const playerTileSize = 60;
        const playerGridSize = (playerTileSize * 5) + (padding * 4);
        const playerStartX = (designWidth - playerGridSize) / 2;
        const playerStartY = 400;

        if (x >= playerStartX && x < playerStartX + playerGridSize &&
            y >= playerStartY && y < playerStartY + playerGridSize) {
            
            const col = Math.floor((x - playerStartX) / (playerTileSize + padding));
            const row = Math.floor((y - playerStartY) / (playerTileSize + padding));

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

            // Check if this move completes the target pattern match
            if (this.checkWinCondition()) {
                this.handleWin();
            } else {
                this.draw();
            }
        }
    }
}