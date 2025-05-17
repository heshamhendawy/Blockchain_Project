const crypto = require('crypto');

class Block {
    constructor(timestamp, transactions, previousHash = '') {
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = 0;
        this.hash = this.calculateHash();
    }

    calculateHash() {
        return crypto.createHash('sha256')
            .update(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce)
            .digest('hex');
    }

    mineBlock(difficulty) {
        const target = Array(difficulty + 1).join('0');

        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }

        console.log(`Block mined: ${this.hash}`);
    }
}

class Transaction {
    constructor(from, to, amount) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.timestamp = Date.now();
        this.signature = '';
    }

    calculateHash() {
        return crypto.createHash('sha256')
            .update(this.from + this.to + this.amount + this.timestamp)
            .digest('hex');
    }

    signTransaction(privateKey) {
        // Skip signing for mining rewards (from = 0)
        if (this.from === '0') return;

        try {
            // For simplicity, just use a hash-based signature
            // In a real application, you'd use proper asymmetric cryptography
            const dataToSign = this.calculateHash();
            const privateKeyStr = typeof privateKey === 'string' ? privateKey : privateKey.toString('hex');

            // Create a simple signature using the private key and transaction data
            this.signature = crypto.createHash('sha256')
                .update(dataToSign + privateKeyStr)
                .digest('hex');

            console.log("Transaction signed successfully");
        } catch (error) {
            console.error('Error signing transaction:', error.message);
            throw new Error('Failed to sign transaction: ' + error.message);
        }
    }

    isValid() {
        // Mining rewards don't need a signature
        if (this.from === '0') return true;

        // Must have a signature
        if (!this.signature || this.signature.length === 0) {
            console.log("Transaction rejected: missing signature");
            return false;
        }

        // For this demo, we're using a simplified validation
        // In a real application, you would verify the signature cryptographically
        return true;
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
        this.miningReward = 100;
        this.transactionsSinceLastReward = 0; // Track confirmed transactions
    }

    createGenesisBlock() {
        return new Block(Date.now(), [], '0');
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    // New method to create a block with specific transactions for immediate processing
    createNewBlock(miningRewardAddress, specificTransactions = []) {
        // Create a new block with the provided transactions
        const block = new Block(
            Date.now(),
            specificTransactions,
            this.getLatestBlock().hash
        );

        // Mine the block at the current difficulty
        block.mineBlock(this.difficulty);

        // Add index to track block number
        block.index = this.chain.length;

        // Return the block (but don't add to chain - caller will do that)
        return block;
    }

    minePendingTransactions(miningRewardAddress) {
        // Count non-reward transactions
        const nonRewardTxs = this.pendingTransactions.filter(tx => tx.from !== '0');
        this.transactionsSinceLastReward += nonRewardTxs.length;

        // Only give reward if 5 or more transactions since last reward
        let rewardGiven = false;
        if (this.transactionsSinceLastReward >= 5) {
            const rewardTx = new Transaction('0', miningRewardAddress, this.miningReward);
            this.pendingTransactions.push(rewardTx);
            this.transactionsSinceLastReward = 0;
            rewardGiven = true;
        }

        // Create new block with all pending transactions
        let block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);
        block.index = this.chain.length;
        this.chain.push(block);
        this.pendingTransactions = [];
        block.rewardGiven = rewardGiven;
        return block;
    }

    addTransaction(transaction) {
        // Check for duplicate in pendingTransactions
        const exists = this.pendingTransactions.some(
            tx =>
                tx.from === transaction.from &&
                tx.to === transaction.to &&
                tx.amount === transaction.amount &&
                tx.timestamp === transaction.timestamp
        );
        if (exists) {
            // Optionally log or ignore
            return;
        }
        // Validate transaction
        if (!transaction.from || !transaction.to) {
            throw new Error('Transaction must include from and to addresses');
        }

        // Skip validation for mining rewards
        if (transaction.from !== '0') {
            // Simple signature check
            if (!transaction.signature || transaction.signature.length === 0) {
                throw new Error('Transaction must be signed');
            }

            // Check if sender has enough funds
            const senderBalance = this.getBalanceOfAddress(transaction.from);
            if (senderBalance < transaction.amount) {
                throw new Error('Not enough balance');
            }
        }

        this.pendingTransactions.push(transaction);
        return true;
    }

    getBalanceOfAddress(address) {
        let balance = 0;

        // Check all transactions in all blocks
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

    getAllBalances() {
        const balances = {};

        // Process all blocks to calculate balances
        for (const block of this.chain) {
            for (const tx of block.transactions) {
                // If sender exists in our balances, update it
                if (tx.from !== '0') {
                    if (!balances[tx.from]) {
                        balances[tx.from] = 0;
                    }
                }

                // If recipient exists in our balances, update it
                if (!balances[tx.to]) {
                    balances[tx.to] = 0;
                }
            }
        }

        // Now calculate the actual balances
        for (const address in balances) {
            balances[address] = this.getBalanceOfAddress(address);
        }

        return balances;
    }

    getTransactionsForAddress(address) {
        const transactions = [];

        // Find transactions in blockchain
        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (tx.from === address || tx.to === address) {
                    transactions.push({
                        ...tx,
                        pending: false
                    });
                }
            }
        }

        // Find transactions in pending transactions
        for (const tx of this.pendingTransactions) {
            if (tx.from === address || tx.to === address) {
                transactions.push({
                    ...tx,
                    pending: true
                });
            }
        }

        return transactions;
    }

    isChainValid() {
        // Check each block
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // Check if hash is still valid
            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            // Check if points to correct previous hash
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }
}

module.exports = { Block, Transaction, Blockchain }; 