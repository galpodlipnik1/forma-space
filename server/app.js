"use strict"

var express = require('express');

var app = express();

// var request = require('request');
const request = require("request-promise");
const logger = require('./logging');

var http = require('http').Server(app);
var socketio = require('socket.io')(http);

var port = process.env.port || 3000;

app.use(express.static(__dirname + "/../client"));
app.use(express.static(__dirname + "/../node_modules"));

// used for forwarding on the local devs
app.get('/fwd', function(req, res) {
  //modify the url in any way you want
  const url = req.query.url;
  const headers = {
    'Referer': 'https://formaviva.com'
  };
  // var newurl = 'http://google.com/';
  request({ url, headers }).pipe(res);
});

var users = [];
var queue = [];
var logs = [];

var currentState = {
  started: null,
  length: null,
  track: null
}

/*
main loop
- if there's no track, select a random track
- when the track ends, play the next track (if there's no queue, select a random one)

- disable adding same tracks to the queue
- use db
*/


/**
 * Returns a random number between min (inclusive) and max (exclusive)
 * @param {number} min - The minimum number.
 * @param {number} max - The maximum number.
 * @returns {number} A random number.
 */
function between(min, max) {  
  return Math.floor(
    Math.random() * (max - min) + min
  )
}

/**
 * Plays the next track in the queue or a random track if the queue is empty.
 * @returns {Promise<void>}
 */
async function playNext() {
  var track = null;
  try {
    if (queue.length > 0) {
      logger.info("Pull track from the queue");
      track = queue.shift();
    } else {
      logger.info("Get random next track");
      track = await getTrack(between(0, 3000));
    }
  } catch (error) {
    logger.error("Failed to get track", error);
    setTimeout(playNext, 5000); // Try again after 5 seconds
    return;
  }

  if (!track) {
    logger.error("Couldn't get the track. Trying again");
    setTimeout(playNext, 5000); // Try again after 5 seconds
    return;
  }

  currentState.started = Date.now();
  currentState.track = track;
  currentState.length = track.data.attributes.metadata.length;

  var data = {
    action: "play",
    track: track,
    started: currentState.started
  }
  // emit event to clients to play the track
  socketio.emit("event", data );

  // inform everyone which track is playing
  socketio.emit("message", botMessage(`Currently playing ${currentState.track.data.attributes.display_name} `));

  // add ability to cancel the timeout
  setTimeout(
    function() {
      logger.info("Track ended, playing next");
      playNext();
    }, currentState.length * 1000);
  // broadcast to all to play this track
}

/*
- store chat log D
- add play command D
- pull track 
*/

/**
 * Stores a log item of a certain type.
 * @param {string} type - The type of the log item.
 * @param {any} item - The log item.
 */
function storeLog(type, item) {
  logs.push([type, item]);
  logger.info(`Stored logs: ${logs}`);
}

/**
 * Stores a log item of a certain type and emits it to a socket.
 * @param {socketio} socket - The socket to emit the item to.
 * @param {string} type - The type of the log item.
 * @param {any} item - The log item.
 */
function storeEmit(socket, type, item) {
  logger.info(`storeEmit: ${type} ${item}`);
  if (!item || !item.time) {
    item['time'] = Date.now;
  }
  
  storeLog(type, item);
  socket.emit(type, item);
}

/**
 * Parses a command from a socket message.
 * @param {socketio} socket - The socket the message came from.
 * @param {Object} data - The message data.
 */
function parseCmd(socket, data) {
  let args = data.message.split(" ")
  if (args.length < 2) {
    logger.error(`Command missing args: ${data.message}`);
    socket.emit('message', botMessage(`Command missing args: ${data.message}`));
    // send message back
    return;
  }

  if (args[0] < 2) {
    logger.error(`Command too short ${args[0]}`);
    socket.emit('message', botMessage(`Command too short ${args[0]}`));
    return;
  }

  const cmd = args.shift().slice(1);
  // let cmd = args[0].slice(1);
  switch (cmd) {
    case 'p':
    case 'play':
      // play a args[1] track
      socket.emit('message', botMessage(`Finding track ${args[0]} ...`));
      cmdPlay(socket, args);
      break;
    
    case 'n':
    case 'next':
        // play a args[1] track
        socket.emit('message', botMessage(`Play next track`));
        playNext();
        break;

    default:
      logger.error(`Sorry, we are out of ${cmd}. Did you mean some techno?!`);
  }
}

/*
cmds: /play formaviva.com/2390/shoshin
cmds: /p 2390/shoshin
cmds: /p kundi - shoshin
*/

/**
 * Checks if a string is numeric.
 * @param {string} str - The string to check.
 * @returns {boolean} Whether the string is numeric.
 */
