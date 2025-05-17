// Global state
const state = {
    publicKey: null,
    privateKey: null,
    userName: null,
    userId: null,
    userPort: null,
    baseUrl: window.location.origin,
    darkMode: localStorage.getItem('darkMode') === 'true',
    peerCount: 0,
    blockchainLength: 0,
    lastCheckedBalance: 0,
    lastTransactionTime: Date.now(),
    pollingInterval: null
};

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    // Initialize dark mode
    if (state.darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }

    // Create blockchain animation blocks
    createBlockchainAnimation(5);

    // Setup transaction banner
    setupTransactionBanner();

    // Try to restore session from localStorage
    restoreSession();

    // Setup event listeners
    setupEventListeners();
});

// Setup transaction banner
function setupTransactionBanner() {
    const banner = document.getElementById('transaction-banner');
    const bannerClose = document.getElementById('banner-close');

    if (bannerClose) {
        bannerClose.addEventListener('click', () => {
            banner.classList.remove('show');
        });
    }
}

// Show transaction banner
function showTransactionBanner(message) {
    const banner = document.getElementById('transaction-banner');
    const bannerMessage = document.getElementById('banner-message');

    if (banner && bannerMessage) {
        bannerMessage.textContent = message;
        banner.classList.add('show');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            banner.classList.remove('show');
        }, 5000);
    }
}

