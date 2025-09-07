from flask import Flask, request, jsonify, session, send_from_directory, send_file
from flask_cors import CORS
from flask_session import Session
import pyodbc
import re
import html
import bcrypt
from datetime import datetime
import os

app = Flask(__name__)

# Configuración de CORS
cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5000,http://127.0.0.1:5000,http://localhost:3000,http://127.0.0.1:3000').split(',')
CORS(app, supports_credentials=True, origins=cors_origins, allow_headers=['Content-Type', 'Authorization'])  # Habilitar CORS para el frontend con credenciales

# Configuración de sesiones
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu-clave-secreta-muy-segura-aqui')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Para desarrollo local
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
Session(app)

# Patrones RegEx para validaciones del backend
PATTERNS = {
    'LISTA_NOMBRE': re.compile(r'^[a-zA-Z0-9\s]{3,50}$'),
    'PRODUCTO_NOMBRE': re.compile(r'^[a-zA-Z0-9\s]{2,100}$'),
    'CANTIDAD': re.compile(r'^[1-9]\d{0,2}$'),
    'CATEGORIA': re.compile(r'^(Alimentos|Hogar|Higiene Personal|Limpieza|Ropa|Electrónicos|Medicamentos|Mascotas|Otros)$'),
    'PRIORIDAD': re.compile(r'^(10|[1-9])$'),
    'USERNAME': re.compile(r'^[a-zA-Z0-9_]{3,20}$'),
    'EMAIL': re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
    'NOMBRE_COMPLETO': re.compile(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,100}$')
}

# Mensajes de error para validaciones
ERROR_MESSAGES = {
    'LISTA_NOMBRE': 'El nombre de la lista debe tener entre 3 y 50 caracteres, solo letras, números y espacios',
    'PRODUCTO_NOMBRE': 'El nombre del producto debe tener entre 2 y 100 caracteres, solo letras, números y espacios',
    'CANTIDAD': 'La cantidad debe ser un número entre 1 y 999',
    'CATEGORIA': 'Debe seleccionar una categoría válida',
    'PRIORIDAD': 'La prioridad debe ser un número entre 1 y 10',
    'USERNAME': 'El nombre de usuario debe tener entre 3 y 20 caracteres, solo letras, números y guiones bajos',
    'PASSWORD': 'La contraseña debe tener entre 6 y 50 caracteres',
    'EMAIL': 'Debe ingresar un email válido',
    'NOMBRE_COMPLETO': 'El nombre completo debe tener entre 2 y 100 caracteres, solo letras y espacios'
}

def sanitize_input(text):
    """Sanitizar entrada de texto contra XSS"""
    if not text or not isinstance(text, str):
        return ''
    # Escapar caracteres HTML especiales
    return html.escape(text.strip())

def validate_field(value, pattern_name, field_name):
    """Validar un campo usando RegEx"""
    if not value:
        return False, f'El campo {field_name} es requerido'
    
    if pattern_name == 'CANTIDAD' or pattern_name == 'PRIORIDAD':
        # Para campos numéricos, convertir a string para validar con RegEx
        value_str = str(value)
        if not PATTERNS[pattern_name].match(value_str):
            return False, ERROR_MESSAGES[pattern_name]
    else:
        # Para campos de texto, sanitizar primero
        sanitized = sanitize_input(value)
        if not PATTERNS[pattern_name].match(sanitized):
            return False, ERROR_MESSAGES[pattern_name]
        return True, sanitized
    
    return True, value

# 🔌 Conexión a SQL Server
conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\SQLEXPRESS;"  # Cambia por tu servidor
    "DATABASE=ListaCompras;"  # Cambia por tu BD
    'Trusted_Connection=yes;'
)
conn = pyodbc.connect(conn_str)

# Funciones de utilidad para autenticación
def hash_password(password):
    """Generar hash de contraseña usando bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verificar contraseña contra hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def require_auth(f):
    """Decorador para requerir autenticación"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Acceso no autorizado. Debe iniciar sesión."}), 401
        return f(*args, **kwargs)
    return decorated_function

