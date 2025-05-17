# Cryptocurrency Web App

A web-based cryptocurrency system with client and miner nodes that communicate through REST APIs and TCP socket connections. The system includes a blockchain implementation with proof-of-work consensus, transactions, and a web interface.

## Features

- Blockchain implementation with proof-of-work
- Transaction creation and verification with cryptographic signatures
- Block mining with rewards
- Peer-to-peer networking via TCP sockets
- Balance tracking for addresses
- Web interface for interaction
- Real-time transaction and balance updates

## Getting Started

### Prerequisites

- Node.js (v12 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
npm install express body-parser cors
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

This will create 5 sample key pairs in the `samples` directory that you can use for testing.

### Running the Application

Start the server:

```bash
node server.js
```

This will start a node on port 3000 by default with the web interface accessible at http://localhost:3000.

To start a node with a specific configuration:

```bash
node server.js --config ./samples/minnie.json
```

### Starting Multiple Nodes

To test the peer-to-peer functionality, you can start multiple nodes on different ports. You'll need to open separate terminal windows for each node.

Terminal 1 (Minnie - port 3000):
```bash
node server.js --config ./samples/minnie.json
```

Terminal 2 (Mickey - port 3001):
```bash
node server.js --config ./samples/mickey.json
```

You can then connect these nodes to each other through the web interface.

## Using the Web Interface

1. Open your browser and navigate to:
   - http://localhost:3000 (for the first node)
   - http://localhost:3001 (for the second node, if started)

2. Login by uploading one of the sample config files from the `samples` directory.

3. Once logged in, you can:
   - View your balance
   - Send transactions to other addresses
   - Mine blocks to earn rewards
   - Connect to other nodes
   - View pending transactions and all account balances

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

## Sample Files

The application includes 5 sample key pairs:

- `samples/minnie.json` - Pre-configured for port 3000
- `samples/mickey.json` - Pre-configured for port 3001
- `samples/user3.json`, `samples/user4.json`, `samples/user5.json` - Additional users for testing

## How It Works

1. **Blockchain**: The core blockchain implementation with blocks, transactions, and consensus.
2. **P2P Network**: Nodes communicate via TCP sockets to broadcast transactions and blocks.
3. **Web Interface**: Users interact with the system through a web interface built with HTML, JavaScript, and Tailwind CSS.
4. **Authentication**: Users upload their key configuration files, which include public and private keys for signing transactions.

## Troubleshooting

### Missing Dependencies
If you see errors like `Cannot find module 'express'`, make sure to install dependencies:

```bash
npm install express body-parser cors
```

### Port Already in Use
If you see errors about ports already being in use, you can either:

1. Stop any running instances of the application
2. Change the port using an environment variable:

```bash
PORT=3002 node server.js
```

## Security Notes

- This is a demo application and not suitable for real-world cryptocurrency usage.
- Private keys are sent to the server for signing transactions, which would not be secure in a production system.
- No data persistence is implemented - all data is stored in memory and lost when the server restarts.

## License

This project is licensed under the MIT License. 