// Helper for API calls
async function fetchApi(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${state.baseUrl}${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Restore session from localStorage
function restoreSession() {
    try {
        const savedSession = localStorage.getItem('blockchainSession');
        if (!savedSession) return;

        const session = JSON.parse(savedSession);

        // Validate session data
        if (!session.publicKey || !session.privateKey) return;

        // Restore state
        state.publicKey = session.publicKey;
        state.privateKey = session.privateKey;
        state.userName = session.userName;
        state.userId = session.userId;

        // Login to server (silently)
        fetchApi('/login', 'POST', {
            publicKey: state.publicKey,
            privateKey: state.privateKey,
            name: state.userName,
            id: state.userId
        }).then(() => {
            console.log('Session restored and logged in with server');
        }).catch(error => {
            console.error('Failed to login with saved session:', error);
        });

        // Handle UI changes
        hideElement('login-section');
        showElement('main-content');

        // Update UI with user info
        updateUserInfo();

        // Set up data refresh
        fetchPendingTransactions();
        refreshMyTransactions();
        refreshAllBalances();

        // Start real-time updates
        startRealTimeUpdates();

        console.log('Session restored successfully');
    } catch (error) {
        console.error('Failed to restore session:', error);
        // Clear potentially corrupted session data
        localStorage.removeItem('blockchainSession');
    }
}

// Save session to localStorage
function saveSession() {
    try {
        const sessionData = {
            publicKey: state.publicKey,
            privateKey: state.privateKey,
            userName: state.userName,
            userId: state.userId
        };

        localStorage.setItem('blockchainSession', JSON.stringify(sessionData));
    } catch (error) {
        console.error('Failed to save session:', error);
    }
}

// Start real-time updates with more frequent polling
function startRealTimeUpdates() {
    // Record initial balance
    refreshBalance(true).then(() => {
        state.lastCheckedBalance = parseInt(document.getElementById('user-balance').textContent) || 0;
    });

    // Clear any existing interval
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
    }

    // Poll for updates extremely frequently (every 100ms) to ensure near-instantaneous updates
    state.pollingInterval = setInterval(checkForNewTransactions, 100);

    // Start periodic full refresh
    startDataRefresh();
}

// Check for new transactions
async function checkForNewTransactions() {
    if (!state.publicKey) return;

    try {
        // Check for balance changes
        const { balance } = await fetchApi(`/balance/${encodeURIComponent(state.publicKey)}`);
        const currentBalance = parseInt(balance);

        // If balance changed, show notification and update UI
        if (currentBalance !== state.lastCheckedBalance) {
            const difference = currentBalance - state.lastCheckedBalance;
            
            // Show notification for balance increase
            if (difference > 0) {
                showTransactionNotification(difference);
            }

            // Update balance display with animation
            const balanceElement = document.getElementById('user-balance');
            balanceElement.textContent = `${currentBalance}`;
            balanceElement.classList.add('balance-change');

            // Remove animation class after it completes
            setTimeout(() => {
                balanceElement.classList.remove('balance-change');
            }, 2000);

            state.lastCheckedBalance = currentBalance;

            // Refresh transactions immediately
            refreshMyTransactions();
            fetchPendingTransactions();
        }

        // Check for confirmed transactions
        const txResponse = await fetch(`/transactions/${encodeURIComponent(state.publicKey)}`);
        const transactions = await txResponse.json();

        // Check for transactions marked as receivedByCurrentNode
        const newConfirmedTx = transactions.filter(tx =>
            tx.to === state.publicKey &&
            tx.receivedByCurrentNode === true &&
            new Date(tx.timestamp).getTime() > state.lastTransactionTime
        );

        if (newConfirmedTx.length > 0) {
            // Update the last transaction time
            state.lastTransactionTime = Date.now();

            // Show notification for new confirmed transaction
            newConfirmedTx.forEach(tx => {
                const fromShort = tx.from === '0' ? 'Mining Reward' : `${tx.from.substring(0, 8)}...`;
                showToast(`Received ${tx.amount} coins from ${fromShort}`, 'success');
                showTransactionBanner(`Transaction confirmed: You received ${tx.amount} coins from ${fromShort}`);

                // Force an instant balance update
                refreshBalance(false);
            });

            // Refresh transactions list immediately
            refreshMyTransactions();
        }

        // Check pending transactions that involve this user
        const response = await fetch('/pending');
        const pendingTransactions = await response.json();

        // Check if any new transactions are for this user
        const currentTime = Date.now();
        const newIncomingTx = pendingTransactions.filter(tx =>
            tx.to === state.publicKey &&
            new Date(tx.timestamp).getTime() > state.lastTransactionTime
        );

        if (newIncomingTx.length > 0) {
            // Update the last transaction time
            state.lastTransactionTime = currentTime;

            // Show notification for new pending transaction
            if (newIncomingTx.length === 1) {
                const tx = newIncomingTx[0];
                const fromShort = tx.from === '0' ? 'Mining Reward' : `${tx.from.substring(0, 8)}...`;
                showToast(`New pending transaction: ${tx.amount} coins from ${fromShort}`, 'info');
                showTransactionBanner(`Pending transaction: ${tx.amount} coins from ${fromShort}`);
            } else {
                showToast(`${newIncomingTx.length} new pending transactions received`, 'info');
                showTransactionBanner(`${newIncomingTx.length} new pending transactions received`);
            }

            // Refresh pending transactions list immediately
            fetchPendingTransactions();
        }
    } catch (error) {
        console.error('Error checking for transactions:', error);
    }
}

// Show transaction notification
function showTransactionNotification(amount) {
    // First show toast
    showToast(`You received ${amount} coins!`, 'success');

    // Show transaction banner
    showTransactionBanner(`Transaction confirmed! You received ${amount} coins`);

    // Then show popup notification if browser supports it
    if ('Notification' in window) {
        // Check if permission is already granted
        if (Notification.permission === 'granted') {
            new Notification('Transaction Received', {
                body: `You received ${amount} coins in your wallet!`,
                icon: 'https://cdn-icons-png.flaticon.com/512/6675/6675847.png'
            });
        }
        // Ask for permission if not granted or denied
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Transaction Received', {
                        body: `You received ${amount} coins in your wallet!`,
                        icon: 'https://cdn-icons-png.flaticon.com/512/6675/6675847.png'
                    });
                }
            });
        }
    }

    // Show an on-page notification too
    const notificationHtml = `
        <div id="tx-notification" class="fixed top-20 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 animate-bounce">
            <div class="flex items-center">
                <i class="fas fa-coins mr-2 text-xl"></i>
                <div>
                    <p class="font-bold">Transaction Received!</p>
                    <p>You received ${amount} coins</p>
                </div>
                <button onclick="this.parentNode.parentNode.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;

    // Add to DOM
    const notification = document.createElement('div');
    notification.innerHTML = notificationHtml;
    document.body.appendChild(notification.firstElementChild);

    // Update peer count (just for visual feedback)
    updatePeerCount(state.peerCount + 1);
    setTimeout(() => {
        updatePeerCount(Math.max(0, state.peerCount - 1));
    }, 3000);

    // Remove after 5 seconds
    setTimeout(() => {
        const notificationElement = document.getElementById('tx-notification');
        if (notificationElement) {
            notificationElement.remove();
        }
    }, 5000);

    // Play a sound notification
    playNotificationSound();
}

// Play sound for notifications
function playNotificationSound() {
    try {
        // Create audio element for notification sound
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-coin-win-notification-1992.mp3');
        audio.volume = 0.5;
        audio.play();
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', toggleDarkMode);
    }

    // Login button
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // Copy address button
    const copyAddressBtn = document.getElementById('copy-address');
    if (copyAddressBtn) {
        copyAddressBtn.addEventListener('click', copyAddressToClipboard);
    }

    // Transaction form
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransaction);
    }

    // Mining button
    const mineBtn = document.getElementById('mine-btn');
    if (mineBtn) {
        mineBtn.addEventListener('click', handleMining);
    }

    // Connect form
    const connectForm = document.getElementById('connect-form');
    if (connectForm) {
        connectForm.addEventListener('submit', handleConnect);
    }

    // Tab buttons
    const tabButtons = document.querySelectorAll('.explorer-tab');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.id.replace('tab-', '');
            handleTabChange(tabId);
        });
    });

    // Add logout functionality
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.className = 'absolute top-4 right-28 text-sm px-3 py-1 bg-red-500 text-white rounded z-10';
    logoutLink.innerHTML = '<i class="fas fa-sign-out-alt mr-1"></i> Logout';
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
    document.body.appendChild(logoutLink);
}

// Logout functionality
function handleLogout() {
    // Clear session data
    localStorage.removeItem('blockchainSession');

    // Clear state
    state.publicKey = null;
    state.privateKey = null;
    state.userName = null;
    state.userId = null;

    // Clear polling interval
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
    }

    // Reset UI
    hideElement('main-content');
    showElement('login-section');

    // Show message
    showToast('Logged out successfully', 'info');
}

// Toggle dark mode
function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    document.body.classList.toggle('dark-mode', state.darkMode);
    localStorage.setItem('darkMode', state.darkMode);
}

// Copy address to clipboard
function copyAddressToClipboard() {
    const address = state.publicKey;
    navigator.clipboard.writeText(address).then(() => {
        showToast('Address copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy address:', err);
        showToast('Failed to copy address', 'error');
    });
}

// Create blockchain animation
function createBlockchainAnimation(blockCount = 5) {
    const container = document.getElementById('blockchain-animation');
    if (!container) return;

    container.innerHTML = '';

    for (let i = 0; i < blockCount; i++) {
        const block = document.createElement('div');
        block.className = 'block';
        block.style.setProperty('--i', i);
        block.textContent = i + 1;
        container.appendChild(block);
    }
}

// Update blockchain animation when new blocks are mined
function updateBlockchainAnimation(newLength) {
    if (newLength <= state.blockchainLength) return;

    state.blockchainLength = newLength;
    createBlockchainAnimation(newLength > 5 ? 5 : newLength);

    // Add a temporary animation class
    const container = document.getElementById('blockchain-animation');
    if (container) {
        container.classList.add('pulse');
        setTimeout(() => {
            container.classList.remove('pulse');
        }, 1000);
    }
}

// Display functions to update UI
function showElement(id) {
    document.getElementById(id).classList.remove('hidden');
}

function hideElement(id) {
    document.getElementById(id).classList.add('hidden');
}

function updateUserInfo() {
    // Update user address display (truncated for UI)
    const addressEl = document.getElementById('user-address');
    const fullAddress = state.publicKey;

    // Truncate the key for display (first and last 15 chars)
    const shortAddress = `${fullAddress.substring(0, 15)}...${fullAddress.substring(fullAddress.length - 15)}`;
    addressEl.textContent = shortAddress;
    addressEl.title = fullAddress; // Full address on hover

    // Update document title with user name if available
    if (state.userName) {
        document.title = `${state.userName}'s BlockChain Wallet`;
    }

    // Update user name and ID if available
    if (state.userName && state.userId) {
        // Update in header
        const headerUserInfo = document.getElementById('header-user-info');
        const headerUserName = document.getElementById('header-user-name');
        const headerUserId = document.getElementById('header-user-id');

        if (headerUserInfo && headerUserName && headerUserId) {
            headerUserName.textContent = state.userName;
            headerUserId.textContent = `ID: ${state.userId}`;
            headerUserInfo.classList.remove('hidden');
        }
    }

    // Update balance
    refreshBalance();
}

