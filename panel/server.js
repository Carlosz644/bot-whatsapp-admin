import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static(__dirname))

// Firebase
const firebaseKey = JSON.parse(process.env.FIREBASE_KEY)
if (!getApps().length) {
    initializeApp({ credential: cert(firebaseKey) })
}
const db = getFirestore()

// --- HELPERS ---
function generarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    return `${seg()}-${seg()}-${seg()}`
}

function diasPorTipo(tipo) {
    const mapa = { prueba: 7, mensual: 30, trimestral: 90, semestral: 180, anual: 365 }
    return mapa[tipo] || 30
}

function fechaVencimiento(dias) {
    const d = new Date()
    d.setDate(d.getDate() + dias)
    return d.toISOString().split('T')[0]
}

// --- RUTAS ---

// Crear licencia
app.post('/api/admin/licencias/crear', async (req, res) => {
    try {
        const { negocio, tipo } = req.body
        if (!negocio) return res.status(400).json({ ok: false, mensaje: 'Negocio requerido' })

        const codigo = generarCodigo()
        const dias = diasPorTipo(tipo || 'mensual')

        await db.collection('licencias').doc(codigo).set({
            codigo,
            negocio,
            tipo: tipo || 'mensual',
            activa: true,
            creadaEn: new Date().toISOString().split('T')[0],
            vencimiento: fechaVencimiento(dias),
            numeroWhatsapp: null,
            activadaEn: null
        })

        res.json({ ok: true, codigo, mensaje: 'Licencia creada correctamente' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al crear: ' + e.message })
    }
})

// Listar licencias
app.get('/api/admin/licencias', async (req, res) => {
    try {
        const snap = await db.collection('licencias').get()
        const licencias = []
        snap.forEach(doc => licencias.push(doc.data()))
        licencias.sort((a, b) => (b.creadaEn || '').localeCompare(a.creadaEn || ''))
        res.json(licencias)
    } catch (e) {
        res.status(500).json([])
    }
})

// Desactivar licencia
app.post('/api/admin/licencias/desactivar/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params
        await db.collection('licencias').doc(codigo).update({ activa: false })
        res.json({ ok: true, mensaje: 'Licencia desactivada' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error: ' + e.message })
    }
})

// Servir panel
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Panel admin disponible en puerto ${PORT}`)
})