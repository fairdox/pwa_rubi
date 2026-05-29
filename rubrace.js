const designWidth = 390;
const designHeight = 797;

class RubRace {
    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = designWidth;
        this.canvas.height = designHeight;
        this.ctx = canvas.getContext('2d');

        // Color definitions (Rubik's standard)
        this.colors = {
            'R': '#B71234', // Red
            'O': '#FF5800', // Orange
            'Y': '#FFD500', // Yellow
            'G': '#009B48', // Green
            'B': '#0046AD', // Blue
            'W': '#FFFFFF'  // White
        };

        // Initialize game state
        this.targetPattern = []; // 3x3 array
        this.playerBoard = [];   // 5x5 array
        this.emptyPos = { row: -1, col: -1 }; // Track the empty spot

        this.initGame();

        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.handleTouch(e));
        this.resize();
    }

    initGame() {
        // 1. Create the pool of 24 colored tiles (4 of each of the 6 colors)
        const colorKeys = Object.keys(this.colors);
        let tilePool = [];
        colorKeys.forEach(color => {
            for (let i = 0; i < 4; i++) {
                tilePool.push(color);
            }
        });

        // Shuffle the pool
        this.shuffleArray(tilePool);

        // 2. Populate the 5x5 player board with 24 tiles and 1 empty spot (null)
        // Choose a random index for the empty spot
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

        // 3. Generate a valid 3x3 target pattern
        // It must be achievable using the total count of tiles available in the game
        this.generateTargetPattern();
    }

    generateTargetPattern() {
        // To ensure the goal is completely fair and possible, we count the colors
        // remaining on the board or pull randomly from a valid distribution.
        // A simple approach is to copy the board, shuffle it, and take a 3x3 slice.
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

        // Keep internal coordinates matching the design resolution
        this.scale = 1; 
        this.scaleH = 1;

        this.draw();
    }

    draw() {
        // Clear canvas using design base dimensions
        this.ctx.fillStyle = "#1E1E1E"; // Dark background
        this.ctx.fillRect(0, 0, designWidth, designHeight);

        // --- Layout Math (Using fixed design dimensions) ---
        const padding = 4;
        const borderRadius = 6;

        // Top Area: 3x3 Target Pattern
        const targetTileSize = 40;
        const targetGridSize = (targetTileSize * 3) + (padding * 2);
        const targetStartX = (designWidth - targetGridSize) / 2;
        const targetStartY = 80; // Margin from top

        // Frame background for target
        this.ctx.fillStyle = "#111111";
        this.ctx.fillRect(targetStartX - 8, targetStartY - 8, targetGridSize + 16, targetGridSize + 16);

        // Draw 3x3 Target
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const colorCode = this.targetPattern[r][c];
                const x = targetStartX + c * (targetTileSize + padding);
                const y = targetStartY + r * (targetTileSize + padding);
                
                this.ctx.fillStyle = this.colors[colorCode];
                this.drawRoundedRect(x, y, targetTileSize, targetTileSize, borderRadius);
            }
        }

        // Bottom Area: 5x5 Play Grid
        const playerTileSize = 60;
        const playerGridSize = (playerTileSize * 5) + (padding * 4);
        const playerStartX = (designWidth - playerGridSize) / 2;
        const playerStartY = 400; // Positioned lower on screen

        // Frame background for player board
        this.ctx.fillStyle = "#111111";
        this.ctx.fillRect(playerStartX - 10, playerStartY - 10, playerGridSize + 20, playerGridSize + 20);

        // Draw 5x5 Board
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const colorCode = this.playerBoard[r][c];
                const x = playerStartX + c * (playerTileSize + padding);
                const y = playerStartY + r * (playerTileSize + padding);

                if (colorCode !== null) {
                    this.ctx.fillStyle = this.colors[colorCode];
                    this.drawRoundedRect(x, y, playerTileSize, playerTileSize, borderRadius);
                } else {
                    // Empty tile spot texture
                    this.ctx.fillStyle = "#222222";
                    this.ctx.fillRect(x, y, playerTileSize, playerTileSize);
                }
            }
        }
    }

    // Helper method to draw smooth tiles
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
        
        // Slight inner border for depth
        this.ctx.strokeStyle = "rgba(0,0,0,0.15)";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

handleTouch(e) {
        // Prevent default behavior to stop screen bouncing on mobile touch
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        // Get coordinates relative to the canvas bounding rect
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Project window coordinates back into our fixed 390x797 design space
        let canvasX = clientX - rect.left;
        let canvasY = clientY - rect.top;

        // Account for rotation if user is in landscape mode
        if (this.isLandscape) {
            const temp = canvasX;
            canvasX = canvasY;
            canvasY = rect.height - temp;
        }

        // Rescale based on CSS dimensions relative to internal canvas resolution
        const finalX = canvasX * (designWidth / rect.width);
        const finalY = canvasY * (designHeight / rect.height);

        this.processGridClick(finalX, finalY);
    }

    processGridClick(x, y) {
        // Layout constants matching the draw function
        const padding = 4;
        const playerTileSize = 60;
        const playerGridSize = (playerTileSize * 5) + (padding * 4);
        const playerStartX = (designWidth - playerGridSize) / 2;
        const playerStartY = 400;

        // Check if click falls within the bounds of the 5x5 grid bounding box
        if (x >= playerStartX && x < playerStartX + playerGridSize &&
            y >= playerStartY && y < playerStartY + playerGridSize) {
            
            // Determine exact column and row index
            const col = Math.floor((x - playerStartX) / (playerTileSize + padding));
            const row = Math.floor((y - playerStartY) / (playerTileSize + padding));

            // Ensure calculated indices fall strictly inside 0-4 boundaries
            if (row >= 0 && row < 5 && col >= 0 && col < 5) {
                this.tryMoveTile(row, col);
            }
        }
    }

    tryMoveTile(clickedRow, clickedCol) {
        const emptyRow = this.emptyPos.row;
        const emptyCol = this.emptyPos.col;

        // Check if the clicked tile shares either the same row or same column as the empty space
        if (clickedRow === emptyRow || clickedCol === emptyCol) {
            
            // Set increments to track direction of movement
            const rowDir = Math.sign(clickedRow - emptyRow); // -1, 0, or 1
            const colDir = Math.sign(clickedCol - emptyCol); // -1, 0, or 1

            // Shift elements sequentially from the empty spot position up to the clicked cell
            let currRow = emptyRow;
            let currCol = emptyCol;

            while (currRow !== clickedRow || currCol !== clickedCol) {
                const nextRow = currRow + rowDir;
                const nextCol = currCol + colDir;

                // Move the adjacent piece into the current spot
                this.playerBoard[currRow][currCol] = this.playerBoard[nextRow][nextCol];

                currRow = nextRow;
                currCol = nextCol;
            }

            // The original clicked cell becomes the new empty space
            this.playerBoard[clickedRow][clickedCol] = null;
            this.emptyPos = { row: clickedRow, col: clickedCol };

            // Re-render frame immediately with updated layout state
            this.draw();
        }
    }
}