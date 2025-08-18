/**
 * Bitcoin Core - Unified Production JavaScript
 * Common functionality for Wallet, Scanner, and Manager
 * NO DUPLICATION - Single source of truth
 * FIXED: Race conditions in node checking
 */

// =============================================================================
// PRODUCTION CONFIGURATION - SHARED ACROSS ALL MODULES
// =============================================================================

const BITCOIN_CONFIG = {
    API_ENDPOINT: 'https://api.unilayer.solutions/api/btc-proxy',
    NETWORK: {
        messagePrefix: '\u0018Bitcoin Signed Message:\n',
        bech32: 'bcrt',
        bip32: {
            public: 0x043587cf,
            private: 0x04358394,
        },
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        wif: 0xef,
    },
    NODES: [
        { id: 'coordinator', name: 'Coordinator', type: 'coordinator' },
        { id: 'worker-0', name: 'Worker-0', type: 'worker' },
        { id: 'worker-1', name: 'Worker-1', type: 'worker' },
        { id: 'worker-2', name: 'Worker-2', type: 'worker' },
        { id: 'worker-3', name: 'Worker-3', type: 'worker' },
        { id: 'worker-4', name: 'Worker-4', type: 'worker' },
        { id: 'worker-5', name: 'Worker-5', type: 'worker' },
        { id: 'worker-6', name: 'Worker-6', type: 'worker' },
        { id: 'worker-7', name: 'Worker-7', type: 'worker' },
        { id: 'worker-8', name: 'Worker-8', type: 'worker' },
        { id: 'worker-9', name: 'Worker-9', type: 'worker' }
    ],
    WALLETS: [
        { id: 'coordinator', name: 'Mining Rewards', type: 'coordinator', wallet: 'mining_rewards' },
        { id: 'pool-a', name: 'Pool A', type: 'pool', wallet: 'pool_a_rewards' },
        { id: 'pool-b', name: 'Pool B', type: 'pool', wallet: 'pool_b_rewards' },
        { id: 'tx-generator', name: 'TX Generator', type: 'generator', wallet: 'tx_generator' },
        { id: 'worker-0', name: 'Worker-0', type: 'worker', wallet: 'worker_0_rewards' },
        { id: 'worker-1', name: 'Worker-1', type: 'worker', wallet: 'worker_1_rewards' },
        { id: 'worker-2', name: 'Worker-2', type: 'worker', wallet: 'worker_2_rewards' },
        { id: 'worker-3', name: 'Worker-3', type: 'worker', wallet: 'worker_3_rewards' },
        { id: 'worker-4', name: 'Worker-4', type: 'worker', wallet: 'worker_4_rewards' },
        { id: 'worker-5', name: 'Worker-5', type: 'worker', wallet: 'worker_5_rewards' },
        { id: 'worker-6', name: 'Worker-6', type: 'worker', wallet: 'worker_6_rewards' },
        { id: 'worker-7', name: 'Worker-7', type: 'worker', wallet: 'worker_7_rewards' },
        { id: 'worker-8', name: 'Worker-8', type: 'worker', wallet: 'worker_8_rewards' },
        { id: 'worker-9', name: 'Worker-9', type: 'worker', wallet: 'worker_9_rewards' }
    ],
    PAGINATION: {
        itemsPerPage: 10
    }
};

// =============================================================================
// CORE API LAYER - PRODUCTION BITCOIN RPC - FIXED WITH BETTER TIMEOUT
// =============================================================================

class BitcoinAPI {
    /**
     * PRODUCTION Bitcoin RPC call with improved timeout handling
     */
    static async call(nodeId, method, params = [], walletName = null) {
        const requestData = {
            node: nodeId,
            method: method,
            params: params
        };
        
        if (walletName) {
            requestData.wallet = walletName;
        }
        
        try {
            // Add timeout control with AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(BITCOIN_CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ': ' + response.statusText);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'API call failed');
            }
            
            return data.result;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Timeout calling ' + nodeId + ' ' + method + ' (10s)');
            }
            
