<?php
/**
 * Bitcoin Testnet API Proxy
 * File: api/btc-proxy.php
 * 
 * This proxy allows HTTPS web applications to communicate with HTTP Bitcoin nodes
 * by acting as an intermediary that handles the RPC calls securely.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Bitcoin node configurations
$NODES = [
    'coordinator' => [
        'ip' => '51.20.82.101',
        'port' => '8332',
        'user' => 'bitcoinuser',
        'pass' => 'bitcoinpass',
        'wallet' => 'mining_rewards'
    ],
    'pool-a' => [
        'ip' => '51.20.82.101',
        'port' => '8332',
        'user' => 'bitcoinuser',
        'pass' => 'bitcoinpass',
        'wallet' => 'pool_a_rewards'
    ],
    'pool-b' => [
        'ip' => '51.20.82.101',
        'port' => '8332',
        'user' => 'bitcoinuser',
        'pass' => 'bitcoinpass',
        'wallet' => 'pool_b_rewards'
    ],
    'tx-generator' => [
        'ip' => '51.20.82.101',
        'port' => '8332',
        'user' => 'bitcoinuser',
        'pass' => 'bitcoinpass',
        'wallet' => 'tx_generator'
    ],
    'worker-0' => [
        'ip' => '13.60.220.75',
        'port' => '8332',
        'user' => 'worker0',
        'pass' => 'workerpass0',
        'wallet' => 'worker_0_rewards'
    ],
    'worker-1' => [
        'ip' => '16.16.91.102',
        'port' => '8332',
        'user' => 'worker1',
        'pass' => 'workerpass1',
        'wallet' => 'worker_1_rewards'
    ],
    'worker-2' => [
        'ip' => '16.170.229.197',
        'port' => '8332',
        'user' => 'worker2',
        'pass' => 'workerpass2',
        'wallet' => 'worker_2_rewards'
    ],
    'worker-3' => [
        'ip' => '16.171.5.254',
        'port' => '8332',
        'user' => 'worker3',
        'pass' => 'workerpass3',
        'wallet' => 'worker_3_rewards'
    ],
    'worker-4' => [
        'ip' => '56.228.42.227',
        'port' => '8332',
        'user' => 'worker4',
        'pass' => 'workerpass4',
        'wallet' => 'worker_4_rewards'
    ],
    'worker-5' => [
        'ip' => '13.60.215.191',
        'port' => '8332',
        'user' => 'worker5',
        'pass' => 'workerpass5',
        'wallet' => 'worker_5_rewards'
    ],
    'worker-6' => [
        'ip' => '16.16.120.35',
        'port' => '8332',
        'user' => 'worker6',
        'pass' => 'workerpass6',
        'wallet' => 'worker_6_rewards'
    ],
    'worker-7' => [
        'ip' => '16.170.169.104',
        'port' => '8332',
        'user' => 'worker7',
        'pass' => 'workerpass7',
        'wallet' => 'worker_7_rewards'
    ],
    'worker-8' => [
        'ip' => '16.171.53.133',
        'port' => '8332',
        'user' => 'worker8',
        'pass' => 'workerpass8',
        'wallet' => 'worker_8_rewards'
    ],
    'worker-9' => [
        'ip' => '13.48.128.167',
        'port' => '8332',
        'user' => 'worker9',
        'pass' => 'workerpass9',
        'wallet' => 'worker_9_rewards'
    ]
];

// Allowed RPC methods for security
$ALLOWED_METHODS = [
    // Read-only methods
    'getblockchaininfo',
    'getnetworkinfo',
    'getmempoolinfo',
    'getpeerinfo',
    'getrawmempool',
    'getrawtransaction',
    'getblock',
    'getblockhash',
    'getblockcount',
    'getbalance',
    'getwalletinfo',
    'listwallets',
    'listtransactions',
    'listunspent',
    'getnewaddress',
    'getaddressinfo',
    'validateaddress',
    // Write methods (for wallet operations)
    'sendtoaddress',
    'sendmany',
    'createwallet',
    'loadwallet',
    'generatetoaddress',
    'generate'
];

// Rate limiting (simple implementation)
$RATE_LIMIT_FILE = '/tmp/btc_proxy_rate_limit.json';
$MAX_REQUESTS_PER_MINUTE = 100;

function checkRateLimit($ip) {
    global $RATE_LIMIT_FILE, $MAX_REQUESTS_PER_MINUTE;
    
    $current_time = time();
    $rate_data = [];
    
    if (file_exists($RATE_LIMIT_FILE)) {
        $rate_data = json_decode(file_get_contents($RATE_LIMIT_FILE), true) ?: [];
    }
    
    // Clean old entries (older than 1 minute)
    $rate_data = array_filter($rate_data, function($timestamp) use ($current_time) {
        return ($current_time - $timestamp) < 60;
    });
    
    // Count requests from this IP in the last minute
    $ip_requests = array_filter($rate_data, function($timestamp, $key) use ($ip) {
        return strpos($key, $ip . '_') === 0;
    }, ARRAY_FILTER_USE_BOTH);
    
    if (count($ip_requests) >= $MAX_REQUESTS_PER_MINUTE) {
        return false;
    }
    
    // Add current request
    $rate_data[$ip . '_' . $current_time . '_' . uniqid()] = $current_time;
    
    // Save updated rate data
    file_put_contents($RATE_LIMIT_FILE, json_encode($rate_data));
    
    return true;
}

// Get client IP
$client_ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// Check rate limit
if (!checkRateLimit($client_ip)) {
    http_response_code(429);
    echo json_encode([
        'success' => false,
        'error' => 'Rate limit exceeded. Maximum ' . $MAX_REQUESTS_PER_MINUTE . ' requests per minute.'
    ]);
    exit;
}

// Parse input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
    exit;
}

// Validate required fields
if (!isset($input['node']) || !isset($input['method'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields: node, method']);
    exit;
}

$node_id = $input['node'];
$method = $input['method'];
$params = $input['params'] ?? [];

// Validate node
if (!isset($NODES[$node_id])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid node ID']);
    exit;
}

// Validate method
if (!in_array($method, $ALLOWED_METHODS)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$node = $NODES[$node_id];

// Prepare RPC request
$rpc_request = [
    'jsonrpc' => '1.0',
    'id' => 'btc-proxy-' . uniqid(),
    'method' => $method,
    'params' => $params
];

// Determine URL (with or without wallet)
$url = "http://{$node['ip']}:{$node['port']}/";
if (isset($node['wallet']) && in_array($method, [
    'getbalance', 'getwalletinfo', 'listtransactions', 'listunspent', 
    'getnewaddress', 'sendtoaddress', 'sendmany'
])) {
    $url .= "wallet/{$node['wallet']}";
}

// Make RPC call
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($rpc_request),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Basic ' . base64_encode($node['user'] . ':' . $node['pass'])
    ],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false
]);

$response = curl_exec($ch);
$curl_error = curl_error($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Handle cURL errors
if ($curl_error) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => 'Connection error: ' . $curl_error,
        'node_info' => ['id' => $node_id, 'ip' => $node['ip']]
    ]);
    exit;
}

// Handle HTTP errors
if ($http_code !== 200) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => 'HTTP error: ' . $http_code,
        'node_info' => ['id' => $node_id, 'ip' => $node['ip']]
    ]);
    exit;
}

// Parse Bitcoin RPC response
$rpc_response = json_decode($response, true);

if (!$rpc_response) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid response from Bitcoin node',
        'node_info' => ['id' => $node_id, 'ip' => $node['ip']]
    ]);
    exit;
}

// Handle Bitcoin RPC errors
if (isset($rpc_response['error']) && $rpc_response['error']) {
    echo json_encode([
        'success' => false,
        'error' => $rpc_response['error']['message'] ?? 'Bitcoin RPC error',
        'error_code' => $rpc_response['error']['code'] ?? null,
        'node_info' => ['id' => $node_id, 'ip' => $node['ip']]
    ]);
    exit;
}

// Success response
echo json_encode([
    'success' => true,
    'result' => $rpc_response['result'],
    'node_info' => [
        'id' => $node_id,
        'name' => ucfirst(str_replace('-', ' ', $node_id)),
        'ip' => $node['ip']
    ],
    'timestamp' => time()
]);

// Log successful request (optional)
error_log("BTC Proxy: {$client_ip} -> {$node_id} -> {$method} -> OK");
?>