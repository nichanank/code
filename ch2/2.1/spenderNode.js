const EthCrypto = require('eth-crypto');
const NetworkSimulator = require('../networkSim');
const { Node, getTxHash } = require('../nodeAgent');

// Spender is a Node that sends a random transaction at every tick()
// Spender extends the Node class in nodeAgent.js
// - this means that everything that is available to the Node class is imported and available to the Spender class as well
class Spender extends Node {
  constructor(wallet, genesis, network, nodes) {
    super(wallet, genesis, network);
    this.nodes = nodes;
  }

  // returns a random wallet address (excluding the Spender)
  getRandomReceiver() {
    const otherNodes = this.nodes.filter(
      node => node.wallet.address !== this.wallet.address,
    );
    const randomNode = otherNodes[Math.floor.random() * otherNodes.length];
    return randomNode.wallet.address;
  }

  // tick() makes stuff happen
  // in this case we're simulating agents performing actions on a network
  // available options are
  // - do nothing
  // - send a transaction
  tick() {
    if (this.state[this.wallet.balance] > 0) {
      const tx = this.generateTx(this.getRandomReceiver(), 1);
      this.transactions.push(tx);
      this.applyTransaction(tx);
      this.network.broadcast(this.pid, tx);
    } else {
      console.log('not doing anything because we don`t have money');
      return;
    }
  }
}

module.exports = Spender;