            console.error('PRODUCTION ERROR - API call failed for ' + nodeId + ' ' + method + ':', error);
            throw error;
        }
    }

    /**
     * Get real blockchain information
     */
    static async getBlockchainInfo() {
        return await this.call('coordinator', 'getblockchaininfo');
    }

    /**
     * Get real mempool information
     */
    static async getMempoolInfo() {
        return await this.call('coordinator', 'getmempoolinfo');
    }

    /**
     * Get network information for node
     */
    static async getNetworkInfo(nodeId = 'coordinator') {
        return await this.call(nodeId, 'getnetworkinfo');
    }

    /**
     * Scan UTXO set for address
     */
    static async scanUTXOs(address) {
        return await this.call('coordinator', 'scantxoutset', 
            ['start', ['addr(' + address + ')']]);
    }

    /**
     * Get raw transaction
     */
    static async getRawTransaction(txid, verbose = true) {
        return await this.call('coordinator', 'getrawtransaction', [txid, verbose]);
    }

    /**
     * Get block by hash or height
     */
    static async getBlock(blockHash, verbosity = 2) {
        return await this.call('coordinator', 'getblock', [blockHash, verbosity]);
    }

    /**
     * Get block hash by height
     */
    static async getBlockHash(height) {
        return await this.call('coordinator', 'getblockhash', [height]);
    }

    /**
     * Send raw transaction to network
     */
    static async sendRawTransaction(txHex) {
        return await this.call('coordinator', 'sendrawtransaction', [txHex]);
    }

    /**
     * Generate new address for wallet
     */
    static async getNewAddress(label = '', walletName) {
        return await this.call('coordinator', 'getnewaddress', [label], walletName);
    }

    /**
     * Get wallet balance
     */
    static async getBalance(walletName) {
        return await this.call('coordinator', 'getbalance', [], walletName);
    }

    /**
     * Send to address from wallet
     */
    static async sendToAddress(address, amount, walletName) {
        return await this.call('coordinator', 'sendtoaddress', [address, amount], walletName);
    }

    /**
     * Generate blocks to address
     */
    static async generateToAddress(numBlocks, address) {
        return await this.call('coordinator', 'generatetoaddress', [numBlocks, address]);
    }

    /**
     * Get raw mempool
     */
    static async getRawMempool() {
        return await this.call('coordinator', 'getrawmempool');
    }

    /**
     * List available wallets
     */
    static async listWallets() {
        return await this.call('coordinator', 'listwallets');
    }

    /**
     * Create new wallet
     */
    static async createWallet(walletName) {
        return await this.call('coordinator', 'createwallet', [walletName]);
    }

    /**
     * Load existing wallet
     */
    static async loadWallet(walletName) {
        return await this.call('coordinator', 'loadwallet', [walletName]);
    }
}

// =============================================================================
// NETWORK MONITORING - FIXED RACE CONDITIONS
// =============================================================================

class NetworkMonitor {
    constructor() {
        this.updateCallbacks = [];
        this.autoRefreshInterval = null;
        this.isAutoRefreshing = false;
    }

