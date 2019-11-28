const EthCrypto = require('eth-crypto');
const hexToBinary = require('hex-to-binary');
const { Node, getTxHash } = require('../nodeAgent');

// Add Client class which generates & sends transactions
class Client extends Node {
  constructor(wallet, genesis, network) {
    super(wallet, genesis, network);
    this.blockchain = []; // longest chain
    this.allBlocks = []; // all blocks
    this.blockNumber = 0; // keep track of blocks added to blockchain despite getState()
    this.difficulty = 13;

    const genesisBlock = {
      nonce: 0,
      number: 0,
      coinbase: 0,
      difficulty: 9000,
      parentHash: 0,
      timestamp: 0,
      contents: {
        type: 'block',
        txList: [],
      },
    };
    this.blockchain.push(genesisBlock);
    this.allBlocks.push(genesisBlock);
  }

  // Check if a message is a transaction or a block
  onReceive(message) {
    if (message.contents.type === 'send') {
      this.receiveTx(message);
    }
    if (message.contents.type === 'receive') {
      this.receiveBlock(message);
    }
  }

  // Process an incoming transaction
  receiveTx(tx) {
    if (this.transactions.includes(tx.contents)) return;
      this.transactions.push(tx);
      this.network.broadcast(this.pid, tx);
  }

  // Check the hash of an incoming block
  isValidBlockHash(block) {
    const blockHash = getTxHash(block);
    const hashBin = hexToBinary(blockHash.substr(2));
    const leadingZeros = parseInt(hashBin.substring(0, this.difficulty));
    return leadingZeros === 0;
  }

  // Processing the transactions in a block
  applyBlock(block) {
    const { txList } = block.contents;
    for (tx in txList) {
      this.applyTx(tx);
      if (tx.contents.from !== 0) {
        this.applyInvalidNonceTxs(tx.contents.from)
      }
    }
  }

  // Update the state with transactions which are contained in the longest chain and return the resulting state object (this process is often referred to as the "fork choice" rule)
  updateState() {
    // create an array to represent a temp chain
    const tempChain = [];
    // create a variable to represent all the blocks that we have already processed
    const { allBlocks } = this;
    // find the highest block number in all the blocks
    const highestBlockNumber = Math.max.apply(Math, allBlocks.map(block => block.number));
    if (this.blockchain.slice(-1)[0].number === highestBlockNumber) return;    
    // add the highestBlockNumber to tempChain using blockNumber
    for (const block of allBlocks) {
      if (block.number === highestBlockNumber) {
        tempChain.push(block);    
        break;
      }
    }
    // add max number of blocks to tempChain using parentHash
    for (let i = highestBlockNumber; i > 0; i--) {
      const prevBlockHash = tempChain[0].parentHash;
      for (const block of allBlocks) {
        if (getTxHash(block) === prevBlockHash) {
          tempChain.unshift(block);
          break;
        }
      }
    }

    // tempchain is missing blocks
    if (tempChain.slice(-1)[0].number + 1 !== tempChain.length) return;

    // save the ordered sequence
    this.blockchain = tempChain;

    // apply all txs from ordered list of blocks
    for (const block of this.blockchain) {
      this.applyBlock(block);
    }    
    // return the new state
    return this.state;
  }

  // Receiving a block, making sure it's valid, and then processing it
  receiveBlock(block) {
    // if we've already seen the block return to do nothing
    if (this.allBlocks.includes(block)) return;
    // if the blockhash is not valid return to do nothing
    if (!this.isValidBlockHash(block)) return;
    // if checks pass, add block to all blocks received
    console.log(
      this.pid.substring(2, 6),
      'received a block:',
      getTxHash(block).substring(5, 10),
      'at height',
      block.number,
    );
    this.allBlocks.push(block);
    // if the block builds directly on the current head of the chain, append to chain
    if (block.parentHash === getTxHash(this.blockchain.slice(-1)[0])) {
      // incriment the block number
      this.blockNumber++;
      // add the block to our view of the blockchain
      this.blockchain.push(block);
      // process the block
      this.applyBlock(block);
    } else {
      // update our state with the new block
      this.updateState();
    }
    // broadcast the block to the network
    this.network.broadcast(this.pid, block);
  }
}

module.exports = Client;
