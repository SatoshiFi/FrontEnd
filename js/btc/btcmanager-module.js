/**
 * Bitcoin Manager Module - Specialized wallet and node management
 * Uses BitcoinCore for common operations, adds manager-specific UI
 * Depends on: btc-core.js
 */

// =============================================================================
// MANAGER-SPECIFIC STATE
// =============================================================================

let currentSendWallet = null;

// =============================================================================
// WALLET MANAGEMENT OPERATIONS
// =============================================================================

/**
 * Check wallet status on Bitcoin network
 */
function checkWalletStatus() {
    BitcoinCore.Notifications.info('Checking wallet status on Bitcoin network...');
    
    BitcoinCore.WalletManager.checkWalletStatus()
        .then(function(wallets) {
            console.log('Available wallets on coordinator:', wallets);
            BitcoinCore.Notifications.success('Found ' + wallets.length + ' wallets: ' + wallets.join(', '));
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Failed to check wallets: ' + error.message);
            console.error('PRODUCTION ERROR - Wallet status check failed:', error);
        });
}

/**
 * Create missing wallets on Bitcoin network
 */
function createMissingWallets() {
    BitcoinCore.Notifications.info('Creating missing wallets on Bitcoin network...');
    
    BitcoinCore.WalletManager.createMissingWallets()
        .then(function(result) {
            BitcoinCore.Notifications.success(
                'Wallet creation complete! Created: ' + result.createdCount + 
                ', Skipped: ' + result.skippedCount
            );
            setTimeout(checkWalletStatus, 1000);
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Failed to create some wallets: ' + error.message);
        });
}

/**
 * Load all wallets into Bitcoin nodes
 */
function loadAllWallets() {
    BitcoinCore.Notifications.info('Loading all wallets into Bitcoin nodes...');
    
    BitcoinCore.WalletManager.loadAllWallets()
        .then(function(result) {
            BitcoinCore.Notifications.success('Loaded ' + result.loadedCount + ' wallets successfully!');
            setTimeout(refreshAllWallets, 1000);
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Failed to load wallets: ' + error.message);
        });
}

/**
 * Initialize all wallets (create + load)
 */
function initializeAllWallets() {
    BitcoinCore.Notifications.info('Initializing all wallets on Bitcoin network...');
    
    createMissingWallets();
    
    setTimeout(function() {
        loadAllWallets();
    }, 3000);
}

/**
 * Distribute initial Bitcoin funds to system wallets
 */
function distributeFunds() {
    BitcoinCore.Notifications.info('Distributing Bitcoin funds to system wallets...');
    
    // Generate blocks to mining_rewards wallet first
    BitcoinCore.API.getNewAddress('mining', 'mining_rewards')
        .then(function(miningAddress) {
            return BitcoinCore.API.generateToAddress(10, miningAddress);
        })
        .then(function(blockHashes) {
            BitcoinCore.Notifications.success('Generated 10 blocks (500 BTC) for mining rewards');
            
            setTimeout(function() {
                // Distribute funds to pools and generator
                Promise.all([
                    sendFundsToWallet('pool_a_rewards', 50),
                    sendFundsToWallet('pool_b_rewards', 50),
                    sendFundsToWallet('tx_generator', 100)
                ]).then(function() {
                    BitcoinCore.Notifications.success('Initial distribution to pools complete!');
                    
                    // Distribute to workers
                    let workerPromise = Promise.resolve();
                    for (let i = 0; i <= 9; i++) {
                        workerPromise = workerPromise.then(function() {
                            return sendFundsToWallet('worker_' + i + '_rewards', 10);
                        });
                    }
                    
                    return workerPromise;
                }).then(function() {
                    BitcoinCore.Notifications.success('All Bitcoin funds distributed successfully!');
                    setTimeout(refreshAllWallets, 2000);
                });
            }, 3000);
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Failed to distribute funds: ' + error.message);
            console.error('PRODUCTION ERROR - Funds distribution failed:', error);
        });
}

/**
 * Helper function to send Bitcoin between wallets
 */