function isNumeric(str) {
  if (typeof str != "string") return false // we only process strings!  
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
         !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

/**
 * Plays a track based on a command from a socket.
 * @param {socketio} socket - The socket the command came from.
 * @param {Array<string>} args - The command arguments.
 * @returns {Promise<void>}
 */
async function cmdPlay(socket, args) {
  // check if valid track
  // if ()
  logger.info("cmdPlay", args);

  let track = null;

  if (isNumeric(args[0])) {
    let trackId = parseInt(args[0]);
    track = await getTrack(trackId);
  }

  if (track) {
    logger.info("found track", track);
    queue.push(track);
    socket.emit('message', botMessage(`Added <b>${track.data.attributes.display_name}</b> to the queue.`));
  } else {
    socket.emit('message', botMessage(`No such ${args[0]} track.`));
  }
  // make async

  logger.info("queue", queue);
}

/*
function getTrack(trackId) {
  request({
    url: 'https://api.formaviva.com/api/v1/tracks/14120',
    json: true
  }, function(error, response, body) {
    console.log(body);
  });

}
*/

/**
 * Retrieves a track by its ID.
 * @param {number} trackId - The ID of the track.
 * @returns {Promise<Object>} The track data.
 */
async function getTrack(trackId) {
  try {
    const r = await request({
      url: `https://api.formaviva.com/api/v1/tracks/${trackId}`,
      json: true
    });
    return r;
  } catch (error) {
    logger.error("Failed to get track", error.response.body);
    // throw new Error('Failed to get track');
    return false;
  }
}

/**
 * Creates a bot message.
 * @param {string} message - The message content.
 * @returns {Object} The bot message.
 */
function botMessage(message) {
  return {
    time: Date.now(),
    userName: 'FormaBot',
    message: message
  }
}

/**
 * Sends the log to a socket.
 * @param {socketio} socket - The socket to send the log to.
 */
function sendLog(socket) {
  logs.forEach(function(log){
    socket.emit(log[0], log[1]);
  });
}

/**
 * Initializes a connection with a socket.
 * @param {socketio} socket - The socket to initialize the connection with.
 */
function initConnection(socket) {
  logger.info("initConnection", currentState);
  if (currentState.track) {
    socket.emit("event", { action: "play", track: currentState.track, started: currentState.started });
    socket.emit("message", botMessage(`Currently playing ${currentState.track.data.attributes.display_name} `));
  }
}

socketio.on('connection', function (socket) {
  logger.info("A user connected. Socket id: " + socket.id);

  initConnection(socket);

  // on join
  socket.on('join', function (userName) {
    logger.info('user change name to : ' + userName);

    socket.userName = userName;
    users.push(userName);

    // socketio.sockets.emit('message', botMessage("A comrade " + userName + " joined the chat"));
    // notice it is not socket.emit('refreshUserList', users)
    socketio.sockets.emit('refreshUserList', users);

    // storeLog("event", { action: "joined", user: userName });
    var data = {
      action: "joined",
      userName: "FormaBot",
      message: "A comrade " + userName + " joined the chat",
    }
    storeEmit(socketio, "event", data);
    storeEmit(socketio, "message", botMessage(`A comrade ${userName} joined the chat...`));
    socketio.sockets.emit('userCount', { count: users.length });

    // cool
    logger.info("Sending socket log to the user");
    sendLog(socket);
    socket.emit("message", botMessage("Only for you"));
  });

  // on message
  socket.on('message', function (message) {
    logger.info(socket.userName + ' says: ' + message);

    var data = {
      time: Date.now(),
      userName: socket.userName,
      message: message
    };

    // storeLog("message", data);
    // socketio.emit('message', data);
    storeEmit(socketio, "message", data);
    
    // parse command
    if (message[0] == '/')
      parseCmd(socketio, data);
  });

  // on disconnect
  socket.on('disconnect', function () {

    //when user log off, the name should be removed from the user list
    var removedUserIndex = users.indexOf(socket.userName);
    if (removedUserIndex >= 0) {
      users.splice(removedUserIndex, 1);

      socketio.sockets.emit('userCount', { count: users.length });

      storeEmit(socketio, "event", {
        action: "left",
        userName: socket.userName,
        message: "User " + socket.userName + " left"
      });
    }

    //notice it is not socket.emit('refreshUserList', users)
    socketio.sockets.emit('refreshUserList', users);

    logger.info('user ' + socket.userName + ' disconnected');
  });
});

http.listen(port, function () {
  logger.info("Running on port: " + port);
  playNext();
});

/**
 * Emits a change visuals event at a certain interval.
 * @param {number} intervalInSeconds - The interval in seconds.
 */
function emitChangeVisuals(intervalInSeconds) {
  setInterval(() => {
    const randomNumber = Math.random(); // Generate a random number between 0 and 100
    socketio.emit('changeVisuals', randomNumber);
  }, intervalInSeconds * 1000);
}

// Call the function with the desired interval in seconds
emitChangeVisuals(15);