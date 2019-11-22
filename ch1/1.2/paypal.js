const EthCrypto = require('eth-crypto');
const Client = require('./client.js');

// Our naive implementation of a centralized payment processor
class Paypal extends Client {
  constructor() {
    super();
    // the state of the network (accounts and balances)
    this.state = {
      [this.wallet.address]: {
        balance: 1000000,
      },
    };
    // the history of transactions
    this.txHistory = [];
  }

  // Checks that the sender of a transaction is the same as the signer
  checkTxSignature(tx) {
    if (this.verify(tx.sig, this.toHash(tx.contents), tx.contents.from)) {
      return true;
    } else {
      console.log('failed signature check');
      return false;
    }
  }

  // Checks if the user's address is already in the state, and if not, adds the user's address to the state
  checkUserAddress(tx) {
    const sender = tx.contents.from;
    if (!(sender in this.state)) {
      this.state[sender] = {
        balance: 0,
      };
    }
    const receiver = tx.contents.to;
    if (!(receiver in this.state)) {
      this.state[receiver] = {
        balance: 0,
      };
    }
    return true;
  }

  // Checks the transaction type and ensures that the transaction is valid based on that type
  checkTxType(tx) {
    if (tx.contents.type === 'mint') {
      if (tx.contents.from !== this.wallet.address) {
        console.log('invalid minter');
        return false;
      }
    }
    if (tx.contents.type === 'check') {
      console.log(this.state[tx.contents.from].balance);
      return false;
    }
    if (tx.contents.type === 'send') {
      const sender = tx.contents.from;
      if (this.state[sender].balance - tx.contents.amount < 0) {
        console.log('insufficient funds');
        return false;
      }
    }
    return true;
  }

  // Checks if a transaction is valid, adds it to the transaction history, and updates the state of accounts and balances
  checkTx(tx) {
    const sigCheck = this.checkTxSignature(tx);
    const addressCheck = this.checkUserAddress(tx);
    const txTypeCheck = this.checkTxType(tx);
    console.log(`sig: ${sigCheck}, address: ${addressCheck}, type: ${txTypeCheck}`)
    if (sigCheck && addressCheck && txTypeCheck) {
      return true;
    } else {
      return false;
    }
  }

  // Updates account balances according to a transaction and adds the transaction to the history
  applyTx(tx) {
    this.state[tx.contents.from].balance -= tx.contents.amount;
    console.log(`deducting ${tx.contents.amount} from account: ${tx.contents.from}`);
    this.state[tx.contents.to].balance += tx.contents.amount;
    console.log(`adding ${tx.contents.amount} to account: ${tx.contents.to}`);
    this.txHistory.push(tx);
    return true;
  }

  // Process a transaction
  processTx(tx) {
    if (this.checkTx(tx)) {
      this.applyTx(tx);
    }
  }
}

module.exports = Paypal;
