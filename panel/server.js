
import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static(__dirname))

// ─── CONFIGURACION DE FIREBASE DESDE VARIABLES DE ENTORNO ───
const firebaseKey = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: 'googleapis.com'
}

let db
try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Faltan variables de entorno de Firebase')
    }
    if (!getApps().length) {
        initializeApp({ credential: cert(firebaseKey) })
    }
    db = getFirestore()
    console.log('Firebase conectado correctamente')
} catch (e) {
    console.error('ERROR Firebase:', e.message)
}

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

app.get('/health', (req, res) => {
    res.json({ ok: true, firebase: !!db })
})

app.post('/api/admin/licencias/crear', async (req, res) => {
    if (!db) return res.status(500).json({ ok: false, mensaje: 'Firebase no conectado' })
    try {
        const { negocio, tipo } = req.body
        if (!negocio) return res.status(400).json({ ok: false, mensaje: 'Negocio requerido' })
        const codigo = generarCodigo()
        const dias = diasPorTipo(tipo || 'mensual')
        await db.collection('licencias').doc(codigo).set({
            codigo, negocio, tipo: tipo || 'mensual', activa: true,
            creadaEn: new Date().toISOString().split('T')[0],
            vencimiento: fechaVencimiento(dias),
            numeroWhatsapp: null, activadaEn: null
        })
        res.json({ ok: true, codigo, mensaje: 'Licencia creada correctamente' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error al crear: ' + e.message })
    }
})

app.get('/api/admin/licencias', async (req, res) => {
    if (!db) return res.status(500).json([])
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

app.post('/api/admin/licencias/desactivar/:codigo', async (req, res) => {
    if (!db) return res.status(500).json({ ok: false, mensaje: 'Firebase no conectado' })
    try {
        await db.collection('licencias').doc(req.params.codigo).update({ activa: false })
        res.json({ ok: true, mensaje: 'Licencia desactivada' })
    } catch (e) {
        res.status(500).json({ ok: false, mensaje: 'Error: ' + e.message })
    }
})

app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Panel admin en puerto ${PORT}`)
})