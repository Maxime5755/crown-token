// Configuration des constantes
const CONTRACT_ADDRESS = '0xd9e0b74fd13EdD3Df8338cEd2c4072880eD9D099';
const DEX_PAIR_ADDRESS = '0x12fb298A577C3c839FD3a0B66bdB17C939c3C620';
const WETH_ADDRESS = '0x3439153EB7AF838Ad19d56E1571FBD09333C2809';
const ABSTRACT_RPC_URL = 'https://fittest-morning-glitter.abstract-mainnet.quiknode.pro/27b2af0cad7ddaee33be3cf89b88314170b0b0e6/';

// Variables globales
let provider;
let contract;
let pairContract;
let priceChart;

// Format number with commas
function formatNumber(num) {
    if (num === undefined || num === null) return '--';
    
    if (typeof num === 'string') {
        num = parseFloat(num);
    }
    
    if (isNaN(num)) return '--';
    
    if (num < 0.000001) {
        return num.toExponential(6);
    }
    
    if (num < 0.01) {
        return num.toFixed(8);
    }
    
    if (num < 1) {
        return num.toFixed(4);
    }
    
    if (num < 1000) {
        return num.toFixed(2);
    }
    
    if (num < 1000000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    
    return (num / 1000000).toFixed(2) + 'M';
}

// Mettre à jour un élément avec une nouvelle valeur
function updateValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = formatNumber(value);
    }
}

// Format time remaining
function formatTimeRemaining(seconds) {
    if (seconds <= 0) return "Réinitialisation imminente";
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    let result = '';
    if (days > 0) result += `${days}j `;
    if (hours > 0) result += `${hours}h `;
    result += `${minutes}m`;
    
    return result;
}

// Update countdown timer
function updateCountdown(seconds) {
    if (seconds <= 0) {
        document.getElementById('countdown-days').textContent = "0";
        document.getElementById('countdown-hours').textContent = "0";
        document.getElementById('countdown-minutes').textContent = "0";
        document.getElementById('countdown-seconds').textContent = "0";
        return;
    }
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    document.getElementById('countdown-days').textContent = days;
    document.getElementById('countdown-hours').textContent = hours;
    document.getElementById('countdown-minutes').textContent = minutes;
    document.getElementById('countdown-seconds').textContent = secs;
}

// Format ETH address
function formatAddress(address) {
    if (!address) return '--';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Copy to clipboard
function copyToClipboard(element) {
    const el = document.querySelector(element);
    const text = el.textContent.trim();
    
    navigator.clipboard.writeText(text).then(() => {
        const icon = el.querySelector('.fa-copy');
        if (icon) {
            icon.className = 'fas fa-check';
            setTimeout(() => {
                icon.className = 'fas fa-copy';
            }, 2000);
        }
    }).catch(err => {
        console.error('Erreur lors de la copie :', err);
        alert('Adresse copiée : ' + text);
    });
}

// Fonction pour traiter les erreurs avec retry
async function fetchWithRetry(fetchFunction, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await fetchFunction();
        } catch (error) {
            retries++;
            console.warn(`Tentative ${retries}/${maxRetries} échouée:`, error);
            if (retries === maxRetries) {
                console.error(`Échec après ${maxRetries} tentatives:`, error);
                throw error;
            }
            // Attendre avant de réessayer (backoff exponentiel)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
        }
    }
}

// Initialize contracts with retry
async function initContracts() {
    try {
        console.log("📡 Connexion au RPC Abstract...");
        provider = new ethers.providers.JsonRpcProvider(ABSTRACT_RPC_URL);
        
        const abi = [
            "function biggestBuy() view returns (uint256)",
            "function resetPeriod() view returns (uint256)",
            "function lastCrownChange() view returns (uint256)",
            "function Crown() view returns (address)",
            "function totalSupply() view returns (uint256)",
            "function decimals() view returns (uint8)",
            "event CrownPayout(address crown, uint256 amountETH)"
        ];
        
        const pairAbi = [
            "function getReserves() view returns (uint112, uint112, uint32)",
            "function token0() view returns (address)",
            "function token1() view returns (address)"
        ];
        
        contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
        pairContract = new ethers.Contract(DEX_PAIR_ADDRESS, pairAbi, provider);
        
        // Test connection
        await provider.getBlockNumber();
        console.log("✅ Connecté au réseau Abstract");
        
        return true;
    } catch (e) {
        console.error("❌ Erreur d'initialisation du contrat:", e);
        return false;
    }
}

