var socket  = io.connect( 'http://localhost:3030' );

socket.on( 'message', function( data ){
	var template, message_html;

	console.log( 'Received message' );
	console.log( data );
	console.log( data.sender.charAt( 0 ) )

	switch( data.sender.charAt( 0 ) ){
		case '%' : // Module
			template = 'system_message';
		break;

		case '@' : // User
			template = 'direct_user_message';
		break;

		case '#' : // Group
			template = 'group_message';
		break;

		case '+' : // Interest
			template = 'interest_message';
		break;

		default  : // Error
			template = 'error';
		break;
	}

	$( '#message_area' ).append( new EJS( {
		url: 'javascripts/templates/' + template + '.ejs'
	} ).render( data ) );
} );

$( 'form' ).live( 'submit', function( event ){
	event.preventDefault();

	console.log( 'Sending message:' );
	console.log( 'TO: ' + $( '#target' ).val() + ' MESSAGE: ' + $( '#body' ).val() );

	socket.emit( 'message', {
		body   : $( '#body'   ).val(),
		target : $( '#target' ).val(),
		sender : '@brett'
	} );

	$( '#body' ).val( '' );
} );
