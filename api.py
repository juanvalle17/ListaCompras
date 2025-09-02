from flask import Flask, request, jsonify
from flask_cors import CORS
import pyodbc
import re
import html

app = Flask(__name__)
CORS(app)  # Habilitar CORS para el frontend

# Patrones RegEx para validaciones del backend
PATTERNS = {
    'LISTA_NOMBRE': re.compile(r'^[a-zA-Z0-9\s]{3,50}$'),
    'PRODUCTO_NOMBRE': re.compile(r'^[a-zA-Z0-9\s]{2,100}$'),
    'CANTIDAD': re.compile(r'^[1-9]\d{0,2}$'),
    'CATEGORIA': re.compile(r'^(Alimentos|Hogar|Higiene Personal|Limpieza|Ropa|Electrónicos|Medicamentos|Mascotas|Otros)$'),
    'PRIORIDAD': re.compile(r'^(10|[1-9])$')
}

# Mensajes de error para validaciones
ERROR_MESSAGES = {
    'LISTA_NOMBRE': 'El nombre de la lista debe tener entre 3 y 50 caracteres, solo letras, números y espacios',
    'PRODUCTO_NOMBRE': 'El nombre del producto debe tener entre 2 y 100 caracteres, solo letras, números y espacios',
    'CANTIDAD': 'La cantidad debe ser un número entre 1 y 999',
    'CATEGORIA': 'Debe seleccionar una categoría válida',
    'PRIORIDAD': 'La prioridad debe ser un número entre 1 y 10'
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

@app.route("/listas", methods=["GET"])
def get_listas():
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, fecha_creacion FROM Listas")
    rows = cursor.fetchall()
    listas = [{"id": r[0], "nombre": r[1], "fecha_creacion": r[2]} for r in rows]
    return jsonify(listas)

@app.route("/listas", methods=["POST"])
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