// Get Crown information avec gestion d'erreur améliorée
async function getCrownInfo() {
    try {
        return await fetchWithRetry(async () => {
            console.log("👑 Récupération des infos du CROWN...");
            const crown = await contract.Crown();
            const biggestBuy = await contract.biggestBuy();
            const resetPeriod = await contract.resetPeriod();
            const lastCrownChange = await contract.lastCrownChange();

            const now = Math.floor(Date.now() / 1000);
            const resetTime = lastCrownChange.toNumber() + resetPeriod.toNumber();
            const remaining = resetTime > now ? resetTime - now : 0;

            // Mettre à jour l'adresse avec le format plus court
            document.getElementById('crown-address').textContent = crown;

            updateValue('crown-buy-amount', parseFloat(ethers.utils.formatEther(biggestBuy)));
            document.getElementById('crown-time-remaining').textContent = formatTimeRemaining(remaining);
            updateValue('biggest-buy-value', parseFloat(ethers.utils.formatEther(biggestBuy)));
            
            updateCountdown(remaining);
            console.log("✅ Infos CROWN récupérées");

            return {
                crown,
                biggestBuy: ethers.utils.formatEther(biggestBuy),
                timeRemaining: remaining,
                lastCrownChange: lastCrownChange.toNumber(),
                resetPeriod: resetPeriod.toNumber()
            };
        });
    } catch (e) {
        console.error("❌ Erreur de récupération des infos CROWN:", e);
        document.getElementById('crown-address').textContent = "Erreur de chargement";
        document.getElementById('crown-time-remaining').textContent = "--";
        document.getElementById('biggest-buy-value').textContent = "--";
        document.getElementById('crown-buy-amount').textContent = "--";
        return null;
    }
}

// Get Crown rewards with improved error handling
async function getCrownRewards() {
    try {
        return await fetchWithRetry(async () => {
            console.log("💰 Récupération des récompenses CROWN...");
            
            // Récupérer par blocs de 10000 pour éviter les timeout
            const fromBlock = 6703915; // Block de départ
            const latestBlock = await provider.getBlockNumber();
            let totalRewards = ethers.BigNumber.from(0);
            
            // Parcourir les blocs par tranches pour éviter les timeouts
            const batchSize = 100000; // Taille des lots
            for (let startBlock = fromBlock; startBlock <= latestBlock; startBlock += batchSize) {
                const endBlock = Math.min(startBlock + batchSize - 1, latestBlock);
                console.log(`📊 Analyse des blocs ${startBlock} à ${endBlock}...`);
                
                try {
                    const filter = contract.filters.CrownPayout();
                    const logs = await contract.queryFilter(filter, startBlock, endBlock);
                    
                    for (const event of logs) {
                        totalRewards = totalRewards.add(event.args.amountETH);
                    }
                    
                    console.log(`✅ ${logs.length} événements trouvés dans ce lot`);
                } catch (batchError) {
                    console.warn(`⚠️ Erreur de lot, poursuite avec le lot suivant:`, batchError);
                }
            }
            
            const formattedRewards = ethers.utils.formatEther(totalRewards);
            updateValue('crown-rewards', parseFloat(formattedRewards));
            console.log(`✅ Total des récompenses: ${formattedRewards} ETH`);
            
            return formattedRewards;
        });
    } catch (error) {
        console.error("❌ Erreur de récupération des récompenses:", error);
        document.getElementById('crown-rewards').textContent = "0.0000";
        return "0.0000";
    }
}

// Get ETH price in USD
async function getEthPriceInUSD() {
    try {
        return await fetchWithRetry(async () => {
            console.log("💲 Récupération du prix ETH...");
            const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
            const json = await res.json();
            console.log(`✅ Prix ETH: ${json.ethereum.usd} USD`);
            return json.ethereum.usd;
        });
    } catch (e) {
        console.warn("⚠️ Utilisation du prix ETH par défaut");
        return 3000; // Default fallback price
    }
}

// Get token price avec gestion d'erreur améliorée
async function getTokenPrice() {
    try {
        return await fetchWithRetry(async () => {
            console.log("💲 Récupération du prix $CROWN...");
            const [r0, r1] = await pairContract.getReserves();
            const token0 = await pairContract.token0();
            const ethPrice = await getEthPriceInUSD();

            const [tokenRes, ethRes] = token0.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() 
                ? [r0, r1] 
                : [r1, r0];

            const priceETH = ethRes / tokenRes;
            const priceUSD = priceETH * ethPrice;

            updateValue('price-value', priceUSD);
            console.log(`✅ Prix $CROWN: ${priceUSD} USD (${priceETH} ETH)`);
            
            return { priceETH, priceUSD };
        });
    } catch (e) {
        console.error("❌ Erreur de récupération du prix:", e);
        document.getElementById('price-value').textContent = "--";
        return { priceETH: 0, priceUSD: 0 };
    }
}

