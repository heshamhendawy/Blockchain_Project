# How to Run the Cryptocurrency System

This guide will walk you through running multiple user nodes, connecting them together, and making transactions in our cryptocurrency system.

## Prerequisites

1. Node.js installed (v12 or higher)
2. Required dependencies installed:
   ```
   npm install
   ```

## Running Multiple Users

Each user node needs to be run in a separate terminal window. We have 6 sample users already configured:

1. Hesham (ID: H0001, Web Port: 3000, P2P Port: 4000)
2. Mohamed (ID: M0001, Web Port: 3001, P2P Port: 4001)
3. Mostafa (ID: M0002, Web Port: 3002, P2P Port: 4002)
4. Mahmoud (ID: M0003, Web Port: 3003, P2P Port: 4003)
5. Mina (ID: M0004, Web Port: 3004, P2P Port: 4004)
6. Abdulrahman (ID: A0001, Web Port: 3005, P2P Port: 4005)

### Start Each User's Node

Open a separate terminal window for each user:

#### For Hesham (Terminal 1):
```
node server.js --config ./samples/hesham.json
```

#### For Mohamed (Terminal 2):
```
node server.js --config ./samples/mohamed.json
```

#### For Mostafa (Terminal 3):
```
node server.js --config ./samples/mostafa.json
```

#### For Mahmoud (Terminal 4):
```
node server.js --config ./samples/mahmoud.json
```

#### For Mina (Terminal 5):
```
node server.js --config ./samples/mina.json
```

#### For Abdulrahman (Terminal 6):
```
node server.js --config ./samples/abdulrahman.json
```

## Accessing Web Interfaces

Each user's web interface will be available at a different port:
- Hesham: http://localhost:3000
- Mohamed: http://localhost:3001
- Mostafa: http://localhost:3002
- Mahmoud: http://localhost:3003
- Mina: http://localhost:3004
- Abdulrahman: http://localhost:3005

## Connecting Nodes Together

For the nodes to communicate with each other, they need to be connected. You can connect them through the web interface:

1. Open a user's web interface (e.g., http://localhost:3000 for Hesham)
2. Go to the "Network" section
3. Enter the host (`localhost`) and the P2P port of another user:
   - Hesham: 4000
   - Mohamed: 4001
   - Mostafa: 4002
   - Mahmoud: 4003
   - Mina: 4004
   - Abdulrahman: 4005
4. Click "Connect to Peer"

For example, to connect Mohamed to Hesham:
- In Mohamed's interface (http://localhost:3001), enter:
  - Host: localhost
  - Port: 4000

It's recommended to connect all nodes to at least one other node to form a network.

## Making Transactions

To send cryptocurrency from one user to another:

1. Open the sender's web interface
2. Make sure you've logged in with the user's config file
3. Find the "Send Transaction" section
4. Enter the recipient's public key (found in their config file or displayed in their interface)
5. Enter the amount to send
6. Click "Send"

The transaction will be created and added to the pending transactions list.

## Mining Blocks

Transactions are only confirmed when they are included in a mined block:

1. Open any user's web interface
2. Click "Mine Block" button
3. This will mine a new block with any pending transactions
4. When successful, the miner receives a reward (50 coins)
5. All connected nodes will receive the updated blockchain

## Checking Balances and Transactions

In any user's web interface, you can check:
- Your current balance
- Pending transactions
- Your transaction history
- All balances in the network

## Troubleshooting

1. **Port already in use errors**:
   - Make sure each user uses a unique port
   - Check if you have other applications using those ports
   - Try closing and reopening terminals

2. **Connection errors**:
   - Ensure the target node is running
   - Double-check the host and port values
   - Try reconnecting

3. **Transaction failures**:
   - Ensure you have sufficient balance
   - Check that the recipient's public key is correct
   - Verify you've entered a valid transaction amount

Happy cryptocurrency mining and trading! 