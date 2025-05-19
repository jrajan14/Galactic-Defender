// Game Constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const ENEMY_SPEED = 2;
const POWERUP_SPEED = 2;
const STAR_COUNT = 100;

// Game State
let gameRunning = false;
let score = 0;
let level = 1;
let playerHealth = 100;
let enemies: Enemy[] = [];
let bullets: Bullet[] = [];
let powerUps: PowerUp[] = [];
let stars: Star[] = [];
let explosions: Explosion[] = [];
let particles: Particle[] = [];
let keys: { [key: string]: boolean } = {};
let playerPower: 'normal' | 'double' | 'laser' | 'shield' = 'normal';
let powerUpTimer = 0;
let enemySpawnTimer = 0;
let enemySpawnInterval = 2000;
let lastTime = 0;
let frameCount = 0;
let fps = 0;

// Gyro
let useGyro = false;
let deviceOrientation: DeviceOrientationEvent | null = null;
let gyroCalibration = 0;

// DOM Elements
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const scoreDisplay = document.getElementById('score')!;
const healthFill = document.getElementById('healthFill')!;
const healthValue = document.getElementById('healthValue')!;
const levelDisplay = document.getElementById('level')!;
const powerupDisplay = document.getElementById('powerup')!;
const startScreen = document.getElementById('startScreen')!;
const gameOverScreen = document.getElementById('gameOverScreen')!;
const startButton = document.getElementById('startButton')!;
const restartButton = document.getElementById('restartButton')!;
const finalScoreDisplay = document.getElementById('finalScore')!;

// Set canvas size
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Game Objects
class Player {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    shieldActive: boolean;
    shieldRadius: number;
    shootInterval: number | null = null;

    constructor() {
        this.x = GAME_WIDTH / 2;
        this.y = GAME_HEIGHT - 100;
        this.width = 50;
        this.height = 50;
        this.color = '#00ffff';
        this.shieldActive = false;
        this.shieldRadius = 60;
    }

    draw() {
        // Draw player ship
        ctx.save();
        ctx.fillStyle = this.color;
        
        // Ship body
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();
        
        // Ship details
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - 5, this.y - 10, 10, 10);
        
        // Engine glow
        const engineGlow = ctx.createRadialGradient(
            this.x, this.y + this.height / 2 + 10, 0,
            this.x, this.y + this.height / 2 + 10, 20
        );
        engineGlow.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
        engineGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = engineGlow;
        ctx.fillRect(this.x - 20, this.y + this.height / 2, 40, 20);
        
        // Shield if active
        if (this.shieldActive) {
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.shieldRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Shield glow
            const shieldGlow = ctx.createRadialGradient(
                this.x, this.y, this.shieldRadius - 10,
                this.x, this.y, this.shieldRadius
            );
            shieldGlow.addColorStop(0, 'rgba(0, 200, 255, 0.3)');
            shieldGlow.addColorStop(1, 'rgba(0, 200, 255, 0)');
            ctx.fillStyle = shieldGlow;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.shieldRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    update() {
        if (useGyro && deviceOrientation) {
            // Use gamma (left/right tilt) for movement
            const tilt = (deviceOrientation.gamma || 0) - gyroCalibration;
            this.x += tilt * 0.5; // Adjust multiplier for sensitivity
                
            // Boundary checks
            this.x = Math.max(this.width / 2, Math.min(GAME_WIDTH - this.width / 2, this.x));
        } 
        
        // Movement
        if (keys['ArrowLeft'] || keys['a']) this.x -= PLAYER_SPEED;
        if (keys['ArrowRight'] || keys['d']) this.x += PLAYER_SPEED;
        if (keys['ArrowUp'] || keys['w']) this.y -= PLAYER_SPEED;
        if (keys['ArrowDown'] || keys['s']) this.y += PLAYER_SPEED;
    
        // Boundary checks
        this.x = Math.max(this.width / 2, Math.min(GAME_WIDTH - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(GAME_HEIGHT - this.height / 2, this.y));
    }

    shoot() {
        const now = Date.now();
        
        if (playerPower === 'normal') {
            bullets.push(new Bullet(this.x, this.y - 30, 0, -BULLET_SPEED, '#00ffff'));
        } else if (playerPower === 'double') {
            bullets.push(new Bullet(this.x - 15, this.y - 30, 0, -BULLET_SPEED, '#00ffff'));
            bullets.push(new Bullet(this.x + 15, this.y - 30, 0, -BULLET_SPEED, '#00ffff'));
        } else if (playerPower === 'laser') {
            bullets.push(new Laser(this.x, this.y - 30, 0, -BULLET_SPEED * 1.5));
        }
        
        // Shooting particles
        for (let i = 0; i < 10; i++) {
            particles.push(new Particle(
                this.x + (Math.random() * 20 - 10),
                this.y + this.height / 2,
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                '#00ffff',
                1,
                1
            ));
        }
    }

    activateShield() {
        this.shieldActive = true;
        setTimeout(() => {
            this.shieldActive = false;
        }, 10000);
    }
}

class Bullet {
    x: number;
    y: number;
    dx: number;
    dy: number;
    radius: number;
    color: string;
    damage: number;

    constructor(x: number, y: number, dx: number, dy: number, color: string, radius = 5, damage = 1) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.radius = radius;
        this.color = color;
        this.damage = damage;
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        const glow = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * 2
        );
        glow.addColorStop(0, this.color);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        return this.y < 0 || this.y > GAME_HEIGHT || this.x < 0 || this.x > GAME_WIDTH;
    }
}

