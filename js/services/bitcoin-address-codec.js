// js/bitcoin-address-codec.js
/**
 * Bitcoin Address Codec v1.0
 * Unified encoding/decoding for Bitcoin addresses across mainnet/testnet
 * Supports: P2PKH, P2WPKH (bech32), P2TR (taproot)
 */

class BitcoinAddressCodec {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize codec with network configuration
     */
    initialize() {
        if (this.initialized) return;

        if (!window.bitcoin) {
            console.error('bitcoinjs-lib not loaded');
            throw new Error('Bitcoin library required');
        }

        // Verify CONFIG.BITCOIN exists
        if (!CONFIG.BITCOIN) {
            throw new Error('CONFIG.BITCOIN not configured');
        }

        this.initialized = true;
        console.log('BitcoinAddressCodec initialized for network:', CONFIG.BITCOIN.NETWORK);
    }

    /**
     * Get current network configuration
     */
    getNetwork() {
        const network = CONFIG.BITCOIN.NETWORK;
        if (network === 'mainnet') {
            return bitcoin.networks.bitcoin;
        } else if (network === 'testnet') {
            return bitcoin.networks.testnet;
        } else {
            throw new Error(`Unknown network: ${network}`);
        }
    }

    /**
     * Get network prefixes
     */
    getPrefixes() {
        const network = CONFIG.BITCOIN.NETWORK;
        return CONFIG.BITCOIN.PREFIXES[network];
    }

    /**
     * Detect address type from string
     */
    getAddressType(address) {
        if (!address || typeof address !== 'string') {
            return null;
        }

        const addr = address.trim().toLowerCase();
        const prefixes = this.getPrefixes();

        // Bech32 (P2WPKH)
        if (addr.startsWith(prefixes.BECH32 + '1q')) {
            return 'p2wpkh';
        }

        // Bech32m (P2TR)
        if (addr.startsWith(prefixes.BECH32 + '1p')) {
            return 'p2tr';
        }

        // P2PKH Legacy
        if (CONFIG.BITCOIN.NETWORK === 'testnet') {
            if (addr.startsWith('m') || addr.startsWith('n')) {
                return 'p2pkh';
            }
        } else {
            if (addr.startsWith('1')) {
                return 'p2pkh';
            }
        }

        // P2SH
        if (CONFIG.BITCOIN.NETWORK === 'testnet' && addr.startsWith('2')) {
            return 'p2sh';
        } else if (CONFIG.BITCOIN.NETWORK === 'mainnet' && addr.startsWith('3')) {
            return 'p2sh';
        }

        return null;
    }