async function sendFundsToWallet(walletName, amount) {
    const address = await BitcoinCore.API.getNewAddress('receive', walletName);
    const txid = await BitcoinCore.API.sendToAddress(address, amount, 'mining_rewards');
    console.log('Sent', amount, 'BTC to', walletName, ', TX:', txid);
    return txid;
}

// =============================================================================
// DASHBOARD STATISTICS
// =============================================================================

/**
 * Initialize manager dashboard
 */
function initDashboard() {
    // Verify dependencies
    if (typeof BitcoinCore === 'undefined') {
        console.error('CRITICAL: BitcoinCore not loaded - manager cannot initialize');
        return;
    }
    
    refreshNetworkStats()
        .then(function() { return refreshAllWallets(); })
        .then(function() { return refreshNodes(); })
        .then(function() { return refreshTransactions(); });
}

/**
 * Refresh network statistics
 */
function refreshNetworkStats() {
    return BitcoinCore.NetworkMonitor.getNetworkStats()
        .then(function(stats) {
            document.getElementById('blockHeight').textContent = stats.blockHeight;
            document.getElementById('mempoolSize').textContent = stats.mempoolSize;
            document.getElementById('lastUpdate').textContent = stats.lastUpdate;
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Network stats refresh failed:', error);
            document.getElementById('blockHeight').textContent = 'Error';
            document.getElementById('mempoolSize').textContent = 'Error';
        });
}

// =============================================================================
// WALLET DISPLAY AND MANAGEMENT
// =============================================================================

/**
 * Refresh all wallet information
 */
function refreshAllWallets() {
    const walletGrid = document.getElementById('walletGrid');
    walletGrid.innerHTML = '<div class="loading">Loading wallets...</div>';

    BitcoinCore.WalletManager.getAllWalletInfo()
        .then(function(result) {
            document.getElementById('totalBalance').textContent = 
                BitcoinCore.Utils.formatBTC(result.totalBalance);
            
            const walletElements = result.wallets.map(function(item) {
                return createWalletCard(item.wallet, item.info);
            });
            
            walletGrid.innerHTML = walletElements.join('');
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Wallet refresh failed:', error);
            walletGrid.innerHTML = '<div class="loading">Failed to load wallets</div>';
        });
}

/**
 * Create wallet card HTML
 */
function createWalletCard(wallet, info) {
    const typeClass = 'type-' + wallet.type;
    const statusColor = info.error ? '#f44336' : '#4CAF50';
    
    return `
        <div class="wallet-card">
            <div class="wallet-header">
                <div class="wallet-name">${wallet.name}</div>
                <div class="wallet-type ${typeClass}">${wallet.type}</div>
            </div>
            <div class="wallet-balance" style="color: ${statusColor}">
                ${info.error ? 'ERROR' : BitcoinCore.Utils.formatBTC(info.balance)}
            </div>
            <div class="wallet-address">${info.address}</div>
            <div class="wallet-actions">
                <button class="wallet-btn" onclick="refreshSingleWallet('${wallet.id}')">🔄</button>
                <button class="wallet-btn" onclick="copyWalletAddress('${info.address}')">📋</button>
                <button class="wallet-btn send" onclick="showSendModal('${wallet.id}', '${wallet.name}')">💸 Send</button>
                <button class="wallet-btn" onclick="generateAddressForWallet('${wallet.id}')">🆕 Address</button>
            </div>
        </div>
    `;
}

/**
 * Refresh single wallet
 */
function refreshSingleWallet(walletId) {
    const wallet = BitcoinCore.Config.WALLETS.find(function(w) { return w.id === walletId; });
    if (!wallet) return;
    
    BitcoinCore.Notifications.info('Refreshing ' + wallet.name + '...');
    refreshAllWallets();
}

/**
 * Copy wallet address to clipboard
 */
function copyWalletAddress(address) {
    BitcoinCore.Utils.copyToClipboard(address, 'Address copied to clipboard');
}

/**
 * Generate new address for wallet
 */
