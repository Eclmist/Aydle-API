
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
var io = require('socket.io')(serv,{});
// set allowed origins
//io.origins(["175.156.162.3:2000"]);

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
			socket.emit('updateGameList',socket.currentRoom.games);
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

	// update every other player's game list
	socket.on('notifyAddGame',function(newestGameList)
	{
		// store the games in the room object
		socket.currentRoom.games = newestGameList;
		socket.to(socket.currentRoom.code).emit('updateGameList', newestGameList);
	});


	socket.on('requestStartGames',function()
	{	
		socket.currentRoom.games.reverse();
		socket.currentRoom.isPlaying = true;
	});

//=============================== END Game Stuff =============================//

});


function IsRoomAvailable(code)
{
	let rooms = io.sockets.adapter.rooms;

	for(let room in rooms) 
	{
		if(room == code)
		{
			if(!gamerooms[code].isPlaying)
				return true;
		}
			
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
