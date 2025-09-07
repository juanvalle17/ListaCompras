// Servicio para manejar las llamadas a la API
class ApiService {
    static async getListas() {
        try {
            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.LISTAS), {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Error al obtener listas');
            return await response.json();
        } catch (error) {
            console.error('Error en getListas:', error);
            throw error;
        }
    }

    static async createLista(nombre) {
        try {
            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.LISTAS), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ nombre })
            });
            if (!response.ok) throw new Error('Error al crear lista');
            return await response.json();
        } catch (error) {
            console.error('Error en createLista:', error);
            throw error;
        }
    }

    static async deleteLista(listaId) {
        try {
            const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.LISTAS}/${listaId}`), {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Error al eliminar lista');
            return await response.json();
        } catch (error) {
            console.error('Error en deleteLista:', error);
            throw error;
        }
    }

    static async addItem(listaId, item) {
        try {
            const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.LISTAS}/${listaId}/items`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    nombre: item.nombre,
                    cantidad: item.cantidad,
                    categoria: item.categoria,
                    prioridad: item.prioridad
                })
            });
            if (!response.ok) throw new Error('Error al agregar item');
            return await response.json();
        } catch (error) {
            console.error('Error en addItem:', error);
            throw error;
        }
    }

    static async getItemsByLista(listaId) {
        try {
            const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.LISTAS}/${listaId}/items`), {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Error al obtener items');
            return await response.json();
        } catch (error) {
            console.error('Error en getItemsByLista:', error);
            throw error;
        }
    }

    static async updateLista(listaId, data) {
        try {
            const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.LISTAS}/${listaId}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error al actualizar lista:', error);
            throw error;
        }
    }
}
