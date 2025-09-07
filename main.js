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
    // Inicializar elementos de UI inmediatamente
    initializeUI();
    
    // Esperar a que la autenticación se complete para cargar datos
    if (await waitForAuthentication()) {
        await loadListasFromAPI();
    }
});

// Función para inicializar la UI sin depender de autenticación
function initializeUI() {
    updatePriorityDisplay();
    
    // Event listener para el slider de prioridad
    const prioritySlider = document.getElementById('item-priority');
    if (prioritySlider) {
        prioritySlider.addEventListener('input', updatePriorityDisplay);
        prioritySlider.addEventListener('change', updatePriorityDisplay);
    }
    
    // Event listeners para validación en tiempo real
    setupRealTimeValidation();
}

// Función para esperar a que la autenticación se complete
function waitForAuthentication() {
    return new Promise((resolve) => {
        const checkAuth = () => {
            if (window.authenticationComplete) {
                resolve(true);
            } else if (window.authenticationFailed) {
                resolve(false);
            } else {
                setTimeout(checkAuth, 100);
            }
        };
        checkAuth();
    });
}

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
    const prioritySlider = document.getElementById('item-priority');
    const priorityLabel = document.getElementById('priority-text');
    
    if (prioritySlider && priorityLabel) {
        const priority = prioritySlider.value;
        const priorityText = getPriorityText(priority);
        priorityLabel.textContent = `${priorityText} (${priority})`;
    }
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
        
        // Renderizar las listas después de cargarlas
        renderLists();
        updateListsCount();
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

// Eliminar lista con confirmación mejorada
async function deleteList(id) {
    // Convertir id a número si es string
    const listId = typeof id === 'string' ? parseInt(id) : id;
    const list = shoppingLists.find(list => list.id === listId);
    if (!list) return;
    
    showDeleteConfirmation(list.name, async () => {
        try {
            // Eliminar de la API
            await ApiService.deleteLista(listId);
            
            // Recargar las listas desde la API
            await loadListasFromAPI();
            
            updateListsCount();
            renderLists();
            showToast('Lista eliminada', `"${list.name}" se eliminó correctamente`, 'success');
        } catch (error) {
            console.error('Error al eliminar lista:', error);
            showToast('Error', 'No se pudo eliminar la lista del servidor', 'error');
        }
    });
}

