const config = require('./config.js');
const io = require('socket.io-emitter')(config.redisUrl);
const amqp = require('amqplib/callback_api');
const queue = 'chat';
const ampqUrl = config.ampqUrl;
amqp.connect(ampqUrl, function (err, conn) {
  conn.createChannel(function (err, channel) {
    console.log('SERVER-2=>Worker-2 started');
    channel.assertQueue(queue, { durable: true });
    channel.prefetch(1);
    channel.consume(queue, function (msg) {
      let chatMsg = JSON.parse(msg.content.toString());
      console.log('SERVER-2=>Worker-2 Received a message:', chatMsg);
      io.emit(`${chatMsg.roomId}__chat`, chatMsg);
      channel.ack(msg);
    }, { noAck: false });
  });
});