// Refresh user balance with improved animation
async function refreshBalance(silent = false) {
    try {
        const { balance } = await fetchApi(`/balance/${encodeURIComponent(state.publicKey)}`);
        const balanceElement = document.getElementById('user-balance');
        const currentDisplayBalance = parseInt(balanceElement.textContent) || 0;
        const newBalance = parseInt(balance);

        // Only animate if balance has increased
        if (newBalance > currentDisplayBalance) {
            // Set the final balance
            balanceElement.textContent = `${newBalance}`;

            // Add animation classes
            balanceElement.classList.add('balance-change');

            // If balance increased significantly, add extra emphasis
            if (newBalance > currentDisplayBalance + 10) {
                balanceElement.classList.add('balance-significant');
            }

            // Remove animation classes after animation completes
            setTimeout(() => {
                balanceElement.classList.remove('balance-change');
                balanceElement.classList.remove('balance-significant');
            }, 2500);

            if (!silent) {
                const difference = newBalance - currentDisplayBalance;
                showTransactionNotification(difference);
            }
        } else {
            // Just update the value without animation if no increase
            balanceElement.textContent = `${newBalance}`;
        }

        state.lastCheckedBalance = newBalance;
        return balance;
    } catch (error) {
        console.error('Failed to fetch balance:', error);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    // Set message
    toastMessage.textContent = message;

    // Set icon based on type
    toast.className = 'toast';
    if (type === 'success') {
        toast.classList.add('toast-success');
        toastIcon.className = 'fas fa-check-circle';
    } else if (type === 'error') {
        toast.classList.add('toast-error');
        toastIcon.className = 'fas fa-exclamation-circle';
    } else {
        toast.classList.add('toast-info');
        toastIcon.className = 'fas fa-info-circle';
    }

    // Show toast
    toast.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show notification
function showNotification(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    element.innerHTML = '';

    const notificationDiv = document.createElement('div');
    notificationDiv.className = `p-4 rounded-r border-l-4 ${isError ? 'bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-600' : 'bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-600'}`;

    const iconClass = isError ? 'fas fa-exclamation-circle text-red-600 dark:text-red-400' : 'fas fa-check-circle text-green-600 dark:text-green-400';

    notificationDiv.innerHTML = `
        <div class="flex">
            <div class="flex-shrink-0">
                <i class="${iconClass}"></i>
            </div>
            <div class="ml-3">
                <p class="text-sm ${isError ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}">${message}</p>
            </div>
        </div>
    `;

    element.appendChild(notificationDiv);
    showElement(elementId);

    // Hide after 5 seconds
    setTimeout(() => {
        hideElement(elementId);
    }, 5000);
}

// Refresh pending transactions
async function fetchPendingTransactions() {
    if (!state.publicKey) return;

    try {
        const response = await fetch('/pending');
        const transactions = await response.json();

        const pendingTransactionsElement = document.getElementById('pending-transactions');

        if (!pendingTransactionsElement) return;

        if (transactions.length === 0) {
            pendingTransactionsElement.innerHTML = '<p class="text-gray-500">No pending transactions</p>';
            return;
        }

        pendingTransactionsElement.innerHTML = '';
        transactions.forEach(tx => {
            const txElement = document.createElement('div');
            txElement.className = 'transaction-item p-4 bg-gray-50 dark:bg-gray-800';

            // Add appropriate class based on transaction relationship to current user
            if (tx.from === state.publicKey) {
                txElement.classList.add('transaction-sent');
            } else if (tx.to === state.publicKey) {
                txElement.classList.add('transaction-received');
            }

            txElement.classList.add('transaction-pending');

            const fromAddress = tx.from === '0' ? 'Mining Reward' : (tx.from.substring(0, 8) + '...' + tx.from.substring(tx.from.length - 8));
            const toAddress = tx.to.substring(0, 8) + '...' + tx.to.substring(tx.to.length - 8);

            txElement.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-medium">${fromAddress} → ${toAddress}</p>
                        <p class="text-sm text-text-light">Amount: ${tx.amount} coins</p>
                    </div>
                    <span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</span>
                </div>
                <div class="text-sm text-text-light">
                    ${new Date(tx.timestamp).toLocaleString()}
                </div>
            `;
            pendingTransactionsElement.appendChild(txElement);
        });
    } catch (error) {
        console.error('Error fetching pending transactions:', error);
    }
}

// Refresh my transactions
async function refreshMyTransactions() {
    if (!state.publicKey) return;

    try {
        const response = await fetch(`/transactions/${encodeURIComponent(state.publicKey)}`);
        const transactions = await response.json();

        const container = document.getElementById('my-transactions');

        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No transactions found</p>';
            return;
        }

        container.innerHTML = '';
        transactions.forEach(tx => {
            const isReceived = tx.to === state.publicKey;
            const txElement = document.createElement('div');

            txElement.className = 'transaction-item p-4 bg-gray-50 dark:bg-gray-800';

            if (tx.pending) {
                txElement.classList.add('transaction-pending');
            } else if (isReceived) {
                txElement.classList.add('transaction-received');

                // Add highlight if this is a newly received transaction
                if (tx.receivedByCurrentNode) {
                    txElement.classList.add('transaction-new');

                    // Remove the flag after displaying it
                    setTimeout(() => {
                        txElement.classList.remove('transaction-new');
                    }, 5000);
                }
            } else {
                txElement.classList.add('transaction-sent');
            }

            const otherParty = isReceived ? tx.from : tx.to;
            const otherPartyShort = otherParty === '0'
                ? 'Mining Reward'
                : `${otherParty.substring(0, 8)}...${otherParty.substring(otherParty.length - 8)}`;

            const date = new Date(tx.timestamp).toLocaleString();
            let statusBadge = tx.pending
                ? '<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</span>'
                : '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Confirmed</span>';

            // Add a special badge for newly received transactions
            if (tx.receivedByCurrentNode && isReceived) {
                statusBadge = '<span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse">New Payment</span>';
            }

            txElement.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="font-medium">${isReceived ? 'Received from' : 'Sent to'}: ${otherPartyShort}</p>
                        <p class="text-sm text-text-light">${date}</p>
                    </div>
                    <div class="flex flex-col items-end">
                        <p class="text-lg font-bold ${isReceived ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                            ${isReceived ? '+' : '-'}${tx.amount} coins
                        </p>
                        ${statusBadge}
                    </div>
                </div>
            `;

            container.appendChild(txElement);
        });
    } catch (error) {
        console.error('Error fetching my transactions:', error);
    }
}

// Refresh all balances
async function refreshAllBalances() {
    try {
        const response = await fetch('/balances');
        const balances = await response.json();

        const container = document.getElementById('all-balances');

        if (!container) return;

        if (Object.keys(balances).length === 0) {
            container.innerHTML = '<tr><td colspan="2" class="text-gray-500 py-3 px-4">No balances available</td></tr>';
            return;
        }

        container.innerHTML = '';

        // Convert to array and sort by balance (highest first)
        const balanceArray = Object.entries(balances).map(([address, balance]) => ({ address, balance }));
        balanceArray.sort((a, b) => b.balance - a.balance);

        balanceArray.forEach(({ address, balance }) => {
            const row = document.createElement('tr');

            // Highlight current user
            if (address === state.publicKey) {
                row.className = 'bg-blue-50 dark:bg-blue-900';
            }

            // Format address for display
            const displayAddress = address === state.publicKey
                ? `${address.substring(0, 8)}...${address.substring(address.length - 8)} (You)`
                : `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;

            row.innerHTML = `
                <td class="py-3 px-4 text-left">${displayAddress}</td>
                <td class="py-3 px-4 text-right font-medium">${balance} coins</td>
            `;

            container.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching all balances:', error);
    }
}

// Update peer count
function updatePeerCount(count) {
    state.peerCount = count;
    const peerCountElement = document.getElementById('peer-count');
    if (peerCountElement) {
        peerCountElement.textContent = `${count} peer${count !== 1 ? 's' : ''} connected`;
    }
}

// Mining handler
async function handleMining() {
    try {
        // Show mining animation
        const miningAnimationEl = document.getElementById('mining-animation');
        showElement('mining-animation');

        // Disable mine button during mining
        const mineBtn = document.getElementById('mine-btn');
        mineBtn.disabled = true;
        mineBtn.classList.add('opacity-50');

        // Mine block with all pending transactions
        const result = await fetchApi('/mine', 'POST', {
            minerAddress: state.publicKey
        });

        // Update blockchain animation
        updateBlockchainAnimation(result.block.index + 1);

        hideElement('mining-animation');
        mineBtn.disabled = false;
        mineBtn.classList.remove('opacity-50');

        // Show success message with transaction details
        let successMessage = 'Block mined successfully! You earned 50 coins as a reward.';
        
        // If there were transactions in the block, show details
        if (result.transactions && result.transactions.length > 0) {
            successMessage += '\nTransactions confirmed:';
            result.transactions.forEach(tx => {
                if (tx.to === state.publicKey) {
                    successMessage += `\n- Received ${tx.amount} coins`;
                } else if (tx.from === state.publicKey) {
                    successMessage += `\n- Sent ${tx.amount} coins`;
                }
            });
        }

        showToast('Block mined successfully!', 'success');
        showNotification('mining-result', successMessage);

        // Force immediate balance update
        await refreshBalance(false);

        // Refresh all data immediately
        fetchPendingTransactions();
        refreshMyTransactions();
        refreshAllBalances();

    } catch (error) {
        hideElement('mining-animation');
        const mineBtn = document.getElementById('mine-btn');
        mineBtn.disabled = false;
        mineBtn.classList.remove('opacity-50');

        console.error('Mining error:', error);
        showToast('Mining failed: ' + (error.message || 'Unknown error'), 'error');
        showNotification('mining-result', 'Mining failed: ' + (error.message || 'Unknown error'), true);
    }
}

// Transaction handler
async function handleTransaction(event) {
    event.preventDefault();

    const recipient = document.getElementById('recipient').value.trim();
    const amount = parseFloat(document.getElementById('amount').value.trim());

    if (!recipient || isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid recipient and amount', 'error');
        return;
    }

    try {
        // Check P2P connection first
        const p2pStatus = await fetchApi('/check-p2p-connection');
        if (!p2pStatus.connected) {
            showToast('No active P2P connections. Please connect to a peer first.', 'error');
            return;
        }

        // Add transaction to pending list
        const result = await fetchApi('/transaction', 'POST', {
            from: state.publicKey,
            to: recipient,
            amount,
            privateKey: state.privateKey
        });

        showToast('Transaction added to pending list. Mine a block to confirm it!', 'info');
        showNotification('transaction-result', 'Transaction added to pending list. Mine a block to confirm it!');

        // Reset form
        document.getElementById('recipient').value = '';
        document.getElementById('amount').value = '';

        // Refresh pending transactions
        fetchPendingTransactions();

    } catch (error) {
        console.error('Transaction error:', error);
        showToast(error.message || 'Failed to send transaction', 'error');
        showNotification('transaction-result', error.message || 'Failed to send transaction', true);
    }
}

// Login handler
async function handleLogin() {
    const fileInput = document.getElementById('config-file');

    if (!fileInput.files.length) {
        showToast('Please select a configuration file', 'error');
        return;
    }

    try {
        const file = fileInput.files[0];
        const fileContent = await file.text();
        const config = JSON.parse(fileContent);

        if (!config.publicKey || !config.privateKey) {
            showToast('Invalid configuration file', 'error');
            return;
        }

        // Store user info in state
        state.publicKey = config.publicKey;
        state.privateKey = config.privateKey;
        state.userName = config.name || null;
        state.userId = config.id || null;

        // Save session to localStorage
        saveSession();

        // Login to server
        await fetchApi('/login', 'POST', {
            publicKey: state.publicKey,
            privateKey: state.privateKey,
            name: state.userName,
            id: state.userId
        });

        // Hide login, show main content
        hideElement('login-section');
        showElement('main-content');

        // Update UI with user info
        updateUserInfo();

        // Set up data refresh
        fetchPendingTransactions();
        refreshMyTransactions();
        refreshAllBalances();

        // Start real-time updates
        startRealTimeUpdates();

        showToast(`Welcome back, ${state.userName || 'User'}!`, 'success');

    } catch (error) {
        console.error('Login error:', error);
        showToast('Failed to login: ' + (error.message || 'Unknown error'), 'error');
    }
}

// Connect to peer handler
async function handleConnect(event) {
    event.preventDefault();

    const host = document.getElementById('peer-host').value.trim();
    const port = document.getElementById('peer-port').value.trim();

    if (!host || !port) {
        showToast('Please enter host and port', 'error');
        return;
    }

    try {
        // Show connecting message
        showToast('Connecting to peer...', 'info');
        
        const result = await fetchApi('/connect', 'POST', { host, port });

        // Only show success if we got a successful response
        if (result.message) {
            showToast('Connected to peer successfully', 'success');
            showNotification('connect-result', result.message);

            // Update peer count
            updatePeerCount(state.peerCount + 1);

            // Reset port field
            document.getElementById('peer-port').value = '';
        } else {
            throw new Error('Connection failed: No response message');
        }
    } catch (error) {
        console.error('Connection error:', error);
        showToast('Connection failed: ' + (error.message || 'Unknown error'), 'error');
        showNotification('connect-result', 'Connection failed: ' + (error.message || 'Unknown error'), true);
    }
}

// Tab change handler
function handleTabChange(tabId) {
    // Update active tab button
    document.querySelectorAll('.explorer-tab').forEach(tab => {
        const isActive = tab.id === `tab-${tabId}`;
        tab.classList.toggle('border-primary', isActive);
        tab.classList.toggle('text-primary', isActive);
        tab.classList.toggle('border-transparent', !isActive);
        tab.classList.toggle('text-gray-500', !isActive);
    });

    // Show active content, hide others
    document.querySelectorAll('.explorer-content').forEach(content => {
        const isActive = content.id === `content-${tabId}`;
        content.classList.toggle('hidden', !isActive);
    });

    // Refresh data for the active tab
    if (tabId === 'pending') {
        fetchPendingTransactions();
    } else if (tabId === 'transactions') {
        refreshMyTransactions();
    } else if (tabId === 'all-balances') {
        refreshAllBalances();
    }
}

// Start periodic data refresh
function startDataRefresh() {
    // Refresh every 10 seconds
    setInterval(() => {
        refreshBalance();
        fetchPendingTransactions();
        refreshMyTransactions();
        refreshAllBalances();
    }, 10000);
}

function sendMoney() {
    const recipient = document.getElementById('recipient').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const privateKey = document.getElementById('privateKey').value;

    if (!recipient || !amount || amount <= 0 || !privateKey) {
        showNotification('Please fill in all fields correctly', 'error');
        return;
    }

    // Show sending notification
    showNotification('Sending money...', 'info');

    fetch('/transaction', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: userId,
            to: recipient,
            amount: amount,
            privateKey: privateKey
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showNotification(data.error, 'error');
            } else {
                showNotification('Money sent successfully!', 'success');
                // Update balances immediately
                updateBalances();
                // Update transaction history immediately
                updateTransactionHistory();
                // Clear form
                document.getElementById('recipient').value = '';
                document.getElementById('amount').value = '';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error sending money', 'error');
        });
}

// Update the WebSocket message handler
socket.onmessage = function (event) {
    const message = JSON.parse(event.data);

    switch (message.type) {
        case 'TRANSACTION_CONFIRMED':
            // Update UI immediately when transaction is confirmed
            if (message.data.recipient === state.publicKey) {
                // This is a received transaction
                const newBalance = message.data.recipientBalance;
                showToast(`Received ${message.data.amount} coins! New balance: ${newBalance} coins`, 'success');

                // Update balance display immediately
                const balanceEl = document.getElementById('user-balance');
                if (balanceEl) {
                    balanceEl.textContent = newBalance;
                    // Add animation class
                    balanceEl.classList.add('balance-update');
                    setTimeout(() => balanceEl.classList.remove('balance-update'), 1000);
                }
            }
            updateTransactionHistory();
            break;

        case 'PAYMENT_RECEIVED':
            // Show immediate notification for received payment with new balance
            const newBalance = message.data.newBalance;
            showToast(`Received ${message.data.amount} coins from ${message.data.from.substring(0, 10)}... New balance: ${newBalance} coins`, 'success');

            // Update balance display immediately with animation
            const balanceEl = document.getElementById('user-balance');
            if (balanceEl) {
                balanceEl.textContent = newBalance;
                // Add animation class
                balanceEl.classList.add('balance-update');
                setTimeout(() => balanceEl.classList.remove('balance-update'), 1000);
            }

            updateTransactionHistory();
            break;

        case 'BALANCE_UPDATE':
            // Update balance display with animation
            if (message.data.address === state.publicKey) {
                const balanceEl = document.getElementById('user-balance');
                if (balanceEl) {
                    balanceEl.textContent = message.data.newBalance;
                    // Add animation class
                    balanceEl.classList.add('balance-update');
                    setTimeout(() => balanceEl.classList.remove('balance-update'), 1000);
                }
            }
            break;

        case 'TRANSACTION':
            // Update transaction history
            updateTransactionHistory();
            break;
    }
};

// Add CSS for balance update animation
const style = document.createElement('style');
style.textContent = `
    .balance-update {
        animation: balanceUpdate 1s ease-in-out;
    }
    
    @keyframes balanceUpdate {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); color: #10B981; }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);

// Add P2P connection status check
async function checkP2PConnection() {
    try {
        const status = await fetchApi('/check-p2p-connection');
        const statusEl = document.getElementById('p2p-status');
        if (statusEl) {
            statusEl.textContent = status.message;
            statusEl.className = status.connected ? 'text-green-500' : 'text-red-500';
        }
        return status.connected;
    } catch (error) {
        console.error('Error checking P2P connection:', error);
        return false;
    }
}

// Check P2P connection periodically
setInterval(checkP2PConnection, 5000);