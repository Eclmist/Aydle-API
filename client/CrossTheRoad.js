function CrossTheRoad(socketReference){

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 800,
    height: 600,
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
        gravity: { y: 0 }
      }
    },
    scene: {
      preload: preload,
      create: create,
      update: update
    } 
  };
   
  var game = new Phaser.Game(config);
   
  function preload()
  {
      this.load.image('ball', 'client/assets/ball.png');
      this.load.image('otherPlayer', 'client/assets/ball.png');
  }
   
  function create()
  {
      var self = this;

  
      socketRef.on('currentPlayers', function (players) {
          
        Object.keys(players).forEach(function (id) {
          if (players[id].playerId === self.socket.id) {
            addPlayer(self, players[id]);
          }
        });
      });
  
      // other players
      socketRef.on('newPlayer', function (playerInfo) {
          addOtherPlayers(self, playerInfo);
        });
        socketRef.on('disconnect', function (playerId) {
          self.otherPlayers.getChildren().forEach(function (otherPlayer) {
            if (playerId === otherPlayer.playerId) {
              otherPlayer.destroy();
            }
          });
        });
  }
   
  function update()
  {
  
  }
  
  
  var AddPlayer = function(self, playerInfo) {
      self.ball = self.physics.add.image(playerInfo.x, playerInfo.y, 'ball').setOrigin(0.5, 0.5).setDisplaySize(50, 50);
  
      self.ball.setDrag(100);
      self.ball.setAngularDrag(100);
      self.ball.setMaxVelocity(200);
    }
  
    function addOtherPlayers(self, playerInfo) {
      const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer').setOrigin(0.5, 0.5).setDisplaySize(53, 40);
  
  
      otherPlayer.playerId = playerInfo.playerId;
      self.otherPlayers.add(otherPlayer);
    }
}