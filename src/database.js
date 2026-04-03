import Database from 'better-sqlite3'
const db = new Database('citas.db')

db.exec(`
    CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL,
        nombre TEXT NOT NULL,
        dia TEXT NOT NULL,
        hora TEXT NOT NULL,
        servicio TEXT,
        estado TEXT DEFAULT 'confirmada',
        bloqueada INTEGER DEFAULT 0,
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

try { db.exec('ALTER TABLE citas ADD COLUMN bloqueada INTEGER DEFAULT 0') } catch (e) {}

// ─── CITAS ───
export function horarioDisponible(dia, hora) {
    const cita = db.prepare('SELECT id FROM citas WHERE dia = ? AND hora = ? AND estado != ?').get(dia, hora, 'cancelada')
    return !cita
}

export function horarioDisponibleConIntervalo(dia, hora, intervaloMinutos) {
    function horaAMinutos(h) {
        h = h.toLowerCase().trim()
        const ampm = h.includes('pm') ? 'pm' : h.includes('am') ? 'am' : null
        h = h.replace(/am|pm/g, '').trim()
        const partes = h.split(':')
        let horas = parseInt(partes[0])
        const mins = partes[1] ? parseInt(partes[1]) : 0
        if (ampm === 'pm' && horas !== 12) horas += 12
        if (ampm === 'am' && horas === 12) horas = 0
        return horas * 60 + mins
    }
    const citasDelDia = db.prepare('SELECT hora FROM citas WHERE dia = ? AND estado != ?').all(dia, 'cancelada')
    const nuevaHoraMin = horaAMinutos(hora)
    for (const cita of citasDelDia) {
        const citaMin = horaAMinutos(cita.hora)
        const diferencia = Math.abs(nuevaHoraMin - citaMin)
        if (diferencia < intervaloMinutos) return false
    }
    return true
}

export function agendarCita(numero, nombre, dia, hora, servicio) {
    const result = db.prepare('INSERT INTO citas (numero, nombre, dia, hora, servicio) VALUES (?, ?, ?, ?, ?)').run(numero, nombre, dia, hora, servicio || 'General')
    return result.lastInsertRowid
}

export function bloquearHorario(dia, hora, motivo) {
    const result = db.prepare('INSERT INTO citas (numero, nombre, dia, hora, servicio, bloqueada) VALUES (?, ?, ?, ?, ?, 1)').run('admin', motivo || 'Bloqueado', dia, hora, motivo || 'Bloqueado')
    return result.lastInsertRowid
}

export function desbloquearHorario(id) {
    db.prepare('UPDATE citas SET estado = ? WHERE id = ? AND bloqueada = 1').run('cancelada', id)
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

export function limpiarCitas() {
    db.prepare('DELETE FROM citas').run()
}

// ─── PEDIDOS ───
export function guardarPedido(numero, nombre, producto, precio) {
    const result = db.prepare('INSERT INTO pedidos (numero, nombre, producto, precio) VALUES (?, ?, ?, ?)').run(numero, nombre || '', producto, precio)
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

export function limpiarPedidos() {
    db.prepare('DELETE FROM pedidos').run()
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

export function limpiarContactos() {
    db.prepare('DELETE FROM contactos').run()
}

export default db