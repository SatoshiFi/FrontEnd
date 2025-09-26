// js/config.js - ИСПРАВЛЕННАЯ API КОНФИГУРАЦИЯ
const CONFIG = {
    NETWORKS: {
        SEPOLIA: {
            chainId: 11155111,
            name: 'Sepolia',
            rpc: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID'
        }
    },

    CONTRACTS: {
        // Core Infrastructure
        FROST_COORDINATOR: '0x4d195A05F2d79E27b310dFB24733d86ffb214867',
        SPV_CONTRACT: '0xD7f2293659A000b37Fd3973B06d4699935c511e9',
        MULTI_POOL_DAO: '0x032fec1b5E4179377c92243Bdd34F8f1EEA131b6',

        // Factory System
        FACTORY: '0xE4D88445264041302433C12057A5587Da892c6cE',
        POOL_DEPLOYER: '0xE91630F1A8e315cb1400bAF7F6761BDc498dA222',
        POOL_TOKEN_FACTORY: '0xfBf82b62d66B1a2a9aE90b50354abAa8d7a35134',

        // Calculator System
        CALCULATOR_REGISTRY: '0x9bB85b0134847Ca4f1976A3C58BAbb6fD69fE8E9',
        FPPS_CALCULATOR: '0xaF00ee3F6D7BD83Ad8601714CF1d10671c8E2a7d',
        PPLNS_CALCULATOR: '0xDE5bA623926AE2bB6Cac97E2687A58602e35978C',
        PPS_CALCULATOR: '0x0E46C4c284480A983A2895D194d14Ce48515AaDf',
        SCORE_CALCULATOR: '0x6a9dAf46Ba893749DD75F442438D195373125F72',

        // Oracle Infrastructure
        ORACLE_REGISTRY: '0x1E384f7112857C9e0437779f441F65853df7Eb26',
        ORACLE_AGGREGATOR: '0x8BC17298773DCfC7D1BA7768f3F153E63bEE4bb7',
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
        REWARD_HANDLER: '0xA741F41BD4713EF655c9Dab11355C11333F46c50',
        REDEMPTION_HANDLER: '0x1D40c7cAC60e2acf28f60a6E3D11a4eB8A6619F7',

        // Legacy - НЕ ТРОГАЙ
        MEMBERSHIP_SBT: '0xF42F943746A2ba3E5b813bb2A4187417bCF56BE5',
        BRIDGE_INBOX: '0xB84d53Bae116fDEd1d35D71156489d6F5a6cf336',
        BRIDGE_OUTBOX: '0xb7F782CAB5242f7C7C97FC1361e381c48Cc19941',
    },

    ABI: {
        // НОВЫЙ ABI для FrostCoordinator
        FROST_COORDINATOR: [
            // Управление сессиями
            "function createSession(bytes groupPubkey, address[] participants, uint256 threshold, uint64 deadline, bool enforceSharesCheck, address verifierOverride, uint8 purpose, tuple(address originContract, uint256 originId, uint16 networkId, bytes32 poolId) origin) returns (uint256)",
            "function getSession(uint256 sessionId) view returns (uint256 id, address creator, bytes groupPubkey, bytes32 messageHash, bool messageBound, uint256 threshold, uint256 total, uint64 deadline, bool enforceSharesCheck, address verifierOverride, uint256 state, uint256 commitsCount, uint256 sharesCount, uint256 refusalCount, uint256 purpose, address originContract, uint256 originId, uint16 networkId, bytes32 poolId, uint256 dkgSharesCount)",
            "function getSessionParticipants(uint256 sessionId) view returns (address[])",
            "function getUserSessions(address user) view returns (uint256[])",
            "function getUserSessionCount(address user) view returns (uint256)",

            // DKG протокол
            "function submitNonceCommit(uint256 sessionId, bytes32 commitment)",
            "function submitDKGShare(uint256 sessionId, address recipient, bytes encryptedShare)",
            "function finalizeDKG(uint256 sessionId, bytes groupPubkey)",

            // Проверки
            "function isParticipant(uint256 sessionId, address who) view returns (bool)",
            "function hasCommitted(uint256 sessionId, address who) view returns (bool)",
            "function hasSubmittedShare(uint256 sessionId, address who) view returns (bool)",
            "function isFinalized(uint256 sessionId) view returns (bool)",
            "function getDKGShare(uint256 sessionId, address sender, address recipient) view returns (bytes)",

            // События
            "event SessionCreated(uint256 indexed sessionId, address indexed creator, bytes groupPubkey, bytes message, string signatureType, uint256 threshold, uint256 total, uint64 deadline, bool enforceSharesCheck, address verifierOverride, uint8 purpose, tuple(address originContract, uint256 originId, uint16 networkId, bytes32 poolId) origin)",
            "event DKGCompleted(uint256 indexed sessionId, bytes groupPubkey)",
            "event DKGShareSubmitted(uint256 indexed sessionId, address indexed sender, address indexed recipient, bytes encryptedShare)",
            "event NonceCommitted(uint256 indexed sessionId, address indexed participant, bytes32 commitment)"
        ],

        // Factory ABI - ОБНОВЛЕНО
        FACTORY: [
            // Pool Creation
            "function createPool(tuple(string asset, string poolId, uint256 pubX, uint256 pubY, string mpName, string mpSymbol, bool restrictedMp, bytes payoutScript, uint256 calculatorId) params) returns (address poolAddress, address mpTokenAddress)",

            // Dependencies
            "function setDependencies(address _spv, address _frost, address _calcRegistry, address _aggregator, address _validator, address _oracleRegistry, address _tokenFactory, address _multiPoolDAO)",

            // Pool Management
            "function getPoolCount() view returns (uint256)",
            "function getPoolAt(uint256 index) view returns (address)",
            "function poolsInfo(address) view returns (tuple(address poolCore, address mpToken, string poolId, bool isActive, uint256 createdAt, address creator))",
            "function isValidPool(address) view returns (bool)",
            "function poolsByAsset(string) view returns (address)",

            // Role Management - ДОБАВЛЕНО
            "function POOL_MANAGER_ROLE() view returns (bytes32)",
            "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "function grantRole(bytes32 role, address account)",

            // События
            "event PoolCreated(address indexed poolCore, address indexed mpToken, string asset, string poolId, address creator)"
        ],

        // ИСПРАВЛЕННЫЕ ABI для MEMBERSHIP_SBT
        MEMBERSHIP_SBT: [
            "function balanceOf(address owner) view returns (uint256)",
            "function tokenOf(address owner) view returns (uint256)",
            "function membershipOf(uint256 tokenId) view returns (tuple(bytes32 poolId, bytes32 role, uint256 joinTimestamp, bool active))",
            "function mint(address to, bytes32 poolId, bytes32 role, string tokenURI) returns (uint256)",

            // ДОБАВЛЕНЫ правильные события
            "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
            "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
            "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
            "event MembershipMinted(address indexed to, uint256 indexed tokenId, bytes32 poolId, bytes32 role)",
            "event MembershipBurned(uint256 indexed tokenId)"
        ],

        ROLE_BADGE_SBT: [
            "function balanceOf(address account, uint256 id) view returns (uint256)",
            "function activeTemplateOf(uint256 tokenId) view returns (uint256)"
        ]
    },

    // DKG Configuration
    FROST_PURPOSES: {
        SIGNATURE: 0,
        SIGNING: 1,
        CUSTODIAL: 2,
        POOL_MANAGEMENT: 3,
        THRESHOLD_WALLET: 4,
        GOVERNANCE: 5,
        DKG: 6  // Основной тип для DKG сессий
    },

    // User Roles - БЕЗ ИЗМЕНЕНИЙ
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

        // ИСПРАВЛЕНО: Используем прямой API Gateway endpoint для requests
        REQUESTS: 'https://yg7ea875jj.execute-api.eu-north-1.amazonaws.com/prod',

        // ПОЛНЫЕ ENDPOINTS - включая /api для mining, без /api для requests
        ENDPOINTS: {
            // Mining API endpoints (с /api)
            STATS: '/api/stats',
            POOLS: '/api/pools',
            WORKERS: '/api/workers',
            BLOCKS: '/api/blocks',
            SHARES: '/api/shares',
            MINING_START: '/api/mining/start',
            MINING_STOP: '/api/mining/stop',

            // Wallet endpoints (с /api)
            WALLET_BALANCE: '/api/simple-wallet/balance/',
            SIMULATE_RECEIVE: '/api/simple-wallet/simulate-receive',

            // Request system endpoints (БЕЗ /api - это API Gateway)
            REQUESTS: '/requests',
            MESSAGES: '/messages',
            DKG_REQUESTS: '/dkg-requests',

            // SPV endpoints (с /api)
            SPV_PROOF: '/api/spv/proof/',

            // Transaction endpoints (с /api)
            TRANSACTIONS: '/api/transactions'
        }
    },

    // =============== ДОБАВЛЕНЫ ОТСУТСТВУЮЩИЕ КОНФИГУРАЦИИ ===============
    APP_SETTINGS: {
        NOTIFICATION_TIMEOUT: 5000,
        MAX_DKG_PARTICIPANTS: 10,
        DEFAULT_DKG_THRESHOLD: 2,
        DEFAULT_DKG_DEADLINE_HOURS: 24,
        POLLING_INTERVAL: 30000  // 30 секунд для обновлений
    },

    // UI Configuration - ДОБАВЛЕНО для исправления ошибок
    UI_CONFIG: {
        AUTO_REFRESH: false,  // Отключаем автообновления
        THEME: 'dark',
        ANIMATION_DURATION: 300,
        NOTIFICATION_POSITION: 'top-right'
    },

    // =============== ДОПОЛНИТЕЛЬНЫЕ ПОЛЕЗНЫЕ КОНСТАНТЫ ===============

    // API Base URLs для обратной совместимости
    API_BASE_URL: 'https://api-mining.unilayer.solutions/api',  // Основной API
    API_REQUESTS_URL: 'https://yg7ea875jj.execute-api.eu-north-1.amazonaws.com/prod',  // Requests API

    // Explorer URL для транзакций
    EXPLORER_URL: 'https://sepolia.etherscan.io',

    // Timeouts
    TIMEOUTS: {
        API_REQUEST: 30000,        // 30 секунд для API запросов
        TRANSACTION_WAIT: 300000,  // 5 минут для ожидания транзакций
        CONNECTION_RETRY: 5000     // 5 секунд между попытками подключения
    },

    // Gas limits для различных операций
    GAS_LIMITS: {
        SIMPLE_TX: 21000,
        CONTRACT_CALL: 100000,
        CONTRACT_DEPLOY: 2000000,
        DKG_SESSION_CREATE: 500000,
        POOL_CREATE: 800000
    }
};

// Экспорт для глобального использования
window.CONFIG = CONFIG;
