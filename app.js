
// setup express
var express = require('express');
var app = express();

app.get('/',function(req,res){
	//res.sendFile(__dirname + '/client/index.html');
	res.send('running');
});	

app.get('/what', function (req,res)
{
	res.send(res.headers);
});

app.get('/room/:id', function(req,res)
{
  let result = false;
  let code = req.params.id;

  if(RoomExist(req.params.id))
  {
    if(CanJoinRoom(gamerooms[code]))
    {
      result = true;
    }
	}

	res.send({result:result});
});


app.get('/dummy/:id', function(req,res)
{
  let code = req.params.id;
  let success = CreateDebugRoom(code);
  if(success)
    res.send('dummy room with code '+ code + ' created.');
  else
    res.send('room ' + code + ' already exist try another code');

});

app.get('/clear', function(req,res)
{
  DeleteDummyRooms();
  res.send('all dummy rooms deleted.');
});

// app.use((req, res, next) => {
  //'/client', express.static(__dirname + '/client')
// );

var serv = require('http').Server(app);

serv.listen(process.env.PORT || 2000);

// require modules
var PassTheBombServer = require('games/PassTheBombServer');
var RoomUtils = require('server/RoomUtils');

// store a reference to all game rooms so we can access it without the socket's reference
var gamerooms = {};

// setup socket.io

const io = require('socket.io')(serv, {});

// restrict to only stuff
// io.set('origins', 'https://aydle.com:* https://www.aydle.com:* http://localhost:*')

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
			let playerID = socket.currentRoom.GetPlayerBySocketID(socket.id).playerID;
			socket.currentRoom.RemovePlayer(socket.id);
			CheckForEmptyRooms();
		
			io.in(socket.currentRoom.code).emit('onPlayerUpdate', {playerID:playerID});
			let host = socket.currentRoom.GetHost();
			io.in(socket.currentRoom.code).emit('onPlayerUpdate',
			{
				playerID : host.playerID,
				isHost : host.isHost
			});
		}
	});

	// route the user to another socket channel
	socket.on('requestJoin',function(code,playerID,name)
	{
		console.log('joing room ' + code + '.....');
    
    let room = gamerooms[code];
    
    if(room !== undefined)
    {
      if(CanJoinRoom(room))
      {
        socket.leaveAll();
			  socket.join(code);

				room.AddPlayer(socket.id,playerID,name);
				let player = room.GetPlayerBySocketID(socket.id);
			  // store the room object in the socket object
			  socket.currentRoom = room;

			  // give information about the room(games/players etc...) to the new player that joined
				socket.emit('onJoin',socket.currentRoom);
				socket.to(socket.currentRoom.code).emit('notifyJoin', player);
				
        socket.emit('updateGameList',socket.currentRoom.games);  
        console.log(room.players);
      }
    }
    else
    {
      socket.emit('onJoinFail');
			socket.disconnect();
    }

	});

	socket.on('requestHost',function(playerID,name)
	{
		console.log('hosting room...');
		let generatedCode = GenerateUniqueCode(4);
		console.log('host created room ' + generatedCode);

		// leave the default socket.io room
		socket.leaveAll();
		socket.join(generatedCode);
		
		// create the room object
		let createdRoom = RoomUtils.CreateRoom(generatedCode);
		createdRoom.AddPlayer(socket.id,playerID,name);
		gamerooms[generatedCode] = createdRoom;
		// store the room object in the socket object	
		socket.currentRoom = createdRoom;

		socket.emit('onHostCode',createdRoom);
	});

	socket.on('kickPlayer',function(roomCode,playerID)
	{
		let room = gamerooms[roomCode];

		if(room !== undefined)
		{
			let player = room.GetPlayerByPlayerID(playerID);

			if(player !== undefined)
			{
				socket.to(socket.currentRoom.code).emit('onPlayerUpdate',{playerID:playerID});
				room.RemovePlayer(player.socketID);
			}

		}

	});

	socket.on('setName',function(name)
	{
		let playerThatChangedName;

		for(let i = 0; i < socket.currentRoom.players.length; i++)
		{
			if(players[i].socketID === socket.id)
			{
				player[i].name = name;
				playerThatChangedName = players[i];
				break;
			}
		}

		if(playerThatChangedName !== undefined)
		{
			io.in(socket.currentRoom.code).emit('onPlayerUpdate',
			{
				playerID:playerThatChangedName.playerID,
				name:name
			});
		}
			
		
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

function RoomExist(code)
{
  return gamerooms[code] !== undefined;
}

function CanJoinRoom(room)
{
  return !room.isPlaying;
}

function CreateDebugRoom(code)
{
	if(!RoomExist(code))
	{
    let createdRoom = RoomUtils.CreateRoom(code);
    createdRoom.AddPlayer('dummy','dummy','dummy');
    gamerooms[code] = createdRoom;
    return true;
  }
  
  return false;
}

function DeleteDummyRooms()
{
  Object.keys(gamerooms).forEach(function(code)
		{
			// if there are no players in the room
      if(gamerooms[code].players[0].socketID === 'dummy'
        && gamerooms[code].players[0].playerID === 'dummy')
			{
				console.log('deleting dummy rooms');
				delete gamerooms[code];
			}
			
		});
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
