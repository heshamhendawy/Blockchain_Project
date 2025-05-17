const fs = require('fs');
const path = require('path');

// Check for required modules and provide helpful error messages
try {
    var express = require('express');
    var bodyParser = require('body-parser');
    var cors = require('cors');
    var net = require('net');
} catch (error) {
    console.error('\nError: Required modules are missing.');
    console.error('Please install the required dependencies with:');
    console.error('\nnpm install express body-parser cors\n');
    console.error('If you encounter permission issues on Windows PowerShell, try:');
    console.error('1. Run PowerShell as Administrator and execute:');
    console.error('   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass');
    console.error('2. Use Command Prompt (cmd) instead of PowerShell');
    console.error('3. Use Visual Studio Code\'s terminal\n');
    process.exit(1);
}

// Import local modules
const { Blockchain, Transaction } = require('./blockchain');
const { generateKeyPair, generateSampleKeyPairs } = require('./keygen');

// Parse command line arguments
const args = process.argv.slice(2);
let configFile = null;

// Look for --config flag
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
        configFile = args[i + 1];
    }
}

// Create samples directory and generate key pairs if needed
if (!fs.existsSync('./samples')) {
    console.log('Creating samples directory and generating key pairs...');
    fs.mkdirSync('./samples');
    generateSampleKeyPairs();
}

// Create public/samples directory and copy sample files for download
const publicSamplesDir = path.join(__dirname, 'public', 'samples');
if (!fs.existsSync(publicSamplesDir)) {
    fs.mkdirSync(publicSamplesDir, { recursive: true });
}

// Copy sample files to public folder
fs.readdirSync('./samples').forEach(file => {
    const sourcePath = path.join(__dirname, 'samples', file);
    const destPath = path.join(publicSamplesDir, file);
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file} to public/samples for download`);
});

// Initialize blockchain
const blockchain = new Blockchain();

// Map to store connected nodes
const peers = new Map();

// User configuration
let userName = null;
let userId = null;
let webPort = null;
let p2pPort = null;

// Load config if provided
if (configFile) {
    try {
        const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (configData.name) userName = configData.name;
        if (configData.id) userId = configData.id;
        if (configData.webPort) webPort = configData.webPort;
        if (configData.p2pPort) p2pPort = configData.p2pPort;
    } catch (error) {
        console.error('Failed to load config file:', error.message);
    }
}

// Server configuration
const PORT = webPort ? parseInt(webPort) : (process.env.PORT || 3000);
const TCP_PORT = p2pPort ? parseInt(p2pPort) : (PORT + 1000); // Fallback to old behavior if p2pPort not specified

// Initialize Express app
const app = express();

// Setup middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Setup TCP server for P2P communication
const tcpServer = net.createServer((socket) => {
    console.log('New P2P connection');

    let buffer = '';
    socket.on('data', (data) => {
        buffer += data.toString();
        let boundary;
        while ((boundary = buffer.indexOf('\n')) !== -1) {
            const jsonStr = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 1);
            if (jsonStr.trim() === '') continue;
            try {
                const message = JSON.parse(jsonStr);

                switch (message.type) {
                    case 'TRANSACTION':
                        handleIncomingTransaction(message.data);
                        break;

                    case 'BLOCK':
                        handleIncomingBlock(message.data);
                        break;

                    case 'GET_BLOCKCHAIN':
                        socket.write(JSON.stringify({
                            type: 'BLOCKCHAIN',
                            data: blockchain.chain
                        }) + '\n');
                        break;

                    case 'DIRECT_NOTIFICATION':
                        // Handle direct notifications (forwarded to all connected clients)
                        if (configFile) {
                            const userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                            if (message.recipientAddress === userConfig.publicKey) {
                                console.log('Received direct notification addressed to this node');
                                // This notification is for this node's user
                                if (message.data.type === 'PAYMENT_RECEIVED') {
                                    console.log(`PAYMENT NOTIFICATION: Received ${message.data.data.amount} coins from ${message.data.data.from.substring(0, 10)}...`);

                                    // Force UI refresh by sending balance update
                                    setTimeout(() => {
                                        console.log('Updating UI with new balance...');
                                        // Ensure balance is updated
                                        const currentBalance = blockchain.getBalanceOfAddress(userConfig.publicKey);
                                        console.log(`Current balance: ${currentBalance}`);
                                    }, 300);
                                }
                            }
                        }
                        break;

                    case 'TRANSACTION_CONFIRMED':
                        console.log('Received transaction confirmation message');
                        // Check if this confirmation is for this user
                        if (configFile) {
                            const userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                            if (message.data.recipient === userConfig.publicKey) {
                                console.log(`CONFIRMED PAYMENT: ${message.data.amount} coins is now in your account`);
                            }
                        }
                        break;

                    case 'PEER_INFO':
                        // Optionally handle peer info
                        break;

                    case 'BALANCE_UPDATE':
                        // Optionally handle balance update
                        break;

                    default:
                        console.log(`Unknown message type: ${message.type}`);
                }
            } catch (error) {
                console.error('Error processing P2P message:', error);
            }
        }
    });

    socket.on('error', (error) => {
        console.log('Socket error:', error.message);
    });

    socket.on('close', () => {
        console.log('P2P connection closed');
    });

    // Only attempt funding if this is a new connection and the account hasn't been funded
    if (configFile) {
        const userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (isNewAccount(userConfig.publicKey)) {
            handleInitialFunding(userConfig.publicKey, userConfig.name);
        }
    }
});

// Start TCP server with error handling
try {
    tcpServer.listen(TCP_PORT, () => {
        console.log(`P2P server listening on port ${TCP_PORT}`);
    });

    tcpServer.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Error: Port ${TCP_PORT} is already in use.`);
            console.error('Try running the server with a different port:');
            console.error(`PORT=${PORT + 10} node server.js\n`);
        } else {
            console.error('TCP server error:', error.message);
        }
    });
} catch (error) {
    console.error('Failed to start TCP server:', error.message);
}

