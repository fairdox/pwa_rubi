class KeyHelper {
    constructor(canvas) {
        if (!canvas) {
            throw new Error("Canvas element is required to initialize KeyHelper.");
        }
        
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.keys = [];
        this.activeKeyId = null; // Tracks the currently pressed button

        // Default layout properties
        this.defaultWidth = 80;
        this.defaultHeight = 50;
        this.defaultRadius = 8;
        this.defaultFont = "18px sans-serif";
        
        // Default color palette
        this.colors = {
            bg: "#333333",
            text: "#ffffff",
            border: "#555555",
            shadow: "#111111", // 3D shadow color
            toggleOnBg: "#1a73e8",
            toggleOnText: "#ffffff",
            disabledBg: "#555555",
            disabledText: "#888888"
        };
    }

    // Helper to generate a simple unique ID string
    _generateId() {
        return 'key_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // Helper to draw a rounded rectangle path
    _roundRect(x, y, width, height, radius) {
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
    }

    // Helper to translate event coordinates to canvas space
    _getCanvasCoords(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        
        // 1. Calculate how much the canvas is stretched or shrunk in the browser
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // 2. Translate and scale client coordinates straight to internal design resolution
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    // Adds a new key to the helper
    addKey(options = {}) {
        const key = {
            id: options.id || this._generateId(),
            groupId: options.groupId || null,
            label: options.label || "",
            text: options.text || null,
            font: options.font || this.defaultFont,
            x: options.x || 0,
            y: options.y || 0,
            width: options.width || this.defaultWidth,
            height: options.height || this.defaultHeight,
            radius: options.radius !== undefined ? options.radius : this.defaultRadius,
            callback: options.callback || null,
            
            // Toggle states
            isToggle: options.isToggle !== undefined ? options.isToggle : false,
            toggled: options.toggled !== undefined ? options.toggled : false,
            
            // Visibility and availability states
            visible: options.visible !== undefined ? options.visible : true,
            disabled: options.disabled !== undefined ? options.disabled : false
        };

        if (key.text){
            const metrics = this.ctx.measureText(key.text);
            key.textWidth = metrics.width;
        }
        this.keys.push(key);
        return key;
    }

    // --- Visibility and State Management ---

    setVisibilityById(id, visible) {
        const key = this.keys.find(k => k.id === id);
        if (key) key.visible = visible;
    }

    setVisibilityByGroup(groupId, visible) {
        this.keys.forEach(key => {
            if (key.groupId === groupId) key.visible = visible;
        });
    }

    setDisabledById(id, disabled) {
        const key = this.keys.find(k => k.id === id);
        if (key) key.disabled = disabled;
    }

    setDisabledByGroup(groupId, disabled) {
        this.keys.forEach(key => {
            if (key.groupId === groupId) key.disabled = disabled;
        });
    }

    // --- Removal Methods ---

    clearById(id) {
        this.keys = this.keys.filter(k => k.id !== id);
        if (this.activeKeyId === id) this.activeKeyId = null;
    }

    clearByGroup(groupId) {
        this.keys = this.keys.filter(k => k.groupId !== groupId);
        this.activeKeyId = null; 
    }

    clearAll() {
        this.keys = [];
        this.activeKeyId = null;
    }

    // --- Engine Integration Methods ---

    // Periodic render function called by the game loop
    draw() {
        this.ctx.save();
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        this.keys.forEach(key => {
            if (!key.visible) return;

            const isPressed = (this.activeKeyId === key.id);
            const shadowDepth = (key.disabled || isPressed) ? 0 : 4;

            // 1. Draw 3D Shadow (only if button is unpressed and enabled)
            if (shadowDepth > 0) {
                this.ctx.fillStyle = this.colors.shadow;
                this._roundRect(key.x, key.y + shadowDepth, key.width, key.height, key.radius);
                this.ctx.fill();
            }

            // Shift button face downward when pressed to cover the shadow space
            const faceY = key.y + (isPressed ? 4 : 0);

            // 2. Determine background and text colors
            let currentBg = this.colors.bg;
            let currentText = this.colors.text;

            if (key.disabled) {
                currentBg = this.colors.disabledBg;
                currentText = this.colors.disabledText;
            } else if (key.isToggle && key.toggled) {
                currentBg = this.colors.toggleOnBg;
                currentText = this.colors.toggleOnText;
            }

            // 3. Draw Button Face
            this.ctx.fillStyle = currentBg;
            this._roundRect(key.x, faceY, key.width, key.height, key.radius);
            this.ctx.fill();

            // 4. Draw Button Border
            this.ctx.strokeStyle = this.colors.border;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // 5. Draw Button Label
            this.ctx.font = key.defaultFont;
            this.ctx.fillStyle = currentText;
            if (key.text){
                this.ctx.fillText(
                    key.text, 
                    key.x - key.textWidth, 
                    faceY + key.height / 2
                );
            }
            this.ctx.fillText(
                key.label, 
                key.x + key.width / 2, 
                faceY + key.height / 2
            );
        });

        this.ctx.restore();
    }

    // Call this on pointerdown / mousedown / touchstart
    onPressDown(clientX, clientY) {
        const coords = this._getCanvasCoords(clientX, clientY);

        for (let i = this.keys.length - 1; i >= 0; i--) {
            const key = this.keys[i];
            if (!key.visible || key.disabled) continue;

            if (coords.x >= key.x && coords.x <= key.x + key.width &&
                coords.y >= key.y && coords.y <= key.y + key.height) {
                
                this.activeKeyId = key.id;
                return key;
            }
        }
        return null;
    }

    // Call this on pointerup / mouseup / touchend. Handles callbacks and resets states.
    onTap(clientX, clientY) {
        const coords = this._getCanvasCoords(clientX, clientY);
        let detectedKey = null;

        for (let i = this.keys.length - 1; i >= 0; i--) {
            const key = this.keys[i];
            if (!key.visible || key.disabled) continue;

            if (coords.x >= key.x && coords.x <= key.x + key.width &&
                coords.y >= key.y && coords.y <= key.y + key.height) {
                
                // Only register tap if this was the key targeted during pointerdown
                if (this.activeKeyId === key.id) {
                    if (key.isToggle) {
                        key.toggled = !key.toggled;
                    }

                    if (typeof key.callback === 'function') {
                        key.callback(key);
                    }
                    detectedKey = key;
                }
                break;
            }
        }

        this.activeKeyId = null; // Clear pressed state
        return detectedKey;
    }

    // Call this on pointercancel / mouseleave to clear click state safely if pointer leaves canvas
    onPressCancel() {
        this.activeKeyId = null;
    }

    /**
     * Draws text to the canvas with an optional backdrop clearing box.
     * @param {CanvasRenderingContext2D} ctx - The canvas 2D rendering context.
     * @param {string} text - The text string to display.
     * @param {number} x - Target X coordinate.
     * @param {number} y - Target Y coordinate.
     * @param {Object} options - Configuration adjustments.
     * @param {string} [options.font="20px sans-serif"] - CSS font style definition.
     * @param {string} [options.color="#FFFFFF"] - Text fill color.
     * @param {string} [options.align="left"] - Text alignment ("left", "center", "right").
     * @param {string} [options.baseline="middle"] - Text baseline positioning.
     * @param {boolean} [options.clearBefore=false] - If true, wipes out pixels directly behind text.
     * @param {number} [options.padding=4] - Extra pixel safety margin added around the clearing box.
    */
    drawText(ctx, text, x, y, options = {}) {
        // 1. Merge user overrides with standard layout defaults
        const font = options.font || "20px sans-serif";
        const color = options.color || "#FFFFFF";
        const align = options.align || "center";
        const baseline = options.baseline || "middle";
        const clearBefore = options.clearBefore || false;
        const padding = options.padding !== undefined ? options.padding : 4;

        // 2. Apply typography metrics to the engine context
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;

        // 3. Conditional execution block for calculation and background erasure
        if (clearBefore) {
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            
            // Extract font size from string descriptor to derive a stable visual height fallback
            const fontSizeMatch = font.match(/(\d+)px/);
            const textHeight = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 20;

            // Determine left horizontal box bound relative to anchor mode configurations
            let clearX = x;
            if (align === "center") {
                clearX = x - (textWidth / 2);
            } else if (align === "right") {
                clearX = x - textWidth;
            }

            // Determine top vertical box bound relative to baseline mode configurations
            let clearY = y;
            if (baseline === "middle") {
                clearY = y - (textHeight / 2);
            } else if (baseline === "bottom" || baseline === "alphabetic") {
                clearY = y - textHeight;
            }

            // Apply specified safe bounds margins
            clearX -= padding;
            clearY -= padding;
            const clearW = textWidth + (padding * 2);
            const clearH = textHeight + (padding * 2);

            // Wipe out background pixel map segment safely
            ctx.clearRect(clearX, clearY, clearW, clearH);
        }

        // 4. Render text payload
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }
}