// js/config.js - ИСПРАВЛЕННАЯ API КОНФИГУРАЦИЯ
const CONFIG = {
    NETWORKS: {
        SEPOLIA: {
            chainId: 11155111,
            name: 'Sepolia',
            rpc: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID'
        }
    },


    // Bitcoin Network Configuration
    BITCOIN: {
        // Auto-detect network from chain
        NETWORK: (function() {
            // Sepolia = testnet, Mainnet = mainnet
            const chainId = window.CONFIG?.CHAIN_ID || 11155111;
            return chainId === 1 ? 'mainnet' : 'testnet';
        })(),

        GENESIS_HEIGHT: 35599,

        PREFIXES: {
            mainnet: {
                P2PKH: 0x00,
                P2SH: 0x05,
                BECH32: 'bc',
                BECH32_REGEX: /^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,87}$/
            },
            testnet: {
                P2PKH: 0x6f,
                P2SH: 0xc4,
                BECH32: 'tb',
                BECH32_REGEX: /^tb1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,87}$/
            }
        },

        SUPPORTED_TYPES: ['p2wpkh', 'p2pkh', 'p2tr'],
        RECOMMENDED_TYPE: 'p2wpkh',

        ADDRESS_VALIDATION: {
            MIN_LENGTH: 26,
            MAX_LENGTH: 90
        }
    },

    CONTRACTS: {
        // Core Infrastructure
        FROST_COORDINATOR: '0x4d195A05F2d79E27b310dFB24733d86ffb214867',
        SPV_CONTRACT: '0xD7f2293659A000b37Fd3973B06d4699935c511e9',
        MULTI_POOL_DAO: '0x032fec1b5E4179377c92243Bdd34F8f1EEA131b6',

        // Factory System
        FACTORY: '0xb87DB5fF6802A8B0bd48fb314234916f1BA27C1a',
        POOL_DEPLOYER: '0x06b6ce3BcCD8A344a7A8aE4040809Bac92B75bB1',
        POOL_TOKEN_FACTORY: '0xfBf82b62d66B1a2a9aE90b50354abAa8d7a35134',

        // Calculator System
        CALCULATOR_REGISTRY: '0x9bB85b0134847Ca4f1976A3C58BAbb6fD69fE8E9',
        FPPS_CALCULATOR: '0xaF00ee3F6D7BD83Ad8601714CF1d10671c8E2a7d',
        PPLNS_CALCULATOR: '0xDE5bA623926AE2bB6Cac97E2687A58602e35978C',
        PPS_CALCULATOR: '0x0E46C4c284480A983A2895D194d14Ce48515AaDf',
        SCORE_CALCULATOR: '0x6a9dAf46Ba893749DD75F442438D195373125F72',

        // Oracle Infrastructure
        ORACLE_REGISTRY: '0x1E384f7112857C9e0437779f441F65853df7Eb26',
        STRATUM_AGGREGATOR: '0x58F683F212175b0A942777cE4E82c9680aa3397D',
        ORACLE_VALIDATOR: '0x65075C39BE930f605e6aca53add3852a1724cb64',

        // Synthetic Tokens
        SBTC: '0x6259dE19c541829066ebeD373e1da25F7C5199B8',
        SDOGE: '0x43F5C175a156d4E42dcBC93D63Be1096986b852E',
        SLTC: '0xdfD5ED5a1Bf7bCB864Bd758a10f686d2b9268B9B',

        // Proxy Implementations
        CORE_IMPL_V2: '0x74ED7De4044a70c08d13Baad2A97ADc49cD1C942',
        REWARDS_IMPL_V2: '0x2e3482562696f9E426869787E40570235D74729e',
        REDEMPTION_IMPL_V2: '0xec19877F8329fd86a55fAF6e466CEd63b1FF5d4c',
        EXTENSIONS_IMPL_V2: '0x1578bfB52486d0935A25de912b523D8f77807c4C',

        // Handlers
        REWARD_HANDLER: '0x6975De45FAb9870A3150bd3046c2cdD5A69f4b1B',
        REDEMPTION_HANDLER: '0xd8386c37d0E53a275FE66964f40304caFcb9aBFc',

        // Legacy
        MEMBERSHIP_SBT: '0xF42F943746A2ba3E5b813bb2A4187417bCF56BE5',
        BRIDGE_INBOX: '0xB84d53Bae116fDEd1d35D71156489d6F5a6cf336',
        BRIDGE_OUTBOX: '0xb7F782CAB5242f7C7C97FC1361e381c48Cc19941',

    },

    ABI: {
        FROST_COORDINATOR: [
            "function createSession(bytes groupPubkey, address[] participants, uint256 threshold, uint64 deadline, bool enforceSharesCheck, address verifierOverride, uint8 purpose, tuple(address originContract, uint256 originId, uint16 networkId, bytes32 poolId) origin) returns (uint256)",
            "function getSession(uint256 sessionId) view returns (uint256 id, address creator, bytes groupPubkey, bytes32 messageHash, bool messageBound, uint256 threshold, uint256 total, uint64 deadline, bool enforceSharesCheck, address verifierOverride, uint256 state, uint256 commitsCount, uint256 sharesCount, uint256 refusalCount, uint256 purpose, address originContract, uint256 originId, uint16 networkId, bytes32 poolId, uint256 dkgSharesCount)",
            "function getSessionParticipants(uint256 sessionId) view returns (address[])",
            "function getUserSessions(address user) view returns (uint256[])",
            "function getUserSessionCount(address user) view returns (uint256)",
            "function submitNonceCommit(uint256 sessionId, bytes32 commitment)",
            "function submitDKGShare(uint256 sessionId, address recipient, bytes encryptedShare)",
            "function finalizeDKG(uint256 sessionId, bytes groupPubkey)",
            "function isParticipant(uint256 sessionId, address who) view returns (bool)",
            "function hasCommitted(uint256 sessionId, address who) view returns (bool)",
            "function hasSubmittedShare(uint256 sessionId, address who) view returns (bool)",
            "function isFinalized(uint256 sessionId) view returns (bool)",
            "function getDKGShare(uint256 sessionId, address sender, address recipient) view returns (bytes)",
            "event SessionCreated(uint256 indexed sessionId, address indexed creator, bytes groupPubkey, bytes message, string signatureType, uint256 threshold, uint256 total, uint64 deadline, bool enforceSharesCheck, address verifierOverride, uint8 purpose, tuple(address originContract, uint256 originId, uint16 networkId, bytes32 poolId) origin)",
            "event DKGCompleted(uint256 indexed sessionId, bytes groupPubkey)",
            "event DKGShareSubmitted(uint256 indexed sessionId, address indexed sender, address indexed recipient, bytes encryptedShare)",
            "event NonceCommitted(uint256 indexed sessionId, address indexed participant, bytes32 commitment)"
        ],

        FACTORY: [

            "function createPool(tuple(string asset, string poolId, uint256 pubX, uint256 pubY, string mpName, string mpSymbol, bool restrictedMp, bytes payoutScript, uint256 calculatorId) params) returns (address poolAddress, address mpTokenAddress)",
            "function setDependencies(address _spv, address _frost, address _calcRegistry, address _aggregator, address _validator, address _oracleRegistry, address _tokenFactory, address _multiPoolDAO)",
            "function setPoolDeployer(address _deployer)",
            "function poolDeployer() view returns (address)",
            "function spvContract() view returns (address)",
            "function frostCoordinator() view returns (address)",
            "function calculatorRegistry() view returns (address)",
            "function stratumDataAggregator() view returns (address)",
            "function stratumDataValidator() view returns (address)",
            "function oracleRegistry() view returns (address)",
            "function poolTokenFactory() view returns (address)",
            "function multiPoolDAO() view returns (address)",
            "function getPoolCount() view returns (uint256)",
            "function getPoolAt(uint256 index) view returns (address)",
            "function poolsInfo(address) view returns (address poolCore, address mpToken, string poolId, string asset, bool isActive, uint256 createdAt, address creator)",
            "function isValidPool(address) view returns (bool)",
            "function poolsByAsset(string) view returns (address[])",
            "function POOL_MANAGER_ROLE() view returns (bytes32)",
            "function ADMIN_ROLE() view returns (bytes32)",
            "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "function grantRole(bytes32 role, address account)",
            "event PoolCreated(address indexed poolCore, address indexed mpToken, string asset, string poolId, address creator)"
        ],

        POOL_CONTRACT: [
            "function poolId() external view returns (string)",
            "function publicKeyX() external view returns (uint256)",
            "function publicKeyY() external view returns (uint256)",
            "function payoutScript() external view returns (bytes)",
            "function poolToken() external view returns (address)",
            "function rewardHandler() external view returns (address)",
            "function redemptionHandler() external view returns (address)",
            "function calculatorRegistry() external view returns (address)",
            "function stratumAggregator() external view returns (address)",
            "function stratumValidator() external view returns (address)",
            "function oracleRegistry() external view returns (address)",
            "function spv() external view returns (address)",
            "function frost() external view returns (address)",
            "function hasRole(bytes32 role, address account) external view returns (bool)",
            "function grantRole(bytes32 role, address account) external",
            "function POOL_MANAGER_ROLE() external view returns (bytes32)",
            "function ADMIN_ROLE() external view returns (bytes32)",
            "function CONFIRMER_ROLE() external view returns (bytes32)",
            "function setPayoutScript(bytes calldata script) external",
            "function setHandlers(address _rewardHandler, address _redemptionHandler) external",
            "function setPoolToken(address token) external",
            "function registerRewardStrict(bytes32 txid, uint32 vout, uint64 amountSat, bytes32 blockHash, bytes calldata rawTx, bytes32 merkleRoot, bytes32[] calldata siblings, uint8[] calldata directions) external returns (bytes32)",
            "function distributeRewardsStrict(address calculator) external returns (uint256)",
            "function requestRedemption(uint64 amountSat, bytes calldata btcScript) external returns (uint256)",
            "function confirmRedemption(uint256 redemptionId, bool ok) external"
        ],

        POOL_DEPLOYER: [
            "function deployPool(bytes calldata params) external returns (address poolAddress, address mpTokenAddress)",
            "function factory() external view returns (address)",
            "function rewardHandler() external view returns (address)",
            "function redemptionHandler() external view returns (address)",
            "function poolRegistry(address) external view returns (address pool, address mpToken, address rewardHandler, address redemptionHandler)",
            "function getPoolAddresses(address pool) external view returns (address pool, address mpToken, address rewardHandler, address redemptionHandler)"
        ],

        STRATUM_AGGREGATOR: [
            // Admin and registry
            "function admin() view returns (address)",
            "function oracleRegistry() view returns (address)",

            // Provider authorization
            "function authorizedProviders(address) view returns (bool)",
            "function authorizeProvider(address provider, bool authorized)",

            // Worker ownership and registration
            "function workerOwner(address) view returns (address)",
            "function workerBitcoinAddress(address) view returns (string)",
            "function workerIdToAddress(string) view returns (address)",
            "function minerWorkers(address, uint256) view returns (address)",
            "function workerLastActivity(address) view returns (uint256)",

            // Worker data
            "function workerData(address) view returns (tuple(address workerAddress, uint256 totalShares, uint256 validShares, uint256 lastSubmission, bool isActive))",
            "function isWorkerRegistered(address) view returns (bool)",
            "function allWorkers(uint256) view returns (address)",
            "function getAllWorkers() view returns (address[])",

            // Legacy methods (keep for compatibility)
            "function setWorkerOwner(address worker, address member)",
            "function registerWorkerToPool(address pool, address worker)",
            "function deregisterWorkerFromPool(address pool, address worker)",
            "function updateWorkerData(address worker, uint256 totalShares, uint256 validShares, bool isActive)",
            "function getWorkerData(address pool) view returns (tuple(address workerAddress, uint256 totalShares, uint256 validShares, uint256 lastSubmission, bool isActive)[])",
            "function aggregateMembers(uint256 poolId) view returns (tuple(address member, address payoutAddress, uint256 aggregatedValidShares, uint256 aggregatedTotalShares, uint256 aggregatedHashRate, uint256 lastActivity, bool isActive, string workerId, uint256 hashRate)[])",

            // NEW METHODS for frontend
            "function registerWorkerFull(address workerAddress, address minerAddress, string bitcoinAddress, string workerId)",
            "function getWorkerOwnerByWorkerId(string workerId) view returns (bool registered, address workerAddress, address minerAddress)",
            "function getWorkersByMiner(address minerAddress) view returns (address[])",
            "function getMinerWorkerCount(address minerAddress) view returns (uint256)",
            "function getWorkerBitcoinAddress(address workerAddress) view returns (string)",
            "function getBitcoinAddressByWorkerId(string workerId) view returns (string)",
            "function getWorkerInfo(address workerAddress) view returns (bool registered, address owner, string bitcoinAddress, uint256 totalShares, uint256 validShares, uint256 lastActivity)",
            "function getWorkerInfoByWorkerId(string workerId) view returns (bool registered, address workerAddress, address owner, string bitcoinAddress, uint256 totalShares, uint256 validShares, uint256 lastActivity)",
            "function getTotalWorkersCount() view returns (uint256)",
            "function updateWorkerBitcoinAddress(address workerAddress, string newBitcoinAddress)",

            // Events
            "event WorkerOwnerSet(address indexed worker, address indexed member)",
            "event WorkerRegisteredToPool(address indexed pool, address indexed worker)",
            "event WorkerDeregisteredFromPool(address indexed pool, address indexed worker)",
            "event ProviderAuthorized(address indexed provider, bool authorized)",
            "event WorkerRegisteredFull(address indexed workerAddress, address indexed minerAddress, string bitcoinAddress, string workerId)",
            "event WorkerStatsUpdated(address indexed workerAddress, uint256 totalShares, uint256 validShares)",
            "event BitcoinAddressUpdated(address indexed workerAddress, string newBitcoinAddress)"
        ],

        MEMBERSHIP_SBT: [
            "function balanceOf(address owner) view returns (uint256)",
            "function tokenOf(address owner) view returns (uint256)",
            "function membershipOf(uint256 tokenId) view returns (tuple(bytes32 poolId, bytes32 role, uint256 joinTimestamp, bool active))",
            "function mint(address to, bytes32 poolId, bytes32 role, string tokenURI) returns (uint256)",
            "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
            "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
            "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
            "event MembershipMinted(address indexed to, uint256 indexed tokenId, bytes32 poolId, bytes32 role)",
            "event MembershipBurned(uint256 indexed tokenId)"
        ],

        REWARD_HANDLER: [

            "function registerReward(bytes32 txid, uint32 vout, uint64 amountSat, bytes32 blockHash, address pool) external returns (bytes32)",


            "function distributeRewards(bytes32 utxoKey, address pool, address calculator, address aggregator) external returns (uint256)",
            "function approveDistribution(address pool, uint256 distributionId) external",

            // View
            "function getRewardInfo(address pool, bytes32 utxoKey) external view returns (tuple(bytes32 txid, uint32 vout, uint64 amountSat, bytes32 blockHash, bool isRegistered, bool isDistributed))",
            "function getPendingDistribution(address pool, uint256 distributionId) external view returns (bytes32 utxoKey, uint256 totalAmount, uint256 recipientsCount, bool isApproved, bool isExecuted, uint256 createdAt)",
            "function getDistributionRecipients(address pool, uint256 distributionId) external view returns (tuple(address recipient, uint256 amount, uint256 percentage)[])",
            "function getPendingDistributionsCount(address pool) external view returns (uint256)",
            "function getConfirmations(bytes32 blockHash) external view returns (uint256)",
            "function isReadyToDistribute(address pool, bytes32 utxoKey) external view returns (bool)",


            "event RewardRegistered(address indexed pool, bytes32 indexed utxoKey, uint64 amount, bytes32 blockHash)",
            "event DistributionCalculated(address indexed pool, bytes32 indexed utxoKey, uint256 indexed distributionId, uint256 recipientsCount, uint256 totalAmount)",
            "event DistributionApproved(address indexed pool, uint256 indexed distributionId)"
        ],

        ROLE_BADGE_SBT: [
            "function balanceOf(address account, uint256 id) view returns (uint256)",
            "function activeTemplateOf(uint256 tokenId) view returns (uint256)"
        ]
    },

    FROST_PURPOSES: {
        SIGNATURE: 0,
        SIGNING: 1,
        CUSTODIAL: 2,
        POOL_MANAGEMENT: 3,
        THRESHOLD_WALLET: 4,
        GOVERNANCE: 5,
        DKG: 6
    },

    USER_ROLES: {
        POOL_OWNER: {
            id: 'pool-owner',
            name: 'Pool Owner',
            permissions: ['create_pool', 'manage_pool', 'manage_frost'],
            dashboardWidgets: ['pool-creation', 'pool-management', 'frost-sessions'],
            sidebarSections: ['dashboard', 'dkgManagement', 'poolCreation', 'poolManagement', 'nftCollection', 'settings'],
            primaryColor: '#059669'
        },
        MINER: {
            id: 'miner',
            name: 'Miner',
            permissions: ['mine', 'view_stats', 'claim_rewards', 'participate_dkg', 'manage_frost', 'create_pool'],
            dashboardWidgets: ['mining', 'rewards', 'pool-stats'],
            sidebarSections: ['dashboard', 'dkgManagement', 'poolCreation', 'miningDashboard', 'nftCollection', 'settings'],
            primaryColor: '#dc2626'
        },
        CUSTODIAL: {
            id: 'custodial',
            name: 'Custodial',
            permissions: ['sign_transactions', 'manage_custody'],
            dashboardWidgets: ['custody', 'frost-signatures'],
            sidebarSections: ['dashboard', 'dkgManagement', 'nftCollection', 'settings'],
            primaryColor: '#7c3aed'
        }
    },

    // =============== ИСПРАВЛЕННАЯ API КОНФИГУРАЦИЯ ===============
    API: {
        // Mining API - работает с HTTPS
        MINING: 'https://api-mining.unilayer.solutions',

        // Используем прямой API Gateway endpoint для requests
        REQUESTS: 'https://yg7ea875jj.execute-api.eu-north-1.amazonaws.com/prod',

        // ПОЛНЫЕ ENDPOINTS - включая /api для mining, без /api для requests
        ENDPOINTS: {
            // Mining API endpoints (с /api префиксом)
            HEALTH: '/api/health',
            STATS: '/api/stats',
            POOLS: '/api/pools',
            WORKERS: '/api/workers',
            BLOCKS: '/api/blocks',
            SHARES: '/api/shares',
            SHARES_START: '/api/shares/start',
            SHARES_STOP: '/api/shares/stop',
            SHARES_STATS: '/api/shares/stats',
            MINING_START: '/api/mining/start',
            MINING_STOP: '/api/mining/stop',

            // Wallet endpoints (с /api)
            WALLET_BALANCE: '/api/simple-wallet/balance/',
            WALLET_SEND: '/api/simple-wallet/send',
            WALLET_TRANSACTIONS: '/api/simple-wallet/transactions/',
            SIMULATE_RECEIVE: '/api/simple-wallet/simulate-receive',

            // Transaction endpoints (с /api)
            TRANSACTION_SEND: '/api/transaction/send',
            TRANSACTION_MEMPOOL: '/api/transaction/mempool',
            TRANSACTION_BALANCE: '/api/transaction/balance/',
            TRANSACTION_HISTORY: '/api/transaction/history/',
            TRANSACTION_UTXOS: '/api/transaction/utxos/',

            // SPV endpoints (с /api)
            SPV_PROOF: '/api/spv/proof/',

            // Request system endpoints (БЕЗ /api - это API Gateway)
            REQUESTS: '/requests',
            MESSAGES: '/messages',
            DKG_REQUESTS: '/dkg-requests'
        },

        // БЕЗОПАСНЫЕ МЕТОДЫ ДОСТУПА К API
        getMiningUrl: function(endpoint) {
            if (!this.ENDPOINTS[endpoint] && !endpoint.startsWith('/api/')) {
                console.warn(`Endpoint ${endpoint} не найден в конфигурации`);
            }
            const path = this.ENDPOINTS[endpoint] || endpoint;
            return this.MINING + path;
        },

        getRequestsUrl: function(endpoint) {
            if (!this.ENDPOINTS[endpoint] && !endpoint.startsWith('/')) {
                console.warn(`Requests endpoint ${endpoint} не найден в конфигурации`);
            }
            const path = this.ENDPOINTS[endpoint] || endpoint;
            return this.REQUESTS + path;
        },

        // Универсальный метод для получения полного URL
        getFullUrl: function(type, endpoint, params = '') {
            let url;
            if (type === 'mining') {
                url = this.getMiningUrl(endpoint);
            } else if (type === 'requests') {
                url = this.getRequestsUrl(endpoint);
            } else {
                console.error(`Неизвестный тип API: ${type}`);
                return null;
            }
            return url + params;
        }
    },

    APP_SETTINGS: {
        NOTIFICATION_TIMEOUT: 5000,
        MAX_DKG_PARTICIPANTS: 10,
        DEFAULT_DKG_THRESHOLD: 2,
        DEFAULT_DKG_DEADLINE_HOURS: 24,
        POLLING_INTERVAL: 30000
    },

    UI_CONFIG: {
        AUTO_REFRESH: false,
        THEME: 'dark',
        ANIMATION_DURATION: 300,
        NOTIFICATION_POSITION: 'top-right'
    },

    // Обратная совместимость
    API_BASE_URL: 'https://api-mining.unilayer.solutions/api',
    API_REQUESTS_URL: 'https://yg7ea875jj.execute-api.eu-north-1.amazonaws.com/prod',
    EXPLORER_URL: 'https://sepolia.etherscan.io',

    TIMEOUTS: {
        API_REQUEST: 30000,
        TRANSACTION_WAIT: 300000,
        CONNECTION_RETRY: 5000
    },

    GAS_LIMITS: {
        SIMPLE_TX: 21000,
        CONTRACT_CALL: 100000,
        CONTRACT_DEPLOY: 2000000,
        DKG_SESSION_CREATE: 500000,
        POOL_CREATE: 800000,
        FROST_POOL_CREATE: 1200000
    }
};

window.CONFIG = CONFIG;
