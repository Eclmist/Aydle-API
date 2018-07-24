
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
app.use('/images', express.static(__dirname + '/images'));

app.get('/',function(req,res){
	//res.sendFile(__dirname + '/client/index.html');
	res.send('running');
});	

app.get('/games', function (req,res)
{
	let gameList = GetShortenedGameList();
	res.send(gameList);
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

//GameUtils.StartGameInstance("66824994",1,1);






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
		console.log('disconnecting...');
		// check for room property
		// socket may not have the room object attached if disconnect fires upon join/host failure
		if('currentRoom' in socket)
		{
			let player = socket.currentRoom.GetPlayerBySocketID(socket.id);
			socket.currentRoom.OnDisconnecting(socket.id);

			io.in(socket.currentRoom.code).emit('onPeerUpdate',
			{
				playerID : player.playerID,
				hasDisconnected : 'user-left'
			});
			
			let host = socket.currentRoom.GetHost();

			if (host !== undefined) {
				io.in(socket.currentRoom.code).emit('onPeerUpdate',
				{
					playerID : host.playerID,
					isHost : host.isHost
				});
			}
					
			CheckRoomIsAway(socket.currentRoom.code);
		}
	});

	

	// route the user to another socket channel
	socket.on('requestJoin',function(code,playerID, successCallback)
	{		
		if(gamerooms[code] === undefined)
		{
			socket.disconnect()
			return
		}
		
		socket.leaveAll();
		socket.join(code);

		let room = gamerooms[code];

		// grab the old player before adding the new one
		let oldPlayer = room.GetPlayerByPlayerID(playerID);
		socket.currentRoom = room;
		
		if(oldPlayer !== undefined)
		{
			// create a player copy with different socketID and away status
			let replacement = Object.assign({socketID:1,isAway:false},oldPlayer);
			replacement.isAway = false;
			replacement.socketID = socket.id;
			room.players.push(replacement);

			let oldSocket = io.sockets.connected[oldPlayer.socketID];
			if(oldSocket !== undefined)
				oldSocket.disconnect();

			room.RemovePlayer(oldPlayer.socketID);

			successCallback(oldPlayer.name);

			socket.to(oldPlayer.socketID).emit('onPeerUpdate', 
			{
				playerID : oldPlayer.playerID,
				hasDisconnected : 'multiple-clients-detected'
			});			
		}
		else
		{
			room.AddPlayer(socket.id,playerID);
			successCallback('');
		}

		let visibleRoom = GetRoomWithVisiblePlayers(room);
		UpdateLobby(socket,visibleRoom);

		
		let player = room.GetPlayerBySocketID(socket.id);
		
		if(player.isInitialized)
			io.in(code).emit('onPeerUpdate', player);
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
		let createdRoom = CreateAndStoreRoom(generatedCode,socket);
		createdRoom.name = roomName;

		let player = createdRoom.AddPlayer(socket.id,playerID);
		player.isHost = true;

		let visiblePlayersRoom = GetRoomWithVisiblePlayers(createdRoom);

		callback(visiblePlayersRoom);
		UpdateLobby(socket,visiblePlayersRoom);
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

	socket.on('setLobbyName',function(name, callback)
	{
		let room  = socket.currentRoom;

		if(room !== undefined)
		{
			room.name = name;
			let visibleRoom = GetRoomWithVisiblePlayers(room);
			UpdateLobby(socket,visibleRoom);
			callback(true);
		}
		else
		{
			callback(false);
		}
	});

	socket.on('setName',function(name, callback)
	{
		let playerThatChangedName;
		let room = socket.currentRoom;
		console.log("there are " + room.players.length);
		let uniqueName = MakeNameUnique(name, 0, room.players,socket.id);

		for(let i = 0; i < room.players.length; i++)
		{
			if(room.players[i].socketID === socket.id)
			{
				room.players[i].name = uniqueName;
				room.players[i].isInitialized = true;
				playerThatChangedName = room.players[i];
				break;
			}
		}

		if(playerThatChangedName !== undefined)
		{
			callback(true);
			io.in(room.code).emit('onPeerUpdate',
			{
				playerID: playerThatChangedName.playerID,
				name: playerThatChangedName.name,
				isInitialized: playerThatChangedName.isInitialized
			});
		}
		else
		{
			callback(false);
		}
			
		
	});

//=============================== Game Stuff =================================//

	socket.on('joinGame', function(gameID)
	{
		GameUtils.StartGameInstance(gameID,socket,io);
	});

	var targetNumber = -1
	var timeleft = 30.0
	var gamerunning = false

	socket.on('startDebugGame', () =>
	{
		io.in(socket.currentRoom.code).emit('onStartGame', {
			routeName: 'PassTheBomb',
			id: 'debug/pass-the-bomb',
			assets: {
				images: { 
					bomb: { url: '/images/bomb.png' } 
				}
			}
		})
		gamerunning = true
		this.targetNumber = GetRandNumber(1, 10)
		io.in(socket.currentRoom.code).emit('PassBomb', socket.currentRoom.GetNextTarget().playerID, timeleft, this.targetNumber)
	});

	socket.on('pass', (time, number) =>
	{
		if (number === this.targetNumber) {

			let timer = time
			// if (timer + 5 < 30)
			// {
			// 	timer = 30
			// } else {
			// 	timer += 5
			// }
			timeleft = timer
			this.targetNumber = GetRandNumber(1, 10)
			io.in(socket.currentRoom.code).emit('PassBomb', socket.currentRoom.GetNextTarget().playerID, timer, this.targetNumber)
		}
	})

	socket.on('generate', () =>
	{
		socket.emit('newRandomNumber', GetRandNumber(1,10))
	});

	setInterval(() => {
		if (gamerunning === true) {
			
			timeleft -= 0.033;
			if (timeleft <= 0) {		
				io.in(socket.currentRoom.code).emit('explode')
				this.gamerunning === false
				timeleft = 30
			}
		}
	}, 33)
});

