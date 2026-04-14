import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static(__dirname))

const PRIVATE_KEY = [
    '-----BEGIN PRIVATE KEY-----',
    'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCgyb/crFvC7OG7',
    'gX3siCYISTxiD3oKzCDHk9Go+71QVKn25jOyum0OGeR+GIMYFZ75LO7izPfJ1qxB',
    'dBMGKQDssIYKKnb32ijxlj3WaHZTWh19OPVcqazpXcjnW+CVLHLIQLSOq6ynmUDU',
    'fYkNLW6kmy/R850LynkOWZ6PxJuB2EXcpQAvhbMdVMdOyovUob+2Pvg+nz/QhsJi',
    'fhNvQQCLIZUufGczt+97NPNDb0nykD2IF1RsY/2R57YWsHrH+oP+Je5Xth4rkT+H',
    '3RngTh07CTBhNk5c58U9pjImy1jWZ00IA/ABTi/khH3uUMmBaCTX2SpNTK7sqxvT',
    'Bme8gsWlAgMBAAECggEAM8nn33cwsy9DYfbKjYYo4eBc76TWhWXMZRwqmshC6P3s',
    'JNdu7XF4sOMMIsVYbEiChPXBGBI2+a8Imqh9fC1228Xb1qho21pMd8wRrN7GxgAv',
    'oWbYOPl59Uy86jBAvSus6O1WeuG24eDN7eNlYnYwvhoyI+jYu7SCm2moVdxYzlBN',
    'Lu02Tu3YXFik7zg2WVvn2UJMOQykGD4ALEabgNFodeWCneAutYmTZH6AnBBq3AAt',
    'h9xsapuJHVHvir+SpEG1b2vNJQxYJigytHgtNbTWjSAQe9ZgMbb8IvLdC5+KblDp',
    'IRrhqFHh17n8mbSs2BSyksmDXU260P3SP1aZDM/cfQKBgQDPFROuxl4bflScniC5',
    '+HEupY1vhaCIobYoJUh+qCKe0AOjGuGQnGkoFHN5w/RQlFjx2x5UGOlOwZG1XBjI',
    'n+XKM8hieLB6gGPh6Xz/7YZVdVMnuVhhbJEDDPiIzN5sjpCmAYyA8rdXGh/q74QK',
    'Al4G2Cu3Y1I/yJSUJ9OsRs0vawKBgQDGxRzzlyolzUqXCgFNBTbMNYwaSP+4a9n/',
    'DUiyY1i5Uwn0BkE+vuN2mEYTY7IkpWd1r1mngPInjqcTuXOAraY5M2MOuqIt1/ja',
    '7J+nS87Y+1HEpU9H+qUnF4zVFuCc5UMExVdxvBdcO8ZzlrfPKwBVnzCbNC96fudB',
    'AwcRhh5zLwKBgQCDQqPgQ8LBAJmXULAD0VPEspFtIDF6ia5R0hgamG6hZc74YwCZ',
    'TltlWVk81JWXQgEDBNY7jjLMhevbHk5jVN8uBRa+PCv46krllr9x5dghcSXNZzF7',
    'R3q/iUg8RkeyXceYQiESV0cZQej7XOjAA3IgOoOzUZR/858iLgCBEbvbkwKBgC1a',
    'yNJkSb+6aiywob9bUzeheEh/I6qHIYTrGQ1rUdFnuzutObIBiJGFCWhfNUTbYRIf',
    'YsuvxpF0IXeEt3BDL0yaBx5TQ7JGN4hsublIuPgV0ICYX9DCxnB3FTGCONpUDcjG',
    '5r8S9hmbohq551MkMr1Wx5aCf9rpngbdk/1Rpx0NAoGAGnza+4FRvKCUhoTuhBZ0',
    '0iNdhj4kAYMiloImPpfL1Xl41Rkp+R4cN9yl+Ajmanhp61xj515iJ/uYvAiWh8gB',
    'hGURF/k0vC9KpSdxcjiPm6CZrb5Tmp6uMnEQdLPlbjGrrbyIlvPjHdHf+wCEN2+h',
    'TR3E741zrO17VTFHg0T/Wr0=',
    '-----END PRIVATE KEY-----'
].join('\n')

const firebaseKey = {
    type: 'service_account',
    project_id: 'bot-whatsapp-licencias-5dcbf',
    private_key_id: '783aacf30b64e23de99a65be0e52e95b0e395138',
    private_key: PRIVATE_KEY,
    client_email: 'firebase-adminsdk-fbsvc@bot-whatsapp-licencias-5dcbf.iam.gserviceaccount.com',
    client_id: '106900626375135790130',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40bot-whatsapp-licencias-5dcbf.iam.gserviceaccount.com',
    universe_domain: 'googleapis.com'
}

let db
try {
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