// Add at the top with other global variables
const processedTransactions = new Set();
const fundedAccounts = new Set(); // Track which accounts have received initial funding

// Handle incoming transactions from peers
function handleIncomingTransaction(transactionData) {
    try {
        if (transactionData.from === transactionData.to) {
            console.log('Rejected self-transfer transaction from peer.');
            return;
        }

        // Create a unique transaction ID
        const txId = `${transactionData.from}-${transactionData.to}-${transactionData.amount}-${transactionData.timestamp}`;
        
        // Check if we've already processed this transaction
        if (processedTransactions.has(txId)) {
            console.log('Skipping duplicate transaction');
            return;
        }

        const tx = new Transaction(
            transactionData.from,
            transactionData.to,
            transactionData.amount
        );
        tx.timestamp = transactionData.timestamp;
        tx.signature = transactionData.signature;

        console.log('Received transaction from peer:',
            `${tx.from.substring(0, 8)}...-> ${tx.to.substring(0, 8)}... for ${tx.amount} coins`);

        // Immediately update recipient's pending balance
        if (configFile) {
            const userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            if (tx.to === userConfig.publicKey) {
                console.log(`INCOMING PAYMENT RECEIVED: ${tx.amount} coins from ${tx.from.substring(0, 10)}...`);
                
                // Add transaction to pending list
                blockchain.addTransaction(tx);
                
                // Calculate new balance including pending transactions
                const pendingBalance = blockchain.getBalanceOfAddress(tx.to);
                const confirmedBalance = blockchain.getConfirmedBalance(tx.to);
                const totalBalance = pendingBalance;

                // Send immediate notification with both balances
                sendDirectNotification(tx.to, {
                    type: 'PAYMENT_RECEIVED',
                    data: {
                        from: tx.from,
                        amount: tx.amount,
                        timestamp: tx.timestamp,
                        confirmed: false,
                        pendingBalance: pendingBalance,
                        confirmedBalance: confirmedBalance,
                        totalBalance: totalBalance
                    }
                });

                // Update UI immediately
                console.log('Updating UI with new balance...');
                console.log(`Current total balance (including pending): ${totalBalance}`);
            } else {
                // For non-recipient nodes, just add to pending
                blockchain.addTransaction(tx);
            }
        } else {
            blockchain.addTransaction(tx);
        }

        // Mark transaction as processed
        processedTransactions.add(txId);

        // Re-broadcast to ensure all peers receive it
        rebroadcastTransaction(tx);

    } catch (error) {
        console.error('Error handling incoming transaction:', error);
    }
}

// Re-broadcast transaction to ensure propagation through network
function rebroadcastTransaction(tx) {
    // Create transaction ID
    const txId = `${tx.from}-${tx.to}-${tx.amount}-${tx.timestamp}`;
    
    // Only broadcast if we haven't seen this transaction before
    if (!processedTransactions.has(txId)) {
        setTimeout(() => {
            console.log('Broadcasting transaction to ensure delivery...');
            broadcast({
                type: 'TRANSACTION',
                data: tx
            });
        }, 100);
    }
}

