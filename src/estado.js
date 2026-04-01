import { writeFileSync, readFileSync, existsSync } from 'fs'

const ARCHIVO = './bot_estado.json'

export function guardarEstado(datos) {
    writeFileSync(ARCHIVO, JSON.stringify(datos), 'utf-8')
}

export function leerEstado() {
    if (!existsSync(ARCHIVO)) {
        return { conectado: false, qr: null, numero: null }
    }
    return JSON.parse(readFileSync(ARCHIVO, 'utf-8'))
}