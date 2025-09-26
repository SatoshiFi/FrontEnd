// js/wallet.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С ПОЛНОЙ МОБИЛЬНОЙ ПОДДЕРЖКОЙ
class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.account = null;
        this.balance = '0';
        this.network = null;
        this.connected = false;
        this.isMobile = this.detectMobileDevice();
        this.isMetaMaskApp = this.detectMetaMaskApp();
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.callbacks = {
            accountChanged: [],
            networkChanged: [],
            connected: [],
            disconnected: [],
            authorizationChanged: []
        };
        this.authorizationCheckInterval = null;
    }

    detectMobileDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = [
            'android', 'webos', 'iphone', 'ipad', 'ipod',
            'blackberry', 'iemobile', 'opera mini', 'mobile'
        ];

        // Проверяем iPad отдельно (может определяться как MacIntel)
        const isIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

        return isIPad || mobileKeywords.some(keyword => userAgent.includes(keyword));
    }

    detectMetaMaskApp() {
        // Проверяем, запущены ли мы в браузере MetaMask
        return window.ethereum && (
            window.ethereum.isMetaMask && (
                window.ethereum._metamask?.isUnlocked !== undefined ||
                navigator.userAgent.includes('MetaMaskMobile')
            )
        );
    }

    async connect() {
        console.log('Starting wallet connection...', {
            isMobile: this.isMobile,
            isMetaMaskApp: this.isMetaMaskApp,
            hasEthereum: !!window.ethereum
        });

        try {
            this.connectionAttempts++;

            // Проверяем доступность MetaMask
            if (!window.ethereum) {
                return await this.handleNoMetaMask();
            }

            // Основная логика подключения
            if (this.isMobile) {
                return await this.connectMobile();
            } else {
                return await this.connectDesktop();
            }

        } catch (error) {
            console.error('Connection failed:', error);

            // Повторная попытка для мобильных устройств
            if (this.isMobile && this.connectionAttempts < this.maxConnectionAttempts) {
                console.log(`Retrying connection (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
                await this.delay(1000);
                return this.connect();
            }

            throw error;
        }
    }

    async handleNoMetaMask() {
        if (this.isMobile) {
            console.log('Mobile device without MetaMask detected');

            // Показываем уведомление пользователю
            this.showMobileMetaMaskPrompt();

            // Пробуем открыть в MetaMask app
            this.openInMetaMaskApp();

            throw new Error('Please open this page in MetaMask mobile app');
        } else {
            throw new Error('MetaMask not installed. Please install MetaMask extension');
        }
    }

    async connectMobile() {
        console.log('Connecting on mobile device...');

        try {
            // Проверяем, что мы в браузере MetaMask
            if (!this.isMetaMaskApp && this.isMobile) {
                console.log('Not in MetaMask app, redirecting...');
                this.openInMetaMaskApp();
                throw new Error('Redirecting to MetaMask app...');
            }

            // Запрашиваем подключение аккаунтов
            const accounts = await this.requestAccounts();

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts returned from MetaMask');
            }

            console.log('Accounts received:', accounts);

            // Инициализируем подключение
            await this.initializeConnection();

            return this.getConnectionInfo();

        } catch (error) {
            console.error('Mobile connection error:', error);

            if (error.code === 4001) {
                throw new Error('Connection rejected by user');
            }

            if (error.code === -32002) {
                throw new Error('Connection request already pending. Please check MetaMask app.');
            }

            throw error;
        }
    }

    async connectDesktop() {
        console.log('Connecting on desktop...');

        try {
            const accounts = await this.requestAccounts();

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts available');
            }

            await this.initializeConnection();
            return this.getConnectionInfo();

        } catch (error) {
            console.error('Desktop connection error:', error);

            if (error.code === 4001) {
                throw new Error('User rejected the connection request');
            }

            throw error;
        }
    }

    async requestAccounts() {
        console.log('Requesting accounts...');

        try {
            // Даем дополнительное время для мобильных устройств
            const timeout = this.isMobile ? 30000 : 10000;

            const accountsPromise = window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), timeout);
            });

            const accounts = await Promise.race([accountsPromise, timeoutPromise]);
            console.log('Accounts received successfully:', accounts);

            return accounts;

        } catch (error) {
            console.error('Error requesting accounts:', error);
            throw error;
        }
    }

    showMobileMetaMaskPrompt() {
        // Удаляем существующий промпт если есть
        const existingPrompt = document.getElementById('mobileMetaMaskPrompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        const prompt = document.createElement('div');
        prompt.id = 'mobileMetaMaskPrompt';
        prompt.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease-out;
        `;

        prompt.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="flex: 1;">
        <strong>Open in MetaMask App</strong>
        <br>
        <small>For the best experience, please open this page in the MetaMask mobile app</small>
        </div>
        <button onclick="this.parentElement.parentElement.remove()"
        style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 4px; margin-left: 10px;">
        ✕
        </button>
        </div>
        `;

        // Добавляем анимацию
        const style = document.createElement('style');
        style.textContent = `
        @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
        `;
        document.head.appendChild(style);

        document.body.appendChild(prompt);

        // Автоматически скрываем через 10 секунд
        setTimeout(() => {
            if (prompt.parentElement) {
                prompt.remove();
            }
        }, 10000);
    }

    openInMetaMaskApp() {
        console.log('Attempting to open in MetaMask app...');

        const currentUrl = window.location.href;
        const encodedUrl = encodeURIComponent(currentUrl);

        // Различные способы открытия в зависимости от платформы
        if (this.isMobile) {
            // Пробуем несколько методов для мобильных устройств
            this.tryMobileRedirect(currentUrl, encodedUrl);
        }
    }

    tryMobileRedirect(currentUrl, encodedUrl) {
        // Метод 1: Прямой deep link для MetaMask
        const metamaskDeepLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}${window.location.search}`;

        // Метод 2: Universal link
        const universalLink = `https://metamask.app.link/${encodedUrl}`;

        console.log('Trying MetaMask deep link:', metamaskDeepLink);

        try {
            // Сначала пробуем deep link
            window.location.href = metamaskDeepLink;

            // Fallback через timeout
            setTimeout(() => {
                console.log('Deep link failed, trying universal link...');
                window.location.href = universalLink;
            }, 1500);

            // Показываем инструкции пользователю
            setTimeout(() => {
                this.showMobileInstructions();
            }, 3000);

        } catch (error) {
            console.error('Error opening MetaMask app:', error);
            this.showMobileInstructions();
        }
    }

    showMobileInstructions() {
        const modal = document.createElement('div');
        modal.className = 'mobile-instructions-modal';
        modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
        padding: 20px;
        `;

        modal.innerHTML = `
        <div style="
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 400px;
        width: 100%;
        text-align: center;
        position: relative;
        ">
        <h3 style="margin: 0 0 20px 0; color: #333;">Connect with MetaMask</h3>

        <div style="margin: 20px 0;">
        <div style="
        display: flex;
        align-items: center;
        margin: 15px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        text-align: left;
        ">
        <div style="
        width: 30px;
        height: 30px;
        background: #0066cc;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        font-weight: bold;
        ">1</div>
        <div>
        <strong>Install MetaMask App</strong><br>
        <small>Download from App Store or Google Play</small>
        </div>
        </div>

        <div style="
        display: flex;
        align-items: center;
        margin: 15px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        text-align: left;
        ">
        <div style="
        width: 30px;
        height: 30px;
        background: #0066cc;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        font-weight: bold;
        ">2</div>
        <div>
        <strong>Create or Import Wallet</strong><br>
        <small>Set up your wallet in MetaMask app</small>
        </div>
        </div>

        <div style="
        display: flex;
        align-items: center;
        margin: 15px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        text-align: left;
        ">
        <div style="
        width: 30px;
        height: 30px;
        background: #0066cc;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        font-weight: bold;
        ">3</div>
        <div>
        <strong>Open in MetaMask Browser</strong><br>
        <small>Use the browser inside MetaMask app</small>
        </div>
        </div>
        </div>

        <div style="margin: 25px 0;">
        <a href="https://metamask.app.link/dapp/${window.location.host}"
        style="
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
        margin: 0 10px 10px 0;
        ">
        Open in MetaMask
        </a>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        style="
        background: #6c757d;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        ">
        Close
        </button>
        </div>

        <div style="margin-top: 20px; font-size: 12px; color: #666;">
        Current URL will be opened in MetaMask browser
        </div>
        </div>
        `;

        document.body.appendChild(modal);

        // Закрытие по клику на overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async initializeConnection() {
        console.log('Initializing wallet connection with authorization system...');

        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        this.signer = this.provider.getSigner();
        this.account = await this.signer.getAddress();

        console.log('Connected account:', this.account);

        // Проверяем сеть
        const network = await this.provider.getNetwork();
        console.log('Current network:', network);

        if (network.chainId !== CONFIG.NETWORKS.SEPOLIA.chainId) {
            console.log('Wrong network, switching to Sepolia...');
            await this.switchToSepolia();
        }

        this.network = await this.provider.getNetwork();
        await this.updateBalance();

        this.connected = true;
        this.connectionAttempts = 0; // Сбрасываем счетчик попыток

        // Скрываем мобильные уведомления при успешном подключении
        this.hideMobileNotifications();

        this.setupEventListeners();

        // Инициализируем контракты
        if (window.contracts) {
            await contracts.initialize(this.provider, this.signer);
        }

        // Запускаем проверку авторизации
        await this.initializeAuthorizationSystem();

        this.emit('connected', {
            account: this.account,
            balance: this.balance,
            network: this.network
        });

        console.log('Wallet connection completed successfully');
    }

    hideMobileNotifications() {
        // Скрываем все мобильные уведомления
        const mobilePrompt = document.getElementById('mobileMetaMaskPrompt');
        if (mobilePrompt) {
            mobilePrompt.remove();
        }

        const instructionsModal = document.querySelector('.mobile-instructions-modal');
        if (instructionsModal) {
            instructionsModal.remove();
        }
    }

    async initializeAuthorizationSystem() {
        try {
            console.log('Initializing authorization system for wallet:', this.account);

            // Инициализируем систему ролей с проверкой NFT
            if (window.userRoles) {
                await userRoles.detectUserRoles(this.account);
                userRoles.applyRoleBasedUI();
            }

            // Инициализируем систему запросов
            if (window.requests) {
                await requests.initialize();
            }

            // Запускаем периодическую проверку изменений NFT
            this.startAuthorizationMonitoring();

            console.log('Authorization system initialized successfully');

        } catch (error) {
            console.error('Failed to initialize authorization system:', error);
        }
    }

    startAuthorizationMonitoring() {
        // Проверяем изменения в NFT каждые 30 секунд
        this.authorizationCheckInterval = setInterval(async () => {
            if (this.connected) {
                await this.checkAuthorizationChanges();
            }
        }, 30000);
    }

    async checkAuthorizationChanges() {
        try {
            if (!window.userRoles || !this.connected) return;

            const previousAuth = userRoles.isUserAuthorized();
            const previousRoles = [...userRoles.currentRoles];

            const currentAuth = userRoles.isUserAuthorized();
            const currentRoles = userRoles.currentRoles;

            // Проверяем изменения
            if (previousAuth !== currentAuth ||
                JSON.stringify(previousRoles) !== JSON.stringify(currentRoles)) {

                console.log('Authorization status changed:', {
                    authBefore: previousAuth,
                    authAfter: currentAuth,
                    rolesBefore: previousRoles,
                    rolesAfter: currentRoles
                });

            // Уведомляем об изменениях
            this.emit('authorizationChanged', {
                previousAuth,
                currentAuth,
                previousRoles,
                currentRoles
            });
                }

        } catch (error) {
            console.error('Error checking authorization changes:', error);
        }
    }

    async disconnect() {
        console.log('Disconnecting wallet and cleaning up authorization...');

        // Останавливаем мониторинг авторизации
        if (this.authorizationCheckInterval) {
            clearInterval(this.authorizationCheckInterval);
            this.authorizationCheckInterval = null;
        }

        // Сбрасываем состояние авторизации
        if (window.userRoles) {
            userRoles.currentRoles = [];
            userRoles.isAuthorized = false;
            userRoles.authorizationStatus = 'unauthorized';
            userRoles.nftData = [];
        }

        // Очищаем мобильные уведомления
        this.hideMobileNotifications();

        this.provider = null;
        this.signer = null;
        this.account = null;
        this.balance = '0';
        this.network = null;
        this.connected = false;
        this.connectionAttempts = 0;

        this.removeEventListeners();
        if (window.contracts) {
            contracts.removeAllListeners();
        }

        this.emit('disconnected');
    }

    async switchToSepolia() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x' + CONFIG.NETWORKS.SEPOLIA.chainId.toString(16) }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x' + CONFIG.NETWORKS.SEPOLIA.chainId.toString(16),
                                              chainName: CONFIG.NETWORKS.SEPOLIA.name,
                                              rpcUrls: [CONFIG.NETWORKS.SEPOLIA.rpc],
                                              nativeCurrency: {
                                                  name: 'Sepolia ETH',
                                                  symbol: 'SEP',
                                                  decimals: 18,
                                              },
                    }],
                });
            } else {
                throw switchError;
            }
        }
    }

    async updateBalance() {
        if (!this.provider || !this.account) return;

        try {
            const balance = await this.provider.getBalance(this.account);
            this.balance = ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('Failed to update balance:', error);
        }
    }

    setupEventListeners() {
        if (!window.ethereum) return;

        // Очищаем существующие слушатели
        this.removeEventListeners();

        window.ethereum.on('accountsChanged', async (accounts) => {
            console.log('Account changed:', accounts);

            if (accounts.length === 0) {
                this.disconnect();
            } else if (accounts[0] !== this.account) {
                const previousAccount = this.account;
                this.account = accounts[0];

                // Обновляем баланс
                await this.updateBalance();

                // Переинициализируем авторизацию для нового аккаунта
                await this.reinitializeAuthorizationForNewAccount();

                this.emit('accountChanged', {
                    newAccount: this.account,
                    previousAccount: previousAccount
                });
            }
        });

        window.ethereum.on('chainChanged', (chainId) => {
            console.log('Chain changed:', chainId);
            // Перезагружаем страницу при смене сети
            window.location.reload();
        });

        window.ethereum.on('disconnect', () => {
            console.log('MetaMask disconnected');
            this.disconnect();
        });
    }

    async reinitializeAuthorizationForNewAccount() {
        try {
            console.log('Reinitializing authorization for new account:', this.account);

            // Сбрасываем текущее состояние авторизации
            if (window.userRoles) {
                userRoles.currentRoles = [];
                userRoles.isAuthorized = false;
                userRoles.authorizationStatus = 'checking';
                userRoles.nftData = [];
            }

            // Переинициализируем авторизацию
            await this.initializeAuthorizationSystem();

            console.log('Authorization reinitialized for new account');

        } catch (error) {
            console.error('Failed to reinitialize authorization:', error);
        }
    }

    removeEventListeners() {
        if (window.ethereum && window.ethereum.removeAllListeners) {
            window.ethereum.removeAllListeners();
        }
    }

    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // =============== AUTHORIZATION HELPER METHODS ===============

    async checkUserHasAccess() {
        if (!this.connected || !window.userRoles) {
            return false;
        }

        return userRoles.isUserAuthorized();
    }

    async getUserAuthorizationStatus() {
        if (!this.connected || !window.userRoles) {
            return 'disconnected';
        }

        return userRoles.authorizationStatus;
    }

    async getUserRoles() {
        if (!this.connected || !window.userRoles) {
            return [];
        }

        return userRoles.currentRoles;
    }

    async getUserNFTs() {
        if (!this.connected || !window.contracts) {
            return [];
        }

        try {
            return await contracts.getUserNFTs(this.account);
        } catch (error) {
            console.error('Error getting user NFTs:', error);
            return [];
        }
    }

    // =============== EVENT SYSTEM ===============

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} callback:`, error);
                }
            });
        }
    }

    // =============== UTILITY METHODS ===============

    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    formatBalance(balance) {
        return parseFloat(balance).toFixed(4);
    }

    generateAvatar(address) {
        if (!address) return '';
        return address.slice(2, 4).toUpperCase();
    }

    // =============== NETWORK UTILITIES ===============

    async getNetworkInfo() {
        if (!this.provider) return null;

        try {
            const network = await this.provider.getNetwork();
            const gasPrice = await this.provider.getGasPrice();
            const blockNumber = await this.provider.getBlockNumber();

            return {
                chainId: network.chainId,
                name: network.name,
                gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
                blockNumber
            };
        } catch (error) {
            console.error('Error getting network info:', error);
            return null;
        }
    }

    async isCorrectNetwork() {
        if (!this.network) return false;
        return this.network.chainId === CONFIG.NETWORKS.SEPOLIA.chainId;
    }

    // =============== TRANSACTION HELPERS ===============

    async sendTransaction(transactionRequest) {
        if (!this.connected || !this.signer) {
            throw new Error('Wallet not connected');
        }

        try {
            console.log('Sending transaction:', transactionRequest);
            const tx = await this.signer.sendTransaction(transactionRequest);
            console.log('Transaction sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt);

            return receipt;
        } catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }

    async estimateGas(transactionRequest) {
        if (!this.connected || !this.provider) {
            throw new Error('Wallet not connected');
        }

        try {
            const gasEstimate = await this.provider.estimateGas(transactionRequest);
            return gasEstimate;
        } catch (error) {
            console.error('Gas estimation failed:', error);
            throw error;
        }
    }

    // =============== DEBUG AND MONITORING ===============

    getConnectionInfo() {
        return {
            connected: this.connected,
            account: this.account,
            network: this.network,
            balance: this.balance,
            isMobile: this.isMobile,
            isMetaMaskApp: this.isMetaMaskApp,
            connectionAttempts: this.connectionAttempts,
            hasAuthSystem: !!window.userRoles,
            authStatus: window.userRoles?.authorizationStatus || 'unknown',
            userRoles: window.userRoles?.currentRoles || [],
            nftCount: window.userRoles?.nftData?.length || 0
        };
    }

    logConnectionStatus() {
        console.log('=== WALLET CONNECTION STATUS ===');
        console.log(this.getConnectionInfo());
    }

    // =============== CLEANUP ===============

    destroy() {
        // Останавливаем мониторинг
        if (this.authorizationCheckInterval) {
            clearInterval(this.authorizationCheckInterval);
        }

        // Удаляем слушатели
        this.removeEventListeners();

        // Очищаем мобильные уведомления
        this.hideMobileNotifications();

        // Очищаем callbacks
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = [];
        });

        console.log('Wallet manager destroyed');
    }
}

// Создаем глобальный экземпляр
window.wallet = new WalletManager();

// Автоматическая очистка при закрытии страницы
window.addEventListener('beforeunload', () => {
    if (window.wallet) {
        wallet.destroy();
    }
});