class Laser extends Bullet {
    constructor(x: number, y: number, dx: number, dy: number) {
        super(x, y, dx, dy, '#ff00ff', 8, 2);
    }

    draw() {
        ctx.save();
        const gradient = ctx.createLinearGradient(this.x, this.y - 10, this.x, this.y + 10);
        gradient.addColorStop(0, '#ff00ff');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, '#00ffff');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.radius;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y - 30);
        ctx.stroke();
        
        // Add glow effect
        const glow = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * 3
        );
        glow.addColorStop(0, 'rgba(255, 0, 255, 0.8)');
        glow.addColorStop(1, 'rgba(255, 0, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Enemy {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    health: number;
    maxHealth: number;
    color: string;
    type: 'basic' | 'fast' | 'tank';
    dx: number;
    dy: number;
    shootTimer: number;
    lastShot: number;

    constructor(type: 'basic' | 'fast' | 'tank' = 'basic') {
        this.type = type;
        this.x = Math.random() * (GAME_WIDTH - 60) + 30;
        this.y = -50;
        
        if (type === 'basic') {
            this.width = 40;
            this.height = 40;
            this.speed = ENEMY_SPEED;
            this.health = 2;
            this.maxHealth = 2;
            this.color = '#ff5555';
            this.dx = (Math.random() - 0.5) * 1;
        } else if (type === 'fast') {
            this.width = 30;
            this.height = 30;
            this.speed = ENEMY_SPEED * 1.5;
            this.health = 1;
            this.maxHealth = 1;
            this.color = '#55ff55';
            this.dx = (Math.random() - 0.5) * 2;
        } else { // tank
            this.width = 60;
            this.height = 60;
            this.speed = ENEMY_SPEED * 0.7;
            this.health = 5;
            this.maxHealth = 5;
            this.color = '#5555ff';
            this.dx = (Math.random() - 0.5) * 0.5;
        }
        
        this.dy = this.speed;
        this.shootTimer = 2000 + Math.random() * 3000;
        this.lastShot = Date.now();
    }

    draw() {
        ctx.save();
        
        // Draw enemy ship based on type
        if (this.type === 'basic') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width / 2, this.y - this.height / 2);
            ctx.lineTo(this.x - this.width / 2, this.y - this.height / 2);
            ctx.closePath();
            ctx.fill();
            
            // Enemy details
            ctx.fillStyle = '#000000';
            ctx.fillRect(this.x - 5, this.y - 5, 10, 10);
        } else if (this.type === 'fast') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Enemy details
            ctx.fillStyle = '#000000';
            ctx.fillRect(this.x - 4, this.y - 4, 8, 8);
        } else { // tank
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.roundRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height, 10);
            ctx.fill();
            
            // Enemy details
            ctx.fillStyle = '#000000';
            ctx.fillRect(this.x - 8, this.y - 8, 16, 16);
        }
        
        // Health bar
        if (this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width, 3);
            ctx.fillStyle = 'lime';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width * healthPercent, 3);
        }
        
        // Engine glow
        const engineGlow = ctx.createRadialGradient(
            this.x, this.y + this.height / 2 + 5, 0,
            this.x, this.y + this.height / 2 + 5, 15
        );
        engineGlow.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
        engineGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = engineGlow;
        ctx.fillRect(this.x - 15, this.y + this.height / 2, 30, 15);
        
        ctx.restore();
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        
        // Bounce off walls
        if (this.x <= this.width / 2 || this.x >= GAME_WIDTH - this.width / 2) {
            this.dx = -this.dx;
        }
        
        // Shoot occasionally
        if (Date.now() - this.lastShot > this.shootTimer && Math.random() < 0.02) {
            this.shoot();
            this.lastShot = Date.now();
        }
        
        return this.y > GAME_HEIGHT + this.height;
    }

    shoot() {
        bullets.push(new Bullet(this.x, this.y + this.height / 2 + 10, 0, BULLET_SPEED * 0.7, '#ff5555', 4));
        
        // Shooting particles
        for (let i = 0; i < 5; i++) {
            particles.push(new Particle(
                this.x + (Math.random() * 10 - 5),
                this.y + this.height / 2 + 10,
                (Math.random() - 0.5) * 1,
                Math.random() * 2,
                '#ff5555',
                1,
                1
            ));
        }
    }
}

