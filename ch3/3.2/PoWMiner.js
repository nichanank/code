const EthCrypto = require('eth-crypto');
const Client = require('./PoWClient');
const { getTxHash } = require('../nodeAgent');

// This Miner class will extend the client we created in 3.1
class Miner extends Client {
  constructor(wallet, genesis, network) {
    super(wallet, genesis, network);
    // create a block in the constructor so that we have something to start mining on
    this.blockAttempt = this.createBlock();
    // hashRate = # hashes miner can try at each tick
    this.hashRate = 5;
  }

  // Create a new block
  createBlock() {
    // get all the transactions for this block
    const txList = [];
    const tx = this.transactions.shift();
    if (tx) txList.push(tx);
    // create a new block
    const newBlock = {
      nonce: 0, // nonce
      number: this.blockNumber + 1, // block number
      coinbase: this.wallet.address, // give ourselves the coinbase reward for finding the block
      difficulty: this.difficulty, // log the difficulty of the network
      parentHash: this.blockchain.slice(-1)[0], // show the hash of the block that matches the network difficulty
      timestamp: Math.round(new Date().getTime() / 1000), // timestamp
      contents: {
        type: 'block',
        txList, // transactions
      },
    };
    return newBlock;
  }

  // What we do when we get a new block (from ourselves or the network)
  receiveBlock(block) {
    // create a variable to hold the hash of the old block so that we can mine on top of it
    const { parentHash } = this.blockAttempt;
    // use the receiveBlock() function from the client to check the block and broadcast it to to the network
    super.receiveBlock(block);
    // update the head of the local state of our blockchain
    const newHead = this.blockchain.slice(-1)[0];
    // if the block head has changed, mine on top of the new head
    if (getTxHash(newHead) !== parentHash) {
      // start creating/mining a new block
      this.blockAttempt = this.createBlock();
    }
  }

  // Start mining
  tick() {
    // for every instance we try to mine (where hashRate determines the amount of computations a GPU or ASIC could process in parrallel)
    for (let i = 0; i < this.hashRate; i++) {
      // - if we find a valid block
      if (this.isValidBlockHash(this.blockAttempt)) {
        // -- get the valid blockhash
        const validBlockHash = getTxHash(this.blockAttempt);
        // -- log the results to the console
        console.log(`blockhash is ${validBlockHash}`);
        // -- create the valid block
        this.receiveBlock(this.blockAttempt);
        // -- process the valid block
        this.applyBlock(this.blockAttempt);
        // -- end the loop and keep mining
        return;
      }
      // - if we did not find a block, incriment the nonce and try again
      this.blockAttempt.nonce++;
    }
  }
}

module.exports = Miner;
