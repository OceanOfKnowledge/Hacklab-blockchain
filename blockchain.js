//Import sha256 hashing algorithm
const sha256 = require('sha256');
const currentNodeUrl = process.argv[3];//Get current nodes URL
const uuid = require('uuid/v1');//import UUID library to create unique random string

//Block Chain Constructor
function Blockchain(){
	//Array containing blocks
	this.chain = [];

	//Array containing all pending transactions
	this.pendingTransactions = [];

	//Assign current node url to blokchain data structure
	this.currentNodeUrl = currentNodeUrl;

	//Define all nodes
	this.networkNodes = [];

	//Create genesis block
	this.createNewBlock(100, '0', '0');
}

//Prototype method inherited by Blockchain: createNewBlock
Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash){
	//Create Block Object with pendingTransactions and hashes
	const newBlock = {
		index: this.chain.length + 1,
		timestamp: Date.now(),
		transactions: this.pendingTransactions,
		nonce: nonce,
		hash: hash,
		previousBlockHash: previousBlockHash
	};

	//Empty the pendingTransactions array
	this.pendingTransactions = [];

	//Push newBlock to the chain
	this.chain.push(newBlock);

	//Return the newBlock that has just been pushed
	return newBlock;
}

//getLastBlock method to return last block of the blockchain
Blockchain.prototype.getLastBlock = function(){
	return this.chain[this.chain.length - 1];
}


//createNewTransaction method to create new transaction
Blockchain.prototype.createNewTransaction = function(amount, sender, recipient){
	//Create new transaction object
	const newTransaction = {
		amount: amount,
		sender: sender,
		recipient: recipient,
		transactionId: uuid().split('-').join('')
	};
	//Return new transaction
	return newTransaction;
};

Blockchain.prototype.addTransactionToPendingTransactions = function(transactionObj){
	//Push transaction object to pending transactions
	this.pendingTransactions.push(transactionObj);

	//Return the block in which transaction will be mined
	return this.getLastBlock()['index'] + 1;
};

//Create hashing method in blockchain prototype
Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce){
	//Convert all data to single string
	const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);

	//Create hash of data
	const hash = sha256(dataAsString);

	//Return the hash
	return hash;
};



//Create proof of work method => repeatedly create hash until hash begins with '0000'
Blockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData){
	//Initialize nonce
	let nonce = 0;

	//Create hash for the first time
	let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);

	//Continuously loop until first 4 characters of hash is '0000'
	while(hash.substring(0,4) !== '0000'){
		//Increment nonce value
		nonce++;

		//Recreate hash with new nonce
		hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
		
	}

	//Return the nonce value that gives a hash beginning with '0000'
	//This is the proof of work
	//Other miners can use it to test whether it does generate a hash starting with '0000'
	return nonce;
};

//Create chainIsValid Boolean method on object prototype
Blockchain.prototype.chainIsValid = function(blockchain){
	let validChain = true; //Boolean flag

	//Loop through blockchain
	for(var i=1; i<blockchain.length; i++){
		const currentBlock = blockchain[i];
		const prevBlock = blockchain[i - 1];

		//Does block hash begin with '0000'?
		const blockHash = this.hashBlock(prevBlock['hash'], {transactions: currentBlock['transactions'], index: currentBlock['index']}, currentBlock['nonce']);
		if(blockHash.substring(0,4) !== '0000') validChain = false;

		//Is previousBlockHash of current block equal to hash of prevBlock
		if(currentBlock['previousBlockHash'] !== prevBlock['hash']) validChain = false;
		
		//Testing
		//console.log('currentBlockHash =>', currentBlock['hash']);
		//console.log('PreviousBlockHash =>', prevBlock['hash']);
	};

	//Check if genesis block is valid
	const genesisBlock = blockchain[0];
	const correctNonce = genesisBlock['nonce'] === 100;
	const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
	const correctHash = genesisBlock['hash'] === '0';
	const correctTransactions = genesisBlock['transactions'].length === 0;
	if(!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

	return validChain;//true || false
};

//getBlock method with blockHash
Blockchain.prototype.getBlock = function(blockHash){
	//	console.log(blockHash);
	//initialize correct block variable
	let correctBlock = null;
	this.chain.forEach(block => {//Loop through block
		if(block.hash === blockHash){
			correctBlock = block;
		}
	});
	return correctBlock;
};

//getTransaction method with given transaction ID
Blockchain.prototype.getTransaction = function(transactionId){
	let correctTransaction = null;
	let correctBlock = null;

	//Loop through blocks in blockchain
	this.chain.forEach(block => {

		//Loop through transactions in each block
		block.transactions.forEach(transaction => {
			if(transaction.transactionId === transactionId){
				correctTransaction = transaction;
				correctBlock = block;
			};
		});

	});

	return {
		transaction: correctTransaction,
		block: correctBlock
	};

};

//getAddressData method to return all transactions involving given address
Blockchain.prototype.getAddressData = function(address){
	const addressTransactions = [];
	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			if(transaction.sender === address || transaction.recipient === address){
				addressTransactions.push(transaction);
			};
		});
	});

	//Cycle through all transactions to find balance
	let balance = 0;
	addressTransactions.forEach(transaction => {
		//If address is recipient, add to balance; else subtract
		if(transaction.recipient === address)balance += transaction.amount;
		else if(transaction.sender === address) balance -= transaction.amount;

	});

	//Return transaction and balance
	return {
		addressTransactions: addressTransactions,
		addressBalance: balance
	};

};

Blockchain.prototype.getBalance= function(address){
	const addressTransactions = [];
	this.chain.forEach(block => {
		block.transactions.forEach(transaction => {
			if(transaction.sender === address || transaction.recipient === address){
				addressTransactions.push(transaction);
			};
		});
	});

	//Cycle through all transactions to find balance
	let balance = 0;
	addressTransactions.forEach(transaction => {
		//If address is recipient, add to balance; else subtract
		if(transaction.recipient === address)balance += transaction.amount;
		else if(transaction.sender === address) balance -= transaction.amount;

	});
	return balance;
}


//Export Blockchain for testing
module.exports = Blockchain;














