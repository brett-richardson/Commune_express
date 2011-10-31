exports.index = function( request, response ){
	response.render( 'index', { title: 'Commune' } )
};


exports.socket = function( request, response ){
	console.dir( request );
	response.send( 'Socket data' );
};
