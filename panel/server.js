import express from 'express'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { todasLasCitas, todosPedidos, cancelarCita, actualizarEstadoPedido, todosLosContactos, bloquearHorario, limpiarCitas, limpiarPedidos, limpiarContactos } from '../src/database.js'
import { leerEstado } from '../src/estado.js'
import { verificarLicencia, activarLicencia } from '../src/licencias.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.json())
app.use(express.static(__dirname))

app.get('/api/config', (req, res) => {
    const config = JSON.parse(readFileSync('./config.json', 'utf-8'))
    res.json(config)
})

app.post('/api/config', (req, res) => {
    try {
        writeFileSync('./config.json', JSON.stringify(req.body, null, 2), 'utf-8')
        res.json({ ok: true, mensaje: 'Configuracion guardada correctamente' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al guardar' })
    }
})

app.get('/api/bot/estado', (req, res) => {
    res.json(leerEstado())
})

app.post('/api/bot/reiniciar', (req, res) => {
    try {
        writeFileSync('./bot_comando.json', JSON.stringify({ accion: 'reiniciar', pendiente: true }), 'utf-8')
        res.json({ ok: true, mensaje: 'Bot reiniciando...' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al reiniciar' })
    }
})

app.post('/api/bot/desvincular', (req, res) => {
    try {
        writeFileSync('./bot_comando.json', JSON.stringify({ accion: 'desvincular', pendiente: true }), 'utf-8')
        res.json({ ok: true, mensaje: 'Desvinculando numero. El QR aparecera en unos segundos.' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al desvincular' })
    }
})

// Citas
app.get('/api/citas', (req, res) => { res.json(todasLasCitas()) })

app.post('/api/citas/cancelar/:id', (req, res) => {
    cancelarCita(req.params.id)
    res.json({ ok: true, mensaje: 'Cita cancelada' })
})

app.post('/api/citas/bloquear', (req, res) => {
    try {
        const { dia, hora, motivo } = req.body
        if (!dia || !hora) return res.status(400).json({ ok: false, mensaje: 'Dia y hora requeridos' })
        bloquearHorario(dia, hora, motivo)
        res.json({ ok: true, mensaje: 'Horario bloqueado correctamente' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al bloquear: ' + e.message })
    }
})

app.post('/api/citas/limpiar', (req, res) => {
    try {
        limpiarCitas()
        res.json({ ok: true, mensaje: 'Todas las citas eliminadas' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al limpiar: ' + e.message })
    }
})

// Pedidos
app.get('/api/pedidos', (req, res) => { res.json(todosPedidos()) })

app.post('/api/pedidos/estado/:id', (req, res) => {
    try {
        actualizarEstadoPedido(req.params.id, req.body.estado)
        res.json({ ok: true, mensaje: 'Estado actualizado' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al actualizar' })
    }
})

app.post('/api/pedidos/limpiar', (req, res) => {
    try {
        limpiarPedidos()
        res.json({ ok: true, mensaje: 'Todos los pedidos eliminados' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al limpiar: ' + e.message })
    }
})

// Contactos
app.get('/api/contactos', (req, res) => { res.json(todosLosContactos()) })

app.post('/api/contactos/limpiar', (req, res) => {
    try {
        limpiarContactos()
        res.json({ ok: true, mensaje: 'Todos los contactos eliminados' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al limpiar: ' + e.message })
    }
})

// Envio masivo
app.post('/api/envio-masivo', (req, res) => {
    try {
        const { mensaje, contactos } = req.body
        if (!mensaje) return res.status(400).json({ ok: false, mensaje: 'El mensaje no puede estar vacio' })
        writeFileSync('./envio_masivo.json', JSON.stringify({
            mensaje, pendiente: true,
            contactosSeleccionados: contactos || null,
            fecha: new Date().toISOString()
        }), 'utf-8')
        res.json({ ok: true, mensaje: 'Envio programado correctamente' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al programar envio' })
    }
})

// Activar licencia
app.post('/api/licencia/activar', async (req, res) => {
    try {
        const { codigo } = req.body
        if (!codigo) return res.status(400).json({ ok: false, mensaje: 'Codigo requerido' })
        const estado = leerEstado()
        const numeroWhatsapp = estado.numero || null
        if (!numeroWhatsapp) {
            return res.json({ ok: false, mensaje: 'Primero vincula tu numero de WhatsApp en la pestana WhatsApp, luego activa la licencia.' })
        }
        const resultado = await activarLicencia(codigo, numeroWhatsapp)
        if (!resultado.valida) return res.json({ ok: false, mensaje: resultado.motivo })
        writeFileSync('./src/licencia.json', JSON.stringify({ codigo }), 'utf-8')
        writeFileSync('./bot_comando.json', JSON.stringify({ accion: 'reiniciar', pendiente: true }), 'utf-8')
        res.json({ ok: true, mensaje: 'Licencia activada y vinculada al numero +' + numeroWhatsapp + '!' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al activar licencia' })
    }
})

app.listen(3001, () => {
    console.log('Panel web disponible en http://localhost:3001')
})