    /**
     * Add callback for network updates
     */
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    /**
     * Helper method: Add timeout to any promise
     */
    callWithTimeout(promise, timeoutMs, timeoutMessage) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(timeoutMessage || 'Operation timeout'));
                }, timeoutMs);
            })
        ]);
    }

    /**
     * Get comprehensive network statistics
     */
    async getNetworkStats() {
        try {
            const blockchainInfo = await BitcoinAPI.getBlockchainInfo();
            const mempoolInfo = await BitcoinAPI.getMempoolInfo();

            const stats = {
                blockHeight: blockchainInfo.blocks,
                difficulty: blockchainInfo.difficulty,
                mempoolSize: mempoolInfo.size,
                lastUpdate: new Date().toLocaleTimeString(),
                totalTxs: blockchainInfo.blocks * 2 + mempoolInfo.size
            };

            // Notify all listeners
            this.updateCallbacks.forEach(callback => callback(stats));
            
            return stats;
        } catch (error) {
            console.error('PRODUCTION ERROR - Network stats failed:', error);
            throw error;
        }
    }

    /**
     * FIXED: Check status of all nodes with sequential processing
     * This prevents race conditions and random timeouts
     */
    async checkAllNodes() {
        const nodeStatuses = [];
        let activeCount = 0;
        
        console.log('Starting FIXED node check for', BITCOIN_CONFIG.NODES.length, 'nodes');
        
        // FIXED: Process nodes sequentially instead of parallel
        for (const node of BITCOIN_CONFIG.NODES) {
            console.log('Checking', node.id, '...');
            
            try {
                // FIXED: Add individual timeouts for each call
                const networkInfo = await this.callWithTimeout(
                    BitcoinAPI.call(node.id, 'getnetworkinfo'),
                    8000, // 8 second timeout per call
                    node.id + ' getnetworkinfo timeout'
                );
                
                const blockchainInfo = await this.callWithTimeout(
                    BitcoinAPI.call(node.id, 'getblockchaininfo'),
                    8000, // 8 second timeout per call
                    node.id + ' getblockchaininfo timeout'
                );

                nodeStatuses.push({
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    status: 'online',
                    height: blockchainInfo.blocks,
                    connections: networkInfo.connections,
                    version: (networkInfo.version / 10000).toFixed(1)
                });
                
                activeCount++;
                console.log('SUCCESS:', node.id);
                
            } catch (error) {
                nodeStatuses.push({
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    status: 'offline',
                    error: error.message
                });
                
                console.log('FAILED:', node.id, '-', error.message);
            }
            
            // FIXED: Small delay between nodes to prevent API overload
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        console.log('FIXED node check complete:', activeCount + '/' + BITCOIN_CONFIG.NODES.length, 'online');
        
        return { nodes: nodeStatuses, activeCount };
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh(intervalMs = 30000) {
        if (this.isAutoRefreshing) return;

        this.autoRefreshInterval = setInterval(() => {
            this.getNetworkStats();
        }, intervalMs);
        
        this.isAutoRefreshing = true;
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
        this.isAutoRefreshing = false;
    }

    /**
     * Toggle auto-refresh
     */
    toggleAutoRefresh(intervalMs = 30000) {
        if (this.isAutoRefreshing) {
            this.stopAutoRefresh();
            return false;
        } else {
            this.startAutoRefresh(intervalMs);
            return true;
        }
    }
}

// =============================================================================
// BLOCKCHAIN EXPLORER - SHARED SEARCH FUNCTIONALITY
// =============================================================================

class BlockchainExplorer {
    /**
     * Auto-detect search type
     */
    static detectSearchType(query) {
        if (/^\d+$/.test(query)) {
            return 'block';
        } else if (query.length === 64 && /^[a-f0-9]+$/i.test(query)) {
            return 'transaction';
        } else if (query.startsWith('bcrt1') || query.startsWith('2') || 
                   query.startsWith('m') || query.startsWith('n')) {
            return 'address';
        } else {
            return 'transaction';
        }
    }

    /**
     * Search address with full transaction history
     */
    static async searchAddress(address) {
        const utxoPromise = BitcoinAPI.scanUTXOs(address)
            .catch(() => ({ total_amount: 0, unspents: [] }));
        
        const historyPromise = BitcoinAPI.getBlockchainInfo()
            .then(async (info) => {
                const promises = [];
                const blocksToCheck = Math.min(20, info.blocks);
                
                for (let i = 0; i < blocksToCheck; i++) {
                    const height = info.blocks - i;
                    promises.push(
                        BitcoinAPI.getBlockHash(height)
                            .then(hash => BitcoinAPI.getBlock(hash, 2))
                            .catch(() => null)
                    );
                }
                
                const blocks = await Promise.all(promises);
                const addressTxs = [];
                
                blocks.forEach(block => {
                    if (!block) return;
                    
                    block.tx.forEach(tx => {
                        let foundInTx = false;
                        let totalReceived = 0;
                        let totalSent = 0;
                        
                        tx.vout.forEach(output => {
                            if (output.scriptPubKey && output.scriptPubKey.address === address) {
                                foundInTx = true;
                                totalReceived += output.value;
                            }
                        });
                        
                        tx.vin.forEach(input => {
                            if (input.prevout && input.prevout.scriptPubKey && input.prevout.scriptPubKey.address === address) {
                                foundInTx = true;
                                totalSent += input.prevout.value;
                            }
                        });
                        
                        if (foundInTx) {
                            addressTxs.push({
                                txid: tx.txid,
                                blockHeight: block.height,
                                time: block.time,
                                received: totalReceived,
                                sent: totalSent,
                                confirmations: blocks[0].height - block.height + 1
                            });
                        }
                    });
                });
                
                return addressTxs;
            })
            .catch(() => []);
        
        const utxoResult = await utxoPromise;
        const transactions = await historyPromise;
        
        return {
            type: 'address',
            data: {
                address,
                balance: utxoResult.total_amount || 0,
                utxos: utxoResult.unspents || [],
                transactions,
                totalReceived: transactions.reduce((sum, tx) => sum + tx.received, 0),
                totalSent: transactions.reduce((sum, tx) => sum + tx.sent, 0)
            }
        };
    }

    /**
     * Search block by hash or height
     */
    static async searchBlock(blockIdentifier) {
        try {
            const block = await BitcoinAPI.getBlock(blockIdentifier, 2);
            return { type: 'block', data: block };
        } catch {
            if (/^\d+$/.test(blockIdentifier)) {
                const hash = await BitcoinAPI.getBlockHash(parseInt(blockIdentifier));
                const block = await BitcoinAPI.getBlock(hash, 2);
                return { type: 'block', data: block };
            }
            throw new Error('Block not found');
        }
    }

    /**
     * Search transaction by ID
     */
    static async searchTransaction(txid) {
        const tx = await BitcoinAPI.getRawTransaction(txid, true);
        return { type: 'transaction', data: tx };
    }

    /**
     * Get recent blocks with pagination
     */
    static async getRecentBlocks(page = 1, itemsPerPage = 10) {
        const info = await BitcoinAPI.getBlockchainInfo();
        const startHeight = Math.max(0, info.blocks - (page - 1) * itemsPerPage);
        const endHeight = Math.max(0, startHeight - itemsPerPage);
        
        const promises = [];
        for (let height = startHeight; height > endHeight && height >= 0; height--) {
            promises.push(
                BitcoinAPI.getBlockHash(height)
                    .then(hash => BitcoinAPI.getBlock(hash, 1))
            );
        }
        
        const blocks = await Promise.all(promises);
        const totalPages = Math.ceil(info.blocks / itemsPerPage);
        
        return { blocks, totalPages, currentPage: page };
    }

    /**
     * Get mempool transactions
     */
    static async getMempoolTransactions(limit = 20) {
        const mempoolTxs = await BitcoinAPI.getRawMempool();
        
        if (mempoolTxs.length === 0) {
            return [];
        }
        
        const transactions = [];
        const txsToProcess = mempoolTxs.slice(0, limit);
        
        for (const txid of txsToProcess) {
            try {
                const tx = await BitcoinAPI.getRawTransaction(txid, true);
                const totalOutput = tx.vout.reduce((sum, output) => sum + output.value, 0);
                
                transactions.push({
                    txid: tx.txid,
                    inputs: tx.vin.length,
                    outputs: tx.vout.length,
                    amount: totalOutput,
                    status: 'mempool'
                });
            } catch (error) {
                console.error('Failed to get transaction ' + txid + ':', error);
            }
        }
        
        return transactions;
    }

    /**
     * Get confirmed transactions from recent blocks
     */
    static async getConfirmedTransactions(page = 1, itemsPerPage = 10) {
        const info = await BitcoinAPI.getBlockchainInfo();
        const blocksToCheck = 5;
        
        const promises = [];
        for (let i = 0; i < blocksToCheck && (info.blocks - i) >= 0; i++) {
            const height = info.blocks - i;
            promises.push(
                BitcoinAPI.getBlockHash(height)
                    .then(hash => BitcoinAPI.getBlock(hash, 2))
            );
        }
        
        const blocks = await Promise.all(promises);
        const allTxs = [];
        
        blocks.forEach(block => {
            block.tx.forEach(tx => {
                if (tx.vin.length > 0 && !tx.vin[0].coinbase) {
                    const totalOutput = tx.vout.reduce((sum, output) => sum + output.value, 0);
                    
                    allTxs.push({
                        txid: tx.txid,
                        blockHeight: block.height,
                        time: block.time,
                        amount: totalOutput,
                        inputs: tx.vin.length,
                        outputs: tx.vout.length,
                        confirmations: blocks[0].height - block.height + 1
                    });
                }
            });
        });
        
        allTxs.sort((a, b) => b.time - a.time);
        
        const startIndex = (page - 1) * itemsPerPage;
        const paginatedTxs = allTxs.slice(startIndex, startIndex + itemsPerPage);
        const totalPages = Math.ceil(allTxs.length / itemsPerPage);
        
        return { transactions: paginatedTxs, totalPages, currentPage: page };
    }
}

// =============================================================================
// WALLET MANAGER - SHARED WALLET OPERATIONS
// =============================================================================

class WalletManager {
    /**
     * Get node ID for wallet operations
     */
    static getNodeIdForWallet(wallet) {
        if (wallet.id === 'pool-a' || wallet.id === 'pool-b' || 
            wallet.id === 'tx-generator' || wallet.id === 'coordinator') {
            return 'coordinator';
        }
        return wallet.id;
    }

    /**
     * Get wallet information with balance and address
     */
    static async getWalletInfo(wallet) {
        try {
            const nodeId = this.getNodeIdForWallet(wallet);
            const walletName = wallet.wallet;
            
            const balance = await BitcoinAPI.call(nodeId, 'getbalance', [], walletName);
            
            let address;
            try {
                address = await BitcoinAPI.call(nodeId, 'getnewaddress', ['display'], walletName);
            } catch {
                address = 'Address unavailable';
            }
            
            return {
                balance: balance || 0,
                address: address || 'No address'
            };
        } catch (error) {
            return {
                balance: 0,
                address: 'Error: ' + error.message,
                error: error.message
            };
        }
    }

    /**
     * Get all wallet information
     */
    static async getAllWalletInfo() {
        const walletInfo = [];
        let totalBalance = 0;
        
        for (const wallet of BITCOIN_CONFIG.WALLETS) {
            const info = await this.getWalletInfo(wallet);
            totalBalance += info.balance;
            walletInfo.push({ wallet, info });
        }
        
        return { wallets: walletInfo, totalBalance };
    }

    /**
     * Check wallet status
     */
    static async checkWalletStatus() {
        return await BitcoinAPI.listWallets();
    }

    /**
     * Create all missing wallets
     */
    static async createMissingWallets() {
        const walletNames = BITCOIN_CONFIG.WALLETS.map(w => w.wallet);
        let createdCount = 0;
        let skippedCount = 0;
        
        for (const walletName of walletNames) {
            try {
                await BitcoinAPI.createWallet(walletName);
                createdCount++;
                console.log('Created wallet:', walletName);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    skippedCount++;
                    console.log('Wallet already exists:', walletName);
                } else {
                    console.error('Failed to create wallet', walletName, ':', error);
                    throw error;
                }
            }
        }
        
        return { createdCount, skippedCount };
    }

    /**
     * Load all wallets
     */
    static async loadAllWallets() {
        const walletNames = BITCOIN_CONFIG.WALLETS.map(w => w.wallet);
        let loadedCount = 0;
        
        for (const walletName of walletNames) {
            try {
                await BitcoinAPI.loadWallet(walletName);
                loadedCount++;
                console.log('Loaded wallet:', walletName);
            } catch (error) {
                if (error.message.includes('already loaded')) {
                    loadedCount++;
                    console.log('Wallet already loaded:', walletName);
                } else {
                    console.error('Failed to load wallet', walletName, ':', error);
                }
            }
        }
        
        return { loadedCount };
    }

    /**
     * Send funds between wallets
     */
    static async sendFunds(fromWallet, toAddress, amount) {
        const wallet = BITCOIN_CONFIG.WALLETS.find(w => w.id === fromWallet);
        if (!wallet) throw new Error('Wallet not found');
        
        const nodeId = this.getNodeIdForWallet(wallet);
        return await BitcoinAPI.sendToAddress(toAddress, amount, wallet.wallet);
    }

    /**
     * Generate new address for wallet
     */
    static async generateNewAddress(walletId, label = '') {
        const wallet = BITCOIN_CONFIG.WALLETS.find(w => w.id === walletId);
        if (!wallet) throw new Error('Wallet not found');
        
        const nodeId = this.getNodeIdForWallet(wallet);
        return await BitcoinAPI.call(nodeId, 'getnewaddress', [label], wallet.wallet);
    }

    /**
     * Generate new block to mining rewards wallet
     */
    static async generateNewBlock() {
        const miningAddress = await BitcoinAPI.getNewAddress('mining', 'mining_rewards');
        const blockHashes = await BitcoinAPI.generateToAddress(1, miningAddress);
        return blockHashes[0];
    }

    /**
     * Generate test transaction
     */
    static async generateTestTransaction() {
        const newAddress = await BitcoinAPI.getNewAddress('test_tx', 'tx_generator');
        return await BitcoinAPI.sendToAddress(newAddress, 0.1, 'tx_generator');
    }
}

