
// setup express
var express = require('express');
var cors = require('cors');
var app = express();

var whitelist = ['https://aydle.com', 'https://www.aydle.com', 'http://localhost:8080']
var corsOptions = {
	origin: function(origin, callback){
        var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
        callback(null, originIsWhitelisted);
    },
	credentials: true
}
app.use(cors(corsOptions));

app.get('/',function(req,res){
	//res.sendFile(__dirname + '/client/index.html');
	res.send('running');
});	

app.get('/games', function (req,res)
{
	res.send(
		{
			
		});
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
var RoomUtils = require('server/RoomUtils');
var GameUtils = require('server/GameUtils');

// store a reference to all game rooms so we can access it without the socket's reference
var gamerooms = {};

// setup socket.io
const io = require('socket.io')(serv, {});

// restrict to only stuff
// io.set('origins', 'https://aydle.com:* https://www.aydle.com:* http://localhost:*')

io.sockets.on('connection', function(socket)
{
	console.log('a client connected');

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
			//socket.currentRoom.RemovePlayer(socket.id);
			CheckForEmptyRooms();
		
			io.in(socket.currentRoom.code).emit('onPeerUpdate',
			{
				playerID : playerID,
				hasDisconnected : 'user-left'
			});

			let host = socket.currentRoom.GetHost();
			io.in(socket.currentRoom.code).emit('onPeerUpdate',
			{
				playerID : host.playerID,
				isHost : host.isHost
			});
		}
	});

	// route the user to another socket channel
	socket.on('requestJoin',function(code,playerID,successCallback,failureCallback)
	{
    
		let room = gamerooms[code];
		
		if(room !== undefined)
		{
			if(CanJoinRoom(room))
			{
				socket.leaveAll();
				socket.join(code);

				// grab the old player before adding the new one
				let oldPlayer = room.GetPlayerByPlayerID(playerID);
			
				room.AddPlayer(socket.id,playerID);
				socket.currentRoom = room;
				socket.emit('onJoin',room);

				if(oldPlayer !== undefined)
				{
					socket.emit('onPeerUpdate', 
					{
						playerID : oldPlayer.playerID,
						hasDisconnected : 'multiple-clients-detected'
					});

					socket.currentRoom.RemovePlayer(oldPlayer.socketID);
				}
				
				let player = socket.currentRoom.GetPlayerBySocketID(socket.id);
				
				successCallback();
				io.in(socket.currentRoom.code).emit('onPeerUpdate', player);
						
			}
		}
		else
		{
			failureCallback();
			socket.disconnect();
		}

	});

	socket.on('requestHost',function(playerID,roomName,callback)
	{
		console.log('hosting room...');
		let generatedCode = GenerateUniqueCode(4);
		console.log('host created room ' + generatedCode);

		// leave the default socket.io room
		socket.leaveAll();
		socket.join(generatedCode);
		
		// create the room object
		let createdRoom = RoomUtils.CreateRoom(generatedCode);
		createdRoom.name = roomName;
		createdRoom.AddPlayer(socket.id,playerID);
		gamerooms[generatedCode] = createdRoom;
		// store the room object in the socket object	
		socket.currentRoom = createdRoom;

		socket.emit('onJoin',createdRoom);
		callback();
	});

	socket.on('kickPlayer',function(roomCode,playerID)
	{
		let room = gamerooms[roomCode];

		if(room !== undefined)
		{
			let player = room.GetPlayerByPlayerID(playerID);

			if(player !== undefined)
			{
				socket.to(socket.currentRoom.code).emit('onPeerUpdate',{playerID:playerID,hasDisconnected:true});
				room.RemovePlayer(player.socketID);
			}

		}

	});

	socket.on('setName',function(name, callback)
	{
		let playerThatChangedName;

		for(let i = 0; i < socket.currentRoom.players.length; i++)
		{
			if(socket.currentRoom.players[i].socketID === socket.id)
			{
				socket.currentRoom.players[i].name = name;
				socket.currentRoom.players[i].isInitialized = true;
				playerThatChangedName = socket.currentRoom.players[i];
				break;
			}
		}

		if(playerThatChangedName !== undefined)
		{
			callback()
			io.in(socket.currentRoom.code).emit('onPeerUpdate',
			{
				playerID:playerThatChangedName.playerID,
				name:playerThatChangedName.name,
				isInitialized:playerThatChangedName.isInitialized
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
    createdRoom.AddPlayer('dummy','dummy');
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

	 return code.toUpperCase();
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
