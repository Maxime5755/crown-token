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

// Initialize data
async function initData() {
    try {
        console.log("🚀 Initialisation des données $CROWN...");
        
        // Initialiser les connexions au contrat
        const contractsInitialized = await initContracts();
        if (!contractsInitialized) {
            throw new Error("Échec de l'initialisation des contrats");
        }
        
        // Get data sequentially to avoid errors
        console.log("👑 Récupération des infos du CROWN...");
        try {
            const crown = await contract.Crown();
            console.log("Crown address:", crown);
            document.getElementById('crown-address').textContent = crown;
        } catch (e) {
            console.error("Error getting Crown:", e);
            document.getElementById('crown-address').textContent = "Erreur de chargement";
        }
        
        try {
            const biggestBuy = await contract.biggestBuy();
            console.log("Biggest buy:", ethers.utils.formatEther(biggestBuy));
            updateValue('biggest-buy-value', parseFloat(ethers.utils.formatEther(biggestBuy)));
            updateValue('crown-buy-amount', parseFloat(ethers.utils.formatEther(biggestBuy)));
        } catch (e) {
            console.error("Error getting biggest buy:", e);
        }
        
        // Initialize chart
        initPriceChart();
        
        console.log("✅ Initialisation des données terminée");
    } catch (e) {
        console.error("❌ Erreur d'initialisation:", e);
        document.querySelectorAll('.loader').forEach(loader => {
            loader.parentNode.textContent = "Erreur de chargement";
        });
    }
}

// Initialize price chart
function initPriceChart() {
    try {
        console.log("📈 Initialisation du graphique...");
        const ctx = document.getElementById('price-chart').getContext('2d');
        
        // Generate sample data
        const labels = [];
        const data = [];
        const now = new Date();
        
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }));
            
            // Random price trend with volatility and uptrend
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
                                return '$' + value.toFixed(8);
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initData);