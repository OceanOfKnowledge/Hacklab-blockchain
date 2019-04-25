/** 
***	API endpoints with express.js
**/
const fs = require('fs');//For data I/O
const sha256 = require('sha256');
const express = require('express');//Import express
const bodyParser = require('body-parser');//Import body-parser: Parses request body
const app = express();//Initialize express
const Blockchain = require('./blockchain');//Import Blockchain constructor
const Users = require('./Users');
const uuid = require('uuid/v1');//import UUID library to create unique random string
const port =process.argv[2];//Initialize port to serve multiple nodes
const rp = require('request-promise');//Import request promise
const expbs = require('express-handlebars');//Import express-handlebars for templating
const urlencodedparser = bodyParser.urlencoded({ extended: false });


//Defining statics
app.use(express.static('public'));


//Define main template
app.engine('handlebars', expbs());
app.set('view engine', 'handlebars');



//Create address for current node
const nodeAddress = uuid().split('-').join('');//Remove - created from UUID

//Instantiate new blockchain
const cedi = new Blockchain();
const user = new Users();

//Use Bodyparser
app.use(bodyParser.json());
app.use(urlencodedparser);

//HomePage
app.get('/', function(req, res){
	res.render('home');
});

app.post('/', urlencodedparser, function(req, res){
	const userKey = req.body['privateKey'];
	const userData = user.getUserData(userKey);
	if(userData){
		console.log(userData);
		const addressData = cedi.getAddressData(userData['publicKey']);
		res.render('dashboard', {signIn: true, name: userData['fullname'], 
			myKey: userData['publicKey'], addressData: addressData['balance']});
	}else{
		res.render('home');
	}
});

//Sign Up
app.get('/signup', function(req, res){
	res.render('signup');
});

//Post to Sign Up
app.post('/signup', urlencodedparser, function(req, res){
	const newUser = req.body;
	newUser['cedi'] = 0;
	newUser['privateKey'] = sha256(JSON.stringify(newUser) + Date.now());
	newUser['publicKey'] = uuid().split('-').join('');
	user.data.push(newUser);
	user.userChain.push(user);
	const addressData = cedi.getAddressData(newUser['publicKey']);
	console.log(user.userChain, newUser['privateKey'], addressData);
	res.render('successful');
});


//Blockchain explorer
app.get('/block-explorer', function(req, res){
	res.render('index');
});


//Set blockchain endpoint
app.get('/blockchain', function(req, res){
	//Send the blockchain
	res.send(cedi);
});

app.get('/explorer', function(req, res){
	console.log(cedi);
	for(i=0; i<cedi.chain.length; i++){
	};
	res.render('explorer', data={d:"data"});
});

//New transaction endpoint
app.post('/transaction', function(req, res){
	//Add transaction to the pending transactions array
	const newTransaction = req.body;
	console.log(newTransaction);
	if(newTransaction.amount > cedi.getBalance(newTransaction.sender)){
		res.json({ note: "Invalid Transaction" });
	}else{
		const blockIndex = cedi.addTransactionToPendingTransactions(newTransaction);
		//Return feedback with block ID
		res.json({ note: `Transaction will be added in block ${blockIndex}.` });
	}
	
});

//Broadcast transactions endpoint
app.post('/transaction/broadcast', function(req, res){
	//Create a new transaction
	const newTransaction = cedi.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);

	//Add new transaction to pending transactions array on current node
	const blockId = cedi.addTransactionToPendingTransactions(newTransaction);

	//Broadcast new transaction to all nodes in network
	const requestPromises = [];
	cedi.networkNodes.forEach(networkNodeUrl => {
		//Request to /transaction endpoint
		const requestOptions = {
			uri: networkNodeUrl + '/transaction',
			method: 'POST',
			body: {newTransaction:newTransaction},
			json: true
		};

		requestPromises.push(rp(requestOptions));
		
	});
	Promise.all(requestPromises).then(data=>{
		res.json({ note: 'Transaction created and broadcast successfully.'});
	});
	fs.writeFileSync('blockchain.txt', JSON.stringify(cedi.chain));
});


