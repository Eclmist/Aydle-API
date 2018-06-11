function GameManager(clientSocket)
{

    let game;
    let configuration;
    let chosenGames = [];

    GameManager.prototype.GetConfig = function()
    {
        if(configuration)
            return configuration;
        else
            console.log('There is no configuration yet!');
    }

    GameManager.prototype.GetGameReference = function()
    {
        if(game)
            return game;
        else
            console.log('No game instance running yet!');
    }

    GameManager.prototype.AddChosenGame = function(chosenGame)
    {
        chosenGames.push(chosenGame);
    }

    GameManager.prototype.StartGames = function()
    {
        StartNextGame();
    }

     // Wire the preload, create and update functions
     function InitGame(gameReference)
     {
           // Use the current cofiguration
           configuration = gameReference.config();

     }
 
     function RunGame()
     {
         if(configuration)
             game = new Phaser.Game(configuration);
     }
    
    function StartNextGame()
    {
        InitGame(chosenGames[chosenGames.length-1]);
        RunGame();
        chosenGames.pop();
    }



    


    
    


}