// =============================================================================
// NOTIFICATION SYSTEM - SHARED UI FEEDBACK
// =============================================================================

class NotificationManager {
    static show(message, type = 'success', duration = 4000) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = 'notification ' + type + ' show';
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        } else {
            console.log(type.toUpperCase() + ': ' + message);
        }
    }

    static success(message, duration = 4000) {
        this.show(message, 'success', duration);
    }

    static error(message, duration = 6000) {
        this.show(message, 'error', duration);
    }

    static warning(message, duration = 5000) {
        this.show(message, 'warning', duration);
    }

    static info(message, duration = 4000) {
        this.show(message, 'info', duration);
    }
}

// =============================================================================
// UI MANAGER - SHARED UI FUNCTIONALITY
// =============================================================================

class UIManager {
    /**
     * Show loading state on element
     */
    static showLoading(element, text = 'Loading...') {
        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;
        
        element.innerHTML = '<span style="display: flex; align-items: center; justify-content: center;"><span style="display: inline-block; width: 16px; height: 16px; border: 2px solid #f3f3f3; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></span><span style="margin-left: 8px;">' + text + '</span></span>';
        element.disabled = true;
    }

    /**
     * Hide loading state
     */
    static hideLoading(element) {
        const originalContent = element.dataset.originalContent;
        if (originalContent) {
            element.innerHTML = originalContent;
            delete element.dataset.originalContent;
        }
        element.disabled = false;
    }

