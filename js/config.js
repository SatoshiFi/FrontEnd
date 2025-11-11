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
        FROST_COORDINATOR: '0x0465b6dA15608849d5FC91C1994cAf386637B8B6',
        MULTI_POOL_DAO: '0x211D6C755D6820617Bd059a8a4D013a3eb61e8e6',
        SPV_CONTRACT: '0x5996026B44305ABd5F55B69EBB59EfF9Dd81fA99',

        // Factory System
        FACTORY: '0xDa329fDa8CF2CFeBCa17fbb75d478Bf696CB45D9',
        TOKEN_FACTORY: '0xeB3487eB8231914E8a3a7e1180367a3D7ef4C224',
        REWARD_HANDLER: '0xf69b0F330D5aFE4dfb91cb78CBc40fF3e0d63096',
        REDEMPTION_HANDLER: '0x61b9f55FB8CE1304103d35315b7A83763fcB6B6C',
        POOL_DEPLOYER: '0x38b4c78B61B471D007c7E00A5884c5feabc0512f',

        // Calculator System
        CALCULATOR_REGISTRY: '0x3B3f52Def04E8b835F762004089c396227CF9694',
        FPPS_CALCULATOR: '0x18fEFf5E76DB9F7f30A5aE20D01c42d6f19CB65F',
        PPLNS_CALCULATOR: '0x5ccE5E7f01b8b2A3829B1e6dAd16f5D8F1Fcc53b',
        PPS_CALCULATOR: '0xb6a3d22c291Db603aC7e77Fd8aFAE03b2e6c25Fb',
        SCORE_CALCULATOR: '0xd75433a8e4cf8c3dA3CB9C5f2C3BdB9cDE23C89B',

        // Oracle System
        ORACLE_REGISTRY: '0x0d5E386999edd42D6fa6739706cFE8DcF08587C1',
        STRATUM_AGGREGATOR: '0x65E76f4efC92f13A63D6885383aC7A1D7B608A10',
        VALIDATOR: '0x37Cdf3BB9d0B2bb62A833819110a24a661F58e41',

        // Synthetic Tokens
        SBTC: '0xc25D09B611CCb19Bcea4F3C4bA9A28b3097fa3bE',
        SDOGE: '0xfCC39E2Afd6bE41cb1830c87d3EB596c375f2670',
        SLTC: '0xD5a4Ed5fde46E17Da4e5cAa6a1204cA80a731771',

        // Proxy Implementations
        CORE_IMPL: '0x9fB6Af46ecfF3bBF41b95d0f0D99e7d73d9A5bd7',
        REWARDS_IMPL: '0x1EDD5dCb416e74C7aa83F5A3702a98cdb05FE54B',
        REDEMPTION_IMPL: '0xC45b90c92a53Df0d1AF2E0bE8B55bC14cf0b5f0f',
        EXTENSIONS_IMPL: '0x16B95aDa55B4C6C61BBc73ba7D9097a2F1a3Aa13',

        // Legacy
        MEMBERSHIP_SBT: '0xF42F943746A2ba3E5b813bb2A4187417bCF56BE5',
        BRIDGE_INBOX: '0xB84d53Bae116fDEd1d35D71156489d6F5a6cf336',
        BRIDGE_OUTBOX: '0xb7F782CAB5242f7C7C97FC1361e381c48Cc19941',
    },

    ABI: {
        FROST_COORDINATOR: [
            // === DKG Session Management ===
            "function createDKGSession(uint256 threshold, address[] participants) returns (uint256)",
            "function publishNonceCommitment(uint256 sessionId, bytes32 commitment)",
            "function publishEncryptedShare(uint256 sessionId, address recipient, bytes encryptedShare)",
            "function finalizeDKG(uint256 sessionId)",
            "function finalizeDKG(uint256 sessionId, bytes groupPubkey)",
            "function cancelDKGSession(uint256 sessionId)",

            // === Session Creation (Multiple Overloads) ===
            "function createSession(uint256 sessionId, bytes groupPubkey, address[] participants, uint256 threshold, uint256 deadline)",
            "function createSession(uint256 sessionId, bytes groupPubkey, bytes message, string signatureType, uint256 deadline)",
            "function createSession(bytes32 pubKeyX, bytes32 pubKeyY, address[] initialParticipants, uint32 threshold, uint256 deadline, uint8 purpose)",
            "function createSession(bytes32 pubKeyX, bytes32 pubKeyY, address[] initialParticipants, uint32 threshold, uint256 deadline, uint8 purpose, bytes32 messageHash) returns (uint256)",

            // === Session Lifecycle ===
            "function joinSession(uint256 sessionId)",
            "function advancePhase(uint256 sessionId)",
            "function submitNonceCommit(uint256 sessionId, bytes32 commitment)",
            "function submitDKGShare(uint256 sessionId, address recipient, bytes encryptedShare)",
            "function submitSignatureShare(uint256 sessionId, bytes share)",
            "function finalizeSession(uint256 sessionId, bytes signature, bytes32 messageHash)",
            "function finalizeSession(uint256 sessionId, bytes[] shares, bytes aggregatedSignature)",
            "function rejectSignatureRequest(uint256 sessionId, string reason)",

            // === Session Info Getters ===
            "function getSession(uint256 sessionId) view returns (uint256 id, address creator, bytes groupPubkey, bytes32 messageHash, bool messageBound, uint256 threshold, uint256 total, uint64 deadline, bool enforceSharesCheck, address verifierOverride, uint256 state, uint256 commitsCount, uint256 sharesCount, uint256 refusalCount, uint256 purpose, address originContract, uint256 originId, uint16 networkId, bytes32 poolId, uint256 dkgSharesCount)",
            "function getSessionDetails(uint256 sessionId) view returns (uint8 state, uint256 threshold, uint256 totalParticipants, address creator, bytes32 groupPubKeyX, address[] participants)",
            "function getSessionParticipants(uint256 sessionId) view returns (address[])",
            "function nextSessionId() view returns (uint256)",

            // === Participant Data Getters ===
            "function getDKGShare(uint256 sessionId, address sender, address recipient) view returns (bytes)",
            "function getNonceCommitment(uint256 sessionId, address participant) view returns (bytes32)",
            "function getSignatureShare(uint256 sessionId, address participant) view returns (bytes)",
            "function getAggregatedSignature(uint256 sessionId) view returns (bytes)",

            // === Public Key Getters ===
            "function getGroupPubKey(uint256 sessionId) view returns (bytes32 pubKeyX, bytes32 pubKeyY)",
            "function getCompressedGroupPubKey(uint256 sessionId) view returns (bytes)",

            // === Custodians ===
            "function getCustodians() view returns (address[])",
            "function sessionParticipants(uint256, uint256) view returns (address)",

            // === Constants ===
            "function MIN_THRESHOLD() view returns (uint256)",
            "function MAX_PARTICIPANTS() view returns (uint256)",
            "function SESSION_TIMEOUT() view returns (uint256)",
            "function MAX_SHARE_SIZE() view returns (uint256)",

            // === Events ===
            "event SessionCreated(uint256 indexed sessionId, address indexed creator, uint256 threshold, uint256 totalParticipants, uint8 purpose, uint64 deadline)",
            "event SessionOpened(uint256 indexed sessionId, address initiator, uint8 purpose)",
            "event ParticipantJoined(uint256 indexed sessionId, address participant)",
            "event PhaseStarted(uint256 indexed sessionId, uint32 phase)",
            "event NonceCommitted(uint256 indexed sessionId, address participant, bytes32 commitmentHash)",
            "event DKGShareSubmitted(uint256 indexed sessionId, address sender, address receiver, bytes encryptedShare)",
            "event SignatureShareSubmitted(uint256 indexed sessionId, address participant, bytes share)",
            "event SessionFinalized(uint256 indexed sessionId, bytes32 groupPubKey, bool success)",
            "event SessionFailed(uint256 indexed sessionId, string reason)",
            "event SessionProgressedToShares(uint256 indexed sessionId)",
            "event SessionReadyForFinalization(uint256 indexed sessionId)"
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

    // =============== API ===============
    API: {
        MINING: 'https://api-mining.unilayer.solutions',

        REQUESTS: 'https://yg7ea875jj.execute-api.eu-north-1.amazonaws.com/prod',

        ENDPOINTS: {
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

            WALLET_BALANCE: '/api/simple-wallet/balance/',
            WALLET_SEND: '/api/simple-wallet/send',
            WALLET_TRANSACTIONS: '/api/simple-wallet/transactions/',
            SIMULATE_RECEIVE: '/api/simple-wallet/simulate-receive',

            TRANSACTION_SEND: '/api/transaction/send',
            TRANSACTION_MEMPOOL: '/api/transaction/mempool',
            TRANSACTION_BALANCE: '/api/transaction/balance/',
            TRANSACTION_HISTORY: '/api/transaction/history/',
            TRANSACTION_UTXOS: '/api/transaction/utxos/',

            SPV_PROOF: '/api/spv/proof/',

            REQUESTS: '/requests',
            MESSAGES: '/messages',
            DKG_REQUESTS: '/dkg-requests'
        },

        getMiningUrl: function(endpoint) {
            if (!this.ENDPOINTS[endpoint] && !endpoint.startsWith('/api/')) {
                console.warn(`Endpoint ${endpoint} isn't available`);
            }
            const path = this.ENDPOINTS[endpoint] || endpoint;
            return this.MINING + path;
        },

        getRequestsUrl: function(endpoint) {
            if (!this.ENDPOINTS[endpoint] && !endpoint.startsWith('/')) {
                console.warn(`Requests endpoint ${endpoint} isn't available`);
            }
            const path = this.ENDPOINTS[endpoint] || endpoint;
            return this.REQUESTS + path;
        },

        getFullUrl: function(type, endpoint, params = '') {
            let url;
            if (type === 'mining') {
                url = this.getMiningUrl(endpoint);
            } else if (type === 'requests') {
                url = this.getRequestsUrl(endpoint);
            } else {
                console.error(`API unknown: ${type}`);
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
