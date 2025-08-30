# 🛒 Lista de Compras - Backend + Frontend

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3+-green.svg)](https://flask.palletsprojects.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![SQL Server](https://img.shields.io/badge/SQL%20Server-2019+-red.svg)](https://www.microsoft.com/en-us/sql-server/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Aplicación web completa para crear y gestionar listas de compras con validaciones de seguridad y base de datos SQL Server.**

## Instalación

### Backend (Python/Flask)

1. Instalar dependencias:
```bash
pip install -r requirements.txt
```

2. Configurar la base de datos SQL Server:
   - Ejecutar el script `bd.text` en tu servidor SQL Server
   - Actualizar la conexión en `api.py` con tus credenciales

3. Ejecutar el servidor:
```bash
python api.py
```

El backend estará disponible en `http://localhost:5000`

### Frontend

1. Abrir `index.html` en tu navegador
2. El frontend se conectará automáticamente al backend

## 🚀 Características Principales

- ✅ **Interfaz moderna y responsive** con diseño intuitivo
- ✅ **Validaciones de seguridad** en múltiples capas (HTML5, JavaScript, Python)
- ✅ **Base de datos SQL Server** para almacenamiento persistente
- ✅ **API RESTful** con Flask y CORS habilitado
- ✅ **Sanitización contra XSS** con DOMPurify
- ✅ **Validaciones RegEx** en frontend y backend
- ✅ **Manejo de errores robusto** con rollback de transacciones

## 📁 Estructura del Proyecto

```
ListaCompras/
├── api.py              # Backend Flask con endpoints para listas e items
├── index.html          # Interfaz principal del usuario
├── main.js             # Lógica principal del frontend
├── validations.js      # Validaciones y sanitización del frontend
├── api-service.js      # Servicio para comunicarse con la API
├── config.js           # Configuración de URLs de la API
├── styles.css          # Estilos CSS
├── bd.text             # Script de creación de base de datos
├── requirements.txt    # Dependencias de Python
├── .gitignore          # Archivos a excluir del repositorio
├── LICENSE             # Licencia MIT
└── README.md           # Documentación del proyecto
```

## Endpoints de la API

- `GET /listas` - Obtener todas las listas
- `POST /listas` - Crear una nueva lista
- `GET /listas/{id}/items` - Obtener items de una lista
- `POST /listas/{id}/items` - Agregar item a una lista

## Características

- ✅ Crear listas de compras
- ✅ Agregar productos con categorías y prioridades
- ✅ Filtrado por categorías
- ✅ Almacenamiento persistente en SQL Server
- ✅ Interfaz moderna y responsive
- ✅ Validaciones RegEx en frontend y backend
- ✅ Sanitización contra XSS con DOMPurify
- ✅ Validaciones de seguridad del lado del servidor

## Validaciones Implementadas

### Frontend (JavaScript)
- **Nombre de lista**: 3-50 caracteres, solo letras, números y espacios
- **Nombre de producto**: 2-100 caracteres, solo letras, números y espacios  
- **Cantidad**: números del 1 al 999
- **Categoría**: debe ser una de las opciones predefinidas
- **Prioridad**: números del 1 al 10

### HTML5 (Validación Nativa del Navegador)
- **Atributos `pattern`**: RegEx para validar formato de texto
- **Atributos `required`**: Campos obligatorios
- **Atributos `min/max`**: Límites numéricos
- **Atributos `minlength/maxlength`**: Límites de longitud
- **Atributos `title`**: Mensajes de ayuda al hacer hover
- **Validación en tiempo real**: Feedback visual inmediato

### Backend (Python)
- Validaciones RegEx equivalentes usando `re.match()`
- Sanitización de entradas con `html.escape()`
- Validación de tipos de datos
- Manejo de errores con rollback de transacciones

## 🤝 Contribuir

Las contribuciones son bienvenidas! Si quieres contribuir al proyecto:

1. Haz un Fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📧 Contacto

Si tienes alguna pregunta o sugerencia, no dudes en abrir un issue en GitHub.
