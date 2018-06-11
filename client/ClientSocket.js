// Handles all socket related stuff for the client 
function ClientSocket(){

var socket;

ClientSocket.prototype.GetSocket = function()
{
    return socket;
}

ClientSocket.prototype.InitSocketConnection = function()
{
    socket = io('aydle-api.azurewebsites.net');

    // From now on, all socket handlers go here

    //===================================================================//
    //=========================== ALL Game Managers =====================//
    //===================================================================//






    //===================================================================//
    //=========================== Room Manager ==========================//
    //===================================================================//

    // When the user has set his name
	socket.on('notifyJoin', function(data)
	{
		alert(data.nameOfClient + ' has joined room ' + data.roomCode);

		if (typeof OnNameSet !== "undefined")
			OnNameSet();

    });


	// When the user successfully connects but have not set his name yet
	socket.on('onJoin', function(data)
	{
		if (typeof OnJoinSuccess !== "undefined")	
			OnJoinSuccess();


        //loadScript('client/game.js',function(){});
        
        gameManager.StartGames();

	});

	socket.on('onJoinFail', function(data)
	{
		if (typeof OnJoinFail !== "undefined")	
			OnJoinFail();


		alert('failed to join');	
		
	});


	// When the user has successfully hosted a room
	socket.on('onHostCode', function(data)
	{
		let temp = data.generatedCode;
		alert('code for room is : ' + temp);

		if (typeof OnHostSuccess !== "undefined") 
            OnHostSuccess(temp);
            
        //loadScript('client/game.js',function(){});
        gameManager.AddChosenGame(PassTheBomb);

	});





}




}