//Mining endpoint
app.get('/mine', function(req, res){
	//Get the last block in the current chain
	const lastBlock = cedi.getLastBlock();

	//Get the hash of the last block
	const previousBlockHash = lastBlock['hash'];

	//Get current block data
	const currentBlockData = {
		transactions: cedi.pendingTransactions,
		index: lastBlock['index'] + 1
	};

	//Get nonce through proof of work
	const nonce = cedi.proofOfWork(previousBlockHash, currentBlockData);

	//Calculate new block hash
	const blockHash = cedi.hashBlock(previousBlockHash, currentBlockData, nonce);

	//Mine block
	const newBlock = cedi.createNewBlock(nonce, previousBlockHash, blockHash);

	//Broadcast newBlock to all network nodes
	const requestPromises = []
	cedi.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/receive-new-block',
			method: 'POST',
			body: { newBlock: newBlock },
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});
	Promise.all(requestPromises).then(data => {
		//Create mining reward transaction and broadcast
		const requestOptions = {
			uri: cedi.currentNodeUrl + '/transaction/broadcast',
			method: 'POST',
			body: { amount: 12.5, sender: "00", recipient: nodeAddress },
			json: true
		};
		return rp(requestOptions);
	}).then(data =>{
		res.json({
			note: `Block mined and broadcast successfully`,
			block: newBlock
		});
	});

	fs.writeFileSync('blockchain.txt', JSON.stringify(cedi.chain));
});


//Receive new block endpoint
app.post('/receive-new-block', function(req, res){
	//Get new block
	const newBlock = req.body.newBlock;

	//Check if previousHash on newblock equals hash on last block on chain
	const lastBlock = cedi.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash;

	//Check if newBlock has correct index
	const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

	//Accept block on condition
	if(correctHash && correctIndex){
		//Add newBlock to chain
		cedi.chain.push(newBlock);

		//Clear pending transactions
		cedi.pendingTransactions = [];

		//Send feedback
		res.json({
			note: "New Block received and accepted",
			newBlock: newBlock
		});
	}else{//Condition failed
		res.json({
			note: "New Block Rejected.",
			newBlock: newBlock
		});
	}

});


//Register a node and broadcast to other networks
app.post('/register-and-broadcast-node', function(req, res){
	//Get newNodeUrl
	const newNodeUrl = req.body.newNodeUrl;

	//Register node: Add the newNodeUrl to netWorkNodes if new node is not already in networkNodes
	if(cedi.networkNodes.indexOf(newNodeUrl) == -1)cedi.networkNodes.push(newNodeUrl);


	//Initialize registered nodes promises array
	const regNodesPromises = [];

	//Broadcast newNodeUrl to other nodes
	cedi.networkNodes.forEach(networkNodeUrl => {
		//Define request options
		const requestOptions = {
			uri: networkNodeUrl + '/register-node',
			method: 'POST',
			body: { newNodeUrl: newNodeUrl },
			json: true
		};

		//Make requests and push to regNodesPromises
		regNodesPromises.push(rp(requestOptions));
	});

	//Run all requests in the regNodesPromises Array
	Promise.all(regNodesPromises).then(data => {
		//Define options for request promises library
		const bulkRegisterOptions = {
			uri: newNodeUrl + '/register-nodes-bulk',
			method: 'POST',
			body: { allNetworkNodes: [...cedi.networkNodes, cedi.currentNodeUrl]},
			json: true
		};

		return rp(bulkRegisterOptions);

	}).then(data => {
		res.json({ note: 'New node registered with network successfully.' });
	});

	fs.writeFileSync('blockchain.txt', JSON.stringify(cedi.chain));

});

