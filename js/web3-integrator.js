// js/web3-integrator.js
class Web3Integrator {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.currentAccount = null;
        this.connected = false;
        this.contracts = {};
        this.listeners = [];
    }

    async init() {
        try {
            // Check if already connected
            if (window.ethereum && window.ethereum.selectedAddress) {
                await this.connect();
            }
        } catch (error) {
            console.warn('Auto-connection failed:', error);
        }
    }

    async connect() {
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask not installed');
            }

            // Подключаемся к кошельку
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            // Используем Web3Provider для подписи транзакций (через MetaMask)
            // и JsonRpcProvider для чтения данных (через Alchemy)
            this.provider = new ethers.providers.JsonRpcProvider(CONFIG.NETWORKS.SEPOLIA.rpc);
            this.signer = new ethers.providers.Web3Provider(window.ethereum).getSigner();

            this.currentAccount = accounts[0];
            this.connected = true;

            // Проверяем сеть
            await this.checkNetwork();

            // Инициализируем контракты
            this.initContracts();

            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.currentAccount = accounts[0];
                    this.emit('connected', { account: this.currentAccount });
                }
            });

            // Listen for network changes
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });

            this.emit('connected', { account: this.currentAccount });

        } catch (error) {
            console.error('Connection failed:', error);
            this.emit('error', { message: error.message });
            throw error;
        }
    }

    async checkNetwork() {
        try {
            const network = await this.signer.provider.getNetwork();

            if (network.chainId !== CONFIG.NETWORKS.SEPOLIA.chainId) {
                // Request network switch
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x' + CONFIG.NETWORKS.SEPOLIA.chainId.toString(16) }],
                    });
                } catch (switchError) {
                    throw new Error('Please switch to Sepolia network');
                }
            }
        } catch (error) {
            console.error('Network check failed:', error);
            throw error;
        }
    }

    initContracts() {
        try {
            // Initialize all contracts
            for (const [name, address] of Object.entries(CONFIG.CONTRACTS)) {
                const abiName = this.getABIName(name);
                if (CONFIG.ABI[abiName]) {
                    this.contracts[name] = new ethers.Contract(
                        address,
                        CONFIG.ABI[abiName],
                        this.signer
                    );
                }
            }

            console.log('Contracts initialized:', Object.keys(this.contracts));
        } catch (error) {
            console.error('Contract initialization failed:', error);
        }
    }

    getABIName(contractName) {
        // Map contract names to ABI names
        const mapping = {
            'FACTORY': 'FACTORY',
            'CORE': 'CORE',
            'REWARDS': 'REWARDS',
            'FROST_COORDINATOR': 'FROST',
            'MULTI_POOL_DAO': 'MULTI_POOL_DAO'
        };
        return mapping[contractName] || contractName;
    }

    getContract(contractName, abiName = null) {
        const abiKey = abiName || this.getABIName(contractName);
        const address = CONFIG.CONTRACTS[contractName];
        const abi = CONFIG.ABI[abiKey];

        if (!address || !abi) {
            throw new Error(`Contract ${contractName} not found`);
        }

        // Используем signer для транзакций, provider для чтения
        return new ethers.Contract(address, abi, this.signer);
    }

    disconnect() {
        this.provider = null;
        this.signer = null;
        this.currentAccount = null;
        this.connected = false;
        this.contracts = {};
        this.emit('disconnected');
    }

    onStateChange(callback) {
        this.listeners.push(callback);
    }

    emit(event, data = {}) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }
}

window.web3Integrator = new Web3Integrator();
