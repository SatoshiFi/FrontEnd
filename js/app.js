// js/app.js - ПОЛНАЯ ВЕРСИЯ С ИНТЕГРИРОВАННЫМ AppUIManager И ПРАВИЛЬНОЙ ИНИЦИАЛИЗАЦИЕЙ

// ========== APP UI MANAGER MODULE ==========

class AppUIManager {
    constructor(app) {
        this.app = app;
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        this.setupUIEventHandlers();
        this.setupModalManagement();
        this.setupViewControls();
        this.setupTabSystem();
        this.initialized = true;

        console.log('AppUIManager initialized');
    }

    // ========== MOBILE MENU MANAGEMENT ==========

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('mobile-open');
        }
    }

    hideMobileNotice() {
        const notice = document.getElementById('metamaskMobileNotice');
        if (notice) {
            notice.style.display = 'none';
        }
    }

    // ========== AUTO HIDE MOBILE NOTICE ==========

    setupMobileNoticeAutoHide() {
        if (!/Mobi|Android/i.test(navigator.userAgent)) {
            this.hideMobileNotice();
        }
    }

    // ========== TAB SYSTEM MANAGEMENT ==========

    setupTabSystem() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMainTab(e.target.dataset.tab);
            });
        });

        document.querySelectorAll('.request-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchRequestTab(e.target.dataset.tab);
            });
        });
    }

    switchMainTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
        const selectedContent = document.getElementById(`${tabId}-tab`);

        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');

        this.onTabChanged(tabId);
    }

    switchRequestTab(tabId) {
        document.querySelectorAll('.request-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.request-content').forEach(content => {
            content.classList.remove('active');
        });

        const selectedTab = document.querySelector(`[data-tab="${tabId}"].request-tab-btn`);
        const selectedContent = document.getElementById(`${tabId}Requests`);

        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');

        this.loadRequestTabContent(tabId);
    }

    onTabChanged(tabId) {
        switch (tabId) {
            case 'overview':
                if (window.nftCollection) {
                    nftCollection.loadOverviewStats();
                }
                break;
            case 'my-pools':
                if (window.nftCollection) {
                    nftCollection.loadUserPools();
                }
                break;
            case 'roles-nft':
                if (window.nftCollection) {
                    nftCollection.loadRolesAndNFTs();
                }
                break;
            case 'requests':
                if (window.nftCollection) {
                    nftCollection.loadRequests();
                }
                break;
        }
    }

    loadRequestTabContent(tabId) {
        if (!window.nftCollection) return;

        switch (tabId) {
            case 'incoming':
                nftCollection.loadIncomingRequests();
                break;
            case 'outgoing':
                nftCollection.loadOutgoingRequests();
                break;
            case 'history':
                nftCollection.loadRequestHistory();
                break;
        }
    }

    // ========== VIEW CONTROLS ==========

    setupViewControls() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });
    }

    switchView(viewType) {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const selectedBtn = document.querySelector(`[data-view="${viewType}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        const grids = document.querySelectorAll('.pools-grid, .nft-grid, .roles-grid');
        grids.forEach(grid => {
            grid.className = grid.className.replace(/view-\w+/, '');
            grid.classList.add(`view-${viewType}`);
        });
    }

    // ========== MODAL MANAGEMENT ==========

    setupModalManagement() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal(e.target);
            }
            if (e.target.classList.contains('modal-close')) {
                this.closeModal(e.target.closest('.modal-overlay'));
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    this.closeModal(modal);
                }
            }
        });
    }

    closeModal(modal) {
        if (modal) {
            modal.remove();
        }
    }

    // ========== DASHBOARD REFRESH ==========

    setupDashboardRefresh() {
        document.getElementById('refreshDashboard')?.addEventListener('click', () => {
            this.refreshDashboard();
        });
    }

    async refreshDashboard() {
        if (window.dashboard && dashboard.refreshDashboard) {
            await dashboard.refreshDashboard();
            this.app.showNotification('success', 'Dashboard refreshed');
        }
    }

    // ========== UI EVENT HANDLERS ==========

    setupUIEventHandlers() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupMobileNoticeAutoHide();
            this.setupDashboardRefresh();
        });
    }

    // ========== INITIALIZATION AND DIAGNOSTICS ==========

    setupInitializationDiagnostics() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.runSystemDiagnostic();
            }, 3000);
        });
    }

    runSystemDiagnostic() {
        console.log('=== SYSTEM DIAGNOSTIC AFTER 3 SECONDS ===');

        if (window.wallet) {
            console.log('Wallet Status:', wallet.getConnectionInfo());
        }

        if (window.userRoles && wallet.connected) {
            console.log('Authorization Status:', {
                isAuthorized: userRoles.isUserAuthorized(),
                        authStatus: userRoles.authorizationStatus,
                        roles: userRoles.currentRoles,
                        nftCount: userRoles.nftData?.length || 0,
                        pendingRequests: userRoles.pendingRequests?.length || 0
            });
        }

        if (window.contracts) {
            console.log('Contracts initialized:', contracts.initialized);
        }

        console.log('=== END DIAGNOSTIC ===');
    }

    checkCriticalComponents() {
        const criticalComponents = {
            'Wallet Manager': !!window.wallet,
            'Contracts Manager': !!window.contracts,
            'User Roles Manager': !!window.userRoles,
            'Request Manager': !!window.requests,
            'NFT Collection': !!window.nftCollection,
            'Dashboard': !!window.dashboard,
            'App': !!window.app
        };

        console.log('Critical components status:', criticalComponents);

        const missingComponents = Object.entries(criticalComponents)
        .filter(([name, available]) => !available)
        .map(([name]) => name);

        if (missingComponents.length > 0) {
            console.error('Missing critical components:', missingComponents);

            if (this.app && this.app.showNotification) {
                this.app.showNotification('error', `Missing components: ${missingComponents.join(', ')}`);
            }
        } else {
            console.log('✅ All critical components loaded successfully');
        }
    }

    // ========== AUTO WALLET CONNECTION ==========

    setupAutoWalletConnection() {
        setTimeout(() => {
            if (window.ethereum && window.ethereum.selectedAddress && window.wallet) {
                console.log('Auto-connecting wallet...');
                wallet.connect().catch(error => {
                    console.log('Auto-connect failed:', error.message);
                });
            }
        }, 1000);
    }

    // ========== CLEANUP ==========

    destroy() {
        document.removeEventListener('DOMContentLoaded', this.setupUIEventHandlers);
        window.removeEventListener('load', this.setupInitializationDiagnostics);

        console.log('AppUIManager destroyed');
    }
}

// ========== MAIN SATOSHIFI APPLICATION CLASS ==========

class SatoshiFiApp {
    constructor() {
        this.initialized = false;
        this.currentSection = 'dashboard';
        this.sectionInitializers = {};
        this.authCheckInterval = null;
        this.initializedSections = new Set();
        this.isInitializing = false;
        this.uiManager = new AppUIManager(this);
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.log('Initializing SatoshiFi App with NFT Authorization...');

            this.uiManager.initialize();
            window.appUI = this.uiManager;

            // Initialize Bitcoin Address Codec
            if (window.bitcoinAddressCodec) {
                try {
                    bitcoinAddressCodec.initialize();
                    console.log('✅ BitcoinAddressCodec initialized for network:', CONFIG.BITCOIN.NETWORK);
                } catch (error) {
                    console.error('❌ BitcoinAddressCodec initialization failed:', error);
                    this.showNotification('warning', 'Bitcoin address codec unavailable');
                }
            } else {
                console.warn('⚠️ BitcoinAddressCodec module not loaded');
            }

            this.setupEventListeners();
            this.setupUI();
            this.setupAuthorizationSystem();

            if (window.ethereum && window.ethereum.selectedAddress) {
                await this.autoConnect();
            } else {
                this.showUnconnectedState();
            }

            this.checkModulesLoaded();

            this.initialized = true;
            console.log('SatoshiFi App initialized successfully with authorization system');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showNotification('error', 'Application initialization error');
        }
    }

    setupAuthorizationSystem() {
        console.log('Setting up authorization system...');

        if (window.userRoles) {
            this.authCheckInterval = setInterval(async () => {
                if (wallet.connected && userRoles.isUserAuthorized()) {
                    await this.checkForNFTUpdates();
                }
            }, 30000);
        }
    }

    async checkForNFTUpdates() {
        try {
            if (!wallet.connected) return;

            const previousAuthStatus = userRoles.isUserAuthorized();
            const previousRoles = [...userRoles.currentRoles];

            const currentAuthStatus = userRoles.isUserAuthorized();
            const currentRoles = userRoles.currentRoles;

            if (previousAuthStatus !== currentAuthStatus) {
                console.log('Authorization status changed:', previousAuthStatus, '->', currentAuthStatus);

                if (currentAuthStatus) {
                    this.onAuthorizationGranted();
                } else {
                    this.onAuthorizationRevoked();
                }
            }

            if (JSON.stringify(previousRoles) !== JSON.stringify(currentRoles)) {
                console.log('User roles changed:', previousRoles, '->', currentRoles);
                this.onRolesChanged(currentRoles);
            }

        } catch (error) {
            console.error('Error checking NFT updates:', error);
        }
    }

    onAuthorizationGranted() {
        console.log('User authorization granted!');
        this.showNotification('success', 'Authorization granted! You now have full access to the platform.');
        this.updateAuthorizationUI();
        this.buildSidebar();

        if (window.dashboard) {
            dashboard.initialize();
        }

        this.updateUserProfile();
        this.sectionInitializers = {};
    }

    onAuthorizationRevoked() {
        console.log('User authorization revoked');
        this.showNotification('warning', 'Your authorization has been revoked. Access to some features is now restricted.');
        this.updateAuthorizationUI();
        this.buildSidebar();

        if (window.dashboard) {
            dashboard.initialize();
        }
    }

    onRolesChanged(newRoles) {
        console.log('User roles updated:', newRoles);
        userRoles.applyRoleBasedUI();
        this.buildSidebar();
        this.updateUserProfile();

        const roleNames = newRoles.map(role => CONFIG.USER_ROLES[role]?.name || role).join(', ');
        this.showNotification('info', `Your roles have been updated: ${roleNames}`);
    }

    setupEventListeners() {
        document.getElementById('connectWallet')?.addEventListener('click', () => {
            this.connectWallet();
        });

        document.getElementById('disconnectWallet')?.addEventListener('click', () => {
            this.disconnectWallet();
        });

        document.addEventListener('authorizationChanged', (event) => {
            console.log('Authorization changed event:', event.detail);
            this.handleAuthorizationChange(event.detail);
        });

        if (window.wallet) {
            wallet.on('connected', (data) => {
                this.onWalletConnected(data);
            });

            wallet.on('disconnected', () => {
                this.onWalletDisconnected();
            });

            wallet.on('accountChanged', (account) => {
                this.onAccountChanged(account);
            });
        }
    }

    setupUI() {
        this.updateWalletUI();
        this.updateAuthorizationUI();
        this.buildSidebar();
        this.showSection('dashboard');
    }

    updateAuthorizationUI() {
        const authElements = document.querySelectorAll('[data-auth-status]');

        authElements.forEach(element => {
            const requiredStatus = element.getAttribute('data-auth-status');

            if (wallet.connected && userRoles) {
                const currentStatus = userRoles.authorizationStatus;
                const isAuthorized = userRoles.isUserAuthorized();

                switch (requiredStatus) {
                    case 'authorized':
                        element.style.display = isAuthorized ? '' : 'none';
                        break;
                    case 'unauthorized':
                        element.style.display = !isAuthorized ? '' : 'none';
                        break;
                    case 'pending':
                        element.style.display = currentStatus === 'pending' ? '' : 'none';
                        break;
                    case 'any':
                        element.style.display = wallet.connected ? '' : 'none';
                        break;
                    default:
                        element.style.display = '';
                }
            } else {
                element.style.display = requiredStatus === 'disconnected' ? '' : 'none';
            }
        });

        this.updateAuthorizationMessages();
    }

    updateAuthorizationMessages() {
        const messageContainer = document.getElementById('authorizationMessage');

        if (messageContainer && wallet.connected && userRoles) {
            const message = userRoles.getAuthorizationMessage();
            const actions = userRoles.getRequiredActionsForUser();

            let html = `<div class="auth-message ${userRoles.authorizationStatus}">
            <p>${message}</p>`;

            if (actions.length > 0) {
                html += '<div class="auth-actions">';
                actions.forEach(action => {
                    switch (action.action) {
                        case 'request_access':
                            html += `<button class="btn btn-primary" onclick="app.showAccessRequestModal()">
                            ${action.title}
                            </button>`;
                            break;
                        case 'create_pool':
                            html += `<button class="btn btn-secondary" onclick="showSection('poolCreation')">
                            ${action.title}
                            </button>`;
                            break;
                    }
                });
                html += '</div>';
            }

            html += '</div>';
            messageContainer.innerHTML = html;
        }
    }

    showUnconnectedState() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const sections = mainContent.querySelectorAll('.content-section');
            sections.forEach(section => {
                if (section.id !== 'dashboard') {
                    section.style.display = 'none';
                }
            });
        }

        if (window.dashboard) {
            dashboard.buildDashboard();
        }
    }

    async connectWallet() {
        try {
            this.showLoading('Connecting to wallet...');
            const data = await wallet.connect();
            this.hideLoading();
            this.showNotification('success', 'Wallet connected successfully');
        } catch (error) {
            this.hideLoading();
            this.showNotification('error', `Connection error: ${error.message}`);
        }
    }

    async autoConnect() {
        try {
            const data = await wallet.connect();
            console.log('Auto-connected to wallet');
        } catch (error) {
            console.log('Auto-connect failed:', error.message);
        }
    }

    async disconnectWallet() {
        await wallet.disconnect();
        this.showNotification('info', 'Wallet disconnected');
    }

    async onWalletConnected(data) {
        console.log('Wallet connected, checking authorization...');

        this.updateWalletUI();

        await this.checkUserAuthorization(data.account);
        await this.checkAndShowAdminPanel();

        if (window.requests) {
            await requests.initialize();
        }

        this.updateUserProfile();
        this.updateAuthorizationUI();
        this.buildSidebar();

        await dashboard.initialize();
    }

    async checkUserAuthorization(account) {
        try {
            console.log('Checking user authorization for:', account);

            await userRoles.detectUserRoles(account);
            userRoles.applyRoleBasedUI();

            console.log('Authorization check completed:', {
                isAuthorized: userRoles.isUserAuthorized(),
                        authStatus: userRoles.authorizationStatus,
                        roles: userRoles.currentRoles
            });

        } catch (error) {
            console.error('Error checking user authorization:', error);
        }
    }

    async checkAndShowAdminPanel() {
        if (!wallet.connected || !window.contracts) return;

        try {
            console.log('Checking admin rights for:', wallet.account);

            const adminRights = await contracts.checkAdminRights(wallet.account);

            console.log('Admin rights check result:', adminRights);

            if (adminRights.hasAdminRights || adminRights.isAdmin || adminRights.isPoolManager) {
                console.log('User has admin rights, enabling admin features');
                this.enableAdminFeatures();
            } else {
                console.log('User does not have admin rights');
            }
        } catch (error) {
            console.error('Error checking admin rights:', error);
        }
    }

    enableAdminFeatures() {
        console.log('Enabling admin features...');

        document.body.classList.add('admin-user');

        if (window.requests) {
            requests.adminMode = true;
            console.log('Requests admin mode enabled');
        }

        if (window.nftCollection) {
            nftCollection.isAdmin = true;
            nftCollection.enableAdminMode();
            console.log('NFT Collection admin mode enabled');
        }

        this.showNotification('info', 'Admin features enabled');
    }

    onWalletDisconnected() {
        this.updateWalletUI();
        this.resetUserProfile();
        this.updateAuthorizationUI();

        if (dashboard.destroy) {
            dashboard.destroy();
        }

        document.body.className = document.body.className
        .replace(/role-\w+/g, '')
        .replace(/auth-\w+/g, '')
        .replace(/admin-user/g, '')
        .trim();

        this.sectionInitializers = {};
        this.showUnconnectedState();
    }

    async onAccountChanged(account) {
        console.log('Account changed to:', account);

        await this.checkUserAuthorization(account.newAccount);
        await this.checkAndShowAdminPanel();

        this.updateUserProfile();
        this.updateWalletUI();
        this.updateAuthorizationUI();

        await dashboard.initialize();

        this.sectionInitializers = {};
    }

    updateWalletUI() {
        const walletStatus = document.getElementById('walletStatus');
        const accountInfo = document.getElementById('accountInfo');
        const connectBtn = document.getElementById('connectWallet');
        const accountAddress = document.getElementById('accountAddress');
        const accountBalance = document.getElementById('accountBalance');
        const accountAvatar = document.getElementById('accountAvatar');

        if (wallet.connected) {
            walletStatus?.classList.remove('disconnected');
            walletStatus?.classList.add('connected');
            connectBtn?.classList.add('hidden');
            accountInfo?.classList.remove('hidden');

            if (accountAddress) accountAddress.textContent = wallet.formatAddress(wallet.account);
            if (accountBalance) accountBalance.textContent = `${wallet.formatBalance(wallet.balance)} ETH`;
            if (accountAvatar) accountAvatar.textContent = wallet.generateAvatar(wallet.account);
        } else {
            walletStatus?.classList.remove('connected');
            walletStatus?.classList.add('disconnected');
            connectBtn?.classList.remove('hidden');
            accountInfo?.classList.add('hidden');
        }
    }

    updateUserProfile() {
        const userProfileContainer = document.getElementById('userProfile');
        if (!userProfileContainer || !wallet.connected) {
            if (userProfileContainer) {
                userProfileContainer.innerHTML = `
                <div class="connect-prompt">
                <p>Connect wallet to get started</p>
                </div>
                `;
            }
            return;
        }

        const profile = userRoles.userProfile;
        const primaryRole = CONFIG.USER_ROLES[profile.primaryRole];
        const authStatus = userRoles.authorizationStatus;

        let statusBadge = '';
        switch (authStatus) {
            case 'authorized':
                statusBadge = '<span class="auth-badge authorized">Authorized</span>';
                break;
            case 'pending':
                statusBadge = '<span class="auth-badge pending">Pending</span>';
                break;
            case 'unauthorized':
                statusBadge = '<span class="auth-badge unauthorized">Unauthorized</span>';
                break;
            default:
                statusBadge = '<span class="auth-badge checking">Checking...</span>';
        }

        userProfileContainer.innerHTML = `
        <div class="user-avatar" style="background: ${primaryRole.primaryColor}">
        ${profile.avatar}
        </div>
        <div class="user-info">
        <div class="user-name">${profile.displayName}</div>
        ${statusBadge}
        <div class="user-roles">
        ${profile.roles.map(roleId => {
            const role = CONFIG.USER_ROLES[roleId];
            return `<span class="role-badge role-badge-${roleId.toLowerCase().replace('_', '-')}">${role.name}</span>`;
        }).join('')}
        </div>
        <div class="user-stats">
        <small>${profile.stats.poolsJoined} pools • ${profile.stats.nftsOwned} NFT</small>
        </div>
        </div>
        `;
    }

    resetUserProfile() {
        const userProfileContainer = document.getElementById('userProfile');
        if (userProfileContainer) {
            userProfileContainer.innerHTML = `
            <div class="connect-prompt">
            <p>Connect wallet to get started</p>
            </div>
            `;
        }
    }

    buildSidebar() {
        const sidebarNav = document.getElementById('sidebarNav');
        if (!sidebarNav) return;

        const sections = wallet.connected ? userRoles.getSidebarSections() : ['dashboard'];
        const isAuthorized = wallet.connected ? userRoles.isUserAuthorized() : false;

        const navigationItems = [
            {
                id: 'dashboard',
                name: 'Dashboard',
                icon: '📊',
                show: true
            },
            {
                id: 'dkgManagement',
                name: 'DKG Management',
                icon: '🔐',
                show: sections.includes('dkgManagement') && isAuthorized,
                authRequired: true
            },
            {
                id: 'poolCreation',
                name: 'Create Pool',
                icon: '➕',
                show: sections.includes('poolCreation') && isAuthorized,
                authRequired: true
            },
            {
                id: 'poolManagement',
                name: 'Pool Management',
                icon: '⚙️',
                show: isAuthorized,
                authRequired: false
            },
            {
                id: 'myWorkers',
                name: 'My Workers',
                icon: '🔧',
                show: isAuthorized,
                authRequired: false
            },
            {
                id: 'miningDashboard',
                name: 'Mining',
                icon: '⛏️',
                show: sections.includes('miningDashboard') && isAuthorized,
                authRequired: true
            },
            {
                id: 'nftCollection',
                name: 'My Status',
                icon: '🅰️',
                show: sections.includes('nftCollection')
            },
            {
                id: 'settings',
                name: 'Settings',
                icon: '🔧',
                show: sections.includes('settings')
            }
        ];

        sidebarNav.innerHTML = navigationItems
        .filter(item => item.show)
        .map(item => {
            const isRestricted = item.authRequired && !isAuthorized;
            return `
            <div class="nav-item ${isRestricted ? 'restricted' : ''}">
            <a href="#"
            class="nav-link ${isRestricted ? 'disabled' : ''}"
            data-section="${item.id}"
            onclick="${isRestricted ? 'app.showAuthorizationRequired()' : `showSection('${item.id}')`}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-text">${item.name}</span>
            ${isRestricted ? '<span class="lock-icon">🔒</span>' : ''}
            </a>
            </div>
            `;
        }).join('');
    }

    showAuthorizationRequired() {
        if (!wallet.connected) {
            this.showNotification('warning', 'Please connect your wallet first');
            return;
        }

        if (userRoles.authorizationStatus === 'pending') {
            this.showNotification('info', 'Your access request is pending approval');
        } else {
            this.showAccessRequestModal();
        }
    }

    showAccessRequestModal() {
        if (!wallet.connected) {
            this.showNotification('warning', 'Please connect your wallet first');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content access-request-modal">
        <div class="modal-header">
        <h3>Request Platform Access</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="access-request-info">
        <p>To access all platform features, you need to request authorization from administrators.</p>
        <p><strong>Your wallet:</strong> ${wallet.formatAddress(wallet.account)}</p>
        </div>
        <div class="form-group">
        <label class="form-label">Requested Role</label>
        <select id="requestedRole" class="form-select">
        <option value="user">User (Basic access)</option>
        <option value="miner">Miner (Mining access)</option>
        <option value="custodial">Custodial (Requires approval)</option>
        </select>
        </div>
        <div class="form-group">
        <label class="form-label">Message to Administrators</label>
        <textarea id="requestMessage" class="form-input" rows="4"
        placeholder="Please explain why you need access to the platform..."></textarea>
        </div>
        </div>
        <div class="modal-actions">
        <button id="submitAccessRequest" class="btn btn-primary">Submit Request</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">Cancel</button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('submitAccessRequest').addEventListener('click', () => {
            this.submitAccessRequest(modal);
        });
    }

    async submitAccessRequest(modal) {
        try {
            const role = document.getElementById('requestedRole').value;
            const message = document.getElementById('requestMessage').value;

            if (!message.trim()) {
                this.showNotification('warning', 'Please provide a message explaining your request');
                return;
            }

            if (window.requests) {
                await requests.initialize();
                const success = await requests.submitMembershipRequest(
                    'platform_access',
                    '0x0000000000000000000000000000000000000000',
                    role,
                    message
                );

                if (success) {
                    modal.remove();
                    userRoles.authorizationStatus = 'pending';
                    this.updateAuthorizationUI();
                    this.showNotification('success', 'Access request submitted successfully! Please wait for administrator approval.');
                } else {
                    this.showNotification('error', 'Failed to submit access request. Please try again.');
                }
            } else {
                this.showNotification('error', 'Request system not available. Please try again later.');
            }

        } catch (error) {
            console.error('Error submitting access request:', error);
            this.showNotification('error', `Failed to submit request: ${error.message}`);
        }
    }

    // =============== SECTION MANAGEMENT ===============

    async showSection(sectionId) {
        if (this.isInitializing) {
            console.warn('Section initialization already in progress');
            return;
        }

        try {
            this.isInitializing = true;
            console.log(`Switching to section: ${sectionId}`);

            if (!this.canAccessSection(sectionId)) {
                this.showAuthorizationRequired();
                return;
            }

            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });

            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });

            const activeNavLink = document.querySelector(`[data-section="${sectionId}"]`);
            if (activeNavLink) {
                activeNavLink.classList.add('active');
            }

            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            await this.initializeSection(sectionId);

            this.currentSection = sectionId;

            if (history.pushState) {
                history.pushState(null, null, `#${sectionId}`);
            }

        } catch (error) {
            console.error(`Failed to show section ${sectionId}:`, error);
            this.showSectionError(sectionId, error);
        } finally {
            this.isInitializing = false;
        }
    }

    canAccessSection(sectionId) {
        const publicSections = ['dashboard', 'nftCollection', 'settings'];
        if (publicSections.includes(sectionId)) {
            return true;
        }

        return wallet.connected && userRoles.isUserAuthorized();
    }

    async initializeSection(sectionId) {
        if (this.initializedSections.has(sectionId)) {
            console.log(`Section ${sectionId} already initialized`);
            return;
        }

        console.log(`Initializing section: ${sectionId}`);

        try {
            switch (sectionId) {
                case 'dashboard':
                    if (wallet.connected) {
                        await dashboard.initialize();
                    }
                    break;

                case 'poolCreation':
                    if (window.poolCreator && userRoles.isUserAuthorized()) {
                        await poolCreator.initialize();
                    } else if (!userRoles.isUserAuthorized()) {
                        this.showSectionAuthRequired(sectionId);
                    }
                    break;

                case 'dkgManagement':
                    if (window.dkgManager && userRoles.isUserAuthorized()) {
                        await dkgManager.initialize();
                    } else if (!userRoles.isUserAuthorized()) {
                        this.showSectionAuthRequired(sectionId);
                    }
                    break;

                case 'poolManagement':
                    if (window.poolManager && userRoles.isUserAuthorized()) {
                        console.log('Initializing poolManager...');
                        await poolManager.initialize();
                    } else if (!userRoles.isUserAuthorized()) {
                        this.showSectionAuthRequired(sectionId);
                    } else {
                        console.error('poolManager not available - check if pool-manager.js is loaded');
                        this.showPoolManagementError();
                    }
                    break;

                case 'myWorkers':
                    if (window.poolManager && userRoles.isUserAuthorized()) {
                        console.log('Initializing My Workers section...');
                        await poolManager.initializeMyWorkersSection();
                    } else if (!userRoles.isUserAuthorized()) {
                        this.showSectionAuthRequired(sectionId);
                    }
                    break;

                case 'miningDashboard':
                    if (window.miningDashboard && userRoles.isUserAuthorized()) {
                        await miningDashboard.initialize();
                    } else if (!userRoles.isUserAuthorized()) {
                        this.showSectionAuthRequired(sectionId);
                    }
                    break;

                case 'nftCollection':
                    if (window.nftCollection) {
                        await nftCollection.initialize();
                    } else {
                        console.warn('nftCollection not available');
                    }
                    break;

                case 'settings':
                    if (window.settings) {
                        await settings.initialize();
                    } else {
                        console.warn('settings not available');
                    }
                    break;
            }

            this.initializedSections.add(sectionId);

        } catch (error) {
            console.error(`Failed to initialize section ${sectionId}:`, error);
            this.showSectionError(sectionId, error);
        }
    }

    showSectionAuthRequired(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const sectionName = {
            'poolCreation': 'Pool Creation',
            'dkgManagement': 'DKG Management',
            'poolManagement': 'Pool Management',
            'myWorkers': 'My Workers',
            'miningDashboard': 'Mining Dashboard'
        }[sectionId] || sectionId;

        section.innerHTML = `
        <div class="auth-required-state">
        <div class="auth-icon">🔒</div>
        <h3>Authorization Required</h3>
        <p>You need platform authorization to access ${sectionName}</p>
        <div class="auth-status">
        <span class="status-badge ${userRoles.authorizationStatus}">
        Status: ${userRoles.authorizationStatus}
        </span>
        </div>
        ${userRoles.authorizationStatus === 'unauthorized' ? `
            <div class="auth-actions">
            <button onclick="app.showAccessRequestModal()" class="btn btn-primary">
            Request Access
            </button>
            </div>
            ` : userRoles.authorizationStatus === 'pending' ? `
            <div class="auth-info">
            <p>Your access request is being reviewed by administrators</p>
            <p>You will be notified once your request is approved</p>
            </div>
            ` : ''}
            </div>
            `;
    }

    // =============== ERROR HANDLING ===============

    showPoolManagementError() {
        const poolsList = document.getElementById('poolsList');
        if (poolsList) {
            poolsList.innerHTML = `
            <div class="error-state">
            <div class="error-icon">⚠️</div>
            <h3>Pool Management unavailable</h3>
            <p>The pool-manager.js module is not loaded or failed to initialize.</p>
            <div class="error-actions">
            <button onclick="location.reload()" class="btn btn-primary">Reload Page</button>
            <button onclick="showSection('dashboard')" class="btn btn-secondary">Return to Dashboard</button>
            </div>
            </div>
            `;
        }
    }

    showSectionError(sectionId, error) {
        const section = document.getElementById(sectionId);
        if (section) {
            const contentArea = section.querySelector('.pools-list, .wizard-content, #dkgManagementContent, #settingsTabs, #miningStats, #nftGrid, #myWorkersContainer')
            || section.querySelector('.section-content')
            || section;

            if (contentArea) {
                contentArea.innerHTML = `
                <div class="error-state">
                <div class="error-icon">❌</div>
                <h3>Error loading ${sectionId}</h3>
                <p>Failed to initialize section</p>
                <small class="error-message">${error.message}</small>
                <div class="error-actions">
                <button onclick="app.reinitializeSection('${sectionId}')" class="btn btn-primary">Try Again</button>
                <button onclick="showSection('dashboard')" class="btn btn-secondary">Return to Dashboard</button>
                </div>
                </div>
                `;
            }
        }
    }

    async reinitializeSection(sectionId) {
        console.log(`Re-initializing section: ${sectionId}`);
        this.initializedSections.delete(sectionId);

        const section = document.getElementById(sectionId);
        const contentArea = section?.querySelector('.pools-list, .wizard-content, #dkgManagementContent, #myWorkersContainer') || section;
        if (contentArea) {
            contentArea.innerHTML = `
            <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Re-initializing ${sectionId}...</p>
            </div>
            `;
        }

        setTimeout(() => {
            this.initializeSection(sectionId);
        }, 500);
    }

    // =============== UTILITY METHODS ===============

    checkModulesLoaded() {
        console.log('=== CHECKING CRITICAL MODULES ===');
        console.log('wallet available:', !!window.wallet);
        console.log('contracts available:', !!window.contracts);
        console.log('bitcoinAddressCodec available:', !!window.bitcoinAddressCodec);
        console.log('poolManager available:', !!window.poolManager);
        console.log('userRoles available:', !!window.userRoles);
        console.log('dashboard available:', !!window.dashboard);
        console.log('dkgManager available:', !!window.dkgManager);
        console.log('poolCreator available:', !!window.poolCreator);
        console.log('requests available:', !!window.requests);
        console.log('nftCollection available:', !!window.nftCollection);

        if (!window.poolManager) {
            console.error('⚠️ poolManager is not available! Check if pool-manager.js is loaded correctly.');
            this.showNotification('error', 'Critical module not loaded: poolManager');
        } else {
            console.log('✅ poolManager is available');
        }

        if (!window.bitcoinAddressCodec) {
            console.warn('⚠️ BitcoinAddressCodec not loaded - Bitcoin address features may not work');
        } else if (!bitcoinAddressCodec.initialized) {
            console.warn('⚠️ BitcoinAddressCodec loaded but not initialized');
        } else {
            console.log('✅ BitcoinAddressCodec ready');
        }
    }

    forceReloadSection(sectionId) {
        console.log(`Force reloading section: ${sectionId}`);
        this.initializedSections.delete(sectionId);
        this.initializeSection(sectionId);
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.querySelector('.loading-text');

        if (text) text.textContent = message;
        if (overlay) overlay.classList.remove('hidden');
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    showNotification(type, message) {
        const container = document.getElementById('notifications');
        if (!container) {
            // FALLBACK: Если контейнер не найден, выводим в консоль
            const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
            console.warn(`[Notification Container Missing] ${emoji} ${type.toUpperCase()}: ${message}`);
            // Показываем через alert как last resort для критичных ошибок
            if (type === 'error') {
                alert(`Error: ${message}`);
            }
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
        <div class="notification-content">
        <span class="notification-icon">
        ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
        </span>
        <span class="notification-text">${message}</span>
        </div>
        `;

        container.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, window.CONFIG?.APP_SETTINGS?.NOTIFICATION_TIMEOUT || 5000);
    }

    // =============== CLEANUP ===============

    destroy() {
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
            this.authCheckInterval = null;
        }

        if (window.contracts) {
            contracts.removeAllListeners();
        }

        if (this.uiManager) {
            this.uiManager.destroy();
        }

        console.log('App destroyed and cleaned up');
    }
}

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========

function toggleMobileMenu() {
    if (window.app && app.uiManager) {
        app.uiManager.toggleMobileMenu();
    }
}

function hideMobileNotice() {
    if (window.app && app.uiManager) {
        app.uiManager.hideMobileNotice();
    }
}

function showSection(sectionId) {
    app.showSection(sectionId);
}

window.toggleMobileMenu = toggleMobileMenu;
window.hideMobileNotice = hideMobileNotice;
window.showSection = showSection;
window.appUI = null;

// ========== APP INITIALIZATION ==========

const app = new SatoshiFiApp();

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== SATOSHIFI AUTHORIZATION SYSTEM INITIALIZING ===');

    setTimeout(() => {
        app.uiManager.checkCriticalComponents();
    }, 500);

    app.initialize();

    app.uiManager.setupAutoWalletConnection();
});

window.addEventListener('load', () => {
    setTimeout(() => {
        console.log('=== AUTHORIZATION DIAGNOSTIC ===');
        console.log('wallet connected:', wallet?.connected);
        console.log('userRoles initialized:', !!window.userRoles);
        console.log('contracts initialized:', contracts?.initialized);
        console.log('requests system:', !!window.requests);

        if (wallet?.connected && window.userRoles) {
            console.log('user authorization status:', userRoles.authorizationStatus);
            console.log('user roles:', userRoles.currentRoles);
            console.log('user NFTs:', userRoles.nftData?.length || 0);
        }

        if (wallet?.connected) {
            app.checkAndShowAdminPanel();
        }
    }, 3000);
});

window.addEventListener('beforeunload', () => {
    if (window.wallet) {
        wallet.destroy();
    }
    if (window.app) {
        app.destroy();
    }
});

window.app = app;
