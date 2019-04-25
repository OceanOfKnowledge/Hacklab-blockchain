//Import sha256 hashing algorithm
const sha256 = require('sha256');
const currentNodeUrl = process.argv[3];//Get current nodes URL
const uuid = require('uuid/v1');//import UUID library to create unique random string

//Block Chain Constructor
function Users(){
	//Chain of Users
	this.userChain = [];

	//Array containing blocks
	this.data = [];

	//Array containing all pending transactions
	this.tickets = [];
}



Users.prototype.addUser = function(data){
	this.data.push(data);
	return this.data;
}

Users.prototype.getUserData = function(privateKey){
	for(var i=0; i<this.data.length; i++){
		if(this.data[i]['privateKey'] === privateKey){
			return this.data[i];
		}
	}
}

//Export Blockchain for testing
module.exports = Users;
