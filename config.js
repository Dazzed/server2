const config = {
  ampqUrl: process.env.CLOUDAMQP_URL || "amqp://localhost",
  redisUrl: "redis://h:p774c4025e8b03e0df720e726bb1d94b346479e8e023d96f2a4c151199cf470f9@ec2-52-73-203-82.compute-1.amazonaws.com:9529"
}
module.exports = config;
