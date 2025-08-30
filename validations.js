// Validaciones y sanitización para el frontend
class Validations {
    // Patrones RegEx para validaciones
    static PATTERNS = {
        // Nombre de lista: 3-50 caracteres, solo letras, números y espacios
        LISTA_NOMBRE: /^[a-zA-Z0-9\s]{3,50}$/,
        
        // Nombre de producto: 2-100 caracteres, solo letras, números y espacios
        PRODUCTO_NOMBRE: /^[a-zA-Z0-9\s]{2,100}$/,
        
        // Cantidad: números del 1 al 999
        CANTIDAD: /^[1-9]\d{0,2}$/,
        
        // Categoría: debe ser una de las opciones válidas
        CATEGORIA: /^(Alimentos|Hogar|Higiene Personal|Limpieza|Ropa|Electrónicos|Medicamentos|Mascotas|Otros)$/,
        
        // Prioridad: números del 1 al 10
        PRIORIDAD: /^(10|[1-9])$/
    };

    // Mensajes de error para cada validación
    static ERROR_MESSAGES = {
        LISTA_NOMBRE: 'El nombre de la lista debe tener entre 3 y 50 caracteres, solo letras, números y espacios',
        PRODUCTO_NOMBRE: 'El nombre del producto debe tener entre 2 y 100 caracteres, solo letras, números y espacios',
        CANTIDAD: 'La cantidad debe ser un número entre 1 y 999',
        CATEGORIA: 'Debe seleccionar una categoría válida',
        PRIORIDAD: 'La prioridad debe ser un número entre 1 y 10'
    };

    // Validar nombre de lista
    static validateListaNombre(nombre) {
        if (!nombre || typeof nombre !== 'string') {
            return { isValid: false, message: 'El nombre de la lista es requerido' };
        }
        
        const sanitized = DOMPurify.sanitize(nombre.trim());
        if (!this.PATTERNS.LISTA_NOMBRE.test(sanitized)) {
            return { isValid: false, message: this.ERROR_MESSAGES.LISTA_NOMBRE };
        }
        
        return { isValid: true, value: sanitized };
    }

    // Validar nombre de producto
    static validateProductoNombre(nombre) {
        if (!nombre || typeof nombre !== 'string') {
            return { isValid: false, message: 'El nombre del producto es requerido' };
        }
        
        const sanitized = DOMPurify.sanitize(nombre.trim());
        if (!this.PATTERNS.PRODUCTO_NOMBRE.test(sanitized)) {
            return { isValid: false, message: this.ERROR_MESSAGES.PRODUCTO_NOMBRE };
        }
        
        return { isValid: true, value: sanitized };
    }

    // Validar cantidad
    static validateCantidad(cantidad) {
        if (!cantidad || isNaN(cantidad)) {
            return { isValid: false, message: 'La cantidad es requerida' };
        }
        
        const cantidadStr = cantidad.toString();
        if (!this.PATTERNS.CANTIDAD.test(cantidadStr)) {
            return { isValid: false, message: this.ERROR_MESSAGES.CANTIDAD };
        }
        
        return { isValid: true, value: parseInt(cantidad) };
    }

    // Validar categoría
    static validateCategoria(categoria) {
        if (!categoria || typeof categoria !== 'string') {
            return { isValid: false, message: 'La categoría es requerida' };
        }
        
        const sanitized = DOMPurify.sanitize(categoria.trim());
        if (!this.PATTERNS.CATEGORIA.test(sanitized)) {
            return { isValid: false, message: this.ERROR_MESSAGES.CATEGORIA };
        }
        
        return { isValid: true, value: sanitized };
    }

    // Validar prioridad
    static validatePrioridad(prioridad) {
        if (!prioridad || isNaN(prioridad)) {
            return { isValid: false, message: 'La prioridad es requerida' };
        }
        
        const prioridadStr = prioridad.toString();
        if (!this.PATTERNS.PRIORIDAD.test(prioridadStr)) {
            return { isValid: false, message: this.ERROR_MESSAGES.PRIORIDAD };
        }
        
        return { isValid: true, value: parseInt(prioridad) };
    }

    // Validar item completo
    static validateItem(item) {
        const validations = {
            nombre: this.validateProductoNombre(item.name),
            cantidad: this.validateCantidad(item.quantity),
            categoria: this.validateCategoria(item.category),
            prioridad: this.validatePrioridad(item.priority)
        };

        const errors = [];
        const validatedItem = {};

        for (const [field, validation] of Object.entries(validations)) {
            if (!validation.isValid) {
                errors.push(validation.message);
            } else {
                validatedItem[field] = validation.value;
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            item: validatedItem
        };
    }

    // Validar lista completa
    static validateLista(nombre, items) {
        const nombreValidation = this.validateListaNombre(nombre);
        if (!nombreValidation.isValid) {
            return { isValid: false, errors: [nombreValidation.message] };
        }

        if (!items || items.length === 0) {
            return { isValid: false, errors: ['Debe agregar al menos un producto a la lista'] };
        }

        const errors = [];
        const validatedItems = [];

        for (const item of items) {
            const itemValidation = this.validateItem(item);
            if (!itemValidation.isValid) {
                errors.push(...itemValidation.errors);
            } else {
                validatedItems.push(itemValidation.item);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            nombre: nombreValidation.value,
            items: validatedItems
        };
    }

    // Sanitizar texto genérico
    static sanitizeText(text) {
        if (!text || typeof text !== 'string') return '';
        return DOMPurify.sanitize(text.trim());
    }

    // Mostrar errores de validación
    static showValidationErrors(errors) {
        if (errors && errors.length > 0) {
            const errorMessage = errors.join('\n• ');
            showToast('Error de Validación', errorMessage, 'error');
            return false;
        }
        return true;
    }
}
