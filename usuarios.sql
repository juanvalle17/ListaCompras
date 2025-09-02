-- Script SQL para crear la tabla de usuarios
-- Ejecutar este script en SQL Server después de crear la base de datos ListaCompras

USE ListaCompras;
GO

-- Crear tabla de usuarios para el sistema de autenticación
CREATE TABLE Usuarios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    email NVARCHAR(100) NOT NULL UNIQUE,
    nombre_completo NVARCHAR(100),
    fecha_creacion DATETIME DEFAULT GETDATE(),
    ultimo_acceso DATETIME,
    activo BIT DEFAULT 1
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IX_Usuarios_Username ON Usuarios(username);
CREATE INDEX IX_Usuarios_Email ON Usuarios(email);

-- Insertar usuario administrador por defecto (contraseña: admin123)
-- Hash generado con bcrypt para 'admin123'
INSERT INTO Usuarios (username, password_hash, email, nombre_completo, activo)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXfs2Stk5v96', 'admin@listacompras.com', 'Administrador', 1);

GO

-- Verificar que la tabla se creó correctamente
SELECT * FROM Usuarios;