const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const net = require('net');
const { Blockchain, Transaction } = require('./blockchain');

class Node {
    constructor(port, keyPair = null) {
        // Node configuration
        this.port = port;
        this.publicKey = keyPair ? keyPair.publicKey : null;
        this.privateKey = keyPair ? keyPair.privateKey : null;
        this.blockchain = new Blockchain();
        this.peers = [];  // List of connected peers
        this.app = express();
        
        // Server configuration
        this.setupServer();
        this.setupP2PServer();
    }

    // Setup Express server and routes
    setupServer() {
        this.app.use(cors());
        this.app.use(bodyParser.json());
        this.app.use(express.static('public'));
        
        // Get blockchain info
        this.app.get('/blockchain', (req, res) => {
            res.json(this.blockchain);
        });
        
        // Get all balances
        this.app.get('/balances', (req, res) => {
            res.json(this.blockchain.getAllBalances());
        });
        
        // Get balance for a specific address
        this.app.get('/balance/:address', (req, res) => {
            const balance = this.blockchain.getBalanceOfAddress(req.params.address);
            res.json({ address: req.params.address, balance });
        });
        
        // Get transactions for a specific address
        this.app.get('/transactions/:address', (req, res) => {
            const transactions = this.blockchain.getTransactionsOfAddress(req.params.address);
            res.json(transactions);
        });
        
        // Get pending transactions
        this.app.get('/pending', (req, res) => {
            res.json(this.blockchain.getPendingTransactions());
        });
        
        // Create a new transaction
        this.app.post('/transaction', (req, res) => {
            try {
                const { from, to, amount, privateKey } = req.body;
                
                // Create and sign the transaction
                const tx = new Transaction(from, to, amount);
                tx.sign(privateKey);
                
                // Add to pending transactions
                this.blockchain.addTransaction(tx);
                
                // Broadcast to all peers
                this.broadcastTransaction(tx);
                
                res.json({ message: 'Transaction added successfully', transaction: tx });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Mine a new block
        this.app.post('/mine', (req, res) => {
            const { minerAddress } = req.body;
            
            // Mine block and get the new block
            const newBlock = this.blockchain.minePendingTransactions(minerAddress);
            
            // Broadcast new block to all peers
            this.broadcastBlock(newBlock);
            
            res.json({ 
                message: 'Block mined successfully', 
                block: newBlock,
                balance: this.blockchain.getBalanceOfAddress(minerAddress)
            });
        });
        
        // Connect to another node
        this.app.post('/connect', (req, res) => {
            const { host, port } = req.body;
            
            // Connect to the peer
            this.connectToPeer(host, port);
            
            res.json({ message: `Connected to peer ${host}:${port}` });
        });
        
        // Get list of connected peers
        this.app.get('/peers', (req, res) => {
            const peerList = this.peers.map(peer => ({
                host: peer.remoteAddress,
                port: peer.remotePort
            }));
            
            res.json(peerList);
        });
        
        // Setup user authentication with key pairs
        this.app.post('/login', (req, res) => {
            const { publicKey, privateKey } = req.body;
            
            // Store the keys for this node
            this.publicKey = publicKey;
            this.privateKey = privateKey;
            
            res.json({ message: 'Login successful', address: publicKey });
        });
    }
    
    // Start the server
    listen() {
        this.app.listen(this.port, () => {
            console.log(`Node is running on http://localhost:${this.port}`);
        });
    }
    
    // Setup P2P server using TCP
    setupP2PServer() {
        this.p2pServer = net.createServer(socket => {
            console.log(`New peer connected: ${socket.remoteAddress}:${socket.remotePort}`);
            
            // Add to peers list
            this.peers.push(socket);
            
            // Handle incoming data
            socket.on('data', data => {
                const message = JSON.parse(data.toString());
                this.handleMessage(message, socket);
            });
            
            // Handle peer disconnection
            socket.on('close', () => {
                console.log(`Peer disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
                this.peers = this.peers.filter(peer => peer !== socket);
            });
            
            // Handle errors
            socket.on('error', error => {
                console.log(`Socket error: ${error.message}`);
                this.peers = this.peers.filter(peer => peer !== socket);
            });
        });
        
        // Start P2P server on a different port (node port + 1000)
        const p2pPort = this.port + 1000;
        this.p2pServer.listen(p2pPort, () => {
            console.log(`P2P server running on port ${p2pPort}`);
        });
    }
    
    // Connect to a peer node
    connectToPeer(host, port) {
        const p2pPort = parseInt(port) + 1000;
        const socket = new net.Socket();
        
        socket.connect(p2pPort, host, () => {
            console.log(`Connected to peer: ${host}:${p2pPort}`);
            this.peers.push(socket);
            
            // Send our blockchain to the new peer
            this.sendMessage(socket, { type: 'blockchain', data: this.blockchain.chain });
            
            // Handle messages from peer
            socket.on('data', data => {
                const message = JSON.parse(data.toString());
                this.handleMessage(message, socket);
            });
            
            // Handle disconnection
            socket.on('close', () => {
                console.log(`Disconnected from peer: ${host}:${p2pPort}`);
                this.peers = this.peers.filter(peer => peer !== socket);
            });
            
            // Handle errors
            socket.on('error', error => {
                console.log(`Socket error: ${error.message}`);
                this.peers = this.peers.filter(peer => peer !== socket);
            });
        });
        
        // Handle connection errors
        socket.on('error', error => {
            console.log(`Connection error: ${error.message}`);
        });
    }
    
    // Send message to a peer
    sendMessage(socket, message) {
        socket.write(JSON.stringify(message));
    }
    
    // Broadcast message to all peers
    broadcast(message) {
        this.peers.forEach(peer => {
            this.sendMessage(peer, message);
        });
    }
    
    // Broadcast a new transaction
    broadcastTransaction(transaction) {
        this.broadcast({
            type: 'transaction',
            data: transaction
        });
    }
    
    // Broadcast a new block
    broadcastBlock(block) {
        this.broadcast({
            type: 'block',
            data: block
        });
    }
    
    // Handle messages from peers
    handleMessage(message, socket) {
        switch (message.type) {
            case 'transaction':
                try {
                    // Add transaction if valid and not already in pending list
                    const tx = message.data;
                    if (!this.blockchain.pendingTransactions.some(t => 
                        t.from === tx.from && 
                        t.to === tx.to && 
                        t.amount === tx.amount && 
                        t.timestamp === tx.timestamp)) {
                        
                        // Recreate the transaction object
                        const newTx = new Transaction(
                            tx.from, tx.to, tx.amount, tx.timestamp, tx.signature
                        );
                        
                        // Add to pending transactions
                        this.blockchain.addTransaction(newTx);
                        console.log('New transaction received and added to pending');
                    }
                } catch (error) {
                    console.log(`Invalid transaction received: ${error.message}`);
                }
                break;
                
            case 'block':
                try {
                    // Add block if valid
                    const newBlock = message.data;
                    const latestBlock = this.blockchain.getLatestBlock();
                    
                    // Check if block is next in sequence
                    if (newBlock.previousHash === latestBlock.hash) {
                        this.blockchain.chain.push(newBlock);
                        // Clear any pending transactions already in this block
                        this.blockchain.pendingTransactions = this.blockchain.pendingTransactions
                            .filter(tx => {
                                return !newBlock.transactions.some(
                                    blockTx => blockTx.signature === tx.signature
                                );
                            });
                        console.log('New block received and added to chain');
                    }
                } catch (error) {
                    console.log(`Invalid block received: ${error.message}`);
                }
                break;
                
            case 'blockchain':
                try {
                    // Replace blockchain if valid and longer
                    const receivedChain = message.data;
                    if (receivedChain.length > this.blockchain.chain.length) {
                        if (this.blockchain.isValidChain(receivedChain)) {
                            console.log('Received blockchain is valid. Replacing current blockchain');
                            this.blockchain.chain = receivedChain;
                        }
                    }
                } catch (error) {
                    console.log(`Invalid blockchain received: ${error.message}`);
                }
                break;
                
            default:
                console.log(`Unknown message type: ${message.type}`);
        }
    }
}

module.exports = Node;