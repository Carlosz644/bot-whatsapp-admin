import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyABZELi3gFhplXiRY0hXtZQSna6eis5U0Y",
    authDomain: "bot-whatsapp-licencias-5dcbf.firebaseapp.com",
    projectId: "bot-whatsapp-licencias-5dcbf",
    storageBucket: "bot-whatsapp-licencias-5dcbf.firebasestorage.app",
    messagingSenderId: "145516273903",
    appId: "1:145516273903:web:34b628c9bcc313e40cbb1a"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

export async function verificarLicencia(codigo) {
    try {
        const docRef = doc(db, 'licencias', codigo)
        const docSnap = await getDoc(docRef)
        if (!docSnap.exists()) return { valida: false, motivo: 'Licencia no encontrada' }
        const datos = docSnap.data()
        const ahora = new Date()
        const vencimiento = new Date(datos.vencimiento)
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

export async function activarLicencia(codigo, numeroWhatsapp) {
    try {
        const docRef = doc(db, 'licencias', codigo)
        const docSnap = await getDoc(docRef)
        if (!docSnap.exists()) return { valida: false, motivo: 'Licencia no encontrada' }
        const datos = docSnap.data()
        const ahora = new Date()
        const vencimiento = new Date(datos.vencimiento)
        if (!datos.activa) return { valida: false, motivo: 'Licencia desactivada' }
        if (ahora > vencimiento) return { valida: false, motivo: 'Licencia vencida' }
        if (datos.numeroWhatsapp && datos.numeroWhatsapp !== numeroWhatsapp) {
            return { valida: false, motivo: 'Esta licencia ya esta en uso por otro numero de WhatsApp' }
        }
        if (!datos.numeroWhatsapp) {
            await updateDoc(docRef, { numeroWhatsapp, activadaEn: new Date().toISOString().split('T')[0] })
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