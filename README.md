# Cryptocurrency Web App

A web-based cryptocurrency system with client and miner nodes that communicate through REST APIs and TCP socket connections. The system includes a blockchain implementation with proof-of-work consensus, transactions, and a web interface.

## Features

- Blockchain implementation with proof-of-work consensus
- Transaction creation and verification with cryptographic signatures
- Block mining with rewards (50 coins per block)
- Peer-to-peer networking via TCP sockets
- Balance tracking for addresses
- Web interface for interaction
- Real-time transaction and balance updates

###For more specific details, you can check Blockchain_Report.pdf imported above in this repository.

## Getting Started

### Prerequisites

- Node.js (v12 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
npm install
```

Note: If you encounter a security error when running npm commands on Windows PowerShell, you may need to adjust your execution policy. There are several options:

Option 1: Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Option 2: Use Command Prompt (cmd) instead of PowerShell to run npm commands.

Option 3: Use Visual Studio Code's built-in terminal, which typically doesn't have these restrictions.

3. Generate sample key pairs (if not already created):

```bash
node keygen.js
```

This will create sample key pairs in the `samples` directory that you can use for testing.

### Running the Application

Start the server:

```bash
node server.js
```

This will start a node on port 3000 by default with the web interface accessible at http://localhost:3000.

To start a node with a specific configuration:

```bash
node server.js --config ./samples/hesham.json
```

### Starting Multiple Nodes

To test the peer-to-peer functionality, you can start multiple nodes on different ports. You'll need to open separate terminal windows for each node.

We have 6 sample users already configured:

1. Hesham (Web Port: 3000, P2P Port: 4000)
2. Mohamed (Web Port: 3001, P2P Port: 4001)
3. Mostafa (Web Port: 3002, P2P Port: 4002)
4. Mahmoud (Web Port: 3003, P2P Port: 4003)
5. Mina (Web Port: 3004, P2P Port: 4004)
6. Abdulrahman (Web Port: 3005, P2P Port: 4005)

Example for starting two nodes:

Terminal 1 (Hesham - port 3000):
```bash
node server.js --config ./samples/hesham.json
```

Terminal 2 (Mohamed - port 3001):
```bash
node server.js --config ./samples/mohamed.json
```

You can then connect these nodes to each other through the web interface.

## Using the Web Interface

1. Open your browser and navigate to:
   - http://localhost:3000 (for Hesham's node)
   - http://localhost:3001 (for Mohamed's node)
   - etc.

2. Once logged in, you can:
   - View your balance
   - Send transactions to other addresses
   - Mine blocks to earn rewards (50 coins)
   - Connect to other nodes
   - View pending transactions and all account balances

## Connecting Nodes Together

For the nodes to communicate with each other, they need to be connected:

1. Open a user's web interface (e.g., http://localhost:3000 for Hesham)
2. Go to the "Network" section
3. Enter the host (`localhost`) and the P2P port of another user (e.g., 4001 for Mohamed)
4. Click "Connect to Peer"

It's recommended to connect all nodes to at least one other node to form a network.

## API Endpoints

The server exposes the following REST API endpoints:

- `GET /blockchain` - Get the entire blockchain
- `GET /balance/:address` - Get balance for a specific address
- `GET /balances` - Get all account balances
- `GET /pending` - Get pending transactions
- `GET /transactions/:address` - Get transactions for a specific address
- `POST /transaction` - Create a new transaction
- `POST /mine` - Mine a new block
- `POST /connect` - Connect to another peer
- `POST /login` - Login with a key pair

## Making Transactions

To send cryptocurrency from one user to another:

1. Open the sender's web interface
2. Find the "Send Transaction" section
3. Enter the recipient's public key
4. Enter the amount to send
5. Click "Send"

The transaction will be created and added to the pending transactions list.

## Mining Blocks

Transactions are only confirmed when they are included in a mined block:

1. Open any user's web interface
2. Click "Mine Block" button
3. This will mine a new block with any pending transactions
4. When successful, the miner receives a reward (50 coins)
5. All connected nodes will receive the updated blockchain

## Troubleshooting

### Missing Dependencies
If you see errors like `Cannot find module 'express'`, make sure to install dependencies:

```bash
npm install
```

### Port Already in Use
If you see errors about ports already being in use, you can either:

1. Stop any running instances of the application
2. Change the port using an environment variable:

```bash
PORT=3006 node server.js
```

### Connection Errors
- Ensure the target node is running
- Double-check the host and port values
- Try reconnecting

## Security Notes

- This is a demo application and not suitable for real-world cryptocurrency usage.
- Private keys are sent to the server for signing transactions, which would not be secure in a production system.
- No data persistence is implemented - all data is stored in memory and lost when the server restarts.

## License

This project is licensed under the MIT License. 