    /**
     * Show tab content
     */
    static showTab(tabName, containerSelector = '.unilayer-tab-container') {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        const tabContents = document.querySelectorAll('.unilayer-tab-content, .tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        const tabs = container.querySelectorAll('.unilayer-tab, .tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });

        const targetContent = document.getElementById(tabName + 'Tab') || 
                            document.querySelector('[data-tab="' + tabName + '"]');
        if (targetContent) {
            targetContent.classList.add('active');
        }

        const activeTab = container.querySelector('[onclick*="' + tabName + '"]') ||
                        container.querySelector('[data-tab-trigger="' + tabName + '"]');
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }

    /**
     * Validate form inputs
     */
    static validateForm(formElement) {
        const inputs = formElement.querySelectorAll('.unilayer-input, .unilayer-textarea, .unilayer-select, input, textarea, select');
        let isValid = true;

        inputs.forEach(input => {
            const value = input.value.trim();
            const isRequired = input.hasAttribute('required');
            const type = input.getAttribute('type');

            input.classList.remove('error', 'success');

            if (isRequired && !value) {
                input.classList.add('error');
                isValid = false;
                return;
            }

            if (value) {
                if (type === 'email' && !BitcoinUtils.isValidEmail(value)) {
                    input.classList.add('error');
                    isValid = false;
                    return;
                }

                if (input.classList.contains('bitcoin-address') && !BitcoinUtils.isValidBitcoinAddress(value)) {
                    input.classList.add('error');
                    isValid = false;
                    return;
                }
            }

            if (value) {
                input.classList.add('success');
            }
        });

        return isValid;
    }

    /**
     * Update progress bar
     */
    static updateProgress(elementId, percentage, animated = true) {
        const progressBar = document.querySelector('#' + elementId + ' .progress-bar, #' + elementId + ' .unilayer-progress-bar');
        if (progressBar) {
            progressBar.style.width = Math.min(100, Math.max(0, percentage)) + '%';
            
            if (animated) {
                progressBar.classList.add('animated');
            } else {
                progressBar.classList.remove('animated');
            }
        }
    }
}

