// Configuración de la API
const API_CONFIG = {
    BASE_URL: 'http://localhost:5000',
    ENDPOINTS: {
        LISTAS: '/listas',
        ITEMS: '/items'
    }
};

// Función para construir URLs completas
function buildApiUrl(endpoint) {
    return `${API_CONFIG.BASE_URL}${endpoint}`;
}
