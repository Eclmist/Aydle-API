// this gonna be filled with server stuff


// setup express
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req,res){
	res.sendFile(__dirname + '/client/index.html');
	//res.send('hello there!');
	
});

app.use('/client', express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);

// require modules
var PassTheBombServer = require('games/PassTheBombServer');
var RoomUtils = require('server/RoomUtils');



var gamerooms = {};

// setup socket.io
//var io = require('socket.io')(serv,{origins : '164.78.250.116'});
var io = require('socket.io')(serv,{});

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
		 let tempRooms = GetRoomsByUser(socket.id)

		if(tempRooms !== undefined)
		{
			let code = GetRoomsByUser(socket.id)[0];
			
			if(gamerooms)
			{
				if(gamerooms[code])
				{
					gamerooms[code].RemovePlayer(socket.id);
					CheckForEmptyRooms();
				}			
			}	 		

			
			io.to(code).emit('disconnect',socket.id);

		}

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

			gamerooms[data.code].AddPlayer(socket.id);

			socket.emit('onJoin');
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
		
		let createdRoom = RoomUtils.CreateRoom();
		createdRoom.AddPlayer(socket.id);
		
		gamerooms[generatedCode] = createdRoom;

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

	
//=============================== Game Stuff =================================//
	

	socket.on('enterGame', function(data)
	{

		

	});

	  // tell every other player except himself in the room what game to prepare
	socket.on('requestAddGame',function(game)
	{
		console.log('host has added a game!');
		let roomCode = GetRoomsByUser(socket.id)[0];
		//socket.broadcast.to(roomCode).emit('addGame', game);
	});

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



// check for rooms with no players and delete them
function CheckForEmptyRooms()
{

	if(gamerooms)
	{
		Object.keys(gamerooms).forEach(function(code)
		{
			console.log('room ' + code);
			console.log(gamerooms[code].players);
		});

	}

}
