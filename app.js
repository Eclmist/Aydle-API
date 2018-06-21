
// setup express
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req,res){
	//res.sendFile(__dirname + '/client/index.html');
	res.send('Error 404');
	
});

app.use('/client', express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);

// require modules
var PassTheBombServer = require('games/PassTheBombServer');
var RoomUtils = require('server/RoomUtils');

// store a reference to all game rooms so we can access it without the socket's reference
var gamerooms = {};

// setup socket.io
//var io = require('socket.io')(serv,{origins : '164.78.250.116'});
var io = require('socket.io')(serv,{});

io.sockets.on('connection', function(socket)
{
	console.log('a client connected');

	// Pass the socket reference to all the game servers here ---------------------------//
	PassTheBombServer.Init(io,socket);



	//-----------------------------------------------------------------------------------//


	// Set up all server handlers here
	socket.emit('onConnected');
	
	socket.on('disconnect', function(socket)
	{
		console.log('a client disconnected');
		
	});

	socket.on('disconnecting',function(reason)
	{
		// check for room property
		// socket may not have the room object attached if disconnect fires upon join/host failure
		if('currentRoom' in socket)
		{
			socket.currentRoom.RemovePlayer(socket.id);
			CheckForEmptyRooms();

			// this line needs revision ***
			io.to(socket.currentRoom.code).emit('disconnect',socket.id);
		}
	});

	// route the user to another socket channel
	socket.on('requestJoin',function(code)
	{
		console.log('joing room ' + code + '.....');
		
		if(IsRoomAvailable(code))
		{
			socket.leaveAll();
			socket.join(code);

			gamerooms[code].AddPlayer(socket.id);
			// store the room object in the socket object
			socket.currentRoom = gamerooms[code];

			let playerSelf = socket.currentRoom.GetPlayerByID(socket.id);

			// give information about the room(games/players etc...) to the new player that joined
			socket.emit('onJoin',socket.currentRoom.players,playerSelf);
			socket.emit('getGameList',socket.currentRoom);
		}
		else
		{
			socket.emit('onJoinFail');
			socket.disconnect();
		}	
	});

	socket.on('requestHost',function()
	{
		console.log('hosting room...');
		let generatedCode = GenerateUniqueCode(4);
		console.log('host created room ' + generatedCode);

		// leave the default socket.io room
		socket.leaveAll();
		socket.join(generatedCode);
		
		// create the room object
		let createdRoom = RoomUtils.CreateRoom(generatedCode);
		createdRoom.AddPlayer(socket.id);
		gamerooms[generatedCode] = createdRoom;
		// store the room object in the socket object
		socket.currentRoom = createdRoom;

		socket.emit('onHostCode',generatedCode);
	});


	socket.on('enterRoomAs',function(name)
	{
		let roomCode = socket.currentRoom.code;
		console.log('entering room '+ roomCode +' as ' + name);

		socket.currentRoom.players.forEach(element => {
			if(element.playerID === socket.id)
				element.name = name;
		});

		socket.broadcast.to(roomCode).emit('notifyJoin',name,roomCode);
	});

//=============================== Game Stuff =================================//

	  // tell every other player except himself in the room what game to prepare
	socket.on('requestAddGame',function(gameref)
	{
		console.log('host has added a game!');
		socket.currentRoom.games.push(gameref);
	});


	socket.on('requestStartGames',function()
	{	
		socket.currentRoom.games.reverse();
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

// returns the code for the room that the player joined
function GetRoomUserIsIn(id)
{
	let userRooms = GetRoomsByUser(id);

	if(userRooms.length > 0)
		return userRooms[0];
	else
		return null;

}

function GetRoomsByUser(id)
{
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

function GenerateUniqueCode(codeCount) 
{
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


// check for rooms with no players and delete them
function CheckForEmptyRooms()
{
	if(gamerooms)
	{
		Object.keys(gamerooms).forEach(function(code)
		{
			// if there are no players in the room
			if(gamerooms[code].players.length < 1)
			{
				console.log('deleting empty room');
				delete gamerooms[code];
			}
			
		});
		
		console.log(gamerooms);
	}
}