    /**
     * Validate Bitcoin address
     */
    validate(address) {
        try {
            if (!address || typeof address !== 'string') {
                return {
                    valid: false,
                    error: 'Address must be a string'
                };
            }

            const trimmed = address.trim();

            // Length check
            if (trimmed.length < 26 || trimmed.length > 90) {
                return {
                    valid: false,
                    error: 'Invalid address length'
                };
            }

            // Detect type
            const type = this.getAddressType(trimmed);
            if (!type) {
                return {
                    valid: false,
                    error: 'Unknown address format'
                };
            }

            // Network check
            const prefixes = this.getPrefixes();
            const network = CONFIG.BITCOIN.NETWORK;

            if (type === 'p2wpkh' || type === 'p2tr') {
                if (!trimmed.startsWith(prefixes.BECH32)) {
                    return {
                        valid: false,
                        error: `Wrong network. Expected ${network} address starting with ${prefixes.BECH32}1`
                    };
                }
            }

            // Try to parse with bitcoinjs-lib
            const btcNetwork = this.getNetwork();

            try {
                if (type === 'p2wpkh') {
                    bitcoin.address.fromBech32(trimmed);
                } else if (type === 'p2pkh') {
                    bitcoin.address.fromBase58Check(trimmed);
                }
            } catch (error) {
                return {
                    valid: false,
                    error: 'Invalid address checksum or format'
                };
            }

            return {
                valid: true,
                type: type,
                network: network
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Encode Bitcoin address to payoutScript (hex bytes)
     */
    encode(address, network = null) {
        try {
            if (!this.initialized) this.initialize();

            const validation = this.validate(address);
            if (!validation.valid) {
                throw new Error(`Invalid address: ${validation.error}`);
            }

            const btcNetwork = network ?
                (network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet) :
                this.getNetwork();

            const type = validation.type;
            let payment;

            switch (type) {
                case 'p2wpkh':
                    // Bech32 → P2WPKH script
                    payment = bitcoin.payments.p2wpkh({
                        address: address.trim(),
                        network: btcNetwork
                    });
                    break;

                case 'p2pkh':
                    // Legacy → P2PKH script
                    payment = bitcoin.payments.p2pkh({
                        address: address.trim(),
                        network: btcNetwork
                    });
                    break;

                case 'p2tr':
                    // Taproot → P2TR script
                    payment = bitcoin.payments.p2tr({
                        address: address.trim(),
                        network: btcNetwork
                    });
                    break;

                default:
                    throw new Error(`Unsupported address type: ${type}`);
            }

            const script = '0x' + payment.output.toString('hex');

            console.log('Encoded address:', {
                address: address.trim(),
                type,
                script,
                length: script.length
            });

            return script;

        } catch (error) {
            console.error('Encoding error:', error);
            throw error;
        }
    }

    /**
     * Decode payoutScript (hex bytes) to Bitcoin address
     */
    decode(script, network = null) {
        try {
            if (!this.initialized) this.initialize();

            if (!script || script === '0x') {
                return null;
            }

            const scriptHex = script.startsWith('0x') ? script.slice(2) : script;
            const btcNetwork = network ?
                (network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet) :
                this.getNetwork();

            const prefixes = network ?
                CONFIG.BITCOIN.PREFIXES[network] :
                this.getPrefixes();

            // P2PKH: 76a914{20-byte-hash}88ac (50 hex chars)
            if (scriptHex.length === 50 &&
                scriptHex.startsWith('76a914') &&
                scriptHex.endsWith('88ac')) {

                const pubkeyHash = scriptHex.slice(6, 46);
                const payment = bitcoin.payments.p2pkh({
                    hash: Buffer.from(pubkeyHash, 'hex'),
                    network: btcNetwork
                });

                console.log(`Decoded P2PKH address (${CONFIG.BITCOIN.NETWORK}):`, payment.address);
                return payment.address;
            }

            // P2WPKH: 0014{20-byte-hash} (44 hex chars)
            if (scriptHex.length === 44 && scriptHex.startsWith('0014')) {
                const data = Buffer.from(scriptHex.slice(4), 'hex');
                const payment = bitcoin.payments.p2wpkh({
                    hash: data,
                    network: btcNetwork
                });

                console.log(`Decoded P2WPKH address (${CONFIG.BITCOIN.NETWORK}):`, payment.address);
                return payment.address;
            }

            // P2TR: 5120{32-byte-hash} (68 hex chars)
            if (scriptHex.length === 68 && scriptHex.startsWith('5120')) {
                const data = Buffer.from(scriptHex.slice(4), 'hex');
                const payment = bitcoin.payments.p2tr({
                    pubkey: data,
                    network: btcNetwork
                });

                console.log(`Decoded P2TR address (${CONFIG.BITCOIN.NETWORK}):`, payment.address);
                return payment.address;
            }

            // P2SH: a914{20-byte-hash}87 (46 hex chars)
            if (scriptHex.length === 46 &&
                scriptHex.startsWith('a914') &&
                scriptHex.endsWith('87')) {

                const scriptHash = scriptHex.slice(4, 44);
                const payment = bitcoin.payments.p2sh({
                    hash: Buffer.from(scriptHash, 'hex'),
                    network: btcNetwork
                });

                console.log(`Decoded P2SH address (${CONFIG.BITCOIN.NETWORK}):`, payment.address);
                return payment.address;
            }

            console.warn('Unknown payout script format:', scriptHex);
            return null;

        } catch (error) {
            console.error('Decoding error:', error);
            return null;
        }
    }

    /**
     * Normalize address (lowercase, trim)
     */
    normalize(address) {
        if (!address || typeof address !== 'string') {
            return null;
        }
        return address.trim().toLowerCase();
    }

    /**
     * Check if address matches network
     */
    isCorrectNetwork(address) {
        const validation = this.validate(address);
        return validation.valid && validation.network === CONFIG.BITCOIN.NETWORK;
    }

    /**
     * Get recommended address type for current network
     */
    getRecommendedType() {
        return 'p2wpkh'; // bech32 - lowest fees
    }

    /**
     * Format address for display (shortened)
     */
    formatForDisplay(address, chars = 8) {
        if (!address || address.length <= chars * 2 + 3) {
            return address;
        }
        return `${address.slice(0, chars)}...${address.slice(-chars)}`;
    }
}

// Global singleton instance
window.bitcoinAddressCodec = new BitcoinAddressCodec();
