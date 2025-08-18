```markdown
# SatoshiFi Frontend

Decentralized mining pool management system on Ethereum.

## Overview

SatoshiFi provides infrastructure for mining pool operators to manage pools with on-chain transparency, federated custody, and DeFi integration. The system uses SPV verification for Bitcoin transactions and threshold signatures for security.

## Architecture

### Smart Contracts (Ethereum)

- **MiningPoolDAO** - Tracks miner shares, registers rewards, manages withdrawals
- **SPVContract** - Verifies Bitcoin block headers and Merkle proofs
- **FROST Coordinator** - Manages threshold signature generation
- **BIP340Verifier** - Validates Schnorr signatures for Taproot transactions
- **StakingContract** - Enables reward staking with yield generation
- **LendingContract** - Provides loans against staked positions
- **CustodyContract** - Manages federated custody with 5-of-7 threshold

### Off-chain Services

- **SPV Monitor** (Python) - Tracks Bitcoin blocks and submits proofs
- **Withdrawal Builder** - Constructs Taproot transactions

## Key Features

- SPV verification of Bitcoin transactions on Ethereum
- FROST 5-of-7 threshold signatures for custody
- Automatic mp-token collateralization (1:1 with BTC)
- Staking rewards (5-15% APY)
- Lending up to 75% LTV
- Sub-pool creation for mining associations

## Installation

```bash
git clone https://github.com/SatoshiFi/FrontEnd.git
cd FrontEnd
npm install
npm run dev
```

## Project Structure

```
FrontEnd/
├── index.html              # Landing page
├── css/                    # Styles
├── js/                     # Core logic
│   └── btc/               # Bitcoin integration
├── lang/                   # i18n (10 languages)
└── api/                    # Backend proxy
```

## Development

- `main` - Production branch
- `develop` - Development branch
- Create feature branches from `develop`
- Submit PRs to `develop`

## Contact

- Email: sb@unilayer.solutions
- GitHub: https://github.com/SatoshiFi
```
