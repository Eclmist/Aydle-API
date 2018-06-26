# Aydle_API
Backend API Server for Aydle


## HTTP GET requests

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