class PowerUp {
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'health' | 'double' | 'laser' | 'shield';
    color: string;
    dy: number;
    rotation: number;
    rotationSpeed: number;

    constructor() {
        this.x = Math.random() * (GAME_WIDTH - 40) + 20;
        this.y = -30;
        this.width = 30;
        this.height = 30;
        this.dy = POWERUP_SPEED;
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        
        const types: ('health' | 'double' | 'laser' | 'shield')[] = ['health', 'double', 'laser', 'shield'];
        this.type = types[Math.floor(Math.random() * types.length)];
        
        switch (this.type) {
            case 'health': this.color = '#00ff00'; break;
            case 'double': this.color = '#ffff00'; break;
            case 'laser': this.color = '#ff00ff'; break;
            case 'shield': this.color = '#00ffff'; break;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw power-up icon based on type
        switch (this.type) {
            case 'health':
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(0, -this.height / 2);
                ctx.lineTo(this.width / 2, this.height / 2);
                ctx.lineTo(-this.width / 2, this.height / 2);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'double':
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.width / 4, -this.height / 2, this.width / 2, this.height);
                ctx.fillRect(-this.width / 2, -this.height / 4, this.width, this.height / 2);
                break;
                
            case 'laser':
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.moveTo(0, -this.height / 2);
                ctx.lineTo(this.width / 2, 0);
                ctx.lineTo(0, this.height / 2);
                ctx.lineTo(-this.width / 2, 0);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'shield':
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }
        
        // Add glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width);
        glow.addColorStop(0, this.color + 'cc');
        glow.addColorStop(1, this.color + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, this.width, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    update() {
        this.y += this.dy;
        this.rotation += this.rotationSpeed;
        return this.y > GAME_HEIGHT + this.height;
    }
}

class Star {
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    twinkleSpeed: number;

    constructor() {
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
        this.size = Math.random() * 2 + 0.5;
        this.speed = Math.random() * 2 + 0.5;
        this.opacity = Math.random();
        this.twinkleSpeed = Math.random() * 0.05 + 0.01;
    }

    draw() {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        if (this.y > GAME_HEIGHT) {
            this.y = 0;
            this.x = Math.random() * GAME_WIDTH;
        }
        
        // Twinkle effect
        this.opacity += this.twinkleSpeed;
        if (this.opacity > 1 || this.opacity < 0.2) {
            this.twinkleSpeed = -this.twinkleSpeed;
        }
    }
}

class Explosion {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    color: string;
    life: number;
    maxLife: number;

    constructor(x: number, y: number, color: string, maxRadius = 30, life = 0.5) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = maxRadius;
        this.color = color;
        this.life = 0;
        this.maxLife = life;
    }

    draw() {
        const progress = this.life / this.maxLife;
        const currentRadius = this.radius * progress;
        const opacity = 1 - progress;
        
        ctx.save();
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, currentRadius
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update(deltaTime: number) {
        this.life += deltaTime;
        return this.life >= this.maxLife;
    }
}

class Particle {
    x: number;
    y: number;
    dx: number;
    dy: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;

    constructor(x: number, y: number, dx: number, dy: number, color: string, size: number, life: number) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.color = color;
        this.size = size;
        this.life = 0;
        this.maxLife = life;
    }

    draw() {
        const progress = this.life / this.maxLife;
        const currentSize = this.size * (1 - progress);
        const opacity = 1 - progress;
        
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update(deltaTime: number) {
        this.x += this.dx;
        this.y += this.dy;
        this.life += deltaTime;
        return this.life >= this.maxLife;
    }
}

// Game Initialization
const player = new Player();

function initGame() {
    initGyroControls();
    // Reset game state
    score = 0;
    level = 1;
    playerHealth = 100;
    enemies = [];
    bullets = [];
    powerUps = [];
    explosions = [];
    particles = [];
    playerPower = 'normal';
    powerUpTimer = 0;
    enemySpawnTimer = 0;
    enemySpawnInterval = 2000;
    
    // Update UI
    scoreDisplay.textContent = '0';
    healthFill.style.width = `${playerHealth}%`;
    levelDisplay.textContent = '1';
    powerupDisplay.textContent = 'None';
    
    // Create stars
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push(new Star());
    }

    // Create mobile shoot button
    if ('ontouchstart' in window) {
        const shootBtn = document.createElement('button');
        shootBtn.className = 'shoot-button';
        shootBtn.textContent = 'SHOOT';
        shootBtn.addEventListener('touchstart', () => {
            player.shoot();
            // Clear any existing interval first
            if (player.shootInterval) {
                clearInterval(player.shootInterval);
            }
            // Continuous shooting while holding
            player.shootInterval = setInterval(() => player.shoot(), 200);
        });
        shootBtn.addEventListener('touchend', () => {
            if (player.shootInterval) {
                clearInterval(player.shootInterval);
                player.shootInterval = null;
            }
        });
        document.body.appendChild(shootBtn);
    }

}

function initGyroControls() {
    if (window.DeviceOrientationEvent) {
        useGyro = true;
        // Request permission on iOS 13+
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            (DeviceOrientationEvent as any).requestPermission()
                .then((response: string) => {
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                })
                .catch(console.error);
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
        
        // Add calibration button for mobile
        const calibrateBtn = document.createElement('button');
        calibrateBtn.textContent = 'Calibrate Gyro';
        calibrateBtn.style.position = 'absolute';
        calibrateBtn.style.bottom = '20px';
        calibrateBtn.style.left = '50%';
        calibrateBtn.style.transform = 'translateX(-50%)';
        calibrateBtn.style.zIndex = '20';
        calibrateBtn.style.padding = '10px 20px';
        calibrateBtn.addEventListener('click', calibrateGyro);
        document.body.appendChild(calibrateBtn);
    }
}

function handleOrientation(event: DeviceOrientationEvent) {
    deviceOrientation = event;
}

function calibrateGyro() {
    if (deviceOrientation) {
        gyroCalibration = deviceOrientation.gamma || 0;
    }
}

function spawnEnemy() {
    const types: ('basic' | 'fast' | 'tank')[] = ['basic', 'fast', 'tank'];
    const weights = [0.6, 0.3, 0.1]; // Higher level increases chance of tank enemies
    
    // Adjust weights based on level
    const levelFactor = Math.min(level / 10, 0.5);
    const adjustedWeights = [
        Math.max(0.6 - levelFactor, 0.3),
        Math.max(0.3 - levelFactor * 0.5, 0.2),
        Math.min(0.1 + levelFactor * 1.5, 0.5)
    ];
    
    // Choose enemy type based on weighted probability
    const rand = Math.random();
    let cumulativeWeight = 0;
    let chosenType: 'basic' | 'fast' | 'tank' = 'basic';
    
    for (let i = 0; i < types.length; i++) {
        cumulativeWeight += adjustedWeights[i];
        if (rand < cumulativeWeight) {
            chosenType = types[i];
            break;
        }
    }
    
    enemies.push(new Enemy(chosenType));
}

function spawnPowerUp() {
    powerUps.push(new PowerUp());
}

function checkCollisions() {
    // Player vs Enemies
    enemies.forEach((enemy, eIndex) => {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (player.width + enemy.width) / 2;
        
        if (distance < minDistance) {
            if (!player.shieldActive) {
                playerHealth -= 10;
                healthFill.style.width = `${playerHealth}%`;
                createExplosion(enemy.x, enemy.y, '#ff5555');
                updateHealthDisplay();
            }
            enemies.splice(eIndex, 1);
            
            if (playerHealth <= 0) {
                gameOver();
            }
        }
    });
    
    // Player vs Enemy Bullets
    bullets.forEach((bullet, bIndex) => {
        if (bullet.dy > 0) { // Only enemy bullets move downward
            const dx = player.x - bullet.x;
            const dy = player.y - bullet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = player.width / 2 + bullet.radius;
            
            if (distance < minDistance) {
                if (!player.shieldActive) {
                    playerHealth -= bullet.damage * 5;
                    healthFill.style.width = `${playerHealth}%`;
                    createExplosion(bullet.x, bullet.y, '#ff5555');
                    updateHealthDisplay();
                }
                bullets.splice(bIndex, 1);
                
                if (playerHealth <= 0) {
                    gameOver();
                }
            }
        }
    });
    
    // Player vs Power-ups
    powerUps.forEach((powerUp, pIndex) => {
        const dx = player.x - powerUp.x;
        const dy = player.y - powerUp.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = player.width / 2 + powerUp.width / 2;
        
        if (distance < minDistance) {
            // Apply power-up effect
            switch (powerUp.type) {
                case 'health':
                    playerHealth = Math.min(100, playerHealth + 30);
                    healthFill.style.width = `${playerHealth}%`;
                    updateHealthDisplay();
                    break;
                case 'double':
                    playerPower = 'double';
                    powerUpTimer = Date.now();
                    powerupDisplay.textContent = 'Double Shot';
                    break;
                case 'laser':
                    playerPower = 'laser';
                    powerUpTimer = Date.now();
                    powerupDisplay.textContent = 'Laser';
                    break;
                case 'shield':
                    player.activateShield();
                    powerupDisplay.textContent = 'Shield';
                    break;
            }
            
            // Create collection effect
            createExplosion(powerUp.x, powerUp.y, powerUp.color, 40, 0.3);
            for (let i = 0; i < 20; i++) {
                particles.push(new Particle(
                    powerUp.x,
                    powerUp.y,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    powerUp.color,
                    Math.random() * 3 + 1,
                    Math.random() * 0.5 + 0.5
                ));
            }
            
            powerUps.splice(pIndex, 1);
        }
    });
    
    // Bullets vs Enemies
    bullets.forEach((bullet, bIndex) => {
        if (bullet.dy < 0) { // Only player bullets move upward
            enemies.forEach((enemy, eIndex) => {
                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = bullet.radius + enemy.width / 2;
                
                if (distance < minDistance) {
                    // Damage enemy
                    enemy.health -= bullet.damage;
                    
                    // Create hit effect
                    createExplosion(bullet.x, bullet.y, bullet.color, 20, 0.2);
                    for (let i = 0; i < 5; i++) {
                        particles.push(new Particle(
                            bullet.x,
                            bullet.y,
                            (Math.random() - 0.5) * 3,
                            (Math.random() - 0.5) * 3,
                            enemy.color,
                            Math.random() * 2 + 1,
                            Math.random() * 0.5 + 0.2
                        ));
                    }
                    
                    // Remove bullet
                    bullets.splice(bIndex, 1);
                    
                    // Check if enemy is destroyed
                    if (enemy.health <= 0) {
                        // Add score based on enemy type
                        switch (enemy.type) {
                            case 'basic': score += 100; break;
                            case 'fast': score += 150; break;
                            case 'tank': score += 250; break;
                        }
                        
                        scoreDisplay.textContent = score.toString();
                        
                        // Create explosion
                        createExplosion(enemy.x, enemy.y, enemy.color, 40);
                        for (let i = 0; i < 20; i++) {
                            particles.push(new Particle(
                                enemy.x,
                                enemy.y,
                                (Math.random() - 0.5) * 5,
                                (Math.random() - 0.5) * 5,
                                enemy.color,
                                Math.random() * 3 + 1,
                                Math.random() * 0.5 + 0.5
                            ));
                        }
                        
                        enemies.splice(eIndex, 1);
                        
                        // Check for level up
                        checkLevelUp();
                    }
                    
                    return;
                }
            });
        }
    });
}

function checkLevelUp() {
    const levelThresholds = [1000, 2500, 5000, 8000, 12000, 17000, 23000, 30000];
    
    if (level - 1 < levelThresholds.length && score >= levelThresholds[level - 1]) {
        level++;
        levelDisplay.textContent = level.toString();
        
        // Increase difficulty
        enemySpawnInterval = Math.max(500, 2000 - (level * 100));
        
        // Show level up effect
        createExplosion(GAME_WIDTH / 2, GAME_HEIGHT / 2, '#ffffff', 100, 1);
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle(
                GAME_WIDTH / 2,
                GAME_HEIGHT / 2,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                `hsl(${Math.random() * 360}, 100%, 50%)`,
                Math.random() * 4 + 2,
                Math.random() * 1 + 0.5
            ));
        }
    }
}

