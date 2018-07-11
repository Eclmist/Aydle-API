# Aydle API
Backend API Server for Aydle


## HTTP requests

### GET requests

Get a 'result' response indicating if room is valid to join

```
/room/<code>
```

Create a dummy room with the specified code.
The created room contains a dummy player.

```
/dummy/<code>
```

Delete all dummy rooms from the server.

```
/clear
```

## Server Objects

### Room

returns the code for the room

```
room.code
```

returns an array of player objects

```
room.players
```

returns true if the room has already started its games

```
room.isPlaying
```

### Player

returns the following error codes of (string) type

```
player.hasDisconnected

// error codes :
//	
// 'kicked-by-host'
// 'user-left'
// 'multiple-clients-detected'
 
```

returns the playerID which is assigned on the client side

```
player.playerID
```

returns the of the socket connection ID associated with the player

```
player.socketID
```

returns the total score of the player

```
player.score
```

returns true if the player is the host

```
player.isHost
```

returns the name of the player 

```
player.name
```



 


