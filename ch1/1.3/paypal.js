/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
const EthCrypto = require('eth-crypto');
const Client = require('./client.js');

// Our naive implementation of a centralized payment processor
class Paypal extends Client {
  // initialize Paypal's state
  constructor() {
    super();
    // the state of the network (accounts and balances)
    this.state = {
      // Paypal's address
      [this.wallet.address]: {
        // Paypal's initial balance
        balance: 1000000,
        // Paypal's initial nonce
        nonce: 0,
      },
    };
    // pending transaction pool
    this.pendingTxPool = [];
    // the history of transactions
    this.txHistory = [];
  }

  // Checks that the sender of a transaction is the same as the signer
  checkTxSignature(tx) {
    // check the signature of a transaction and return a boolean
    const sig = this.verify(tx.sig, this.hash(tx.contents), tx.contents.from);
    // return an error if the signature is invalid
    if (!sig) {
      console.log('Invalid Signature');
      return false;
      // return true if the transaction is valid
    }
    return true;
  }

  // Check if the user's address is already in the state, and if not, add the user's address to the state
  checkUserAddress(tx) {
    // check if the sender is in the state
    if (!(tx.contents.to in this.state)) {
      // if the sender is not in the state, add their address and initialize an empty balance and nonce of 0
      this.state[tx.contents.to] = {
        balance: 0,
        nonce: 0,
      };
    }
    // check if the receiver is in the state
    if (!(tx.contents.from in this.state)) {
      // if the receiver is not in the state, add their address and initialize an empty balance and nonce of 0
      this.state[tx.contents.from] = {
        balance: 0,
        nonce: 0,
      };
    }
    // if the checks on both accounts pass (they're both in the state), return true
    return true;
  }

  // Check that the transaction nonce matches the nonce that Paypal has for the sender's account
  // note: we first have to make sure that the account is in Paypal's state before we can check it's nonce
  checkTxNonce(tx) {
    if (tx.contents.nonce > this.state[tx.contents.from].nonce) {
      if (!(tx.contents.from in this.pendingTxPool)) {
        this.pendingTxPool.push(tx);
      }
      return false;
    }
    if (tx.contents.nonce === this.state[tx.contents.from].nonce) {
      return true;
    }
    if (tx.contents.nonce < this.state[tx.contents.from].nonce) {
      return false;
    }
  }

  // Check that the transaction is valid based on the type
  checkTxType(tx) {
    // if mint
    if (tx.contents.type === 'mint') {
      // check that the sender is PayPal
      if (tx.contents.from !== this.wallet.address) {
        // if a check fails, return an error stating why
        console.log("Non-Paypal Clients can't mint!");
        return false;
      }
      // if a check passes, return true
      return true;
    }
    // if check
    if (tx.contents.type === 'check') {
      const user = tx.contents.from;
      console.log(`Your balance is: ${this.state[user].balance}`);
      // return false so that Paypal does not process the tx
      return false;
    }
    // if send
    if (tx.contents.type === 'send') {
      // check that the transaction amount is positive and the sender has an account balance greater than or equal to the transaction amount
      if (this.state[tx.contents.from].balance - tx.contents.amount < 0) {
        // if a check fails, print an error to the console stating why and return false
        console.log('Not enough money!');
        return false;
      }
      // if a check passes, return true
      return true;
    }
    // if cancel
    if (tx.contents.type === 'cancel') {
      const cancelTxNonce = tx.contents.nonce;
      for (const i in this.pendingTxPool) {
        const pendingTx = this.pendingTxPool[i];
        if (pendingTx.contents.nonce === cancelTxNonce) {
          if (this.wallet === pendingTx.contents.from) {
            delete this.pendingTxPool[i];
            return true;
          }
        }
      }

      for (const i in this.txHistory) {
        const processedTx = this.txHistory[i];
        if (processedTx.contents.nonce === cancelTxNonce) {
          if (processedTx.contents.from === tx.contents.from) {
            const cancellationFee = (3 / tx.contents.amount * 100); // 3% cancellation fee
            this.state[tx.contents.to].balance -= tx.contents.amount;
            this.state[tx.contents.from].balance += (tx.contents.amount - cancellationFee);
            this.state[this.wallet.address].balance += cancellationFee;
            return true;
          }
        }
      }
      this.txHistory.push(tx);
      return false;
    }
  }

  // Checks if a transaction is valid
  checkTx(tx) {
    // check that the signature is valid
    if (this.checkTxSignature(tx)) {
      // check that the sender and receiver are in the state
      if (this.checkUserAddress(tx)) {
        // check that the type is valid
        if (this.checkTxType(tx)) {
          // check that the nonce is valid
          if (this.checkTxNonce(tx)) {
            return true;
          }
        }
      }
    }
    // if all checks pass return true
    // if any checks fail return false
    return false;
  }

  // Updates account balances according to the transaction, then adds the transaction to the history
  applyTx(tx) {
    // first decrease the balance of the transaction sender/signer
    this.state[tx.contents.from].balance -= tx.contents.amount;
    // then increase the balance of the transaction receiver
    this.state[tx.contents.to].balance += tx.contents.amount;
    // then increment the nonce of the transaction sender
    this.state[tx.contents.from].nonce += 1;
    // then add the transaction to the transaction history
    this.txHistory.push(tx);
    // return true once the transaction is processed
    return true;
  }

  // Processes pending TX
  processPendingTx() {
    for (const i in this.pendingTxPool) {
      const pendingTx = this.pendingTxPool[i];
      const { sender, nonce } = pendingTx.contents;
      if (this.state[sender].nonce === nonce) {
        const pendingTxCopy = pendingTx;
        delete this.pendingTxPool[i];
        this.processTx(pendingTxCopy);
      }
    }
  }

  // Checks if a transaction is valid, then processes it, then checks if there are any valid transactions in the pending transaction pool and processes those too
  processTx(tx) {
    // check the transaction is valid
    if (this.checkTx(tx)) {
      // apply the transaction to Paypal's state
      this.applyTx(tx);
      // check if any pending transactions are now valid, and if so process them too
      this.processPendingTx();
      return true;
    }
    return false;
  }
}

// export the Paypal module so that other files can use it
module.exports = Paypal;
