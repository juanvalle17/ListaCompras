from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_session import Session
import pyodbc
import re
import html
import bcrypt
from datetime import datetime
import os

app = Flask(__name__)
CORS(app, supports_credentials=True)  # Habilitar CORS para el frontend con credenciales

# Configuración de sesiones
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu-clave-secreta-muy-segura-aqui')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
Session(app)

# Patrones RegEx para validaciones del backend
PATTERNS = {
    'LISTA_NOMBRE': re.compile(r'^[a-zA-Z0-9\s]{3,50}$'),
    'PRODUCTO_NOMBRE': re.compile(r'^[a-zA-Z0-9\s]{2,100}$'),
    'CANTIDAD': re.compile(r'^[1-9]\d{0,2}$'),
    'CATEGORIA': re.compile(r'^(Alimentos|Hogar|Higiene Personal|Limpieza|Ropa|Electrónicos|Medicamentos|Mascotas|Otros)$'),
    'PRIORIDAD': re.compile(r'^(10|[1-9])$'),
    'USERNAME': re.compile(r'^[a-zA-Z0-9_]{3,20}$'),
    'PASSWORD': re.compile(r'^.{6,50}$'),
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
    cursor.execute("SELECT id, nombre, fecha_creacion FROM Listas")
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
        cursor.execute("INSERT INTO Listas (nombre) OUTPUT INSERTED.id VALUES (?)", result)
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
    cursor.execute("""
        SELECT id, nombre, cantidad, categoria, prioridad 
        FROM Items 
        WHERE lista_id = ?
        ORDER BY prioridad DESC
    """, lista_id)
    rows = cursor.fetchall()
    items = [{
        "id": r[0], 
        "nombre": r[1], 
        "cantidad": r[2], 
        "categoria": r[3], 
        "prioridad": r[4]
    } for r in rows]
    return jsonify(items)

@app.route("/listas/<int:lista_id>", methods=["DELETE"])
@require_auth
def delete_lista(lista_id):
    try:
        cursor = conn.cursor()
        # Primero eliminar todos los items de la lista
        cursor.execute("DELETE FROM Items WHERE lista_id = ?", lista_id)
        # Luego eliminar la lista
        cursor.execute("DELETE FROM Listas WHERE id = ?", lista_id)
        
        if cursor.rowcount == 0:
            return jsonify({"error": "Lista no encontrada"}), 404
            
        conn.commit()
        return jsonify({"mensaje": f"Lista {lista_id} eliminada correctamente"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Error al eliminar lista: {str(e)}"}), 500

@app.route("/listas/<int:lista_id>/items", methods=["POST"])
@require_auth
def add_item(lista_id):
    data = request.json
    if not data:
        return jsonify({"error": "Datos JSON requeridos"}), 400
    
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
    
    try:
        cursor = conn.cursor()
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

if __name__ == "__main__":
    app.run(debug=True)
