import express from 'express'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { todasLasCitas, todosPedidos, cancelarCita, actualizarEstadoPedido, todosLosContactos } from '../src/database.js'
import { leerEstado } from '../src/estado.js'
import { crearLicencia, desactivarLicencia, todasLasLicencias, generarCodigo, verificarLicencia, activarLicencia } from '../src/licencias.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()

const DIAS_POR_TIPO = {
    prueba: 7,
    mensual: 30,
    trimestral: 90,
    semestral: 180,
    anual: 365
}

const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(express.static(__dirname))
app.use('/admin', express.static('./admin'))

// Redirigir raiz al admin
app.get('/', (req, res) => {
    res.redirect('/admin')
})

// Config
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

// Bot estado
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

// Contactos
app.get('/api/contactos', (req, res) => { res.json(todosLosContactos()) })

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

// Activar licencia del cliente
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

// Admin licencias
app.get('/api/admin/licencias', async (req, res) => {
    try {
        const licencias = await todasLasLicencias()
        res.json(licencias)
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al obtener licencias' })
    }
})

app.post('/api/admin/licencias/crear', async (req, res) => {
    try {
        const { negocio, tipo } = req.body
        if (!negocio || !tipo) return res.status(400).json({ ok: false, mensaje: 'Faltan datos' })
        const codigo = generarCodigo()
        const dias = DIAS_POR_TIPO[tipo] || 30
        await crearLicencia(codigo, negocio, tipo, dias)
        res.json({ ok: true, codigo, mensaje: 'Licencia creada correctamente' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al crear licencia: ' + e.message })
    }
})

app.post('/api/admin/licencias/desactivar/:codigo', async (req, res) => {
    try {
        await desactivarLicencia(req.params.codigo)
        res.json({ ok: true, mensaje: 'Licencia desactivada' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al desactivar' })
    }
})

app.listen(PORT, () => {
    console.log('Panel web disponible en puerto ' + PORT)
})