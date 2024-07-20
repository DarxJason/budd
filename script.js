export class mainMap extends Phaser.Scene {
    constructor() {
        super("mainMap");
    }
    preload() {
        this.load.tilemapTiledJSON('maps', 'src/assets/map.json');
        this.load.image('tiles', 'src/assets/tileset.png');
    }
    create() {        
        const map = this.make.tilemap({ key: 'maps'});
        const tileset = map.addTilesetImage('tileset', 'tiles');
        const layer = map.createLayer('map', tileset, 0, 0);

    }
    update() {
    }
}


const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 1000,
    pixelArt: true,
    scene: mainMap,
    physics: {
        default: "arcade",
        arcade: {
            debug: false
        }
    }
};

const game = new Phaser.Game(config);

export default mainMap;
