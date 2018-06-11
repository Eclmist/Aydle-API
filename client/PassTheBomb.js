function PassTheBomb()
{}

// all games must have a config function that returns a config
PassTheBomb.config = function(){
    return{
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 400,
    height: 600,
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
        gravity: { y: 0 }
      }
    },
    scene: {
      preload: PassTheBomb.Awake,
      create: PassTheBomb.Start,
      update: PassTheBomb.Update
    } 
  }
};

let tempAnswer = 0;
let expectedAnswer = 0;


PassTheBomb.Awake = function()
{
    this.load.image('background', 'client/assets/pass_the_bomb/background.jpeg');
    this.load.image('bomb', 'client/assets/pass_the_bomb/bomb.png');
    this.load.image('explosion', 'client/assets/pass_the_bomb/explosion.png');
    this.load.image('add', 'client/assets/pass_the_bomb/addbutton.png');
    this.load.image('pass', 'client/assets/pass_the_bomb/passbutton.png');

    this.load.audio('increment','client/assets/pass_the_bomb/increment.ogg');
    this.load.audio('boom','client/assets/pass_the_bomb/boom.wav');
}

PassTheBomb.Start = function()
{
    
    var self = this;
    self.add.image(0,0,'background');
    let add = self.add.sprite(0,600,'add').setOrigin(0,1).setDisplaySize(200,200);
    let pass = self.add.sprite(200,600,'pass').setOrigin(0,1).setDisplaySize(200,200);
    self.add.sprite(200,250,'bomb').setOrigin(0.5,0.5).setDisplaySize(200,200);
    let increment = self.sound.add('increment');
    let boom = self.sound.add('boom');

    let q = GenerateQuestion();
    let question = self.add.text(50, 100, q, { fontSize: '50px', fill: '#FFF' });

    add.setInteractive();
    pass.setInteractive();

    add.on('pointerdown',function(event)
    {
        increment.play();
        tempAnswer++;
        question.setText(q + tempAnswer);

        if(tempAnswer > expectedAnswer)
        {
            Explode(self);
        }
        
    });

    pass.on('pointerdown',function(event)
    {
        if(tempAnswer !== expectedAnswer)
        {
            Explode(self);
        }
        else
        {
            alert('Good Job!');
        }
    });

    function Explode(self)
    {
        self.add.sprite(200,250,'explosion');
        boom.play();
    }





}

PassTheBomb.Update = function()
{
    



}


function GenerateQuestion(difficulty)
{
    let temp = '';
    let x = getRandNumber(0,9);
    let y = getRandNumber(0,9);

    if(difficulty > 8)
    {
        expectedAnswer = x * y;
        return temp + x + ' X ' + y + ' = ';
    }
    else
    {
        expectedAnswer = x + y;
        return temp + x + ' + ' + y + ' = ';
    }
   
}

function getRandNumber(max, min)
{
    return Math.floor(Math.random() * (max - min + 1)) + min;
}




  
  