// this gonna be filled with server stuff

// setup express
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req,res){
	//res.sendFile(__dirname + '/client/index.html');
	res.send('hello there!');
	
});

app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);

var PassTheBombServer = require('games/PassTheBombServer');
var PlayerManager = require('games/PlayerManager');

var playerManager = new PlayerManager();

// setup socket.io
var io = require('socket.io')(serv,{origins : '164.78.250.116'});

io.sockets.on('connection', function(socket)
{
	console.log('a client connected');

	// Pass the socket reference to all the game servers
	PassTheBombServer.Init(socket);


	// Set up all server handlers here
	socket.emit('onConnected');

	
	socket.on('disconnect', function(socket)
	{
		console.log('a client disconnected');
		
	});

	socket.on('disconnecting',function(reason)
	{
		let code = GetRoomsByUser(socket.id)[0];
		playerManager.RemovePlayer(socket.id);
		io.to(code).emit('disconnect',socket.id);
		
	});

	// just a test function
	socket.on('doserverstuff',function(data)
	{
		console.log(GetRoomsByUser(socket.id));
	});


	// route the user to another socket channel
	socket.on('requestJoin',function(data)
	{
		console.log('joing room ' + data.code + '.....');

		
		if(IsRoomAvailable(data.code))
		{
			socket.leaveAll();
			socket.join(data.code);
			socket.emit('onJoin');
			console.log(io.sockets.adapter.rooms);
		}
		else
		{
			socket.emit('onJoinFail');
			socket.disconnect();
		}
		
	});


	socket.on('requestHost',function(data)
	{

		console.log('hosting room...');
		let generatedCode = GenerateUniqueCode(4);
		console.log('host created room ' + generatedCode);

		// leave the default socket.io room
		socket.leaveAll();
		socket.join(generatedCode);
		
		socket.emit('onHostCode',
		{
			generatedCode : generatedCode
		});

	});


	socket.on('enterRoomAs',function(data)
	{
		let roomCode = GetRoomsByUser(socket.id)[0];
		console.log('entering room '+ roomCode +' as ' + data.name);
		let nameOfClient = data.name;
		

		socket.broadcast.to(roomCode).emit('notifyJoin',
		{
			nameOfClient :  nameOfClient,
			roomCode : roomCode
		});
	});

	socket.on('enterGame', function(data)
	{
		// for now initilize the player as he joins the room
		// dont allow same player to join
		let addedBefore = false;
		let players = playerManager.GetPlayers();

		Object.keys(players).forEach(function (id)
		{
			
			if (players[id].playerID === socket.id)
			{
			  addedBefore = true;
			}
		});

		if(!addedBefore)
		{
			console.log('adding');
			playerManager.AddPlayer(socket.id);
			
			// send the list of players to the new player
			socket.emit('currentPlayers', playerManager.GetPlayers());
			// update all other players of the new player
			let roomCode = GetRoomsByUser(socket.id)[0];
			socket.broadcast.to(roomCode).emit('newPlayer', playerManager.GetPlayer(socket.id));
		}

	});


	// when a player moves, update the player data
	socket.on('playerMovement', function (movementData) {
		let movingPlayer = playerManager.GetPlayer(socket.id);
		let roomCode = GetRoomsByUser(socket.id)[0];
		
		movingPlayer.x = movementData.x;
		movingPlayer.y = movementData.y;
		movingPlayer.rotation = movementData.rotation;

		// emit a message to all players about the player that moved
		socket.broadcast.to(roomCode).emit('playerMoved', movingPlayer);
  	});
	
//=============================== Game Stuff =================================//
	


	socket.on('requestStartGame',function(data)
	{

	});

//=============================== END Game Stuff =============================//

});


function IsRoomAvailable(code)
{
	let rooms = io.sockets.adapter.rooms;

	for(let room in rooms) 
	{
		if(room == code)
			return true;
	}

	return false;
}


function GetRoomsByUser(id){
    let usersRooms = [];
    let rooms = io.sockets.adapter.rooms;

    for(let room in rooms)
    {
        if(rooms.hasOwnProperty(room))
        {
            let sockets = rooms[room].sockets;
            if(id in sockets)
                usersRooms.push(room);          
        }
    }

    return usersRooms;	
}


const legalCharacters = "abcdefghijklmnopqrstuvwxyz0123456789";

function GenerateUniqueCode(codeCount) {
  let code = "";


  for (let i = 0; i < codeCount; i++)
    code += legalCharacters.charAt(Math.floor(Math.random() * legalCharacters.length));

 	let rooms = io.sockets.adapter.rooms;
 	for(let room in rooms)
 	{
		 if(room == code)
		 {
			GenerateUniqueCode(codeCount);
		 }
	 }
	 

	 return code;
}
