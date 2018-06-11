
function RoomManager(clientSocket){

var tempCode = '';

RoomManager.prototype.JoinRoom = function(code)
{
		
		clientSocket.InitSocketConnection();

		// store the code temporarily
		tempCode = code;
		TryJoinRoom();
		

};


function TryJoinRoom()
{
	if(!clientSocket.GetSocket().connected)
	{
		window.setTimeout(TryJoinRoom,1000);
	}
	else
	{
		
		clientSocket.GetSocket().emit('requestJoin',
		{
			code: tempCode
		});
	}

}

RoomManager.prototype.HostRoom = function()
{

	clientSocket.InitSocketConnection();
	TryHostRoom();

};

function TryHostRoom()
{
	if(!clientSocket.GetSocket().connected)
	{
		window.setTimeout(TryHostRoom,1000);
	}
	else
	{
		clientSocket.GetSocket().emit('requestHost');
	}
}


RoomManager.prototype.SetName = function(name)
{
	clientSocket.GetSocket().emit('enterRoomAs',
	{
		name : name 
	});
};



} // end RoomManager

