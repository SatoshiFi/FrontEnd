// js/components/nft-collection.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С ПРАВИЛЬНОЙ ИНИЦИАЛИЗАЦИЕЙ
class NFTCollectionManager {
    constructor() {
        this.requests = [];
        this.isAdmin = false;
        this.initialized = false;
        this.userNFTs = [];
        this.currentTab = 'user-nfts';
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.log('Initializing NFTCollectionManager...');

            // Загружаем NFT пользователя
            await this.loadUserNFTs();

            // Проверяем админские права
            await this.checkAdminRights();

            // Строим интерфейс
            this.buildNFTInterface();

            // Если админ - загружаем запросы
            if (this.isAdmin) {
                await this.loadRequests();
            }

            this.initialized = true;
            console.log('NFTCollectionManager initialized successfully, isAdmin:', this.isAdmin);

        } catch (error) {
            console.error('Failed to initialize NFTCollectionManager:', error);
            this.showInitializationError(error);
        }
    }

    buildNFTInterface() {
        const container = document.getElementById('nftCollection');
        if (!container) return;

        container.innerHTML = `
        <div class="nft-collection-header">
        <h2>My NFT/SBT Collection</h2>
        <p>Manage your digital assets and authorization requests</p>
        </div>

        <div class="nft-tabs">
        <button class="tab-button active" data-tab="user-nfts" onclick="nftCollection.switchTab('user-nfts')">
        My NFTs
        </button>
        <button class="tab-button" data-tab="requests" onclick="nftCollection.switchTab('requests')">
        My Requests
        </button>
        ${this.isAdmin ? `
            <button class="tab-button admin-tab" data-tab="admin" onclick="nftCollection.switchTab('admin')">
            Admin Panel
            </button>` : ''}
            </div>

            <div class="nft-content">
            <div id="user-nfts-tab" class="tab-content active">
            <div id="user-nfts-grid" class="nfts-grid">
            <div class="loading">Loading your NFTs...</div>
            </div>
            </div>

            <div id="requests-tab" class="tab-content">
            <div id="user-requests-content">
            <div class="loading">Loading your requests...</div>
            </div>
            </div>

            ${this.isAdmin ? `
                <div id="admin-tab" class="tab-content">
                <div id="admin-requests-list">
                <div class="loading">Loading admin requests...</div>
                </div>
                </div>` : ''}
                </div>
                `;

                this.loadTabContent('user-nfts');
    }

    async loadUserNFTs() {
        try {
            if (!wallet.connected) {
                this.userNFTs = [];
                return;
            }

            console.log('Loading user NFTs...');

            // Загружаем NFTs через contracts
            if (window.contracts && contracts.initialized) {
                this.userNFTs = await contracts.getUserNFTs(wallet.account);
                console.log(`Loaded ${this.userNFTs.length} NFTs for user`);
            } else {
                console.warn('Contracts not initialized, cannot load NFTs');
                this.userNFTs = [];
            }

        } catch (error) {
            console.error('Failed to load user NFTs:', error);
            this.userNFTs = [];
        }
    }

    async checkAdminRights() {
        try {
            if (!wallet.connected || !window.contracts || !contracts.initialized) {
                this.isAdmin = false;
                return;
            }

            // ИСПРАВЛЕНО: используем правильный метод проверки админских прав
            const adminRights = await contracts.checkAdminRights(wallet.account);
            this.isAdmin = adminRights.hasAdminRights || adminRights.isAdmin || adminRights.isPoolManager;

            console.log('Admin rights check result:', {
                hasAdminRights: adminRights.hasAdminRights,
                isAdmin: adminRights.isAdmin,
                isPoolManager: adminRights.isPoolManager,
                finalResult: this.isAdmin
            });

        } catch (error) {
            console.error('Failed to check admin rights:', error);
            this.isAdmin = false;
        }
    }

    switchTab(tabName) {
        // Обновляем активные кнопки
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Обновляем активный контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
        this.loadTabContent(tabName);
    }

    async loadTabContent(tabName) {
        switch (tabName) {
            case 'user-nfts':
                this.renderUserNFTs();
                break;
            case 'requests':
                await this.loadUserRequests();
                break;
            case 'admin':
                if (this.isAdmin) {
                    await this.loadRequests();
                }
                break;
        }
    }

    renderUserNFTs() {
        const container = document.getElementById('user-nfts-grid');
        if (!container) return;

        if (!wallet.connected) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">🔗</div>
            <h3>Connect Wallet</h3>
            <p>Connect your wallet to view your NFT collection</p>
            <button onclick="wallet.connect()" class="btn btn-primary">Connect Wallet</button>
            </div>
            `;
            return;
        }

        if (this.userNFTs.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">🎨</div>
            <h3>No NFTs Found</h3>
            <p>You don't have any SatoshiFi NFTs yet</p>
            ${!userRoles.isUserAuthorized() ? `
                <button onclick="app.showAccessRequestModal()" class="btn btn-primary">
                Request Platform Access
                </button>` : ''}
                </div>
                `;
                return;
        }

        const nftsHTML = this.userNFTs.map(nft => this.renderNFTCard(nft)).join('');
        container.innerHTML = `
        <div class="nfts-header">
        <h3>Your NFT Collection (${this.userNFTs.length})</h3>
        </div>
        <div class="nfts-grid-container">
        ${nftsHTML}
        </div>
        `;
    }

    renderNFTCard(nft) {
        const isActive = nft.active === true;
        const nftType = nft.type === 'membership' ? 'Membership' : 'Role Badge';

        let roleDisplay = '';
        let poolDisplay = '';

        if (nft.type === 'membership') {
            try {
                roleDisplay = nft.role ? ethers.utils.parseBytes32String(nft.role) : 'Unknown';
                poolDisplay = nft.poolId ? ethers.utils.parseBytes32String(nft.poolId) : 'Unknown';
            } catch {
                roleDisplay = 'Invalid';
                poolDisplay = 'Invalid';
            }
        }

        return `
        <div class="nft-card ${isActive ? 'active' : 'inactive'}">
        <div class="nft-header">
        <div class="nft-type">${nftType}</div>
        <div class="nft-status ${isActive ? 'active' : 'inactive'}">
        ${isActive ? '✅ Active' : '❌ Inactive'}
        </div>
        </div>

        <div class="nft-content">
        <div class="nft-id">Token ID: ${nft.tokenId}</div>

        ${nft.type === 'membership' ? `
            <div class="nft-details">
            <div class="detail-item">
            <span class="label">Role:</span>
            <span class="value">${roleDisplay}</span>
            </div>
            <div class="detail-item">
            <span class="label">Pool:</span>
            <span class="value">${poolDisplay}</span>
            </div>
            <div class="detail-item">
            <span class="label">Joined:</span>
            <span class="value">${new Date(nft.joinTimestamp * 1000).toLocaleDateString()}</span>
            </div>
            </div>` : ''}
            </div>

            <div class="nft-footer">
            <span class="nft-contract">Contract: ${wallet.formatAddress(CONFIG.CONTRACTS.MEMBERSHIP_SBT)}</span>
            </div>
            </div>
            `;
    }

    async loadUserRequests() {
        const container = document.getElementById('user-requests-content');
        if (!container) return;

        if (!wallet.connected) {
            container.innerHTML = `
            <div class="empty-state">
            <h3>Connect Wallet</h3>
            <p>Connect your wallet to view your requests</p>
            </div>
            `;
            return;
        }

        try {
            container.innerHTML = '<div class="loading">Loading your requests...</div>';

            // Загружаем запросы пользователя через requests manager
            if (window.requests && requests.initialized) {
                await requests.loadUserRequests();
                const userRequests = requests.getOutgoingRequests();
                this.renderUserRequests(userRequests);
            } else {
                // Инициализируем requests manager если не инициализирован
                if (window.requests) {
                    await requests.initialize();
                    const userRequests = requests.getOutgoingRequests();
                    this.renderUserRequests(userRequests);
                } else {
                    throw new Error('Request system not available');
                }
            }

        } catch (error) {
            console.error('Failed to load user requests:', error);
            container.innerHTML = `
            <div class="error-state">
            <h3>Error Loading Requests</h3>
            <p>${error.message}</p>
            <button onclick="nftCollection.loadTabContent('requests')" class="btn btn-secondary">
            Try Again
            </button>
            </div>
            `;
        }
    }

    renderUserRequests(userRequests) {
        const container = document.getElementById('user-requests-content');
        if (!container) return;

        if (userRequests.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>No Requests</h3>
            <p>You haven't submitted any authorization requests</p>
            ${!userRoles.isUserAuthorized() ? `
                <button onclick="app.showAccessRequestModal()" class="btn btn-primary">
                Request Platform Access
                </button>` : ''}
                </div>
                `;
                return;
        }

        const requestsHTML = userRequests.map(request => this.renderUserRequestCard(request)).join('');

        container.innerHTML = `
        <div class="requests-header">
        <h3>Your Authorization Requests (${userRequests.length})</h3>
        <button onclick="nftCollection.loadTabContent('requests')" class="btn btn-secondary btn-sm">
        🔄 Refresh
        </button>
        </div>
        <div class="requests-list">
        ${requestsHTML}
        </div>
        `;
    }

    renderUserRequestCard(request) {
        return `
        <div class="request-card user-request">
        <div class="request-header">
        <div class="request-info">
        <h4>Authorization Request</h4>
        <p>Requested Role: ${request.requested_role}</p>
        </div>
        <div class="request-status">
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        </div>

        <div class="request-details">
        <p><strong>Message:</strong> ${request.message}</p>
        <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
        ${request.admin_notes ? `<p><strong>Admin Notes:</strong> ${request.admin_notes}</p>` : ''}
        </div>

        <div class="request-actions">
        ${request.status === 'pending' ? `
            <button onclick="requests.cancelRequest('${request.request_id}')" class="btn btn-error btn-sm">
            Cancel Request
            </button>` : ''}
            </div>
            </div>
            `;
    }

    // =============== ADMIN METHODS ===============

    async loadRequests() {
        if (!this.isAdmin) return;

        const container = document.getElementById('admin-requests-list');
        if (!container) return;

        try {
            console.log('Loading admin requests...');
            container.innerHTML = '<div class="loading">Loading admin requests...</div>';

            // ИСПРАВЛЕНО: используем ТОЛЬКО requests manager, убираем дублирование
            if (window.requests && requests.initialized && requests.adminMode) {
                this.requests = await requests.loadAllRequests();
            } else {
                // Fallback: загружаем только обычные запросы БЕЗ дублирования DKG
                const response = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.REQUESTS}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.requests = data.requests || [];
                }
            }

            console.log(`Loaded ${this.requests.length} admin requests`);
            this.renderRequestsList();

        } catch (error) {
            console.error('Failed to load admin requests:', error);
            container.innerHTML = `
            <div class="error-state">
            <h3>Error Loading Admin Requests</h3>
            <p>${error.message}</p>
            <button onclick="nftCollection.loadRequests()" class="btn btn-secondary">
            Try Again
            </button>
            </div>
            `;
        }
    }

    renderRequestsList() {
        const container = document.getElementById('admin-requests-list');
        if (!container) return;

        if (!this.isAdmin) {
            container.innerHTML = `
            <div class="access-denied">
            <div class="access-icon">🚫</div>
            <h3>Admin Access Required</h3>
            <p>You need administrator privileges to view this panel.</p>
            </div>
            `;
            return;
        }

        console.log('Total requests loaded:', this.requests.length);
        console.log('Request statuses:', this.requests.map(r => r.status));

        // ИСПРАВЛЕНО: убираем дублирование по request_id
        const uniqueRequests = [];
        const seenIds = new Set();

        for (const request of this.requests) {
            if (!seenIds.has(request.request_id)) {
                seenIds.add(request.request_id);
                uniqueRequests.push(request);
            }
        }

        const pendingRequests = uniqueRequests.filter(r => r.status === 'pending');
        console.log('Unique requests:', uniqueRequests.length);
        console.log('Filtered pending requests:', pendingRequests.length);

        if (pendingRequests.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>No Pending Requests Found</h3>
            <p>Total requests loaded: ${uniqueRequests.length}</p>
            <button onclick="nftCollection.loadRequests()" class="btn btn-secondary">
            🔄 Refresh
            </button>
            </div>
            `;
            return;
        }

        const requestsHTML = pendingRequests.map(request => this.renderAdminRequestCard(request)).join('');

        container.innerHTML = `
        <div class="admin-header">
        <h2>Admin Panel - Pending Requests</h2>
        <div class="admin-stats">
        <span class="stat-item">
        <strong>${pendingRequests.length}</strong> Pending
        </span>
        <span class="stat-item">
        <strong>${uniqueRequests.length}</strong> Total
        </span>
        </div>
        <button onclick="nftCollection.loadRequests()" class="btn btn-secondary btn-sm">
        🔄 Refresh
        </button>
        </div>
        <div class="requests-container">
        ${requestsHTML}
        </div>
        `;
    }

    renderAdminRequestCard(request) {
        // Check if this is a DKG request
        if (request.request_type === 'dkg_group_pool_manager' || request.is_group_request) {
            return this.renderDKGRequestCard(request);
        }

        // Regular request rendering
        return `
        <div class="request-card admin-request" data-request-id="${request.request_id}">
        <div class="request-header">
        <div class="request-info">
        <h4>Authorization Request</h4>
        <p><strong>From:</strong> ${wallet.formatAddress(request.user_address || request.requester_address)}</p>
        <p><strong>Requested Role:</strong> ${request.requested_role || 'N/A'}</p>
        </div>
        <div class="request-status">
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        </div>

        <div class="request-details">
        <p><strong>Message:</strong> ${request.message}</p>
        <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
        ${request.target_pool_id && request.target_pool_id !== 'platform_access' ?
            `<p><strong>Pool:</strong> ${request.target_pool_id}</p>` : ''}
            </div>

            <div class="admin-actions">
            <button onclick="nftCollection.approveRequest('${request.request_id}')" class="btn btn-success btn-sm">
            ✅ Approve & Mint NFT
            </button>
            <button onclick="nftCollection.rejectRequest('${request.request_id}')" class="btn btn-error btn-sm">
            ❌ Reject
            </button>
            </div>

            <div class="admin-notes-section">
            <textarea id="admin-notes-${request.request_id}" placeholder="Optional admin notes..." class="admin-notes-input"></textarea>
            </div>
            </div>
            `;
    }

    renderDKGRequestCard(request) {
        return `
        <div class="request-card dkg-request" data-request-id="${request.request_id}">
        <div class="request-header">
        <div class="request-info">
        <h4>DKG Group Authorization</h4>
        <p><strong>Session ID:</strong> ${request.session_id}</p>
        <p><strong>From:</strong> ${wallet.formatAddress(request.requester_address)}</p>
        <p><strong>Requested Role:</strong> Pool Manager (Group)</p>
        </div>
        <div class="request-status">
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        </div>

        <div class="request-details">
        <p><strong>Message:</strong> ${request.message}</p>
        <p><strong>Participants:</strong> ${request.participants.length} addresses</p>
        <p><strong>Threshold:</strong> ${request.threshold}</p>
        <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
        <div class="participants-list">
        <strong>Participants:</strong>
        ${request.participants.slice(0, 3).map(addr => `<span class="participant-addr">${wallet.formatAddress(addr)}</span>`).join(' ')}
        ${request.participants.length > 3 ? ` <span class="more-participants">+${request.participants.length - 3} more</span>` : ''}
        </div>
        </div>

        <div class="admin-actions">
        <button onclick="nftCollection.approveDKGRequest('${request.request_id}')" class="btn btn-success btn-sm">
        ✅ Approve All Participants
        </button>
        <button onclick="nftCollection.rejectDKGRequest('${request.request_id}')" class="btn btn-error btn-sm">
        ❌ Reject Group Request
        </button>
        </div>

        <div class="admin-notes-section">
        <textarea id="admin-notes-${request.request_id}" placeholder="Optional admin notes..." class="admin-notes-input"></textarea>
        </div>
        </div>
        `;
    }

    async approveDKGRequest(requestId) {
        try {
            const adminNotes = document.getElementById(`admin-notes-${requestId}`)?.value || '';

            app.showLoading('Approving DKG group request and granting Pool Manager roles...');

            // Use requests manager for DKG approval
            if (window.requests && requests.approveDKGRequest) {
                const success = await requests.approveDKGRequest(requestId, adminNotes);

                if (success) {
                    app.hideLoading();
                    app.showNotification('success', 'DKG group request approved and Pool Manager roles granted');
                    await this.loadRequests();
                } else {
                    app.hideLoading();
                    app.showNotification('error', 'Failed to approve DKG request');
                }
            } else {
                throw new Error('DKG request system not available');
            }

        } catch (error) {
            app.hideLoading();
            console.error('Failed to approve DKG request:', error);
            app.showNotification('error', `Failed to approve DKG request: ${error.message}`);
        }
    }

    async rejectDKGRequest(requestId) {
        try {
            const adminNotes = document.getElementById(`admin-notes-${requestId}`)?.value || 'DKG group request rejected by admin';

            if (window.requests && requests.rejectDKGRequest) {
                const success = await requests.rejectDKGRequest(requestId, adminNotes);

                if (success) {
                    app.showNotification('info', 'DKG group request rejected');
                    await this.loadRequests();
                } else {
                    app.showNotification('error', 'Failed to reject DKG request');
                }
            } else {
                throw new Error('DKG request system not available');
            }

        } catch (error) {
            console.error('Failed to reject DKG request:', error);
            app.showNotification('error', `Failed to reject DKG request: ${error.message}`);
        }
    }

    // Добавить эти методы в nft-collection.js после rejectDKGRequest()

    async approveRequest(requestId) {
        try {
            const adminNotes = document.getElementById(`admin-notes-${requestId}`)?.value || '';

            app.showLoading('Approving request and minting NFT...');

            // Use requests manager for approval
            if (window.requests && requests.approveRequest) {
                const success = await requests.approveRequest(requestId, adminNotes);

                if (success) {
                    app.hideLoading();
                    app.showNotification('success', 'Request approved and NFT minted');
                    await this.loadRequests();
                } else {
                    app.hideLoading();
                    app.showNotification('error', 'Failed to approve request');
                }
            } else {
                throw new Error('Request system not available');
            }

        } catch (error) {
            app.hideLoading();
            console.error('Failed to approve request:', error);
            app.showNotification('error', `Failed to approve request: ${error.message}`);
        }
    }

    async rejectRequest(requestId) {
        try {
            const adminNotes = document.getElementById(`admin-notes-${requestId}`)?.value || 'Request rejected by admin';

            if (window.requests && requests.rejectRequest) {
                const success = await requests.rejectRequest(requestId, adminNotes);

                if (success) {
                    app.showNotification('info', 'Request rejected');
                    await this.loadRequests();
                } else {
                    app.showNotification('error', 'Failed to reject request');
                }
            } else {
                throw new Error('Request system not available');
            }

        } catch (error) {
            console.error('Failed to reject request:', error);
            app.showNotification('error', `Failed to reject request: ${error.message}`);
        }
    }

    // =============== PUBLIC METHODS ===============

    async refreshAll() {
        await this.loadUserNFTs();
        this.loadTabContent(this.currentTab);
    }

    enableAdminMode() {
        this.isAdmin = true;
        this.buildNFTInterface(); // Пересоздаем интерфейс с админской вкладкой
    }

    // =============== CLEANUP ===============

    destroy() {
        this.initialized = false;
    }
}

// Создаем глобальный экземпляр
window.nftCollection = new NFTCollectionManager();