function createExplosion(x: number, y: number, color: string, maxRadius = 30, life = 0.5) {
    explosions.push(new Explosion(x, y, color, maxRadius, life));
}

function gameOver() {
    gameRunning = false;
    finalScoreDisplay.textContent = score.toString();
    gameOverScreen.style.display = 'flex';
    
    // Create big explosion
    createExplosion(player.x, player.y, '#00ffff', 100, 1);
    for (let i = 0; i < 100; i++) {
        particles.push(new Particle(
            player.x,
            player.y,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            `hsl(${Math.random() * 360}, 100%, 50%)`,
            Math.random() * 5 + 2,
            Math.random() * 1 + 0.5
        ));
    }
}

function updateHealthDisplay() {
    healthValue.textContent = playerHealth.toString();
    healthFill.style.width = `${playerHealth}%`;
}

// Game Loop
function gameLoop(timestamp: number) {
    if (!gameRunning) return;
    
    // Calculate delta time
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    frameCount++;
    
    // Calculate FPS every second
    if (frameCount % 60 === 0) {
        fps = Math.round(1 / deltaTime);
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw stars
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    stars.forEach(star => {
        star.draw();
        star.update();
    });
    
    // Update and draw player
    player.update();
    player.draw();
    
    // Spawn enemies
    enemySpawnTimer += deltaTime * 1000;
    if (enemySpawnTimer > enemySpawnInterval) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }
    
    // Spawn power-ups occasionally
    if (Math.random() < 0.002) {
        spawnPowerUp();
    }
    
    // Check power-up timer
    if (playerPower !== 'normal' && playerPower !== 'shield' && Date.now() - powerUpTimer > 10000) {
        playerPower = 'normal';
        powerupDisplay.textContent = 'None';
    }
    
    // Update and draw enemies
    enemies.forEach((enemy, index) => {
        enemy.draw();
        if (enemy.update()) {
            enemies.splice(index, 1);
        }
    });
    
    // Update and draw bullets
    bullets.forEach((bullet, index) => {
        bullet.draw();
        if (bullet.update()) {
            bullets.splice(index, 1);
        }
    });
    
    // Update and draw power-ups
    powerUps.forEach((powerUp, index) => {
        powerUp.draw();
        if (powerUp.update()) {
            powerUps.splice(index, 1);
        }
    });
    
    // Update and draw explosions
    explosions.forEach((explosion, index) => {
        explosion.draw();
        if (explosion.update(deltaTime)) {
            explosions.splice(index, 1);
        }
    });
    
    // Update and draw particles
    particles.forEach((particle, index) => {
        particle.draw();
        if (particle.update(deltaTime)) {
            particles.splice(index, 1);
        }
    });
    
    // Check collisions
    checkCollisions();
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // Space to shoot
    if (e.key === ' ' && gameRunning) {
        player.shoot();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

startButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    initGame();
    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
});

restartButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    initGame();
    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
});

// Initialize stars
for (let i = 0; i < STAR_COUNT; i++) {
    stars.push(new Star());
}

// Show start screen
startScreen.style.display = 'flex';
