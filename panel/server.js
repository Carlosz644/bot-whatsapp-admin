import express from 'express'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { crearLicencia, desactivarLicencia, todasLasLicencias, generarCodigo } from '../src/licencias.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use('/admin', express.static('./admin'))

app.get('/', (req, res) => {
    res.redirect('/admin')
})

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
        const dias = { prueba: 7, mensual: 30, trimestral: 90, semestral: 180, anual: 365 }[tipo] || 30
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
    console.log('Panel admin disponible en puerto ' + PORT)
})