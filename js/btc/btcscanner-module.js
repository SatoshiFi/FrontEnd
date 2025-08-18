/**
 * Bitcoin Scanner Module - Specialized blockchain exploration
 * Uses BitcoinCore for common operations, adds scanner-specific UI
 * Depends on: btc-core.js
 */

// =============================================================================
// SCANNER-SPECIFIC STATE
// =============================================================================

let currentPage = { blocks: 1, confirmed: 1 };

// =============================================================================
// TAB MANAGEMENT
// =============================================================================

/**
 * Switch between scanner tabs
 */
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(function(content) {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Load real data for selected tab
    if (tabName === 'blocks') {
        refreshBlocks();
    } else if (tabName === 'mempool') {
        refreshMempool();
    } else if (tabName === 'confirmed') {
        refreshConfirmed();
    } else if (tabName === 'nodes') {
        refreshNodes();
    }
}

// =============================================================================
// SEARCH FUNCTIONALITY
// =============================================================================

/**
 * Perform blockchain search
 */
function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const type = document.getElementById('searchType').value;
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query) {
        alert('Please enter a search query');
        return;
    }
    
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div class="loading">Searching blockchain...</div>';
    
    // Auto-detect search type if needed
    let detectedType = type;
    if (type === 'auto') {
        detectedType = BitcoinCore.Explorer.detectSearchType(query);
    }
    
    searchBlockchain(query, detectedType)
        .then(function(results) {
            displaySearchResults(results, detectedType);
        })
        .catch(function(error) {
            resultsDiv.innerHTML = '<div style="color: #f44336;">Search failed: ' + error.message + '</div>';
            console.error('PRODUCTION ERROR - Blockchain search failed:', error);
        });
}

/**
 * Execute blockchain search using BitcoinCore
 */
async function searchBlockchain(query, type) {
    switch(type) {
        case 'address':
            return await BitcoinCore.Explorer.searchAddress(query);
        case 'block':
            return await BitcoinCore.Explorer.searchBlock(query);
        case 'transaction':
            return await BitcoinCore.Explorer.searchTransaction(query);
        default:
            throw new Error('Unknown search type');
    }
}

/**
 * Display search results
 */
function displaySearchResults(results, type) {
    const resultsDiv = document.getElementById('searchResults');
    let html = '';
    
    switch(type) {
        case 'address':
            html = createAddressResultHTML(results.data);
            break;
        case 'block':
            html = createBlockResultHTML(results.data);
            break;
        case 'transaction':
            html = createTransactionResultHTML(results.data);
            break;
    }
    
    resultsDiv.innerHTML = html;
}