// Add cleanup of processed transactions periodically
setInterval(() => {
    // Keep only transactions from the last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    for (const txId of processedTransactions) {
        const timestamp = parseInt(txId.split('-')[3]);
        if (timestamp < fiveMinutesAgo) {
            processedTransactions.delete(txId);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// Handle incoming blocks from peers
function handleIncomingBlock(blockData) {
    try {
        // Log receipt of block
        console.log('Received block from peer:', blockData.hash);

        // Validate block before accepting it
        if (blockData.previousHash === blockchain.getLatestBlock().hash) {
            console.log('Block is valid, adding to chain...');

            // Before adding block, check if any transactions are for this user
            if (configFile) {
                const userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                const receivedTransactions = blockData.transactions.filter(tx =>
                    tx.to === userConfig.publicKey && tx.from !== '0' // Exclude mining rewards
                );

                if (receivedTransactions.length > 0) {
                    console.log('***********************************');
                    console.log('PAYMENT RECEIVED: You received coins in a block from another node!');
                    receivedTransactions.forEach(tx => {
                        console.log(`- ${tx.amount} coins from ${tx.from.substring(0, 10)}...`);
                        // Mark transactions as received by current node for UI display
                        tx.receivedByCurrentNode = true;
                    });
                    console.log('***********************************');
                }
            }

            // Add block to chain
            blockchain.chain.push(blockData);
            console.log('Added new block from peer to blockchain');

            // Clear any transactions that were in this block
            blockchain.pendingTransactions = blockchain.pendingTransactions.filter(tx => {
                return !blockData.transactions.some(btx =>
                    btx.from === tx.from &&
                    btx.to === tx.to &&
                    btx.amount === tx.amount
                );
            });
        } else {
            console.log('Rejecting block: Invalid previous hash');
        }
    } catch (error) {
        console.error('Error handling incoming block:', error);
    }
}

// Connect to a peer
function connectToPeer(host, port) {
    const peerKey = `${host}:${port}`;

    // Check if already connected
    if (peers.has(peerKey)) {
        console.log(`Already connected to ${peerKey}`);
        return Promise.resolve(true);
    }

    console.log(`Connecting to peer at ${host}:${port}`);

    return new Promise((resolve, reject) => {
        // Connect and send initial message
        const socket = new net.Socket();

        socket.connect(port, host, () => {
            console.log(`Connected to peer at ${host}:${port}`);
            peers.set(peerKey, socket);

            // Request blockchain
            socket.write(JSON.stringify({
                type: 'GET_BLOCKCHAIN'
            }) + '\n');

            // Also send our ID so peers know who connected
            if (userName && userId) {
                socket.write(JSON.stringify({
                    type: 'PEER_INFO',
                    data: {
                        name: userName,
                        id: userId,
                        port: PORT
                    }
                }) + '\n');
            }

            // Resolve the promise when connection is successful
            resolve(true);
        });

        socket.on('data', (data) => {
            try {
                const message = JSON.parse(data.toString());

                switch (message.type) {
                    case 'BLOCKCHAIN':
                        console.log('Received blockchain from peer');

                        // Compare chain lengths - use the longer chain
                        if (message.data.length > blockchain.chain.length) {
                            console.log(`Peer has longer blockchain (${message.data.length} vs our ${blockchain.chain.length})`);
                            blockchain.chain = message.data;
                            console.log('Updated our blockchain from peer');
                        }
                        break;

                    case 'TRANSACTION':
                        console.log('Received transaction data from peer');
                        handleIncomingTransaction(message.data);
                        break;

                    case 'BLOCK':
                        handleIncomingBlock(message.data);
                        break;

                    case 'PEER_INFO':
                        console.log(`Peer info received: ${message.data.name} (${message.data.id}) on port ${message.data.port}`);
                        break;

                    case 'BALANCE_UPDATE':
                        // Optionally handle balance update
                        break;

                    default:
                        console.log(`Unknown message type: ${message.type}`);
                }
            } catch (error) {
                console.error('Error processing peer data:', error);
            }
        });

        socket.on('error', (error) => {
            console.log(`Error connecting to peer ${peerKey}:`, error.message);
            peers.delete(peerKey);
            reject(error);
        });

        socket.on('close', () => {
            console.log(`Connection to peer ${peerKey} closed`);
            peers.delete(peerKey);
        });
    });
}

// Broadcast to all peers
function broadcast(message) {
    console.log(`Broadcasting ${message.type} to ${peers.size} peers...`);
    let successCount = 0;

    if (peers.size === 0) {
        console.log('WARNING: No peers connected. Message not broadcast.');
        return;
    }

    peers.forEach((socket, peerKey) => {
        try {
            socket.write(JSON.stringify(message) + '\n');
            console.log(`- Sent ${message.type} to ${peerKey}`);
            successCount++;
        } catch (error) {
            console.error(`Failed to broadcast to ${peerKey}:`, error);
            // Remove failed peer
            peers.delete(peerKey);
        }
    });

    console.log(`Broadcast complete: ${successCount}/${peers.size} peers received the message`);
}

// API Routes
app.get('/blockchain', (req, res) => {
    res.json(blockchain);
});

app.get('/peers', (req, res) => {
    // Return list of connected peers
    const peerList = Array.from(peers.keys());
    res.json({
        count: peerList.length,
        peers: peerList
    });
});

app.get('/balance/:address', (req, res) => {
    const address = req.params.address;
    const balance = blockchain.getBalanceOfAddress(address);
    res.json({ balance });
});

app.get('/balances', (req, res) => {
    res.json(blockchain.getAllBalances());
});

app.get('/pending', (req, res) => {
    res.json(blockchain.pendingTransactions);
});

app.get('/transactions/:address', (req, res) => {
    const address = req.params.address;
    const transactions = blockchain.getTransactionsForAddress(address);

    // Check if this is the current user's address
    let isCurrentUser = false;
    if (configFile) {
        const userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        isCurrentUser = (userConfig.publicKey === address);
    }

    // Mark incoming transactions for UI highlighting if this is the current user
    if (isCurrentUser) {
        transactions.forEach(tx => {
            if (tx.to === address && tx.from !== '0') { // Not mining rewards
                tx.receivedByCurrentNode = true;
            }
        });
    }

    res.json(transactions);
});

function isValidPublicKey(key) {
    // Example: check length and allowed characters (adjust as needed)
    return typeof key === 'string' && key.length > 30 && /^[A-Za-z0-9+/=]+$/.test(key);
}

app.post('/transaction', (req, res) => {
    try {
        const { from, to, amount, privateKey } = req.body;

        if (!from || !to || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid transaction data' });
        }

        if (!isValidPublicKey(to)) {
            return res.status(400).json({ error: 'Invalid recipient public key' });
        }

        if (from === to) {
            return res.status(400).json({ error: 'You cannot send coins to yourself.' });
        }

        // Check P2P connection
        if (peers.size === 0) {
            return res.status(400).json({
                error: 'No active P2P connections. Please connect to at least one peer before sending transactions.'
            });
        }

        console.log(`Adding transaction to pending list: ${from.substring(0, 10)}... -> ${to.substring(0, 10)}... for ${amount} coins`);

        try {
            // Create transaction
            const tx = new Transaction(from, to, amount);
            tx.signTransaction(privateKey);

            // Check balance before adding transaction
            const senderBalance = blockchain.getBalanceOfAddress(from);
            if (senderBalance < amount) {
                return res.status(400).json({
                    error: `Insufficient balance. You have ${senderBalance} coins, but tried to send ${amount} coins.`
                });
            }

            // Add to blockchain's pending transactions
            blockchain.addTransaction(tx);

            // Calculate recipient's new balances
            const pendingBalance = blockchain.getBalanceOfAddress(to);
            const confirmedBalance = blockchain.getConfirmedBalance(to);
            const totalBalance = pendingBalance;

            // Broadcast pending transaction to peers
            broadcast({
                type: 'TRANSACTION',
                data: tx
            });

            // Immediately notify the recipient
            sendDirectNotification(to, {
                type: 'PAYMENT_RECEIVED',
                data: {
                    from: tx.from,
                    amount: tx.amount,
                    timestamp: tx.timestamp,
                    confirmed: false,
                    pendingBalance: pendingBalance,
                    confirmedBalance: confirmedBalance,
                    totalBalance: totalBalance
                }
            });

            res.json({
                message: 'Transaction processed successfully!',
                transaction: {
                    from,
                    to,
                    amount,
                    timestamp: tx.timestamp,
                    pending: true,
                    balances: {
                        sender: blockchain.getBalanceOfAddress(from),
                        recipient: totalBalance
                    }
                }
            });
        } catch (error) {
            console.error('Error processing transaction:', error);
            res.status(400).json({ error: `Error processing transaction: ${error.message}` });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/mine', (req, res) => {
    try {
        const { minerAddress } = req.body;

        if (!minerAddress) {
            return res.status(400).json({ error: 'Miner address is required' });
        }

        console.log(`Mining block for ${minerAddress}...`);
        
        // Mine block with all pending transactions
        const block = blockchain.minePendingTransactions(minerAddress);

        // Get all transactions in this block (excluding mining reward)
        const transactions = block.transactions.filter(tx => tx.from !== '0');

        // Process each transaction immediately
        transactions.forEach(tx => {
            // Get updated balances
            const newSenderBalance = blockchain.getBalanceOfAddress(tx.from);
            const newRecipientBalance = blockchain.getBalanceOfAddress(tx.to);

            // Send immediate notification to recipient
            sendDirectNotification(tx.to, {
                type: 'PAYMENT_RECEIVED',
                data: {
                    from: tx.from,
                    amount: tx.amount,
                    timestamp: tx.timestamp,
                    confirmed: true,
                    newBalance: newRecipientBalance,
                    currentBalance: newRecipientBalance
                }
            });

            // Send immediate notification to sender
            sendDirectNotification(tx.from, {
                type: 'BALANCE_UPDATE',
                data: {
                    newBalance: newSenderBalance,
                    currentBalance: newSenderBalance,
                    timestamp: Date.now()
                }
            });
        });

        // Broadcast new block to peers with high priority
        broadcast({
            type: 'BLOCK',
            data: block,
            priority: 'HIGH'
        });

        // Broadcast transaction confirmations
        transactions.forEach(tx => {
            broadcast({
                type: 'TRANSACTION_CONFIRMED',
                data: {
                    transaction: tx,
                    recipient: tx.to,
                    amount: tx.amount,
                    timestamp: Date.now(),
                    senderBalance: blockchain.getBalanceOfAddress(tx.from),
                    recipientBalance: blockchain.getBalanceOfAddress(tx.to),
                    priority: 'HIGH'
                }
            });
        });

        res.json({
            message: 'Block mined successfully!',
            block,
            transactions: transactions
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/connect', (req, res) => {
    try {
        const { host, port } = req.body;

        if (!host || !port) {
            return res.status(400).json({ error: 'Host and port are required' });
        }

        const portNumber = parseInt(port);

        // Validate that it's a P2P port (4000-4005)
        if (portNumber < 4000 || portNumber > 4005) {
            return res.status(400).json({ 
                error: 'Invalid P2P port. Please use one of the following P2P ports:',
                validPorts: {
                    'Hesham': 4000,
                    'Mohamed': 4001,
                    'Mostafa': 4002,
                    'Mahmoud': 4003,
                    'Mina': 4004,
                    'Abdulrahman': 4005
                }
            });
        }

        // Connect only to P2P port
        connectToPeer(host, portNumber)
            .then(connected => {
                if (connected) {
                    res.json({ message: `Connected to peer's P2P port at ${host}:${portNumber}` });
                } else {
                    res.status(400).json({ error: 'Could not connect to peer' });
                }
            })
            .catch(error => {
                res.status(400).json({ error: error.message });
            });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Helper: Wait for at least one peer before allowing mining/funding
function waitForPeers(callback) {
    if (peers.size > 0) {
        callback();
    } else {
        console.log('Waiting for at least one peer to connect before mining/funding...');
        const interval = setInterval(() => {
            if (peers.size > 0) {
                clearInterval(interval);
                callback();
            }
        }, 1000);
    }
}

// Helper function to check if an account has been funded
function hasBeenFunded(publicKey) {
    return fundedAccounts.has(publicKey) || blockchain.getConfirmedBalance(publicKey) > 0;
}

// Modified isNewAccount function
function isNewAccount(publicKey) {
    return !hasBeenFunded(publicKey);
}

// Handle initial funding
function handleInitialFunding(publicKey, name) {
    if (hasBeenFunded(publicKey)) {
        console.log(`Account ${name || publicKey.substring(0, 10)} has already been funded.`);
        return false;
    }

    // Add to funded accounts set before creating transaction
    fundedAccounts.add(publicKey);
    
    const fundingTx = new Transaction('0', publicKey, 500);
    blockchain.addTransaction(fundingTx);
    broadcast({
        type: 'TRANSACTION',
        data: fundingTx
    });

    // Mine the funding transaction
    const fundingBlock = blockchain.minePendingTransactions(publicKey);
    broadcast({
        type: 'BLOCK',
        data: fundingBlock
    });

    console.log(`Initial funding: 500 coins given to ${name || publicKey.substring(0, 10)}`);
    return true;
}

// Modify the login endpoint
app.post('/login', (req, res) => {
    try {
        const { publicKey, privateKey, name, id } = req.body;

        if (name && id) {
            console.log(`User login: ${name} (${id})`);
        } else {
            console.log(`User login with address: ${publicKey.substring(0, 10)}...`);
        }

        // Check if this is a new account that hasn't been funded
        if (isNewAccount(publicKey)) {
            waitForPeers(() => {
                handleInitialFunding(publicKey, name);
            });
        }

        res.json({
            message: 'Logged in successfully',
            address: publicKey,
            name: name || null,
            id: id || null,
            initialFunded: !hasBeenFunded(publicKey)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Send a direct notification to a specific recipient if they're connected
function sendDirectNotification(recipientAddress, message) {
    console.log(`Sending direct notification to ${recipientAddress.substring(0, 10)}...`);

    // Find all peers who might be the recipient
    peers.forEach((socket, peerKey) => {
        try {
            // Add current balance to the message
            const currentBalance = blockchain.getBalanceOfAddress(recipientAddress);
            message.data.currentBalance = currentBalance;

            console.log(`Sending direct notification to peer: ${peerKey}`);
            socket.write(JSON.stringify({
                type: 'DIRECT_NOTIFICATION',
                recipientAddress: recipientAddress,
                data: message
            }) + '\n');

            // Send an immediate balance update
            socket.write(JSON.stringify({
                type: 'BALANCE_UPDATE',
                data: {
                    address: recipientAddress,
                    newBalance: currentBalance,
                    timestamp: Date.now()
                }
            }) + '\n');
        } catch (error) {
            console.error(`Failed to send direct notification to ${peerKey}:`, error);
        }
    });
}

// Add P2P connection validation endpoint
app.get('/check-p2p-connection', (req, res) => {
    const isConnected = peers.size > 0;
    res.json({
        connected: isConnected,
        peerCount: peers.size,
        message: isConnected ? 'P2P connection is active' : 'No active P2P connections'
    });
});

// Add /p2p-status endpoint for monitoring
app.get('/p2p-status', (req, res) => {
    const peerList = Array.from(peers.keys());
    res.json({
        connectedPeers: peerList,
        count: peerList.length
    });
});

// Serve the main HTML file for any other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server
app.listen(PORT, () => {
    console.log('===========================================');
    if (userName) {
        console.log(`${userName}'s Cryptocurrency Node`);
        console.log('===========================================');
        if (userId) console.log(`- User ID: ${userId}`);
        console.log(`- Web interface: http://localhost:${PORT}`);
        console.log(`- P2P communication port: ${TCP_PORT}`);
        console.log(`- API endpoints available at http://localhost:${PORT}`);
        console.log('===========================================');

        // Mine an initial block for this user
        console.log(`Mining initial block for ${userName}${userId ? ` (${userId})` : ''}...`);
        blockchain.minePendingTransactions(configFile ? JSON.parse(fs.readFileSync(configFile, 'utf8')).publicKey : '0');
        console.log('Initial block mined!');
    } else {
        console.log(`Cryptocurrency node running on http://localhost:${PORT}`);
    }
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PORT} is already in use.`);
        console.error(`Try running the server with a different port or use the port specified in the config file.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});

// On node startup, if no peers, mine the initial block and broadcast it
app.on('listening', () => {
    if (peers.size === 0) {
        console.log('No peers detected. Mining initial block...');
        const initialBlock = blockchain.minePendingTransactions(configFile ? JSON.parse(fs.readFileSync(configFile, 'utf8')).publicKey : '0');
        broadcast({
            type: 'BLOCK',
            data: initialBlock
        });
        console.log('Initial block mined and broadcasted!');
    }
});

// Ensure all nodes use the same genesis block (fixed timestamp)
const GENESIS_TIMESTAMP = 1700000000000; // Example fixed timestamp
Blockchain.prototype.createGenesisBlock = function() {
    return new Block(GENESIS_TIMESTAMP, [], '0');
};

// Add helper function to get confirmed balance
Blockchain.prototype.getConfirmedBalance = function(address) {
    let balance = 0;
    
    for (const block of this.chain) {
        for (const trans of block.transactions) {
            if (trans.to === address) {
                balance += trans.amount;
            }
            if (trans.from === address) {
                balance -= trans.amount;
            }
        }
    }
    
    return balance;
};