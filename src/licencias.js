import admin from 'firebase-admin'

let serviceAccount

if (process.env.FIREBASE_KEY) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_KEY)
    } catch (e) {
        console.log('Error parseando FIREBASE_KEY:', e.message)
    }
} else {
    const { readFileSync } = await import('fs')
    serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf-8'))
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    })
}

const db = admin.firestore()

// Verificar licencia
export async function verificarLicencia(codigo) {
    try {
        const doc = await db.collection('licencias').doc(codigo).get()
        if (!doc.exists) return { valida: false, motivo: 'Licencia no encontrada' }

        const datos = doc.data()
        const ahora = new Date()
        const vencimiento = datos.vencimiento.toDate()

        if (!datos.activa) return { valida: false, motivo: 'Licencia desactivada' }
        if (ahora > vencimiento) return { valida: false, motivo: 'Licencia vencida' }

        return {
            valida: true,
            negocio: datos.negocio,
            tipo: datos.tipo,
            vencimiento: vencimiento.toLocaleDateString('es-MX')
        }
    } catch (e) {
        console.log('Error verificando licencia:', e.message)
        return { valida: false, motivo: 'Error de conexion' }
    }
}

// Activar licencia vinculando numero de WhatsApp
export async function activarLicencia(codigo, numeroWhatsapp) {
    try {
        const doc = await db.collection('licencias').doc(codigo).get()
        if (!doc.exists) return { valida: false, motivo: 'Licencia no encontrada' }

        const datos = doc.data()
        const ahora = new Date()
        const vencimiento = datos.vencimiento.toDate()

        if (!datos.activa) return { valida: false, motivo: 'Licencia desactivada' }
        if (ahora > vencimiento) return { valida: false, motivo: 'Licencia vencida' }

        if (datos.numeroWhatsapp && datos.numeroWhatsapp !== numeroWhatsapp) {
            return { valida: false, motivo: 'Esta licencia ya esta en uso por otro numero de WhatsApp' }
        }

        if (!datos.numeroWhatsapp) {
            await db.collection('licencias').doc(codigo).update({
                numeroWhatsapp,
                activadaEn: admin.firestore.FieldValue.serverTimestamp()
            })
        }

        return {
            valida: true,
            negocio: datos.negocio,
            tipo: datos.tipo,
            vencimiento: vencimiento.toLocaleDateString('es-MX')
        }
    } catch (e) {
        console.log('Error activando licencia:', e.message)
        return { valida: false, motivo: 'Error de conexion' }
    }
}

// Crear nueva licencia
export async function crearLicencia(codigo, negocio, tipo, dias) {
    const vencimiento = new Date()
    vencimiento.setDate(vencimiento.getDate() + dias)

    await db.collection('licencias').doc(codigo).set({
        negocio,
        tipo,
        activa: true,
        numeroWhatsapp: null,
        creada: admin.firestore.FieldValue.serverTimestamp(),
        vencimiento: admin.firestore.Timestamp.fromDate(vencimiento)
    })

    return { codigo, vencimiento: vencimiento.toLocaleDateString('es-MX') }
}

// Desactivar licencia
export async function desactivarLicencia(codigo) {
    await db.collection('licencias').doc(codigo).update({ activa: false })
}

// Desvincular numero
export async function desvincularNumero(codigo) {
    await db.collection('licencias').doc(codigo).update({ numeroWhatsapp: null })
}

// Obtener todas las licencias
export async function todasLasLicencias() {
    const snapshot = await db.collection('licencias').get()
    return snapshot.docs.map(doc => ({
        codigo: doc.id,
        ...doc.data(),
        vencimiento: doc.data().vencimiento?.toDate().toLocaleDateString('es-MX'),
        activadaEn: doc.data().activadaEn?.toDate().toLocaleDateString('es-MX') || 'No activada'
    }))
}

// Generar codigo unico
export function generarCodigo() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const segmento = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    return segmento() + '-' + segmento() + '-' + segmento()
}