// =============================================================================
// STORAGE MANAGER - LOCAL STORAGE UTILITIES  
// =============================================================================

class StorageManager {
    /**
     * Save data to localStorage
     */
    static save(key, value) {
        try {
            localStorage.setItem('bitcoin_' + key, JSON.stringify(value));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    /**
     * Load data from localStorage
     */
    static load(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem('bitcoin_' + key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
            return defaultValue;
        }
    }

    /**
     * Remove data from localStorage
     */
    static remove(key) {
        try {
            localStorage.removeItem('bitcoin_' + key);
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
        }
    }
}

// =============================================================================
// UTILITIES - SHARED HELPER FUNCTIONS
// =============================================================================

class BitcoinUtils {
    /**
     * Format Bitcoin amount
     */
    static formatBTC(amount, decimals = 8) {
        return parseFloat(amount).toFixed(decimals) + ' BTC';
    }

    /**
     * Format USD amount
     */
    static formatUSD(amount, decimals = 2) {
        return '$' + parseFloat(amount).toFixed(decimals);
    }

    /**
     * Format hash for display
     */
    static formatHash(hash, startChars = 8, endChars = 8) {
        if (!hash || hash.length <= startChars + endChars) {
            return hash;
        }
        return hash.substring(0, startChars) + '...' + hash.substring(hash.length - endChars);
    }

    /**
     * Format timestamp
     */
    static formatTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString();
    }

    /**
     * Format duration in seconds
     */
    static formatDuration(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return days + 'd ' + hours + 'h';
        if (hours > 0) return hours + 'h ' + minutes + 'm';
        return minutes + 'm';
    }

    /**
     * Validate Bitcoin address
     */
    static isValidBitcoinAddress(address) {
        return /^(bc1|[13]|bcrt1)[a-zA-HJ-NP-Z0-9]{25,87}$/.test(address);
    }

    /**
     * Validate email address
     */
    static isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * Copy text to clipboard
     */
    static async copyToClipboard(text, successMessage = 'Copied to clipboard!') {
        try {
            await navigator.clipboard.writeText(text);
            NotificationManager.success(successMessage, 2000);
            return true;
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            NotificationManager.success(successMessage, 2000);
            return true;
        }
    }

    /**
     * Validate Bitcoin transaction structure
     */
    static validateBitcoinTransaction(tx) {
        const errors = [];
        
        if (!tx.recipient || !this.isValidBitcoinAddress(tx.recipient)) {
            errors.push('Invalid recipient address');
        }
        
        const amount = parseFloat(tx.amount);
        if (!amount || amount <= 0) {
            errors.push('Invalid amount');
        }
        
        if (amount > tx.availableBalance) {
            errors.push('Insufficient balance');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Estimate Bitcoin transaction fee
     */
    static estimateBitcoinFee(inputs, outputs, feeRate = 10) {
        const estimatedSize = (inputs * 148) + (outputs * 34) + 10;
        return Math.ceil(estimatedSize * feeRate);
    }

    /**
     * Format Bitcoin amounts with units
     */
    static formatBitcoinAmount(satoshis, unit = 'BTC') {
        const btc = satoshis / 100000000;
        
        switch (unit) {
            case 'BTC':
                return btc.toFixed(8) + ' BTC';
            case 'mBTC':
                return (btc * 1000).toFixed(5) + ' mBTC';
            case 'sat':
                return Math.round(satoshis) + ' sat';
            default:
                return btc.toFixed(8) + ' BTC';
        }
    }
}

// =============================================================================
// MINING UTILITIES - MINING POOL CALCULATIONS
// =============================================================================

class MiningUtils {
    /**
     * Calculate hashrate from shares
     */
    static calculateHashrate(shares, timeSpan, difficulty) {
        if (timeSpan <= 0) return 0;
        const sharesPerSecond = shares / timeSpan;
        return sharesPerSecond * difficulty;
    }

    /**
     * Format hashrate with appropriate units
     */
    static formatHashrate(hashrate) {
        if (hashrate >= 1e12) {
            return (hashrate / 1e12).toFixed(2) + ' TH/s';
        } else if (hashrate >= 1e9) {
            return (hashrate / 1e9).toFixed(2) + ' GH/s';
        } else if (hashrate >= 1e6) {
            return (hashrate / 1e6).toFixed(2) + ' MH/s';
        } else if (hashrate >= 1e3) {
            return (hashrate / 1e3).toFixed(2) + ' KH/s';
        } else {
            return hashrate.toFixed(2) + ' H/s';
        }
    }

    /**
     * Calculate mining profitability
     */
    static calculateMiningProfit(hashrate, difficulty, blockReward, electricityCost = 0) {
        const blocksPerDay = (hashrate * 86400) / difficulty;
        const dailyReward = blocksPerDay * blockReward;
        const dailyProfit = dailyReward - electricityCost;
        
        return {
            dailyBTC: dailyReward,
            dailyProfit: dailyProfit,
            monthlyBTC: dailyReward * 30,
            monthlyProfit: dailyProfit * 30
        };
    }
}

// =============================================================================
// EXPORT GLOBAL INSTANCES
// =============================================================================

window.BitcoinCore = {
    API: BitcoinAPI,
    Config: BITCOIN_CONFIG,
    NetworkMonitor: new NetworkMonitor(),
    Explorer: BlockchainExplorer,
    WalletManager: WalletManager,
    Notifications: NotificationManager,
    Utils: BitcoinUtils,
    UI: UIManager,
    Storage: StorageManager,
    Mining: MiningUtils
};

window.showNotification = (message, type, duration) => NotificationManager.show(message, type, duration);
window.showTab = (tabName, container) => UIManager.showTab(tabName, container);
window.copyToClipboard = (text, message) => BitcoinUtils.copyToClipboard(text, message);
window.formatBTC = (amount, decimals) => BitcoinUtils.formatBTC(amount, decimals);
window.formatHash = (hash, start, end) => BitcoinUtils.formatHash(hash, start, end);
window.formatTime = (timestamp) => BitcoinUtils.formatTime(timestamp);
window.validateForm = (form) => UIManager.validateForm(form);

console.log('Bitcoin Core loaded - FIXED version with sequential node checking ready');