// Variables globales
let currentItems = [];
let shoppingLists = [];
let currentFilter = 'Todos';

// Iconos para categorías
const categoryIcons = {
    'Alimentos': '🥬',
    'Hogar': '🏠',
    'Higiene Personal': '🧴',
    'Limpieza': '🧽',
    'Ropa': '👕',
    'Electrónicos': '📱',
    'Medicamentos': '💊',
    'Mascotas': '🐕',
    'Otros': '📦'
};

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    await loadListasFromAPI();
    updateListsCount();
    renderLists();
    updatePriorityDisplay();
    
    // Event listener para el slider de prioridad
    document.getElementById('item-priority').addEventListener('input', updatePriorityDisplay);
    
    // Event listeners para validación en tiempo real
    setupRealTimeValidation();
});

// Navegación entre secciones
function showSection(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // Remover clase active de todos los botones
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    document.getElementById(section + '-section').classList.add('active');
    document.getElementById('btn-' + section).classList.add('active');
    
    if (section === 'lists') {
        renderLists();
    }
}

// Actualizar display de prioridad
function updatePriorityDisplay() {
    const priority = document.getElementById('item-priority').value;
    const priorityText = getPriorityText(priority);
    document.getElementById('priority-text').textContent = `${priorityText} (${priority})`;
}

// Obtener texto de prioridad
function getPriorityText(priority) {
    if (priority <= 3) return 'Baja';
    if (priority <= 7) return 'Media';
    return 'Alta';
}

// Obtener clase CSS para prioridad
function getPriorityClass(priority) {
    if (priority <= 3) return 'priority-low';
    if (priority <= 7) return 'priority-medium';
    return 'priority-high';
}

// Agregar item a la lista temporal
function addItem() {
    const name = document.getElementById('item-name').value;
    const quantity = parseInt(document.getElementById('item-quantity').value);
    const category = document.getElementById('item-category').value;
    const priority = parseInt(document.getElementById('item-priority').value);

    // Validar el item completo
    const itemToValidate = { name, quantity, category, priority };
    const validation = Validations.validateItem(itemToValidate);
    
    if (!validation.isValid) {
        Validations.showValidationErrors(validation.errors);
        return;
    }

    const newItem = {
        id: Date.now().toString(),
        name: validation.item.nombre,
        quantity: validation.item.cantidad,
        category: validation.item.categoria,
        priority: validation.item.prioridad
    };

    currentItems.push(newItem);
    
    // Limpiar formulario de item
    document.getElementById('item-name').value = '';
    document.getElementById('item-quantity').value = '1';
    document.getElementById('item-category').value = '';
    document.getElementById('item-priority').value = '5';
    updatePriorityDisplay();

    renderCurrentItems();
    showToast('Éxito', `${validation.item.nombre} agregado a la lista`, 'success');
}

// Remover item de la lista temporal
function removeItem(id) {
    const item = currentItems.find(item => item.id === id);
    currentItems = currentItems.filter(item => item.id !== id);
    renderCurrentItems();
    showToast('Eliminado', `${item.name} removido de la lista`, 'success');
}

// Renderizar items actuales
function renderCurrentItems() {
    const container = document.getElementById('items-list');
    const card = document.getElementById('items-card');
    const count = document.getElementById('items-count');

    if (currentItems.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    count.textContent = currentItems.length;

    container.innerHTML = currentItems.map(item => `
        <div class="item ${getPriorityClass(item.priority)}">
            <div class="item-content">
                <div class="item-name">
                    ${categoryIcons[item.category]} ${item.name} x${item.quantity}
                </div>
                <div class="item-details">
                    <span class="item-badge">${item.category}</span>
                    <span>Prioridad: ${getPriorityText(item.priority)}</span>
                </div>
            </div>
            <button class="btn btn-danger" onclick="removeItem('${item.id}')">
                🗑️
            </button>
        </div>
    `).join('');
}

// Cargar listas desde la API
async function loadListasFromAPI() {
    try {
        const listas = await ApiService.getListas();
        shoppingLists = [];
        
        // Para cada lista, cargar sus items
        for (const lista of listas) {
            const items = await ApiService.getItemsByLista(lista.id);
            shoppingLists.push({
                id: lista.id,
                name: lista.nombre,
                items: items.map(item => ({
                    id: item.id,
                    name: item.nombre,
                    quantity: item.cantidad,
                    category: item.categoria,
                    priority: item.prioridad
                })),
                createdAt: lista.fecha_creacion
            });
        }
    } catch (error) {
        console.error('Error al cargar listas:', error);
        showToast('Error', 'No se pudieron cargar las listas desde el servidor', 'error');
    }
}

// Crear lista de compras
async function createList() {
    const listName = document.getElementById('list-name').value;

    // Validar la lista completa
    const validation = Validations.validateLista(listName, currentItems);
    
    if (!validation.isValid) {
        Validations.showValidationErrors(validation.errors);
        return;
    }

    try {
        // Crear la lista en la API
        const nuevaLista = await ApiService.createLista(validation.nombre);
        
        // Agregar todos los items validados a la lista
        for (const item of validation.items) {
            await ApiService.addItem(nuevaLista.id, item);
        }

        // Recargar las listas desde la API
        await loadListasFromAPI();
        
        // Limpiar formulario
        document.getElementById('list-name').value = '';
        currentItems = [];
        renderCurrentItems();
        updateListsCount();

        showToast('Lista creada', `"${validation.nombre}" se agregó con ${validation.items.length} productos`, 'success');
        
        // Cambiar a la vista de listas
        setTimeout(() => {
            showSection('lists');
        }, 1500);
    } catch (error) {
        console.error('Error al crear lista:', error);
        showToast('Error', 'No se pudo crear la lista en el servidor', 'error');
    }
}

// Eliminar lista
function deleteList(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta lista?')) {
        return;
    }

    const list = shoppingLists.find(list => list.id === id);
    shoppingLists = shoppingLists.filter(list => list.id !== id);
    localStorage.setItem('shoppingLists', JSON.stringify(shoppingLists));
    
    updateListsCount();
    renderLists();
    showToast('Lista eliminada', `"${list.name}" se eliminó correctamente`, 'success');
}