function generateAddressForWallet(walletId) {
    BitcoinCore.WalletManager.generateNewAddress(walletId, 'new_address_' + Date.now())
        .then(function(newAddress) {
            BitcoinCore.Notifications.success(
                'New address generated: ' + BitcoinCore.Utils.formatHash(newAddress, 20) + '...'
            );
            copyWalletAddress(newAddress);
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Failed to generate address: ' + error.message);
            console.error('PRODUCTION ERROR - Address generation failed:', error);
        });
}

// =============================================================================
// TRANSACTION MODAL
// =============================================================================

/**
 * Show send modal for wallet transfers
 */
function showSendModal(walletId, walletName) {
    currentSendWallet = walletId;
    document.getElementById('fromWallet').value = walletName;
    document.getElementById('sendModal').style.display = 'block';
}

/**
 * Close send modal
 */
function closeSendModal() {
    document.getElementById('sendModal').style.display = 'none';
    document.getElementById('toAddress').value = '';
    document.getElementById('sendAmount').value = '';
    currentSendWallet = null;
}

/**
 * Execute Bitcoin transaction between wallets
 */
function executeSend() {
    if (!currentSendWallet) return;
    
    const toAddress = document.getElementById('toAddress').value.trim();
    const amount = parseFloat(document.getElementById('sendAmount').value);
    
    if (!toAddress || !amount || amount <= 0) {
        BitcoinCore.Notifications.error('Please enter valid address and amount');
        return;
    }
    
    if (!BitcoinCore.Utils.isValidBitcoinAddress(toAddress)) {
        BitcoinCore.Notifications.error('Invalid Bitcoin address');
        return;
    }
    
    BitcoinCore.WalletManager.sendFunds(currentSendWallet, toAddress, amount)
        .then(function(txid) {
            BitcoinCore.Notifications.success(
                'Bitcoin transaction sent! TX: ' + BitcoinCore.Utils.formatHash(txid) + '...'
            );
            closeSendModal();
            setTimeout(function() {
                refreshAllWallets();
                refreshTransactions();
            }, 1000);
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Transaction failed: ' + error.message);
            console.error('PRODUCTION ERROR - Transaction failed:', error);
        });
}

// =============================================================================
// BLOCK AND TRANSACTION GENERATION
// =============================================================================

/**
 * Generate new Bitcoin block
 */
function generateNewBlock() {
    BitcoinCore.WalletManager.generateNewBlock()
        .then(function(blockHash) {
            BitcoinCore.Notifications.success(
                'New block generated: ' + BitcoinCore.Utils.formatHash(blockHash) + '...'
            );
            setTimeout(function() {
                refreshNetworkStats();
                refreshAllWallets();
                refreshTransactions();
            }, 1000);
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Block generation failed: ' + error.message);
            console.error('PRODUCTION ERROR - Block generation failed:', error);
        });
}

/**
 * Generate test transaction
 */
function generateTransaction() {
    BitcoinCore.WalletManager.generateTestTransaction()
        .then(function(txid) {
            BitcoinCore.Notifications.success(
                'Test transaction generated: ' + BitcoinCore.Utils.formatHash(txid) + '...'
            );
            setTimeout(refreshTransactions, 1000);
        })
        .catch(function(error) {
            BitcoinCore.Notifications.error('Transaction generation failed: ' + error.message);
            console.error('PRODUCTION ERROR - Transaction generation failed:', error);
        });
}

// =============================================================================
// NODE MONITORING
// =============================================================================

/**
 * Refresh node status
 */
