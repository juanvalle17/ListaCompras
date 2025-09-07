// Configuración de la API
const API_BASE_URL = 'http://127.0.0.1:5000';
const API_CONFIG = {
    BASE_URL: API_BASE_URL,
    ENDPOINTS: {
        LISTAS: '/listas',
        ITEMS: '/items',
        UPDATE_ITEM: '/listas/{lista_id}/items/{item_id}'
    }
};

// Función para construir URLs completas
function buildApiUrl(endpoint) {
    return `${API_CONFIG.BASE_URL}${endpoint}`;
}
