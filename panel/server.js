import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static(__dirname))

const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCdp1rGFou6O9Pz
xwaI6ebk5cGqzSJyFnOZM1NnjTfhMX55Vo/D/WB58LLUDV5BjRUhntwDZLLehJqc
sm6KZZPTNLQeQiJphIH2MAZxdLabmwgt9UmN10Xjbx++K/LkSBwAC/v33k0wyuZo
47RAJq97CYkKjzTikRsSmkcNbAlj7wZ9Xttkytj8Q4yxSEc9GM4MvAnkkzH2AkNk
DWw9zyJ/zpmYSsED/N10/7M0zBucpyIhn62taCPeKvL8aA6+byTOazxvI/E9M6C6
AX5Dt4KK/7G9b3uIxT8u+KmUe4WX1RlZsX/CTGMvlXkyWE2VI446kozkRT4TUS/Y
sZVDK+r9AgMBAAECggEACKgMSW0qfe7UDAIlHzZsqavd7vF1jzshXMufLEPqShCs
J6Bzo2jRt9BaGV+kicfj3aU54mvQkHxKewknHa1HKSUvMKwj9JREiI6JhAhLEI86
Kz/ZKpMj8MGExi3ml9dHxk7iJnGL3n59mUvLdWxKXWCgKDbFyhz6lhJnjVqdx2Fd
8ytJXcsbaNRQCPHh/HazVpJ0wPXyDj0MskLQu7LhnK7DPl4nvACXCM5OQpiXBX1M
CXGJLMVcSMSSGeRDK941IfhMJ7VSlJnjQWVN5Rrobuf9QnjYF7iehUlWEtwjPzzK
Ra4A1a0fuBQZDjbFmqk9oUVcKQs7A9DSe8I7mBK9wKBgQDLFZQ/KE4AB+DZRe7Dg
J72DVkTK5BAow5V4Hjykyv5uEI7PF0YtaKyuGmegsVVND3Ug5G26ZB4bxzoHEY8f
FjStl55I/xKQ28V3ShWAWGsvFy3HtC2qHzpCO14Xha2udrh9d5ciIGK7LIt7NFa2
GFR2h9Rg3l2DI9o7LMizjYl1wKBgQDGu2aMXb901Bt/pWgIPy8Np2ZtLY+6o6eQ
FYY/XZ6McXD8EaEIFfxUZaDIZ2kVTBw4Znz+d4Ntz2n/Y1ONTgmMv9IFPbUoVYaE
SZPQSDHSqoOy+CBSiNT+HT/FOZxF9jyCTGR4jhQhrDms6OJgqn6gCIRO/zfgDiR1
xZcpC8MzSwKBgQC3xp1S0fxT1s1IkRpR3JD9BHM4/9EYTPXqDKomibvfzThSNnvg
om3K4Uri4GAGjLHvH+i6532PHq2/9eYxUi1m8RVo9oGWCpP56xpXSgTDtekI5V/m
C26Ny0BqDmrrjCBhHofMoNLpjuxm1slVNj5LPeHdd+ZwR0l3n8szkfw6HQKBgD+V
JbIzLFZMpp+oZCh/TqansHWt5hZo1eubd2A+q8NzaBq96S+VGS5HdbGopE5UE5NX
9xXTVxGDEv7K4KiNFzEZDjDvFU7aTjd08v3om0gzlf9ks7K0ZLEI2qZXUFBx/9oQ
ZvTLQFWlrK5NtGAJLIo3L122+kGNRM0JctuHD+URAoGABqUEMnBcMEELT6iTbfej
cRsoJg0zxJLKex6KcGj70VBCUBjhmVF4fwdE6cQGmySO4UtqiVVrZHjeyyp6T2bq
6XqGnsugi+LsWd0x3I2AZq0VlMp7YSra3QhI1kBqNbsHCp8+zRyWOPpx/jvIBCIn
E9Kewg+Ku+VR0M8gJ8lhh+g=
-----END PRIVATE KEY-----`

const firebaseKey = {
    type: "service_account",
    project_id: "bot-whatsapp-licencias",
    private_key_id: "48aa931b0871fbf2b7ed623a3e9a340f90339f1c",
    private_key: privateKey,
    client_email: "firebase-adminsdk-fbsvc@bot-whatsapp-licencias.iam.gserviceaccount.com",
    client_id: "106337392086475541472",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40bot-whatsapp-licencias.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
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