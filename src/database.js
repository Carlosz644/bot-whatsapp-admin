import Database from 'better-sqlite3'

const db = new Database('citas.db')

// Crear tablas si no existen
db.exec(`
    CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL,
        nombre TEXT NOT NULL,
        dia TEXT NOT NULL,
        hora TEXT NOT NULL,
        servicio TEXT,
        estado TEXT DEFAULT 'confirmada',
        creada_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL,
        nombre TEXT,
        producto TEXT NOT NULL,
        precio REAL,
        estado TEXT DEFAULT 'recibido',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contactos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT UNIQUE NOT NULL,
        nombre TEXT,
        ultimo_mensaje DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`)

// ─── CITAS ───
export function horarioDisponible(dia, hora) {
    const cita = db.prepare('SELECT id FROM citas WHERE dia = ? AND hora = ? AND estado != ?').get(dia, hora, 'cancelada')
    return !cita
}

export function agendarCita(numero, nombre, dia, hora, servicio) {
    const stmt = db.prepare('INSERT INTO citas (numero, nombre, dia, hora, servicio) VALUES (?, ?, ?, ?, ?)')
    const result = stmt.run(numero, nombre, dia, hora, servicio || 'General')
    return result.lastInsertRowid
}

export function obtenerCitasPorNumero(numero) {
    return db.prepare('SELECT * FROM citas WHERE numero = ? AND estado = ?').all(numero, 'confirmada')
}

export function cancelarCita(id) {
    db.prepare('UPDATE citas SET estado = ? WHERE id = ?').run('cancelada', id)
}

export function todasLasCitas() {
    return db.prepare('SELECT * FROM citas ORDER BY creada_en DESC').all()
}

// ─── PEDIDOS ───
export function guardarPedido(numero, nombre, producto, precio) {
    const stmt = db.prepare('INSERT INTO pedidos (numero, nombre, producto, precio) VALUES (?, ?, ?, ?)')
    const result = stmt.run(numero, nombre || '', producto, precio)
    return result.lastInsertRowid
}

export function obtenerPedido(id) {
    return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id)
}

export function todosPedidos() {
    return db.prepare('SELECT * FROM pedidos ORDER BY creado_en DESC').all()
}

export function actualizarEstadoPedido(id, estado) {
    db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, id)
}

// ─── CONTACTOS ───
export function guardarContacto(numero, nombre) {
    db.prepare(`
        INSERT INTO contactos (numero, nombre, ultimo_mensaje) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(numero) DO UPDATE SET ultimo_mensaje = CURRENT_TIMESTAMP
    `).run(numero, nombre || '')
}

export function todosLosContactos() {
   return db.prepare('SELECT * FROM contactos ORDER BY ultimo_mensaje DESC').all()
}

export default db