// Mostrar confirmación de eliminación
function showDeleteConfirmation(itemName, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content delete-confirmation">
            <div class="modal-header">
                <h3>🗑️ Confirmar Eliminación</h3>
            </div>
            <div class="modal-body">
                <div class="delete-warning">
                    <div class="warning-icon">⚠️</div>
                    <p>¿Estás seguro de que deseas eliminar la lista <strong>"${itemName}"</strong>?</p>
                    <p class="warning-text">Esta acción no se puede deshacer.</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeDeleteConfirmation()">Cancelar</button>
                <button class="btn btn-danger" onclick="confirmDelete()">Eliminar</button>
            </div>
        </div>
    `;
    
    // Guardar la función de confirmación
    window.currentDeleteAction = onConfirm;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// Cerrar confirmación de eliminación
function closeDeleteConfirmation() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    window.currentDeleteAction = null;
}

// Confirmar eliminación
function confirmDelete() {
    if (window.currentDeleteAction) {
        window.currentDeleteAction();
    }
    closeDeleteConfirmation();
}

// Actualizar contador de listas
function updateListsCount() {
    document.getElementById('lists-count').textContent = shoppingLists.length;
}

// Alternar estado completado de un item
async function toggleItemCompleted(listId, itemId) {
    // Convertir IDs a números si son strings
    const numListId = typeof listId === 'string' ? parseInt(listId) : listId;
    const numItemId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
    
    const list = shoppingLists.find(l => l.id === numListId);
    if (list) {
        const item = list.items.find(i => (i.id || i.name) === numItemId);
        if (item) {
            const newCompletedState = !item.completed;
            
            try {
                // Actualizar en el servidor usando el endpoint correcto
                const response = await fetch(buildApiUrl(`/items/${numItemId}/status`), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        completed: newCompletedState
                    })
                });
                
                if (response.ok) {
                    // Actualizar localmente solo si la API responde correctamente
                    item.completed = newCompletedState;
                    renderLists();
                } else {
                    const errorData = await response.json();
                    showToast('Error', errorData.error || 'No se pudo actualizar el item', 'error');
                }
            } catch (error) {
                console.error('Error al actualizar item:', error);
                showToast('Error', 'Error de conexión al actualizar el item', 'error');
            }
        }
    }
}

// Filtrar listas
function filterLists() {
    currentFilter = document.getElementById('category-filter').value;
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const priorityFilter = document.getElementById('priority-filter').value;
    
    let filteredLists = shoppingLists;
    
    // Filtrar por categoría
    if (currentFilter !== 'Todos') {
        filteredLists = filteredLists.filter(list => 
            list.items.some(item => item.category === currentFilter)
        );
    }
    
    // Filtrar por búsqueda de texto
    if (searchTerm) {
        filteredLists = filteredLists.filter(list => 
            list.name.toLowerCase().includes(searchTerm) ||
            list.items.some(item => item.name.toLowerCase().includes(searchTerm))
        );
    }
    
    // Filtrar por prioridad
    if (priorityFilter !== 'Todas') {
        filteredLists = filteredLists.filter(list => 
            list.items.some(item => getPriorityText(item.priority) === priorityFilter)
        );
    }
    
    renderFilteredLists(filteredLists);
}

// Editar lista
function editList(listId) {
    // Convertir id a número si es string
    const id = typeof listId === 'string' ? parseInt(listId) : listId;
    const list = shoppingLists.find(l => l.id === id);
    if (!list) return;
    
    // Crear modal de edición
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>✏️ Editar Lista</h3>
                <button class="modal-close" onclick="closeEditModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="edit-list-name">Nombre de la lista:</label>
                    <input type="text" id="edit-list-name" value="${list.name}" class="form-control">
                </div>
                <div class="items-edit-section">
                    <h4>Items de la lista:</h4>
                    <div id="edit-items-container">
                        ${list.items.map((item, index) => `
                            <div class="edit-item" data-index="${index}">
                                <input type="text" value="${item.name}" class="item-name-input">
                                <input type="number" value="${item.quantity}" min="1" class="item-quantity-input">
                                <select class="item-category-input">
                                    ${Object.keys(categoryIcons).map(cat => 
                                        `<option value="${cat}" ${cat === item.category ? 'selected' : ''}>${categoryIcons[cat]} ${cat}</option>`
                                    ).join('')}
                                </select>
                                <button class="btn btn-danger btn-sm" onclick="removeEditItem(${index})">
                                    🗑️
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeEditModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="saveEditedList('${id}')">Guardar Cambios</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// Cerrar modal de edición
function closeEditModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Remover item en edición
function removeEditItem(index) {
    const item = document.querySelector(`[data-index="${index}"]`);
    if (item) {
        item.remove();
    }
}

// Guardar lista editada
async function saveEditedList(listId) {
    // Convertir id a número si es string
    const id = typeof listId === 'string' ? parseInt(listId) : listId;
    const list = shoppingLists.find(l => l.id === id);
    if (!list) return;
    
    const newName = document.getElementById('edit-list-name').value.trim();
    if (!newName) {
        showToast('Error', 'El nombre de la lista no puede estar vacío', 'error');
        return;
    }
    
    // Recopilar items actualizados
    const editItems = document.querySelectorAll('.edit-item');
    const updatedItems = [];
    
    editItems.forEach(itemEl => {
        const name = itemEl.querySelector('.item-name-input').value.trim();
        const quantity = parseInt(itemEl.querySelector('.item-quantity-input').value);
        const category = itemEl.querySelector('.item-category-input').value;
        
        if (name && quantity > 0) {
            const originalIndex = parseInt(itemEl.dataset.index);
            const originalItem = list.items[originalIndex];
            updatedItems.push({
                nombre: name,
                cantidad: quantity,
                categoria: category,
                prioridad: originalItem.priority || 1
            });
        }
    });
    
    try {
        // Actualizar la lista en la API
        await ApiService.updateLista(id, {
            nombre: newName,
            items: updatedItems
        });
        
        // Recargar las listas desde la API
        await loadListasFromAPI();
        
        // Cerrar modal y mostrar mensaje de éxito
        closeEditModal();
        showToast('Lista actualizada', `"${newName}" se actualizó correctamente`, 'success');
        
    } catch (error) {
        console.error('Error al actualizar lista:', error);
        showToast('Error', 'No se pudo actualizar la lista', 'error');
    }
}

// Renderizar todas las listas
function renderLists() {
    renderFilteredLists(shoppingLists);
}

function renderFilteredLists(filteredLists) {
    const container = document.getElementById('lists-container');

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
            ${filteredLists.map(list => {
                // Calcular progreso
                const totalItems = list.items.length;
                const completedItems = list.items.filter(item => item.completed).length;
                const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
                
                return `
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
                            <button class="btn btn-secondary" onclick="editList('${list.id}')" style="padding: 0.5rem; margin-right: 0.5rem;">
                                ✏️
                            </button>
                            <button class="btn btn-danger" onclick="deleteList('${list.id}')" style="padding: 0.5rem;">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    <div class="progress-section">
                        <div class="progress-info">
                            <span class="progress-text">${completedItems}/${totalItems} completados</span>
                            <span class="progress-percentage">${progressPercentage}%</span>
                        </div>
                        <div class="progress-bar">
                             <div class="progress-fill progress-${progressPercentage === 100 ? 'complete' : progressPercentage === 0 ? 'empty' : progressPercentage >= 75 ? 'high' : progressPercentage >= 50 ? 'medium' : 'low'}" style="width: ${progressPercentage}%"></div>
                         </div>
                    </div>
                    
                    <div class="items-list">
                        ${list.items
                            .sort((a, b) => b.priority - a.priority)
                            .map(item => `
                            <div class="item ${getPriorityClass(item.priority)} ${item.completed ? 'completed' : ''}" style="margin-bottom: 0.5rem;">
                                <div class="item-content">
                                    <div class="item-checkbox">
                                        <input type="checkbox" ${item.completed ? 'checked' : ''} 
                                               onchange="toggleItemCompleted('${list.id}', '${item.id || item.name}')">
                                    </div>
                                    <div class="item-name ${item.completed ? 'completed-text' : ''}">
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
                `;
            }).join('')}
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

    if (!toast || !toastTitle || !toastMessage) {
        console.warn('Toast elements not found');
        return;
    }

    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Reset classes and set new type
    toast.className = `toast ${type}`;
    
    // Force reflow to ensure the transition works properly
    toast.offsetHeight;
    
    // Add show class for opacity transition
    toast.classList.add('show');
    
    // Set visibility and opacity for proper display
    toast.style.visibility = 'visible';
    toast.style.opacity = '1';

    // Clear any existing timeout
    if (toast.hideTimeout) {
        clearTimeout(toast.hideTimeout);
    }

    // Set new timeout to hide toast
    toast.hideTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.classList.remove('show');
            toast.style.visibility = 'hidden';
        }, 300); // Wait for opacity transition to complete
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