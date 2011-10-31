var
	express    = require( 'express'   ),
	routes     = require( './routes'  ),
	app        = module.exports = express.createServer(),
	io         = require( 'socket.io' ).listen( app ),
	sys        = require( 'sys'  ),
	amqp       = require( 'amqp' ),
	user = {
		name      : '@brett', // TODO: Queue names should be dynamic
		groups    : [ '+beerev', '+brewfa', '+sparks' ],
		interests : [ '_development', '_design', '_deployment' ]
	},
	rabbitmq = amqp.createConnection( {
		host : 'localhost',
		port : '5672'
	} ),
	fanout_exchange,
	direct_exchange,
	topic_exchange,
	web_socket
;


// Express Configuration
app.configure( function(){
  app.set( 'views', __dirname + '/views' );
  app.set( 'view engine', 'jade' );
  app.use( express.bodyParser() );
  app.use( express.methodOverride() );
  app.use( app.router );
  app.use( express.static( __dirname + '/public' ) );
} );

app.configure( 'development', function(){
  app.use( express.errorHandler( { dumpExceptions: true, showStack: true } ) );
} );

app.configure( 'production', function(){
  app.use( express.errorHandler() );
} );


// WebSockets Browser <--> NodeJS
io.sockets.on( 'connection', function( socket ){
	web_socket = socket;

	web_socket.emit( 'message', {
		sender    : '%system',
		target    : user.name,
		recipient : user.name,
		body      : 'Welcome, you are connected to Commune.'
	} );

	web_socket.on( 'message', function( data ){
		console.log( 'received message from browser' );
		console.log( data );

		switch( data.target.charAt( 0 ) ){
			case '@' : // Direct message
			case '%' : // Module message
				direct_exchange.publish(
					data.target,
					data, {
						mandatory    : true,
						immediate    : true,
						deliveryMode : 2, // Persistant
						replyTo      : data.sender
					}
				);
				direct_exchange.publish( data.sender, data, {
					mandatory    : true,
					immediate    : true,
					deliveryMode : 2, // Persistant
					replyTo      : data.sender
				} );
			break;

			case '+' : // Groups message
				fanout_exchange.publish( data.target, data, {
					mandatory    : true,
					immediate    : true,
					deliveryMode : 2, // Persistant
					replyTo      : data.sender
				} );
			break;

			case '_' : // Interest message
				topic_exchange.publish( data.target, data, {
					mandatory    : true,
					immediate    : true,
					deliveryMode : 2, // Persistant
					replyTo      : data.sender
				} );
			break;

			default: // Not recognised
				direct_exchange.publish( user.name, {
					sender : '%system',
					target : user.name,
					body   : 'Your message target was not recognized.'
				}, {
					mandatory    : true,
					immediate    : true,
					deliveryMode : 2, // Persistant
					replyTo      : '%system'
				} );
			break;
		}

	} );
} );


// AMQP NodeJS <--> RabbitMQ
rabbitmq.on( 'ready', function(){
	// Create fanout exchange for group-based broadcasts
	fanout_exchange = rabbitmq.exchange( 'commune-fanout', {
		type       : 'fanout',
		durable    : true,
		autoDelete : false
	},	function( exchange ){
		console.log( 'Fanout exchange ' + exchange.name + ' is now open' );
	} );

	// Create direct exchange for user/user and system/user messages
	direct_exchange = rabbitmq.exchange( 'commune-direct', {
		type       : 'direct',
		durable    : true,
		autoDelete : false
	},	function( exchange ){
		console.log( 'Direct exchange ' + exchange.name + ' is now open' );
	} );

	// Create topic exchange for flexible publish/subscribe
	topic_exchange = rabbitmq.exchange( 'commune-topic', {
		type       : 'topic',
		durable    : true,
		autoDelete : false
	},	function( exchange ){
		console.log( 'Topic exchange ' + exchange.name + ' is now open' );
	} );

	// Create a queue for the individual's messages
	var user_queue = rabbitmq.queue( user.name, {
		durable    : true,
		autoDelete : false
	}, function( queue ){
		console.log( 'Queue "' + user.name + '" is open' );

		// Add listener for all messages in the individual's queue
		user_queue.subscribe( function( message, headers, deliveryInfo ){
			console.log( message );
			console.log( user.name + ' got a message with routing key ' + deliveryInfo.routingKey );
			web_socket.emit( 'message', message );
		} );

		// Subscribe to personal direct messages
		user_queue.bind( direct_exchange, user.name );

		// Subscribe to all the user's groups
		for( i in user.groups ){
			console.log( 'Binding ' + user.name + ' to group ' + user.groups[i] );
			user_queue.bind( fanout_exchange, user.groups[i] );
		}

		// Subscribe to user's interests
		for( i in user.interests ){
			console.log( 'Binding ' + user.name + ' to interest ' + user.interests[i] );
			user_queue.bind( topic_exchange, user.interests[i] );
			console.dir( topic_exchange );
		}
	} );
} );


rabbitmq.on( 'error', function( error, response ){
	console.log( error );
	console.log( response );
} );


// Routes
app.get(  '/', routes.index );
app.listen( 3030 );


console.log(
	"Express server listening on port %d in %s mode",
	app.address().port, app.settings.env
);