# Endpoints de autenticación
@app.route("/auth/register", methods=["POST"])
def register():
    data = request.json
    if not data:
        return jsonify({"error": "Datos JSON requeridos"}), 400
    
    # Validar todos los campos
    validations = {
        'username': validate_field(data.get("username"), 'USERNAME', 'username'),
        'password': validate_field(data.get("password"), 'PASSWORD', 'password'),
        'email': validate_field(data.get("email"), 'EMAIL', 'email'),
        'nombre_completo': validate_field(data.get("nombre_completo"), 'NOMBRE_COMPLETO', 'nombre_completo')
    }
    
    # Verificar errores de validación
    errors = []
    validated_data = {}
    
    for field, (is_valid, result) in validations.items():
        if not is_valid:
            errors.append(result)
        else:
            validated_data[field] = result
    
    if errors:
        return jsonify({"error": "Errores de validación", "details": errors}), 400
    
    try:
        cursor = conn.cursor()
        
        # Verificar si el usuario ya existe
        cursor.execute("SELECT id FROM Usuarios WHERE username = ? OR email = ?", 
                      (validated_data['username'], validated_data['email']))
        if cursor.fetchone():
            return jsonify({"error": "El usuario o email ya existe"}), 409
        
        # Crear hash de la contraseña
        password_hash = hash_password(validated_data['password'])
        
        # Insertar nuevo usuario
        cursor.execute("""
            INSERT INTO Usuarios (username, password_hash, email, nombre_completo)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?)
        """, (validated_data['username'], password_hash, validated_data['email'], validated_data['nombre_completo']))
        
        user_id = cursor.fetchone()[0]
        conn.commit()
        
        return jsonify({
            "mensaje": "Usuario registrado exitosamente",
            "user_id": user_id,
            "username": validated_data['username']
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al registrar usuario: {str(e)}"}), 500

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.json
    if not data:
        return jsonify({"error": "Datos JSON requeridos"}), 400
    
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"error": "Usuario y contraseña son requeridos"}), 400
    
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, password_hash, email, nombre_completo, activo
            FROM Usuarios 
            WHERE username = ? AND activo = 1
        """, (username,))
        
        user = cursor.fetchone()
        
        if not user or not verify_password(password, user[2]):
            return jsonify({"error": "Usuario o contraseña incorrectos"}), 401
        
        # Actualizar último acceso
        cursor.execute("UPDATE Usuarios SET ultimo_acceso = GETDATE() WHERE id = ?", (user[0],))
        conn.commit()
        
        # Crear sesión
        session['user_id'] = user[0]
        session['username'] = user[1]
        session['nombre_completo'] = user[4]
        
        return jsonify({
            "mensaje": "Inicio de sesión exitoso",
            "user": {
                "id": user[0],
                "username": user[1],
                "email": user[3],
                "nombre_completo": user[4]
            }
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Error al iniciar sesión: {str(e)}"}), 500

@app.route("/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"mensaje": "Sesión cerrada exitosamente"}), 200

@app.route("/auth/me", methods=["GET"])
@require_auth
def get_current_user():
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, email, nombre_completo, fecha_creacion, ultimo_acceso
            FROM Usuarios 
            WHERE id = ?
        """, (session['user_id'],))
        
        user = cursor.fetchone()
        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404
        
        return jsonify({
            "user": {
                "id": user[0],
                "username": user[1],
                "email": user[2],
                "nombre_completo": user[3],
                "fecha_creacion": user[4],
                "ultimo_acceso": user[5]
            }
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Error al obtener usuario: {str(e)}"}), 500

# Endpoints de listas (ahora requieren autenticación)
@app.route("/listas", methods=["GET"])
@require_auth
def get_listas():
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, fecha_creacion FROM Listas WHERE user_id = ?", (session['user_id'],))
    rows = cursor.fetchall()
    listas = [{"id": r[0], "nombre": r[1], "fecha_creacion": r[2]} for r in rows]
    return jsonify(listas)

@app.route("/listas", methods=["POST"])
@require_auth
def create_lista():
    data = request.json
    if not data:
        return jsonify({"error": "Datos JSON requeridos"}), 400
    
    nombre = data.get("nombre")
    
    # Validar nombre de lista
    is_valid, result = validate_field(nombre, 'LISTA_NOMBRE', 'nombre')
    if not is_valid:
        return jsonify({"error": result}), 400
    
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO Listas (nombre, user_id) OUTPUT INSERTED.id VALUES (?, ?)", (result, session['user_id']))
        lista_id = cursor.fetchone()[0]
        conn.commit()
        return jsonify({"id": lista_id, "nombre": result}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al crear lista: {str(e)}"}), 500

@app.route("/listas/<int:lista_id>/items", methods=["GET"])
@require_auth
def get_items(lista_id):
    cursor = conn.cursor()
    
    # Verificar que la lista pertenece al usuario autenticado
    cursor.execute("SELECT id FROM Listas WHERE id = ? AND user_id = ?", (lista_id, session['user_id']))
    if not cursor.fetchone():
        return jsonify({"error": "Lista no encontrada o no tienes permisos para verla"}), 404
    
    # Primero verificar si la columna completed existe, si no, agregarla
    try:
        cursor.execute("ALTER TABLE Items ADD completed BIT DEFAULT 0")
        conn.commit()
    except:
        # La columna ya existe, continuar
        pass
    
    cursor.execute("""
        SELECT id, nombre, cantidad, categoria, prioridad, ISNULL(completed, 0) as completed
        FROM Items 
        WHERE lista_id = ?
        ORDER BY prioridad DESC
    """, (lista_id,))
    rows = cursor.fetchall()
    items = [{
        "id": r[0], 
        "nombre": r[1], 
        "cantidad": r[2], 
        "categoria": r[3], 
        "prioridad": r[4],
        "completed": bool(r[5])
    } for r in rows]
    return jsonify(items)

@app.route("/listas/<int:lista_id>", methods=["DELETE"])
@require_auth
def delete_lista(lista_id):
    try:
        cursor = conn.cursor()
        
        # Verificar que la lista pertenece al usuario autenticado
        cursor.execute("SELECT id FROM Listas WHERE id = ? AND user_id = ?", (lista_id, session['user_id']))
        if not cursor.fetchone():
            return jsonify({"error": "Lista no encontrada o no tienes permisos para eliminarla"}), 404
        
        # Primero eliminar todos los items de la lista
        cursor.execute("DELETE FROM Items WHERE lista_id = ?", (lista_id,))
        # Luego eliminar la lista
        cursor.execute("DELETE FROM Listas WHERE id = ? AND user_id = ?", (lista_id, session['user_id']))
        
        conn.commit()
        return jsonify({"mensaje": f"Lista {lista_id} eliminada correctamente"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al eliminar lista: {str(e)}"}), 500

@app.route("/listas/<int:lista_id>", methods=["PUT"])
@require_auth
def update_lista(lista_id):
    data = request.json
    if not data:
        return jsonify({"error": "Datos JSON requeridos"}), 400
    
    try:
        cursor = conn.cursor()
        
        # Verificar que la lista existe y pertenece al usuario autenticado
        cursor.execute("SELECT id FROM Listas WHERE id = ? AND user_id = ?", (lista_id, session['user_id']))
        if not cursor.fetchone():
            return jsonify({"error": "Lista no encontrada o no tienes permisos para editarla"}), 404
        
        # Actualizar nombre de la lista si se proporciona
        if 'nombre' in data:
            is_valid, result = validate_field(data['nombre'], 'LISTA_NOMBRE', 'nombre')
            if not is_valid:
                return jsonify({"error": "Error de validación", "details": [result]}), 400
            
            cursor.execute("UPDATE Listas SET nombre = ? WHERE id = ?", (result, lista_id))
        
        # Si se proporcionan items, reemplazar todos los items de la lista
        if 'items' in data:
            # Eliminar todos los items existentes
            cursor.execute("DELETE FROM Items WHERE lista_id = ?", (lista_id,))
            
            # Agregar los nuevos items
            for item in data['items']:
                # Validar cada campo del item
                is_valid_nombre, nombre_result = validate_field(item.get('nombre', ''), 'PRODUCTO_NOMBRE', 'nombre')
                if not is_valid_nombre:
                    return jsonify({"error": "Error de validación en item", "details": [nombre_result]}), 400
                
                is_valid_cantidad, cantidad_result = validate_field(item.get('cantidad', 1), 'CANTIDAD', 'cantidad')
                if not is_valid_cantidad:
                    return jsonify({"error": "Error de validación en item", "details": [cantidad_result]}), 400
                
                is_valid_categoria, categoria_result = validate_field(item.get('categoria', 'Otros'), 'CATEGORIA', 'categoria')
                if not is_valid_categoria:
                    return jsonify({"error": "Error de validación en item", "details": [categoria_result]}), 400
                
                is_valid_prioridad, prioridad_result = validate_field(item.get('prioridad', 1), 'PRIORIDAD', 'prioridad')
                if not is_valid_prioridad:
                    return jsonify({"error": "Error de validación en item", "details": [prioridad_result]}), 400
                
                # Insertar el item validado
                cursor.execute("""
                    INSERT INTO Items (lista_id, nombre, cantidad, categoria, prioridad) 
                    VALUES (?, ?, ?, ?, ?)
                """, (lista_id, nombre_result, cantidad_result, categoria_result, prioridad_result))
        
        conn.commit()
        return jsonify({"mensaje": "Lista actualizada correctamente"}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al actualizar lista: {str(e)}"}), 500

@app.route("/listas/<int:lista_id>/items", methods=["POST"])
@require_auth
def add_item(lista_id):
    data = request.json
    if not data:
        return jsonify({"error": "Datos JSON requeridos"}), 400
    
    try:
        cursor = conn.cursor()
        
        # Verificar que la lista pertenece al usuario autenticado
        cursor.execute("SELECT id FROM Listas WHERE id = ? AND user_id = ?", (lista_id, session['user_id']))
        if not cursor.fetchone():
            return jsonify({"error": "Lista no encontrada o no tienes permisos para agregar items"}), 404
        
        # Validar todos los campos del item
        validations = {
            'nombre': validate_field(data.get("nombre"), 'PRODUCTO_NOMBRE', 'nombre'),
            'cantidad': validate_field(data.get("cantidad"), 'CANTIDAD', 'cantidad'),
            'categoria': validate_field(data.get("categoria"), 'CATEGORIA', 'categoria'),
            'prioridad': validate_field(data.get("prioridad"), 'PRIORIDAD', 'prioridad')
        }
        
        # Verificar si hay errores de validación
        errors = []
        validated_data = {}
        
        for field, (is_valid, result) in validations.items():
            if not is_valid:
                errors.append(result)
            else:
                validated_data[field] = result
        
        if errors:
            return jsonify({"error": "Errores de validación", "details": errors}), 400
        
        cursor.execute("""
            INSERT INTO Items (lista_id, nombre, cantidad, categoria, prioridad)
            VALUES (?, ?, ?, ?, ?)
        """, (lista_id, validated_data['nombre'], validated_data['cantidad'], 
               validated_data['categoria'], validated_data['prioridad']))
        conn.commit()
        return jsonify({"mensaje": f"Item '{validated_data['nombre']}' agregado a la lista {lista_id}"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al agregar item: {str(e)}"}), 500

@app.route("/listas/<int:lista_id>/items/<int:item_id>", methods=["PATCH"])
@require_auth
def update_item(lista_id, item_id):
    data = request.json
    if not data:
        return jsonify({"error": "Datos JSON requeridos"}), 400
    
    try:
        cursor = conn.cursor()
        
        # Verificar que el item existe en la lista
        cursor.execute("SELECT id FROM Items WHERE id = ? AND lista_id = ?", (item_id, lista_id))
        if not cursor.fetchone():
            return jsonify({"error": "Item no encontrado en la lista especificada"}), 404
        
        # Construir la consulta de actualización dinámicamente
        update_fields = []
        update_values = []
        
        if 'completed' in data:
            # Agregar campo completed a la tabla si no existe
            try:
                cursor.execute("ALTER TABLE Items ADD completed BIT DEFAULT 0")
                conn.commit()
            except:
                # La columna ya existe, continuar
                pass
            
            update_fields.append("completed = ?")
            update_values.append(1 if data['completed'] else 0)
        
        if 'nombre' in data:
            is_valid, result = validate_field(data['nombre'], 'PRODUCTO_NOMBRE', 'nombre')
            if not is_valid:
                return jsonify({"error": "Error de validación", "details": [result]}), 400
            update_fields.append("nombre = ?")
            update_values.append(result)
        
        if 'cantidad' in data:
            is_valid, result = validate_field(data['cantidad'], 'CANTIDAD', 'cantidad')
            if not is_valid:
                return jsonify({"error": "Error de validación", "details": [result]}), 400
            update_fields.append("cantidad = ?")
            update_values.append(result)
        
        if 'categoria' in data:
            is_valid, result = validate_field(data['categoria'], 'CATEGORIA', 'categoria')
            if not is_valid:
                return jsonify({"error": "Error de validación", "details": [result]}), 400
            update_fields.append("categoria = ?")
            update_values.append(result)
        
        if 'prioridad' in data:
            is_valid, result = validate_field(data['prioridad'], 'PRIORIDAD', 'prioridad')
            if not is_valid:
                return jsonify({"error": "Error de validación", "details": [result]}), 400
            update_fields.append("prioridad = ?")
            update_values.append(result)
        
        if not update_fields:
            return jsonify({"error": "No hay campos para actualizar"}), 400
        
        # Ejecutar la actualización
        update_values.append(item_id)
        update_values.append(lista_id)
        query = f"UPDATE Items SET {', '.join(update_fields)} WHERE id = ? AND lista_id = ?"
        
        cursor.execute(query, update_values)
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({"error": "No se pudo actualizar el item"}), 404
        
        return jsonify({"mensaje": "Item actualizado correctamente"}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al actualizar item: {str(e)}"}), 500

@app.route("/items/<int:item_id>/status", methods=["PUT"])
@require_auth
def update_item_status(item_id):
    data = request.json
    if not data or 'completed' not in data:
        return jsonify({"error": "Campo 'completed' requerido"}), 400
    
    completed = bool(data['completed'])
    
    try:
        cursor = conn.cursor()
        
        # Verificar que el item existe y pertenece a una lista del usuario autenticado
        cursor.execute("""
            SELECT i.id FROM Items i 
            INNER JOIN Listas l ON i.lista_id = l.id 
            WHERE i.id = ? AND l.user_id = ?
        """, (item_id, session['user_id']))
        if not cursor.fetchone():
            return jsonify({"error": "Item no encontrado o no tienes permisos para modificarlo"}), 404
        
        # Actualizar el estado del item
        cursor.execute("UPDATE Items SET completed = ? WHERE id = ?", (completed, item_id))
        conn.commit()
        
        return jsonify({"mensaje": "Estado del item actualizado correctamente"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al actualizar item: {str(e)}"}), 500

# Rutas para servir archivos estáticos del frontend
@app.route('/')
def index():
    """Servir la página principal"""
    return send_file('index.html')

@app.route('/login')
def login_page():
    """Servir la página de login"""
    return send_file('login.html')

@app.route('/<path:filename>')
def static_files(filename):
    """Servir archivos estáticos (CSS, JS, etc.)"""
    return send_from_directory('.', filename)

if __name__ == "__main__":
    app.run(debug=True)
