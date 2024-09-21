export class mainMap extends Phaser.Scene {
    constructor() {
        super("mainMap");
    }

    preload() {
        this.load.tilemapTiledJSON('maps', 'src/assets/map.json');
        this.load.image('tiles', 'src/assets/tiles.png');
        this.load.image('player', 'src/assets/flower.webp');
        this.load.image('enemy', 'src/assets/mob/bee.svg');
        this.load.image('yellow_ladybug', 'src/assets/shineyLadybug.png');
        this.load.image('petal', 'src/assets/petal.png');
        this.load.image('squareBud', 'src/assets/squareBud.png');
        this.load.image('bush', 'src/assets/mob/bush.svg'); // Load bush image
    }

    create() {
        const map = this.add.tilemap('maps');
        const tiles = map.addTilesetImage('tileset', 'tiles');
        const groundLayer = map.createLayer('Map', tiles, 0, 0);
        const wallLayer = map.createLayer('Walls', tiles, 0, 0);

        groundLayer.setScale(15);
        wallLayer.setScale(15);
        this.useMouseControl = false;
        this.movementArrow = this.add.graphics();
        this.movementArrow.lineStyle(12, 0x808080);
        this.player = this.physics.add.sprite(Phaser.Math.Between(4000, 6000), Phaser.Math.Between(6200, 8000), 'player');
        this.player.setScale(0.3);
        this.player.setDepth(1);
        this.player.body.setCircle(this.player.width * 0.47, this.player.width * 0.06, this.player.height * 0.05);
        this.player.body.setMass(10000);

        this.hp = 500;
        this.currentHp = this.hp;

        this.createHpBar();
        this.createPetalSlots();
        this.createUtilityIcons();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            d: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.cameras.main.startFollow(this.player);
        this.cameras.main.setZoom(0.85);

        this.minimap = this.cameras.add(10, 10, 150, 150).setZoom(0.05).setName('mini');
        this.minimap.startFollow(this.player);
        this.minimap.setScroll(0, 0);
        this.cameras.main.ignore(this.minimap);

        wallLayer.setCollisionBetween(15, 21);
        this.physics.add.collider(this.player, wallLayer);

        this.enemies = this.physics.add.group();
        this.bushes = this.physics.add.group(); // New group for bushes

        this.physics.add.collider(this.player, this.enemies, this.handleCollision, null, this);
        this.physics.add.collider(this.enemies, this.enemies);
        this.physics.add.collider(this.enemies, wallLayer);
        this.physics.add.overlap(this.player, this.enemies, this.chasePlayer, null, this);

        // Add collision between the player and bushes
        this.physics.add.collider(this.player, this.bushes, this.handleBushCollision, null, this);

        this.time.addEvent({
            delay: 2000,
            callback: this.changeEnemiesDirection,
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: 5000,
            callback: this.autoHeal,
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: 15000,
            callback: this.attemptSpawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Attempt to spawn bushes with the same rarity logic as squares
        this.time.addEvent({
            delay: 100004,
            callback: this.attemptSpawnBush,
            callbackScope: this,
            loop: true
        });
    }

    update() {
        const maxSpeed = 150; // Maximum player speed
        const minSpeed = 10;  // Minimum speed when very close to the mouse
        const stopDistance = 10; // Distance within which the player will stop
    
        // Control switching
        if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K))) {
            this.useMouseControl = !this.useMouseControl; // Toggle control scheme
        }
    
        if (this.useMouseControl) {
            // Mouse control
            const pointer = this.input.activePointer; // Get the active pointer
            const dx = pointer.worldX - this.player.x; // Use worldX instead of x
            const dy = pointer.worldY - this.player.y; // Use worldY instead of y
    
            // Calculate the angle between player and pointer
            const angle = Math.atan2(dy, dx);
    
            // Calculate the distance between the player and the mouse
            const distance = Math.sqrt(dx * dx + dy * dy);
    
            let speed = maxSpeed; // Default speed is maxSpeed
    
            if (distance > stopDistance) {
                // Reduce speed proportionally as the player gets closer to the mouse
                if (distance < maxSpeed) {
                    speed = Math.max(minSpeed, distance); // Speed decreases but stays above minSpeed
                }
    
                const velocityX = (dx / distance) * speed; // Normalize x based on distance
                const velocityY = (dy / distance) * speed; // Normalize y based on distance
    
                // Set the player's velocity (but do not rotate the player)
                this.player.setVelocity(velocityX, velocityY);
            } else {
                // If the player is very close to the mouse, stop moving
                this.player.setVelocity(0);
            }
    
            // Rotate only the arrow around the player
            this.movementArrow.clear(); // Clear the previous arrow
            this.movementArrow.fillStyle(0x808080); // Arrow color (grey)
    
            // Draw arrowhead
            const arrowheadSize = 20; // Size of the arrowhead
            const arrowDistanceFromPlayer = 50; // Distance of the arrow from the player
            const arrowheadX = this.player.x + Math.cos(angle) * arrowDistanceFromPlayer; // Offset a bit ahead of the player
            const arrowheadY = this.player.y + Math.sin(angle) * arrowDistanceFromPlayer;
            
            this.movementArrow.beginPath();
            this.movementArrow.moveTo(arrowheadX, arrowheadY); // Start at arrow tip
            this.movementArrow.lineTo(arrowheadX - arrowheadSize * Math.cos(angle - Math.PI / 6), arrowheadY - arrowheadSize * Math.sin(angle - Math.PI / 6)); // Left side of arrowhead
            this.movementArrow.lineTo(arrowheadX - arrowheadSize * Math.cos(angle + Math.PI / 6), arrowheadY - arrowheadSize * Math.sin(angle + Math.PI / 6)); // Right side of arrowhead
            this.movementArrow.closePath();
            this.movementArrow.fillPath();
        } else {
            // Keyboard control (WASD)
            this.player.setVelocity(0);
    
            if (this.keys.w.isDown || this.cursors.up.isDown) {
                this.player.setVelocityY(-maxSpeed);
            } else if (this.keys.s.isDown || this.cursors.down.isDown) {
                this.player.setVelocityY(maxSpeed);
            }
    
            if (this.keys.a.isDown || this.cursors.left.isDown) {
                this.player.setVelocityX(-maxSpeed);
            } else if (this.keys.d.isDown || this.cursors.right.isDown) {
                this.player.setVelocityX(maxSpeed);
            }
    
            // Clear the movement arrow when using keyboard controls
            this.movementArrow.clear();
        }
        this.enemies.getChildren().forEach(enemy => {
            let distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            let chaseRange = 550;
        
            if (distance < chaseRange) {
                this.physics.moveToObject(enemy, this.player, 125);
            } else {
                enemy.setVelocity(enemy.wanderDirection.x * 50, enemy.wanderDirection.y * 50);
            }
        
            // Set the enemy's rotation based on its velocity
            if (enemy.body.velocity.x !== 0 || enemy.body.velocity.y !== 0) {
                enemy.rotation = Math.atan2(enemy.body.velocity.y, enemy.body.velocity.x) + Math.PI / 2; // Adjust to face upwards
            }
        
            // Update the enemy's health bar
            enemy.healthBar.clear();
            enemy.healthBar.fillStyle(0xff0000, 1);
            enemy.healthBar.fillRect(enemy.x - 20, enemy.y - 35, 40, 5); // Move the health bar on top
            enemy.healthBar.fillStyle(0x00ff00, 1);
            enemy.healthBar.fillRect(enemy.x - 20, enemy.y - 35, 40 * (enemy.currentHp / enemy.maxHp), 5);
        
            // Update the rarity text position
            enemy.rarityText.setPosition(enemy.x, enemy.y - 50);
        });
        
    
        // Update the HP bar
        this.updateHpBar();
    
        // Update health and rotate bush enemies
        this.bushes.getChildren().forEach(bush => {
            // Update bush health bar
            bush.healthBar.clear();
            bush.healthBar.fillStyle(0xff0000, 1);
            bush.healthBar.fillRect(bush.x - 20, bush.y - 35, 40, 5); // Bush HP bar on top
            bush.healthBar.fillStyle(0x00ff00, 1);
            bush.healthBar.fillRect(bush.x - 20, bush.y - 35, 40 * (bush.currentHp / bush.maxHp), 5);
        });
    }
    

    spawnBush(x, y, rarity) {
        let bush = this.physics.add.sprite(x, y, 'bush');
        bush.setScale(1); // Scale the bush to make it smaller
        bush.setDepth(1); // Set base depth for bush
    
        // Use the same health and damage mechanics as square enemies
        const rarityMultiplier = this.getRarityMultiplier(rarity);
        bush.maxHp = 60 * rarityMultiplier; // Match square health mechanics
        bush.currentHp = bush.maxHp;
    
        // Health bar for bush
        bush.healthBar = this.add.graphics();
        bush.healthBar.setDepth(5); // Ensure health bar is on top
    
        // Add rarity text above the bush
        bush.rarityText = this.add.text(bush.x, bush.y - 50, rarity, { fontSize: '25px', fill: '#ffffff' });
        bush.rarityText.setOrigin(0.5);
        bush.rarityText.setDepth(6); // Ensure rarity text is on top
    
        // Bush properties
        bush.body.immovable = true; // Make it stationary
        bush.body.moves = false;    // Disable movement
        bush.damageDelt = 20 * rarityMultiplier; // Match square damage mechanics
       
    
        // Add the bush to the bushes group
        this.bushes.add(bush); // <-- Corrected here

    
    
        // Update bush health bar
        bush.healthBar.clear();
        bush.healthBar.fillStyle(0xff0000, 1);
        bush.healthBar.fillRect(bush.x - 20, bush.y - 35, 40, 5); // HP bar on top
        bush.healthBar.fillStyle(0x00ff00, 1);
        bush.healthBar.fillRect(bush.x - 20, bush.y - 35, 40 * (bush.currentHp / bush.maxHp), 5);
    
        // Update rarity text position
        bush.rarityText.setPosition(bush.x, bush.y - 50);
    }


    attemptSpawnBush() {
        // Randomly spawn a bush with rarity logic
        let rarity = Math.random() < 0.1 ? 'rare' : 'common';
        let x = Phaser.Math.Between(4000, 6000);
        let y = Phaser.Math.Between(6200, 8000);

        if (rarity === 'rare') {
            this.spawnBush(x, y, rarity); // Rare bush with more health
        } else {
            this.spawnBush(x, y, rarity);
        }
    }
    handleBushCollision(player, bush) {
        if (!this.damageCooldown) {
            this.takeDamage(bush.damageDelt);
            this.player.setTint(0xff0000);
            this.time.delayedCall(100, () => {
                this.player.clearTint();
            });
    
            this.damageCooldown = true;
            this.time.delayedCall(500, () => {
                this.damageCooldown = false;
            });
        }
    
        if (!bush.damageCooldown) {
            this.damageBush(bush, 5);
            bush.setTint(0xff0000);
            this.time.delayedCall(100, () => {
                bush.clearTint();
            });
    
            bush.damageCooldown = true;
            this.time.delayedCall(500, () => {
                bush.damageCooldown = false;
            });
        }
    
        // Bounce effect for bushes
        const angle = Phaser.Math.Angle.Between(player.x, player.y, bush.x, bush.y);
        const bounceForce = 2000; // Adjust this value to control bounce strength
        player.body.velocity.x += Math.cos(angle) * bounceForce;
        player.body.velocity.y += Math.sin(angle) * bounceForce;
    }
    
    
    
    


    damageBush(bush, amount) {
        bush.currentHp = Phaser.Math.Clamp(bush.currentHp - amount, 0, bush.maxHp);
        if (bush.currentHp <= 0) {
            this.bushDied(bush);
        }
    }

    bushDied(bush) {
        bush.rarityText.destroy();
   
        bush.healthBar.destroy();
        bush.destroy();
    }




    autoHeal() {
        if (this.currentHp <= (this.hp - 50)) {
            this.currentHp += 50;
        }
    }

    createHpBar() {
        this.hpBarContainer = document.createElement('div');
        this.hpBarContainer.style.position = 'absolute';
        this.hpBarContainer.style.top = '20px';
        this.hpBarContainer.style.right = '20px';
        this.hpBarContainer.style.width = '250px';
        this.hpBarContainer.style.height = '30px';
        this.hpBarContainer.style.borderRadius = '30px';
        this.hpBarContainer.style.backgroundColor = '#000';
        this.hpBarContainer.style.padding = '5px';
        this.hpBarContainer.style.boxSizing = 'border-box';
        document.body.appendChild(this.hpBarContainer);

        this.hpBar = document.createElement('div');
        this.hpBar.style.height = '100%';
        this.hpBar.style.width = '100%';
        this.hpBar.style.borderRadius = '30px';
        this.hpBar.style.backgroundColor = '#ffe100';
        this.hpBar.style.boxSizing = 'border-box';
        this.hpBarContainer.appendChild(this.hpBar);

        this.updateHpBar();
    }

    createBottomBoxes() {

    }
    
    createPetalSlots() {
        this.petalSlots = [];
        const petalContainer = document.createElement('div');
        petalContainer.style.position = 'absolute';
        petalContainer.style.bottom = '15px'; // Position below the existing slots
        petalContainer.style.left = '50%';
        petalContainer.style.transform = 'translateX(-50%)';
        petalContainer.style.maxWidth = '100%'; // Remove the max width to prevent stacking
        document.body.appendChild(petalContainer);

        for (let i = 0; i < 10; i++) {
            const petal = document.createElement('div');
            petal.style.width = '43px';
            petal.style.height = '43px';
            petal.style.backgroundColor = '#f7f3f1';
            petal.style.display = 'inline-block';
            petal.style.margin = '3px 3px';
            petal.style.borderRadius = '5px';
            petal.style.border = '3px solid #ccc5c0';
            petalContainer.appendChild(petal);
            this.petalSlots.push(petal);

            const nobBasicPetal = document.createElement('img');
            nobBasicPetal.style.width = '33px';
            nobBasicPetal.src = 'src/assets/squareBud.png';
            nobBasicPetal.style.padding = '5px';
            nobBasicPetal.style.height = '33px';
            nobBasicPetal.style.borderRadius = '3px';
            nobBasicPetal.style.backgroundColor = 'black';
            nobBasicPetal.style.cursor = 'pointer';
            petal.appendChild(nobBasicPetal);
        }
    }

    createUtilityIcons() {
        const boxes = [
            { BOXborder: '#4981b1', BGcolor: '#5a9fdb', color: '#5a9fdb', border: '4px solid #4981b1', key: '(C)', image: 'src/assets/crafting.svg', content: 'Crafting' }
        ];

        const boxContainer = document.createElement('div');
        boxContainer.style.position = 'absolute';
        boxContainer.style.bottom = '5px';
        boxContainer.style.left = '10px';
        boxContainer.style.display = 'flex';
        boxContainer.style.flexDirection = 'column';
        boxContainer.style.alignItems = 'flex-start';
        document.body.appendChild(boxContainer);

        boxes.forEach((boxInfo, index) => {
            const box = document.createElement('div');
            box.style.width = '43px';
            box.style.height = '43px';
            box.style.backgroundColor = boxInfo.color;
            box.style.margin = '3px 0';
            box.style.borderRadius = '5px';
            box.style.border = boxInfo.border;
            box.style.position = 'relative';
            box.style.cursor = 'pointer';
            boxContainer.appendChild(box);

            // Create and style the image
            const image = document.createElement('img');
            image.src = boxInfo.image;
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.borderRadius = '3px';
            box.appendChild(image);

            // Add event listener to the box to redirect to the crafting scene
            box.addEventListener('click', () => {
                this.scene.start('crafting');
            });

            const tooltip = document.createElement('div');
            tooltip.style.position = 'absolute';
            tooltip.style.bottom = '100%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.marginBottom = '5px';
            tooltip.style.padding = '5px 10px';
            tooltip.style.backgroundColor = '#000';
            tooltip.style.color = '#fff';
            tooltip.style.borderRadius = '5px';
            tooltip.style.fontSize = '12px';
            tooltip.style.whiteSpace = 'nowrap';
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
            tooltip.style.transition = 'opacity 0.3s';
            tooltip.innerHTML = `${boxInfo.key} ${boxInfo.content}`;
            box.appendChild(tooltip);

            box.addEventListener('mouseover', () => {
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';
            });

            box.addEventListener('mouseout', () => {
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
            });

            const nobLetter = document.createElement('div');
            nobLetter.style.position = 'absolute';
            nobLetter.style.bottom = '0';
            nobLetter.style.right = '0';
            nobLetter.style.fontSize = '10px';
            nobLetter.style.backgroundColor = boxInfo.BGcolor;
            nobLetter.style.color = '#fff';
            nobLetter.style.padding = '2px 4px';
            nobLetter.style.borderRadius = '3px';
            nobLetter.style.border = boxInfo.BOXborder;
            nobLetter.innerHTML = boxInfo.key;
            box.appendChild(nobLetter);
        });
    }

    updateHpBar() {
        const hpPercentage = this.currentHp / this.hp;
        this.hpBar.style.width = `${hpPercentage * 100}%`;
    }

    handleCollision(player, enemy) {
        if (!this.damageCooldown) {
            this.takeDamage(enemy.damageDelt);
            this.player.setTint(0xff0000);
            this.time.delayedCall(100, () => {
                this.player.clearTint();
            });
    
            this.damageCooldown = true;
            this.time.delayedCall(500, () => {
                this.damageCooldown = false;
            });
        }
    
        if (!enemy.damageCooldown) {
            this.damageEnemy(enemy, 5);
            enemy.setTint(0xff0000);
            this.time.delayedCall(100, () => {
                enemy.clearTint();
            });
    
            enemy.damageCooldown = true;
            this.time.delayedCall(500, () => {
                enemy.damageCooldown = false;
            });
        }
    
        // Bounce effect
        const angle = Phaser.Math.Angle.Between(player.x, player.y, enemy.x, enemy.y);
        const bounceForce = 200; // Adjust this value to control bounce strength
        player.body.setVelocity(Math.cos(angle) * -bounceForce, Math.sin(angle) * -bounceForce);
    }
    
    
    
    takeDamage(amount) {
        this.currentHp = Phaser.Math.Clamp(this.currentHp - amount, 0, this.hp);
        this.smoothHpBarDecrease();
        if (this.currentHp <= 0) {
            this.playerDied();
        }
    }

    damageEnemy(enemy, amount) {
        enemy.currentHp = Phaser.Math.Clamp(enemy.currentHp - amount, 0, enemy.maxHp);
        if (enemy.currentHp <= 0) {
            this.enemyDied(enemy);
        }
    }

    enemyDied(enemy) {
        enemy.rarityText.destroy();
   
        enemy.healthBar.destroy();
        enemy.destroy();
    }

    smoothHpBarDecrease() {
        this.tweens.addCounter({
            from: this.hpBar.clientWidth,
            to: (this.currentHp / this.hp) * 250,
            duration: 200,
            onUpdate: (tween) => {
                this.hpBar.style.width = `${tween.getValue()}px`;
            }
        });
    }

    playerDied() {
        this.currentHp = this.hp;
        this.player.setPosition(Phaser.Math.Between(4000, 6000), Phaser.Math.Between(6200, 8000));
        this.currentHp = this.hp / 3;
        this.smoothHpBarDecrease();
    }

    changeDirection(enemy) {
        const directions = [
            new Phaser.Math.Vector2(1, 0),
            new Phaser.Math.Vector2(-1, 0),
            new Phaser.Math.Vector2(0, 1),
            new Phaser.Math.Vector2(0, -1),
            new Phaser.Math.Vector2(1, 1).normalize(),
            new Phaser.Math.Vector2(-1, -1).normalize(),
            new Phaser.Math.Vector2(-1, 1).normalize(),
            new Phaser.Math.Vector2(1, -1).normalize()
        ];

        enemy.wanderDirection = Phaser.Utils.Array.GetRandom(directions);
    }

    changeEnemiesDirection() {
        this.enemies.getChildren().forEach(enemy => {
            this.changeDirection(enemy);
        });
    }

    spawnEnemies(count) {
        for (let i = 0; i < count; i++) {
            let x = Phaser.Math.Between(4000, 6000);
            let y = Phaser.Math.Between(6200, 8000);

            const rarityRoll = Phaser.Math.Between(1, 1000);
            let rarity, color, scale, hpMultiplier, massMultiplier, damageMultiplier;
            
            if (rarityRoll <= 750) {
                rarity = 'Nob';
                color = '#1b1b1b';
                scale = 1.5;
                hpMultiplier = 1;
                damageMultiplier = 1;
                massMultiplier = 1;
            } else if (rarityRoll <= 975) {
                rarity = 'Mythic';
                color = '#1ce7eb';
                scale = 3;
                hpMultiplier = 50;
                damageMultiplier = 20;
                massMultiplier = 10;
            } else if (rarityRoll <= 999) {
                rarity = 'Ultra';
                color = '#ff0084';
                scale = 5;
                hpMultiplier = 10000;
                damageMultiplier = 100;
                massMultiplier = 100;
            } else {
                rarity = 'Super';
                color = '#00ffb7';
                scale = 7;
                hpMultiplier = 1000 * 10000;
                damageMultiplier = 250;
                massMultiplier = 1000;
            }

            let enemy = this.physics.add.sprite(x, y, 'enemy');
            enemy.setScale(scale);
            enemy.setDepth(1);
            enemy.rarity = rarity;

            enemy.body.setCircle(enemy.width * 0.3, enemy.width * 0.2, enemy.height * 0.2);

            enemy.damageMultiplier = damageMultiplier;
            enemy.body.setMass(massMultiplier);

            enemy.wanderDirection = new Phaser.Math.Vector2(0, 0);
            this.changeDirection(enemy);

    

        

        
            enemy.healthBar = this.add.graphics();
            enemy.healthBar.setDepth(2);

            enemy.currentHp = 60 * hpMultiplier;
            enemy.maxHp = 60 * hpMultiplier;
            enemy.damageDelt = 20 * damageMultiplier;

            enemy.rarityText = this.add.text(enemy.x, enemy.y - 35, rarity, { fontSize: '25px', fill: color });
            enemy.rarityText.setOrigin(0.5);
            enemy.rarityText.setDepth(3); 

            this.enemies.add(enemy);
        }
    }

    attemptSpawnEnemy() {
        if (Phaser.Math.Between(1, 2) === 1) {
            this.spawnEnemies(1);
        }
    }

    getRarityMultiplier(rarity) {
        switch (rarity) {
            case 'Nob': return 1;
            case 'Mythic': return 5;
            case 'Ultra': return 100;
            case 'Super': return 250;
            default: return 1;
        }
    }

    chasePlayer(player, enemy) {
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: true, 
    scene: mainMap,
    physics: {
        default: 'arcade',
        arcade: {
            fps: 60,
            debug: false
        }
    }
};

const game = new Phaser.Game(config);

export default mainMap;

