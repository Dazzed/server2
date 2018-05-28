const uuid = require('uuid/v4');
const express = require('express');
const socket = require('socket.io');
const redis = require('ioredis');

const redisUrl = "redis://h:p774c4025e8b03e0df720e726bb1d94b346479e8e023d96f2a4c151199cf470f9@ec2-52-73-203-82.compute-1.amazonaws.com:9529";
const port = process.env.PORT || 3002;

const app = express();
const server = app.listen(port, console.log(`Server listening at PORT:${port}`));

const redisClient = redis.createClient(redisUrl);
const pub = redis.createClient();   //Redis Publisher
const sub = redis.createClient();   //Redis Subscriber

//Subscribe to channel name global
sub.subscribe('global');

const io = socket(server);

app.use(express.static('public'));

function getFromRedis(key) {
  return new Promise((resolve, reject) => {
    try {
      redisClient.get(key, function (err, reply) {
        if (err) {
          return reject(err);
        }
        if (reply == null) {
          reply = [];
        }
        console.log(reply);
        resolve(`[${reply}]`);
      });
    } catch (err) {
      return reject(err);
    }
  });
}

async function setToRedis(key, data) {
  try {
    var exist = await redisClient.exists(key);
    console.log('room key:', exist);
    if (exist === 1) {
      redisClient.append(key, `,${JSON.stringify(data)}`);
    }
    else {
      redisClient.append(key, `${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log('Error in (setToRedis):', err);
  }
}

app.get('/setRoom', async function (req, res) {
  try {
    console.log('Get request for (/setRoom)');
    const { query_room } = req.query;
    var rooms = [];
    rooms = JSON.parse(await getFromRedis('rooms'));
    console.log('Rooms available:', rooms);
    const existingRoom = rooms.find(r => r.roomName === query_room);
    if (existingRoom) {
      return res.jsonp(existingRoom);
    } else {
      const room = {
        roomName: query_room,
        roomId: uuid()
      }
      setToRedis('rooms', room);
      return res.jsonp(room);
    }
  } catch (err) {
    console.log('Error in (/setRoom):', err);
  }
});

app.get('/getChats', async function (req, res) {
  try {
    console.log('Client Requested for /getChats');
    const reqRoomId = req.query.roomId;
    const time = req.query.time;
    chats = JSON.parse(await getFromRedis('chats'));
    var result;
    if (time == 0) {
      result = chats.filter(chat => chat.roomId == reqRoomId);
    }
    else {
      result = chats.filter(chat => chat.roomId == reqRoomId && chat.time > time);
    }
    res.jsonp(result);
  } catch (err) {
    console.log('Error in(/getChats):', err);
  }
});

sub.on('message', function (channel, msg) {
  // Broadcast the message to all connected clients on this server.
  try {
    var chat = JSON.parse(msg);
    console.log('Emitting Chat Received by Redis Subscriber:', chat);
    io.local.emit(`${chat.roomId}__chat`, chat);
  } catch (err) {
    console.log('error on emiting:', err);
  }
});

io.on('connection', socket => {
  console.log('Client connected with Id:', socket.id);
  io.emit(`61b923e0-b3de-4afe-913a-2f1333671883__chat`, "hello");
  socket.on('chat', data => {
    const chat = {
      roomId: data.roomId,
      handle: data.handle,
      type: data.type,
      message: data.message,
      time: Date.now()
    }
    pub.publish('global', JSON.stringify(chat));
    setToRedis('chats', chat);
  });

  socket.on('chat_sync', data => {
    const chat = {
      roomId: data.roomId,
      handle: data.handle,
      type: data.type,
      message: data.message,
      time: Date.now()
    }
    pub.publish('global', JSON.stringify(chat));
    setToRedis('chats', chat);
  });

  socket.on('typing', data => {
    // pub.publish('global', chat);
    socket.broadcast.emit(`${data.roomId}__typing`, data);
  });

  socket.on('error', error => {
    console.log('Error Event:', error);
  });

});