//Register a node with the network
app.post('/register-node', function(req, res){
	//Define newNodeUrl
	const newNodeUrl = req.body.newNodeUrl;

	//Check if node is already in the network
	const nodeNotAlreadyPresent = cedi.networkNodes.indexOf(newNodeUrl) == -1;//true or false
	
	//Check if newNode is current node
	const notCurrentNode = cedi.currentNodeUrl !== newNodeUrl;

	//Register newNodeUrl with node that receives request
	if(nodeNotAlreadyPresent && notCurrentNode) cedi.networkNodes.push(newNodeUrl);

	//Send back a response
	res.json({ 
		note: 'New node registered successfully.'
	});

});

//Register all nodes already in network
app.post('/register-nodes-bulk', function(req, res){
	//Get all nodes currently in network
	const allNetworkNodes = req.body.allNetworkNodes;

	//Loop through nodes and register all on current node
	allNetworkNodes.forEach(networkNodeUrl => {
		//Check that the node url is not the current node
		const notCurrentNode = cedi.currentNodeUrl !== networkNodeUrl;
		
		//Check that current node is not already present
		const nodeNotAlreadyPresent = cedi.networkNodes.indexOf(networkNodeUrl) == -1;
		
		//On conditions, add new network node url to network nodes array
		if(nodeNotAlreadyPresent && notCurrentNode) cedi.networkNodes.push(networkNodeUrl);
	});
	//Send feedback
	res.json({note: 'Bulk registeration successful.'});

});


//Consensus endpoint
app.get('/consensus', function(req, res){
	//Get blockchain from network nodes
	const requestPromises = [];
	cedi.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/blockchain',
			method: 'GET',
			json: true
		};
		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises).then(blockchains => {//Iterate through blockchains received and accept longer blockchain
		//Initialize variables for iteration
		const currentChainLength = cedi.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newPendingTransactions = null;

		//console.log(blockchains);
		//Is there a longer chain in network than chain in current node?
		blockchains.forEach(blockchain => {
			//console.log(blockchain);
			//console.log('Current chain length => ', maxChainLength);
			if(blockchain.chain.length > maxChainLength){
				maxChainLength = blockchain.chain.length; //Length of the longest chain
				newLongestChain = blockchain; //Replace chain
				newPendingTransactions = blockchain.pendingTransactions; //Replace transactions
			}
			//console.log('Longest chain => ', newLongestChain);
		});
		//console.log('Longest chain outside the loop => ', newLongestChain);
		//No longer chain OR longer chain is not valid
		if(!newLongestChain || (newLongestChain && !cedi.chainIsValid(newLongestChain.chain))){
			res.json({
				note: "Current chain has not been replaced",
				chain: newLongestChain
			});
		}else{//Valid longer chain
			cedi.chain = newLongestChain.chain;//Replace chain
			cedi.pendingTransactions = newPendingTransactions;//Replace transactions

			res.json({
				note: "This chain has been replaced.",
				chain: cedi.chain
			});
		}
	});
});


//Receives block hash and returns corresponding block
app.get('/block/:blockHash', function(req, res){
	const blockHash = req.params.blockHash;
	const correctBlock = cedi.getBlock(blockHash);

	res.json({
		block: correctBlock
	});
});

//Receives transaction ID and returns corresponding transaction
app.get('/transaction/:transactionId', function(req, res){
	//Get transaction ID 
	const transactionId = req.params.transactionId;
	const transactionData = cedi.getTransaction(transactionId);

	res.json({
		transaction: transactionData.transaction,
		block: transactionData.block
	});
});

//Receives address and returns all transactions involving address
//And also get current balance of address
app.get('/address/:address', function(req, res){
	//Get address
	const address = req.params.address;
	const addressData = cedi.getAddressData(address);

	res.json({
		addressData: addressData
	});
});

/***********EXPLORER ENDPOINT**************/
app.get('/block-explorer', function(req, res){
	res.sendFile('./block-explorer/index.html', { root: __dirname });
});

app.get('/block-explorer/test', function(req, res){
	res.sendFile('./block-explorer/test.html', { root: __dirname });
});
/**********END EXPLORER ENDPOINT***********/


/******************FRONT END***************/

/***************END FRONTEND***************/


//Run Netwrok Node
app.listen(port, function(){
	console.log(`Listening on port ${port}...`);
});

