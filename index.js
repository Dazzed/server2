const uuid = require('uuid/v4');
const express = require('express');
const socket = require('socket.io');
const redisStore = require('ioredis');
const redis = require('socket.io-redis');
const amqp = require('amqplib/callback_api');
const config = require('./config.js');

const queue = 'chat';
const ampqUrl = config.ampqUrl;
const redisUrl = config.redisUrl;
const port = process.env.PORT || 3002;

const app = express();
const server = app.listen(port, console.log(`SERVER-2=>listening at PORT:${port}`));
const redisClient = new redisStore(redisUrl);

const io = socket(server);
io.adapter(redis(redisUrl));

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
    var exist = await redisClient.exists(key)
    if (exist) {
      redisClient.append(key, `,${JSON.stringify(data)}`);
    }
    else {
      redisClient.append(key, `${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log('SERVER-2=>Error in (setToRedis):', err);
  }
}

app.get('/setRoom', async function (req, res) {
  try {
    console.log('SERVER-2=>Get request for (/setRoom)');
    const { query_room } = req.query;
    var rooms = [];
    rooms = JSON.parse(await getFromRedis('rooms'));
    console.log('SERVER-2=>Rooms available:', rooms);
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
    console.log('SERVER-2=>Error in (/setRoom):', err);
  }
});

app.get('/getChats', async function (req, res) {
  try {
    console.log('Requested for /getChats');
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
    console.log('SERVER-2=>Error in(/getChats):', err);
  }
});

amqp.connect(ampqUrl, function (err, conn) {
  conn.createChannel(function (err, channel) {
    channel.assertQueue(queue, { durable: true });
    io.on('connection', socket => {
      console.log('SERVER-2=>Client connected with Id:', socket.id);
      socket.on('chat', data => {
        const chat = {
          roomId: data.roomId,
          handle: data.handle,
          type: data.type,
          message: data.message,
          time: Date.now()
        }
        channel.sendToQueue(queue, new Buffer(JSON.stringify(chat)), { persistent: true });
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
        channel.sendToQueue(queue, new Buffer(JSON.stringify(chat)), { persistent: true });
        setToRedis('chats', chat);
      });

      socket.on('typing', data => {
        socket.broadcast.emit(`${data.roomId}__typing`, data);
      });
    });
  });
});