function refreshNodes() {
    const nodeList = document.getElementById('nodeList');
    nodeList.innerHTML = '<div class="loading">Checking nodes...</div>';

    BitcoinCore.NetworkMonitor.checkAllNodes()
        .then(function(result) {
            const nodeElements = result.nodes.map(function(node) {
                if (node.status === 'online') {
                    return `
                        <div class="node-item">
                            <div class="node-header">
                                <div class="node-name">
                                    <span class="status-indicator online"></span>
                                    ${node.name}
                                </div>
                                <div class="node-status status-online">ONLINE</div>
                            </div>
                            <div class="node-details">
                                <div>Height: ${node.height} | Connections: ${node.connections}</div>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="node-item offline">
                            <div class="node-header">
                                <div class="node-name">
                                    <span class="status-indicator offline"></span>
                                    ${node.name}
                                </div>
                                <div class="node-status status-offline">OFFLINE</div>
                            </div>
                            <div class="node-details">
                                <div>Error: ${node.error}</div>
                            </div>
                        </div>
                    `;
                }
            }).join('');
            
            document.getElementById('activeNodes').textContent = result.activeCount;
            nodeList.innerHTML = nodeElements;
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Node refresh failed:', error);
            nodeList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">Failed to load nodes</div>';
        });
}

// =============================================================================
// TRANSACTION MONITORING
// =============================================================================

/**
 * Refresh recent transactions
 */
function refreshTransactions() {
    const transactionList = document.getElementById('transactionList');
    transactionList.innerHTML = '<div class="loading">Loading transactions...</div>';

    BitcoinCore.Explorer.getMempoolTransactions(8)
        .then(function(transactions) {
            if (transactions.length === 0) {
                transactionList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">No pending transactions</div>';
                return;
            }

            const txElements = transactions.map(function(tx) {
                return `
                    <div class="transaction-item">
                        <div class="tx-header">
                            <div class="tx-hash">${BitcoinCore.Utils.formatHash(tx.txid, 12)}...</div>
                            <div class="tx-amount">${BitcoinCore.Utils.formatBTC(tx.amount)}</div>
                        </div>
                        <div class="tx-details">
                            In: ${tx.inputs} | Out: ${tx.outputs} | Pending
                        </div>
                    </div>
                `;
            }).join('');
            
            transactionList.innerHTML = txElements;
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Transaction refresh failed:', error);
            transactionList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">Failed to load transactions</div>';
        });
}

// =============================================================================
// AUTO-REFRESH FUNCTIONALITY
// =============================================================================

/**
 * Toggle auto-refresh
 */
function toggleAutoRefresh() {
    const isRefreshing = BitcoinCore.NetworkMonitor.toggleAutoRefresh(30000);
    const btn = document.querySelector('[onclick="toggleAutoRefresh()"]');
    
    if (isRefreshing) {
        btn.textContent = '⏸️ Stop auto-refresh';
        BitcoinCore.Notifications.success('Auto-refresh enabled (30s intervals)');
        
        // Add callback for automatic updates
        BitcoinCore.NetworkMonitor.onUpdate(function(stats) {
            document.getElementById('blockHeight').textContent = stats.blockHeight;
            document.getElementById('mempoolSize').textContent = stats.mempoolSize;
            document.getElementById('lastUpdate').textContent = stats.lastUpdate;
            
            // Refresh data periodically
            refreshAllWallets();
            refreshNodes();
            refreshTransactions();
        });
    } else {
        btn.textContent = '⏱️ Auto-refresh';
        BitcoinCore.Notifications.success('Auto-refresh disabled');
    }
}

// =============================================================================
// ADMIN FUNCTIONS (PLACEHOLDERS FOR FUTURE FEATURES)
// =============================================================================

function showBulkSendModal() {
    BitcoinCore.Notifications.info('Bulk transfer feature coming soon...');
}

function consolidateFunds() {
    BitcoinCore.Notifications.info('Consolidating funds...');
}

function exportWalletInfo() {
    BitcoinCore.Notifications.info('Exporting wallet information...');
}

function showNodeStatsModal() {
    BitcoinCore.Notifications.info('Node statistics feature coming soon...');
}

function clearMempool() {
    BitcoinCore.Notifications.warning('Mempool clearing not available in this version');
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Initialize when page loads
window.addEventListener('load', initDashboard);

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('sendModal');
    if (event.target === modal) {
        closeSendModal();
    }
});

console.log('⚙️ Bitcoin Manager module loaded - Ready for system administration');