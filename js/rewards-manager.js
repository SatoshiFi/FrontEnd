// js/rewards-manager.js
class RewardsManager {
    constructor() {
        this.rewardsHistory = [];
    }

    async distributeRewards(poolAddress, amount, periodId, blockHeight) {
        try {
            const rewards = web3Integrator.getContract('REWARDS');

            // Конвертируем BTC в wei (используем 18 decimals для токенов)
            const amountWei = ethers.utils.parseEther(amount.toString());

            // Вызываем функцию распределения наград
            const tx = await rewards.distributeRewards(
                poolAddress,
                amountWei,
                periodId,
                blockHeight
            );

            const receipt = await tx.wait();

            // Сохраняем в историю
            this.rewardsHistory.push({
                poolAddress,
                amount,
                periodId,
                blockHeight,
                txHash: receipt.transactionHash,
                timestamp: new Date(),
                                     distributor: web3Integrator.currentAccount
            });

            return receipt;
        } catch (error) {
            console.error('Distribution error:', error);
            throw error;
        }
    }

    async loadRewardsHistory() {
        try {
            const rewards = web3Integrator.getContract('REWARDS');

            // КРИТИЧНО: Используем очень консервативный подход
            const currentBlock = await web3Integrator.provider.getBlockNumber();

            // Проверяем только последние 500 блоков порциями по 50
            const totalRange = 500;
            const chunkSize = 50;
            const maxRetries = 3;

            let allEvents = [];

            console.log(`Loading events from last ${totalRange} blocks in chunks of ${chunkSize}`);

            for (let offset = 0; offset < totalRange; offset += chunkSize) {
                const fromBlock = currentBlock - totalRange + offset;
                const toBlock = Math.min(currentBlock - totalRange + offset + chunkSize - 1, currentBlock);

                let retries = 0;
                let success = false;

                while (retries < maxRetries && !success) {
                    try {
                        console.log(`Loading chunk: ${fromBlock}-${toBlock} (attempt ${retries + 1})`);

                        const filter = rewards.filters.RewardsDistributed();
                        const events = await Promise.race([
                            rewards.queryFilter(filter, fromBlock, toBlock),
                                                          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                        ]);

                        allEvents = allEvents.concat(events);
                        success = true;

                        if (events.length > 0) {
                            console.log(`Found ${events.length} events in chunk ${fromBlock}-${toBlock}`);
                        }

                        // Обязательная пауза между запросами
                        await new Promise(resolve => setTimeout(resolve, 300));

                    } catch (chunkError) {
                        retries++;
                        console.warn(`Chunk ${fromBlock}-${toBlock} failed (attempt ${retries}):`, chunkError.message);

                        if (retries < maxRetries) {
                            // Увеличиваем паузу при retry
                            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                        }
                    }
                }

                // Если один chunk не загрузился после всех попыток, останавливаемся
                if (!success) {
                    console.warn(`Stopping after failed chunk ${fromBlock}-${toBlock}`);
                    break;
                }
            }

            this.rewardsHistory = allEvents.map(event => {
                return {
                    poolAddress: event.args.pool,
                    amount: ethers.utils.formatEther(event.args.amount),
                                                periodId: event.args.periodId.toNumber(),
                                                blockHeight: event.args.blockHeight.toNumber(),
                                                txHash: event.transactionHash,
                                                blockNumber: event.blockNumber,
                                                distributor: event.args.distributor || 'Unknown'
                };
            });

            this.rewardsHistory.sort((a, b) => b.blockNumber - a.blockNumber);

            console.log(`Successfully loaded ${this.rewardsHistory.length} reward events`);
            return this.rewardsHistory;

        } catch (error) {
            console.error('Error loading rewards history:', error);
            // Не бросаем ошибку, возвращаем пустой массив
            this.rewardsHistory = [];
            return [];
        }
    }

    async refreshRewardsHistoryUI() {
        const container = document.getElementById('rewards-history');

        try {
            uiController.showStatus('Loading rewards history...', 'info');
            const history = await this.loadRewardsHistory();

            if (history.length === 0) {
                container.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                <p style="opacity: 0.7;">No rewards distributed yet.</p>
                <p style="font-size: 0.9em; opacity: 0.5;">
                Rewards will appear here after distribution transactions.
                </p>
                </div>
                `;
                uiController.showStatus('No rewards history found', 'info');
                return;
            }

            // Показываем таблицу как раньше...
            let html = '<table class="rewards-table">...'; // остальной код таблицы

            container.innerHTML = html;
            uiController.showStatus(`Loaded ${history.length} reward records`, 'success');

        } catch (error) {
            console.error('UI Error:', error);
            container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #f87171;">
            <p>Failed to load rewards history</p>
            <p style="font-size: 0.9em;">${error.message}</p>
            <button class="btn btn-secondary" onclick="refreshRewardsHistory()" style="margin-top: 10px;">
            Try Again
            </button>
            </div>
            `;
            uiController.showStatus('Failed to load rewards history', 'error');
        }
    }

    formatAddress(address) {
        if (!address) return 'Unknown';
        return address.slice(0, 6) + '...' + address.slice(-4);
    }
}

// Создаем глобальный экземпляр
window.rewardsManager = new RewardsManager();

// Интеграция с UI
window.distributeRewards = async function() {
    try {
        const poolAddress = document.getElementById('reward-pool').value;
        const amount = document.getElementById('reward-amount').value;
        const periodId = document.getElementById('period-id').value;
        const blockHeight = document.getElementById('block-height').value;

        if (!poolAddress || !amount || !periodId || !blockHeight) {
            throw new Error('Please fill in all fields');
        }

        uiController.showStatus('Distributing rewards...', 'info');

        const receipt = await rewardsManager.distributeRewards(
            poolAddress,
            parseFloat(amount),
                                                               parseInt(periodId),
                                                               parseInt(blockHeight)
        );

        uiController.showStatus(`Rewards distributed! TX: ${receipt.transactionHash}`, 'success');

        // Обновляем историю
        await rewardsManager.refreshRewardsHistoryUI();

    } catch (error) {
        uiController.showStatus('Error: ' + error.message, 'error');
    }
};

window.refreshRewardsHistory = async function() {
    try {
        uiController.showStatus('Loading rewards history...', 'info');
        await rewardsManager.refreshRewardsHistoryUI();
        uiController.showStatus('History loaded', 'success');
    } catch (error) {
        uiController.showStatus('Error loading history: ' + error.message, 'error');
    }
};

// Стили перенесены в pool-manager.css