function createAddressResultHTML(data) {
    return `
        <h4>📍 Address: ${data.address}</h4>
        <p><strong>Current Balance:</strong> ${BitcoinCore.Utils.formatBTC(data.balance)}</p>
        <p><strong>Unspent UTXOs:</strong> ${data.utxos.length}</p>
        <p><strong>Recent Transactions:</strong> ${data.transactions.length}</p>
        <p><strong>Total Received:</strong> ${BitcoinCore.Utils.formatBTC(data.totalReceived)}</p>
        <p><strong>Total Sent:</strong> ${BitcoinCore.Utils.formatBTC(data.totalSent)}</p>
        ${data.transactions.length > 0 ? 
            '<div style="margin-top: 12px;"><strong>Recent Activity:</strong><br>' +
            data.transactions.slice(0, 3).map(function(tx) {
                return `• TX: ${BitcoinCore.Utils.formatHash(tx.txid)}... (Block #${tx.blockHeight})`;
            }).join('<br>') + '</div>' : ''}
    `;
}

function createBlockResultHTML(block) {
    return `
        <h4>📦 Block #${block.height}</h4>
        <p><strong>Hash:</strong> ${block.hash}</p>
        <p><strong>Time:</strong> ${BitcoinCore.Utils.formatTime(block.time)}</p>
        <p><strong>Transactions:</strong> ${block.tx.length}</p>
        <p><strong>Size:</strong> ${block.size} bytes</p>
    `;
}

function createTransactionResultHTML(tx) {
    const totalOutput = tx.vout.reduce((sum, output) => sum + output.value, 0);
    return `
        <h4>💸 Transaction: ${tx.txid}</h4>
        <p><strong>Block:</strong> ${tx.blockhash ? 'Confirmed' : 'Mempool'}</p>
        <p><strong>Inputs:</strong> ${tx.vin.length}</p>
        <p><strong>Outputs:</strong> ${tx.vout.length}</p>
        <p><strong>Amount:</strong> ${BitcoinCore.Utils.formatBTC(totalOutput)}</p>
        ${tx.confirmations ? `<p><strong>Confirmations:</strong> ${tx.confirmations}</p>` : ''}
    `;
}

// =============================================================================
// NETWORK STATISTICS
// =============================================================================

/**
 * Refresh network statistics
 */
function refreshNetworkStats() {
    BitcoinCore.NetworkMonitor.getNetworkStats()
        .then(function(stats) {
            document.getElementById('blockHeight').textContent = stats.blockHeight;
            document.getElementById('mempoolSize').textContent = stats.mempoolSize;
            document.getElementById('lastUpdate').textContent = stats.lastUpdate;
            document.getElementById('totalTxs').textContent = '~' + stats.totalTxs;
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Network stats refresh failed:', error);
            document.getElementById('blockHeight').textContent = 'Error';
            document.getElementById('mempoolSize').textContent = 'Error';
        });
}

// =============================================================================
// BLOCKS TAB
// =============================================================================

/**
 * Refresh blocks list
 */
function refreshBlocks() {
    const blocksList = document.getElementById('blocksList');
    blocksList.innerHTML = '<div class="loading">Loading blocks...</div>';
    
    BitcoinCore.Explorer.getRecentBlocks(currentPage.blocks, BitcoinCore.Config.PAGINATION.itemsPerPage)
        .then(function(result) {
            const blockElements = result.blocks.map(function(block) {
                return `
                    <div class="item block" onclick="searchBlock('${block.hash}')">
                        <div class="item-header">
                            <div class="item-title">Block #${block.height}</div>
                            <div class="item-badge badge-block">BLOCK</div>
                        </div>
                        <div class="item-details">
                            <div>Hash: ${BitcoinCore.Utils.formatHash(block.hash, 32)}...</div>
                            <div>Transactions: ${block.tx.length} | Size: ${block.size} bytes</div>
                        </div>
                        <div class="item-meta">
                            ${BitcoinCore.Utils.formatTime(block.time)}
                        </div>
                    </div>
                `;
            }).join('');
            
            blocksList.innerHTML = blockElements || 
                '<div style="text-align: center; opacity: 0.7; padding: 20px;">No blocks found</div>';
            
            updatePagination('blocks', result.totalPages);
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Blocks refresh failed:', error);
            blocksList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">Failed to load blocks</div>';
        });
}

// =============================================================================
// MEMPOOL TAB
// =============================================================================

/**
 * Refresh mempool transactions
 */
function refreshMempool() {
    const mempoolList = document.getElementById('mempoolList');
    mempoolList.innerHTML = '<div class="loading">Loading mempool...</div>';
    
    BitcoinCore.Explorer.getMempoolTransactions(20)
        .then(function(transactions) {
            if (transactions.length === 0) {
                mempoolList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">No pending transactions</div>';
                return;
            }
            
            const txElements = transactions.map(function(tx) {
                return `
                    <div class="item mempool" onclick="searchTransaction('${tx.txid}')">
                        <div class="item-header">
                            <div class="item-title">${BitcoinCore.Utils.formatHash(tx.txid)}...</div>
                            <div class="item-badge badge-mempool">MEMPOOL</div>
                        </div>
                        <div class="item-details">
                            <div>Amount: ${BitcoinCore.Utils.formatBTC(tx.amount)}</div>
                            <div>In: ${tx.inputs} | Out: ${tx.outputs}</div>
                        </div>
                        <div class="item-meta">
                            Pending confirmation
                        </div>
                    </div>
                `;
            }).join('');
            
            mempoolList.innerHTML = txElements;
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Mempool refresh failed:', error);
            mempoolList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">Failed to load mempool</div>';
        });
}

// =============================================================================
// CONFIRMED TRANSACTIONS TAB
// =============================================================================

/**
 * Refresh confirmed transactions
 */
function refreshConfirmed() {
    const confirmedList = document.getElementById('confirmedList');
    confirmedList.innerHTML = '<div class="loading">Loading confirmed transactions...</div>';
    
    BitcoinCore.Explorer.getConfirmedTransactions(currentPage.confirmed, BitcoinCore.Config.PAGINATION.itemsPerPage)
        .then(function(result) {
            const txElements = result.transactions.map(function(tx) {
                return `
                    <div class="item confirmed" onclick="searchTransaction('${tx.txid}')">
                        <div class="item-header">
                            <div class="item-title">${BitcoinCore.Utils.formatHash(tx.txid)}...</div>
                            <div class="item-badge badge-confirmed">CONFIRMED</div>
                        </div>
                        <div class="item-details">
                            <div>Amount: ${BitcoinCore.Utils.formatBTC(tx.amount)}</div>
                            <div>Block #${tx.blockHeight} | In: ${tx.inputs} | Out: ${tx.outputs}</div>
                        </div>
                        <div class="item-meta">
                            ${BitcoinCore.Utils.formatTime(tx.time)} | ${tx.confirmations} confirmations
                        </div>
                    </div>
                `;
            }).join('');
            
            confirmedList.innerHTML = txElements || 
                '<div style="text-align: center; opacity: 0.7; padding: 20px;">No confirmed transactions found</div>';
            
            updatePagination('confirmed', result.totalPages);
        })
        .catch(function(error) {
            console.error('PRODUCTION ERROR - Confirmed transactions refresh failed:', error);
            confirmedList.innerHTML = '<div style="text-align: center; opacity: 0.7; padding: 20px;">Failed to load confirmed transactions</div>';
        });
}

// =============================================================================
// NODES TAB
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
                                <div>🆔 ${node.id} | ⛓️ Height: ${node.height}</div>
                                <div>🔗 Connections: ${node.connections} | 💾 v${node.version}</div>
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
                                <div>🆔 ${node.id} | ❌ ${node.error}</div>
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
// PAGINATION
// =============================================================================

/**
 * Update pagination controls
 */
function updatePagination(type, totalPages) {
    const paginationDiv = document.getElementById(type + 'Pagination');
    if (!paginationDiv || totalPages <= 1) {
        if (paginationDiv) paginationDiv.innerHTML = '';
        return;
    }
    
    let html = '';
    const current = currentPage[type];
    
    // Previous button
    html += `<button class="page-btn" ${current <= 1 ? 'disabled' : ''} onclick="changePage('${type}', ${current - 1})">‹</button>`;
    
    // Page numbers
    for (let i = Math.max(1, current - 2); i <= Math.min(totalPages, current + 2); i++) {
        html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="changePage('${type}', ${i})">${i}</button>`;
    }
    
    // Next button
    html += `<button class="page-btn" ${current >= totalPages ? 'disabled' : ''} onclick="changePage('${type}', ${current + 1})">›</button>`;
    
    paginationDiv.innerHTML = html;
}