function GetRandNumber(max, min) //both inclusive
{
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Creates the room object and stores it in both the socket and in global gamerooms var
function CreateAndStoreRoom(code,socket)
{
	let createdRoom = RoomUtils.CreateRoom(code);
	gamerooms[code] = createdRoom;

	if(socket !== undefined) // may be a dummy
		socket.currentRoom = createdRoom;

	return createdRoom;
}

function RoomExist(code)
{
  return gamerooms[code] !== undefined;
}

function CanJoinRoom(room)
{
  return !room.isPlaying;
}

function UpdateLobby(socket,updatedRoom)
{
	socket.emit('onLobbyUpdate', updatedRoom);
}

function CreateDebugRoom(code)
{
	if(!RoomExist(code))
	{
    	let createdRoom = CreateAndStoreRoom(code);
		let dummyPlayer = createdRoom.AddPlayer('dummy','dummy');
		
		dummyPlayer.isHost = true;
		dummyPlayer.name = "dummy";
		dummyPlayer.isInitialized = true;

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

function GetRoomWithVisiblePlayers(room)
{

		// make a duplicate room with only the initialized players
		let visiblePlayers = [];

		for(let i = 0; i < room.players.length; i++)
		{
			if(!room.players[i].isAway)
				visiblePlayers.push(room.players[i]);
		}


		return {
			name: room.name,
			code: room.code,
			players: visiblePlayers,
			isPlaying : room.isPlaying,
			games : room.games
		};

	
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

function CheckRoomIsAway(code)
{
	let isActive = false;
	let room = gamerooms[code];

	for(let i = 0; i < room.players.length; i++)
	{
		if(!room.players[i].isAway)
		{
			isActive = true;
			break;
		}
	}

	if(!isActive)
	{
		delete gamerooms[code];
	}
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

function MakeNameUnique(name,counter,players,excludeSocketID)
{
    let count = counter;
    let originalName = name
    let pendingName;
    let exist = false;
            
    if( count !== 0)
        pendingName = name + " - " + count;
    else
    	pendingName = name;

    for(let i = 0; i <players.length; i++)
    {
		// skip self if reconnecting as same player
		if(!players[i].isAway && players[i].socketID !== excludeSocketID)
		{
			if(pendingName === players[i].name)
        	{
            	exist = true;
        		break;
        	}
		}
		
    }

    if(exist === true)
    {
        count++;
        return MakeNameUnique(originalName,count,players,excludeSocketID);
    }
    else
    {
        if(count !== 0)
            return  pendingName;
        else
            return originalName;
    }   
}


function GetShortenedGameList()
{
	let games = GameUtils.GetGameList();
	let shortened = [];

	for(let i = 0; i < games.length; i++)
	{
		shortened.push
		(
			{
				gameID : games[i].gameID,
				name : games[i].name,
				previewURL : __dirname + '/' + games[i].preview
			}
		);
	}

	return shortened;
	
}