// Actualizar contador de listas
function updateListsCount() {
    document.getElementById('lists-count').textContent = shoppingLists.length;
}

// Filtrar listas
function filterLists() {
    currentFilter = document.getElementById('category-filter').value;
    renderLists();
}

// Renderizar todas las listas
function renderLists() {
    const container = document.getElementById('lists-container');
    
    let filteredLists = shoppingLists;
    if (currentFilter !== 'Todos') {
        filteredLists = shoppingLists.filter(list => 
            list.items.some(item => item.category === currentFilter)
        );
    }

    if (filteredLists.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📦</div>
                <h3>${currentFilter === 'Todos' ? 'No hay listas de compras' : 'No hay listas con esta categoría'}</h3>
                <p>${currentFilter === 'Todos' ? 'Crea tu primera lista de compras para comenzar' : 'Prueba con otra categoría'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="lists-grid">
            ${filteredLists.map(list => `
                <div class="list-card">
                    <div class="list-card-header">
                        <div>
                            <div class="list-card-title">${list.name}</div>
                            <div class="list-card-date">
                                📅 ${formatDate(list.createdAt)}
                            </div>
                        </div>
                        <div class="list-card-actions">
                            <span class="badge">${list.items.length} productos</span>
                            <button class="btn btn-danger" onclick="deleteList('${list.id}')" style="padding: 0.5rem;">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    <div class="items-list">
                        ${list.items
                            .sort((a, b) => b.priority - a.priority)
                            .map(item => `
                            <div class="item ${getPriorityClass(item.priority)}" style="margin-bottom: 0.5rem;">
                                <div class="item-content">
                                    <div class="item-name">
                                        ${categoryIcons[item.category]} ${item.name} x${item.quantity}
                                    </div>
                                    <div class="item-details">
                                        <span class="item-badge">${item.category}</span>
                                        <span>Prioridad: ${getPriorityText(item.priority)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Mostrar toast
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');

    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Permitir agregar items con Enter
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target.closest('#list-form')) {
        e.preventDefault();
        const itemName = document.getElementById('item-name');
        const itemCategory = document.getElementById('item-category');
        
        if (itemName.value.trim() && itemCategory.value) {
            addItem();
        }
    }
});

// Configurar validación en tiempo real
function setupRealTimeValidation() {
    const inputs = document.querySelectorAll('input[pattern], input[required], select[required]');
    
    inputs.forEach(input => {
        // Validar al perder el foco
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        // Validar al escribir (para campos de texto)
        if (input.type === 'text') {
            input.addEventListener('input', function() {
                validateField(this);
            });
        }
        
        // Validar al cambiar (para selects)
        if (input.tagName === 'SELECT') {
            input.addEventListener('change', function() {
                validateField(this);
            });
        }
    });
}

// Validar campo individual
function validateField(field) {
    const isValid = field.checkValidity();
    const helpText = field.parentNode.querySelector('.form-help');
    
    if (helpText) {
        if (isValid) {
            helpText.style.color = '#28a745';
            helpText.textContent = getHelpText(field);
        } else {
            helpText.style.color = '#dc3545';
            helpText.textContent = field.validationMessage || 'Campo inválido';
        }
    }
}

// Obtener texto de ayuda según el campo
function getHelpText(field) {
    switch (field.id) {
        case 'list-name':
            return 'Mínimo 3, máximo 50 caracteres';
        case 'item-name':
            return 'Mínimo 2, máximo 100 caracteres';
        case 'item-quantity':
            return 'Entre 1 y 999';
        case 'item-category':
            return 'Selecciona una categoría obligatoria';
        case 'item-priority':
            return 'Desliza para establecer la prioridad';
        default:
            return '';
    }
}