/**
 * Change pagination page
 */
function changePage(type, page) {
    currentPage[type] = page;
    
    if (type === 'blocks') {
        refreshBlocks();
    } else if (type === 'confirmed') {
        refreshConfirmed();
    }
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
        
        // Add callback for UI updates
        BitcoinCore.NetworkMonitor.onUpdate(function(stats) {
            document.getElementById('blockHeight').textContent = stats.blockHeight;
            document.getElementById('mempoolSize').textContent = stats.mempoolSize;
            document.getElementById('lastUpdate').textContent = stats.lastUpdate;
            document.getElementById('totalTxs').textContent = '~' + stats.totalTxs;
            
            // Refresh current tab
            const activeTab = document.querySelector('.tab.active').textContent;
            if (activeTab.includes('Blocks')) {
                refreshBlocks();
            } else if (activeTab.includes('Mempool')) {
                refreshMempool();
            } else if (activeTab.includes('Confirmed')) {
                refreshConfirmed();
            } else if (activeTab.includes('Nodes')) {
                refreshNodes();
            }
        });
    } else {
        btn.textContent = '⏱️ Auto-refresh';
        BitcoinCore.Notifications.success('Auto-refresh disabled');
    }
}

// =============================================================================
// SEARCH SHORTCUTS
// =============================================================================

/**
 * Search for specific block (called from block items)
 */
function searchBlock(blockHash) {
    document.getElementById('searchInput').value = blockHash;
    document.getElementById('searchType').value = 'block';
    performSearch();
}

/**
 * Search for specific transaction (called from transaction items)
 */
function searchTransaction(txid) {
    document.getElementById('searchInput').value = txid;
    document.getElementById('searchType').value = 'transaction';
    performSearch();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize scanner dashboard
 */
function initDashboard() {
    // Verify dependencies
    if (typeof BitcoinCore === 'undefined') {
        console.error('CRITICAL: BitcoinCore not loaded - scanner cannot initialize');
        return;
    }
    
    // Load initial data
    refreshNetworkStats();
    refreshBlocks(); // Load default tab content
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Initialize when page loads
window.addEventListener('load', initDashboard);

// Handle search on Enter key
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
});

console.log('🔍 Bitcoin Scanner module loaded - Ready for blockchain exploration');