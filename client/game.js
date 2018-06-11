
var config = {
  type: Phaser.AUTO,
  parent: 'phaser-example',
  width: 800,
  height: 300,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 500 }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  } 
};
 
//var game = new Phaser.Game(config);
 

function preload()
{
    alert('preload');
    this.load.image('monster', 'client/assets/monster.png');
    this.load.image('otherPlayer', 'client/assets/monster.png');
    this.load.image('background','client/assets/background.png');
    this.load.image('ground','client/assets/ground.png');
    this.load.image('forest','client/assets/forest.jpg');
}


function create() {

    
    var self = this;

    window.addEventListener('resize', resize);
    resize();

    
    var bg = self.add.image(0,0,'background');

    this.input.on('pointerdown',function(event)
    {
        this.monster.body.velocity.y = -200;
    },this);

    // get the client socket reference
    this.socket = clientSocket.GetSocket();


    this.otherPlayers = this.physics.add.group();
    this.socket.on('currentPlayers', function (players) {
      Object.keys(players).forEach(function (id) {
        if (players[id].playerID === self.socket.id) {
          addPlayer(self, players[id]);
        } else {
          addOtherPlayers(self, players[id]);
        }
      });
    });
    this.socket.on('newPlayer', function (playerInfo) {
      addOtherPlayers(self, playerInfo);
    });
    this.socket.on('disconnect', function (playerId) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
            
          if (playerId === otherPlayer.playerId) {
            otherPlayer.destroy();
          }
        });
      });

      this.socket.on('playerMoved', function (playerInfo) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
          if (playerInfo.playerID === otherPlayer.playerId) {
            otherPlayer.setPosition(playerInfo.x, playerInfo.y);
          }
        });
      });
  }
 

function update()
{

    if(this.monster)
    {
        // emit player movement
        var x = this.monster.x;
        var y = this.monster.y;
        if (this.monster.oldPosition && (x !== this.monster.oldPosition.x || y !== this.monster.oldPosition.y))
        {
            this.socket.emit('playerMovement', { x: this.monster.x, y: this.monster.y});
        }
 
        // save old position data
        this.monster.oldPosition = 
        {
        x: this.monster.x,
        y: this.monster.y,
        };
    }


}

function resize() {
    var canvas = game.canvas, width = window.innerWidth, height = window.innerHeight;
    var wratio = width / height, ratio = canvas.width / canvas.height;
 
    if (wratio < ratio) {
        canvas.style.width = width + "px";
        canvas.style.height = (width / ratio) + "px";
    } else {
        canvas.style.width = (height * ratio) + "px";
        canvas.style.height = height + "px";
    }
}


function addPlayer(self, playerInfo) {
    self.monster = self.physics.add.image(getRandPos(100,40), 195, 'monster').setOrigin(0.5, 0).setDisplaySize(50, 50);
    self.monster.body.collideWorldBounds = true;
   // self.ball.setDrag(100);
    //self.ball.setAngularDrag(100);
    //self.ball.setMaxVelocity(200);
  }

  function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.physics.add.sprite(getRandPos(100,40), 195, 'otherPlayer').setOrigin(0.5, 0).setDisplaySize(50, 50);
    otherPlayer.body.collideWorldBounds = true;

    otherPlayer.playerId = playerInfo.playerID;
    self.otherPlayers.add(otherPlayer);
  }

  function getRandPos(max, min)
  {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  