const crypto = require('crypto');

// Class representing a transaction in the blockchain
class Transaction {
    constructor(from, to, amount, timestamp = Date.now(), signature = null) {
        this.from = from;           // Sender's public key
        this.to = to;               // Recipient's public key
        this.amount = amount;       // Amount to transfer
        this.timestamp = timestamp; // Transaction timestamp
        this.signature = signature; // Digital signature
    }

    // Calculate hash of transaction data (used for signing)
    calculateHash() {
        return crypto.createHash('sha256').update(
            this.from + this.to + this.amount + this.timestamp
        ).digest('hex');
    }

    // Sign the transaction with the sender's private key
    sign(privateKey) {
        const sign = crypto.createSign('SHA256');
        sign.update(this.calculateHash());
        sign.end();
        this.signature = sign.sign(privateKey, 'hex');
    }

    // Verify the transaction signature using sender's public key
    verifySignature() {
        // Skip verification for mining rewards (no sender)
        if (this.from === '0') return true;
        
        const verify = crypto.createVerify('SHA256');
        verify.update(this.calculateHash());
        verify.end();
        return verify.verify(this.from, this.signature, 'hex');
    }
}

// Class representing a block in the blockchain
class Block {
    constructor(timestamp, transactions, previousHash = '') {
        this.timestamp = timestamp;         // Block creation timestamp
        this.transactions = transactions;   // Array of transactions
        this.previousHash = previousHash;   // Hash of previous block
        this.hash = this.calculateHash();   // Hash of this block
        this.nonce = 0;                     // Used for proof-of-work
    }

    // Calculate hash of all block data
    calculateHash() {
        return crypto.createHash('sha256').update(
            this.previousHash + 
            this.timestamp + 
            JSON.stringify(this.transactions) + 
            this.nonce
        ).digest('hex');
    }

    // Proof-of-work mining (find hash with leading zeros)
    mineBlock(difficulty) {
        const target = Array(difficulty + 1).join('0');
        
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        
        console.log(`Block mined: ${this.hash}`);
    }

    // Verify all transactions in the block
    hasValidTransactions() {
        for (const tx of this.transactions) {
            if (!tx.verifySignature()) {
                return false;
            }
        }
        return true;
    }
}

// Main blockchain class
class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()]; // Blockchain starts with genesis block
        this.difficulty = 2;                      // Mining difficulty (# of leading zeros)
        this.pendingTransactions = [];            // Transactions waiting to be mined
        this.miningReward = 100;                  // Reward for mining a block
    }

    // Create the first block (genesis)
    createGenesisBlock() {
        return new Block(Date.now(), [], '0');
    }

    // Get the latest block in the chain
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    // Process mining rewards and pending transactions
    minePendingTransactions(miningRewardAddress) {
        // Create mining reward transaction
        const rewardTx = new Transaction('0', miningRewardAddress, this.miningReward);
        this.pendingTransactions.push(rewardTx);

        // Create and mine a new block with all pending transactions
        const block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);

        console.log('Block successfully mined!');
        this.chain.push(block);

        // Reset pending transactions
        this.pendingTransactions = [];
        
        return block;
    }

    // Add a new transaction to pending transactions
    addTransaction(transaction) {
        // Verify transaction signature
        if (!transaction.verifySignature()) {
            throw new Error('Cannot add invalid transaction to chain');
        }

        // Verify sender has enough balance (except for mining rewards)
        if (transaction.from !== '0') {
            const senderBalance = this.getBalanceOfAddress(transaction.from);
            if (senderBalance < transaction.amount) {
                throw new Error('Not enough balance');
            }
        }

        this.pendingTransactions.push(transaction);
        return true;
    }

    // Get balance of a specific address
    getBalanceOfAddress(address) {
        let balance = 0;

        // Go through all blocks and transactions
        for (const block of this.chain) {
            for (const trans of block.transactions) {
                // If this address is the sender, subtract the amount
                if (trans.from === address) {
                    balance -= trans.amount;
                }
                // If this address is the recipient, add the amount
                if (trans.to === address) {
                    balance += trans.amount;
                }
            }
        }

        return balance;
    }

    // Get all transactions for an address (both sent and received)
    getTransactionsOfAddress(address) {
        const txs = [];

        // Go through all blocks
        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (tx.from === address || tx.to === address) {
                    txs.push(tx);
                }
            }
        }

        // Also check pending transactions
        for (const tx of this.pendingTransactions) {
            if (tx.from === address || tx.to === address) {
                txs.push({...tx, pending: true});
            }
        }

        return txs;
    }

    // Get all balances (for all addresses that have had transactions)
    getAllBalances() {
        const balances = {};
        
        // Process all blocks
        for (const block of this.chain) {
            for (const trans of block.transactions) {
                // Initialize balances for addresses not yet seen
                if (!balances[trans.from] && trans.from !== '0') balances[trans.from] = 0;
                if (!balances[trans.to]) balances[trans.to] = 0;
                
                // Update balances
                if (trans.from !== '0') balances[trans.from] -= trans.amount;
                balances[trans.to] += trans.amount;
            }
        }
        
        return balances;
    }

    // Get pending transactions
    getPendingTransactions() {
        return this.pendingTransactions;
    }

    // Verify the integrity of the blockchain
    isChainValid() {
        // Start from block 1 (not genesis)
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // Verify current block's transactions
            if (!currentBlock.hasValidTransactions()) {
                return false;
            }

            // Verify block hash
            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            // Verify block links to previous block
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }
        return true;
    }

    // Replace the chain if given one is longer and valid
    replaceChain(newChain) {
        if (newChain.length <= this.chain.length) {
            console.log('Received chain is not longer than the current chain');
            return false;
        }
        
        if (!this.isValidChain(newChain)) {
            console.log('Received chain is invalid');
            return false;
        }
        
        console.log('Replacing blockchain with new chain');
        this.chain = newChain;
        return true;
    }

    // Validate a provided chain
    isValidChain(chain) {
        // Check if genesis block is valid
        if (JSON.stringify(chain[0]) !== JSON.stringify(this.createGenesisBlock())) {
            return false;
        }
        
        // Check all other blocks
        for (let i = 1; i < chain.length; i++) {
            const block = chain[i];
            const previousBlock = chain[i - 1];
            
            if (block.previousHash !== previousBlock.hash) {
                return false;
            }
            
            if (block.hash !== block.calculateHash()) {
                return false;
            }
        }
        
        return true;
    }
}

module.exports = { Blockchain, Block, Transaction };