// Get market cap
async function getMarketCap(priceUSD) {
    try {
        return await fetchWithRetry(async () => {
            console.log("📊 Calcul de la capitalisation de marché...");
            const supply = await contract.totalSupply();
            const decimals = await contract.decimals();
            const formattedSupply = ethers.utils.formatUnits(supply, decimals);
            const mcap = parseFloat(formattedSupply) * priceUSD;
            
            updateValue('mcap-value', mcap);
            console.log(`✅ Market Cap: ${mcap} USD`);
            
            return mcap;
        });
    } catch (e) {
        console.error("❌ Erreur de calcul de la capitalisation:", e);
        document.getElementById('mcap-value').textContent = "--";
        return 0;
    }
}

// Get liquidity
async function getLiquidity() {
    try {
        return await fetchWithRetry(async () => {
            console.log("💧 Récupération de la liquidité...");
            const [r0, r1] = await pairContract.getReserves();
            const token0 = await pairContract.token0();
            const ethPrice = await getEthPriceInUSD();

            const ethReserve = token0.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() ? r1 : r0;
            const ethValue = ethers.utils.formatEther(ethReserve);
            const liquidityUSD = parseFloat(ethValue) * ethPrice * 2; // Multiply by 2 for both sides of liquidity
            
            updateValue('liquidity-value', liquidityUSD);
            console.log(`✅ Liquidité: ${liquidityUSD} USD`);
            
            return liquidityUSD;
        });
    } catch (e) {
        console.error("❌ Erreur de récupération de la liquidité:", e);
        document.getElementById('liquidity-value').textContent = "--";
        return 0;
    }
}

// Initialize price chart
function initPriceChart() {
    try {
        console.log("📈 Initialisation du graphique...");
        const ctx = document.getElementById('price-chart').getContext('2d');
        
        // Generate some sample data for now
        const labels = [];
        const data = [];
        const now = new Date();
        
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }));
            
            // Random price trend with some volatility but general uptrend
            const baseValue = 0.0001;
            const volatility = 0.00005;
            const uptrend = 0.000003 * (30 - i);
            data.push(baseValue + (Math.random() * volatility) + uptrend);
        }
        
        // Create chart
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Prix $CROWN (USD)',
                    data: data,
                    borderColor: '#00DC5A',
                    backgroundColor: 'rgba(0, 220, 90, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#00DC5A',
                        bodyColor: '#FFFFFF',
                        borderColor: '#00DC5A',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#aaaaaa',
                            maxRotation: 0,
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#aaaaaa',
                            callback: function(value) {
                                return ' + value.toFixed(8);
                            }
                        }
                    }
                }
            }
        });
        console.log("✅ Graphique initialisé");
        return true;
    } catch (e) {
        console.error("❌ Erreur d'initialisation du graphique:", e);
        return false;
    }
}

// Initialize data
async function initData() {
    try {
        console.log("🚀 Initialisation des données $CROWN...");
        
        // Initialiser les connexions au contrat
        const contractsInitialized = await initContracts();
        if (!contractsInitialized) {
            throw new Error("Échec de l'initialisation des contrats");
        }
        
        // Get all data in parallel
        const crownInfo = await getCrownInfo();
        
        // Obtenir le prix et la capitalisation
        const price = await getTokenPrice();
        if (price && price.priceUSD > 0) {
            await getMarketCap(price.priceUSD);
        }
        
        // Obtenir la liquidité et les récompenses
        await Promise.all([
            getLiquidity(),
            getCrownRewards()
        ]);
        
        // Initialize chart after data is loaded
        initPriceChart();
        
        console.log("✅ Initialisation des données terminée");
        
        // Schedule regular updates
        setInterval(async () => {
            try {
                console.log("🔄 Mise à jour des données...");
                const [updatedCrownInfo, updatedPrice] = await Promise.all([
                    getCrownInfo(),
                    getTokenPrice()
                ]);
                
                if (updatedPrice && updatedPrice.priceUSD > 0) {
                    await getMarketCap(updatedPrice.priceUSD);
                }
                
                await Promise.all([
                    getLiquidity(),
                    getCrownRewards()
                ]);
                
                console.log("✅ Données mises à jour");
            } catch (e) {
                console.error("❌ Erreur de mise à jour des données:", e);
            }
        }, 60000); // Mise à jour toutes les minutes
        
        // Update countdown every second
        setInterval(() => {
            if (crownInfo) {
                const now = Math.floor(Date.now() / 1000);
                const resetTime = crownInfo.lastCrownChange + crownInfo.resetPeriod;
                const remaining = resetTime > now ? resetTime - now : 0;
                updateCountdown(remaining);
            }
        }, 1000);
        
    } catch (e) {
        console.error("❌ Erreur d'initialisation:", e);
        document.querySelectorAll('.loader').forEach(loader => {
            loader.parentNode.textContent = "Erreur de chargement";
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initData);