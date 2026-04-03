import pkg from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { horarioDisponibleConIntervalo, agendarCita, cancelarCita, guardarPedido, guardarContacto, todosLosContactos } from './database.js'
import { guardarEstado } from './estado.js'
import { verificarLicencia } from './licencias.js'

const { Client, LocalAuth, Location } = pkg

function getConfig() {
    return JSON.parse(readFileSync('./config.json', 'utf-8'))
}

function getLicencia() {
    try {
        return JSON.parse(readFileSync('./src/licencia.json', 'utf-8'))
    } catch {
        return { codigo: '' }
    }
}

function dentroDeHorario() {
    const config = getConfig()
    const hora = new Date().getHours()
    return hora >= config.horarioApertura && hora < config.horarioCierre
}

function esperar(ms) {
    return new Promise(r => setTimeout(r, ms))
}

function tiempoAleatorio() {
    return Math.floor(Math.random() * 1000) + 1000
}

const sesiones = {}

function getTiempoReset() {
    const config = getConfig()
    return (config.tiempoReset || 7) * 60 * 1000
}

function getSesion(numero) {
    const ahora = Date.now()
    const TIEMPO_RESET = getTiempoReset()
    if (!sesiones[numero]) {
        sesiones[numero] = { paso: null, ultimaRespuesta: {}, ultimoMensaje: ahora }
    }
    const sesion = sesiones[numero]
    if (sesion.ultimoMensaje && (ahora - sesion.ultimoMensaje) > TIEMPO_RESET) {
        sesiones[numero] = { paso: null, ultimaRespuesta: {}, ultimoMensaje: ahora }
    } else {
        sesion.ultimoMensaje = ahora
    }
    return sesiones[numero]
}

function puedeResponder(sesion, tipo) {
    const ahora = Date.now()
    const TIEMPO_RESET = getTiempoReset()
    const ultimaVez = sesion.ultimaRespuesta[tipo]
    if (!ultimaVez) return true
    return (ahora - ultimaVez) > TIEMPO_RESET
}

function registrarRespuesta(sesion, tipo) {
    sesion.ultimaRespuesta[tipo] = Date.now()
}

function construirMenu(config) {
    const menu = config.menuPersonalizado || []
    let texto = 'Hola! Bienvenido a ' + config.nombreNegocio + '\n\n' + config.mensajeBienvenida + '\n\nEn que te podemos ayudar?\n\n'
    menu.forEach(item => { texto += item.opcion + '. ' + item.nombre + '\n' })
    return texto
}

function esDiaValido(texto) {
    const diasValidos = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo']
    const textoMin = texto.toLowerCase()
    const tieneDia = diasValidos.some(d => textoMin.includes(d))
    const tieneFecha = /\d{1,2}[\/\-]\d{1,2}/.test(texto)
    return tieneDia || tieneFecha
}

function esHoraValida(texto) {
    return /\d{1,2}(:\d{2})?\s*(am|pm)?/i.test(texto)
}

async function procesarOpcion(item, msg, sesion, config, numero) {
    switch (item.tipo) {
        case 'catalogo': {
            const disponibles = config.catalogo.filter(p => p.disponible)
            const noDisponibles = config.catalogo.filter(p => !p.disponible)
            let respuesta = 'Nuestro catalogo:\n\n'
            disponibles.forEach(p => { respuesta += ' ' + p.nombre + ' - $' + p.precio + '\n' })
            if (noDisponibles.length > 0) {
                respuesta += '\nSin existencia:\n'
                noDisponibles.forEach(p => { respuesta += ' ' + p.nombre + '\n' })
            }
            respuesta += '\nPara hacer un pedido escribe el nombre del producto o escribe *pedido*.'
            await msg.reply(respuesta)
            break
        }
        case 'horarios':
            await msg.reply('Nuestros horarios:\n' + config.horarios)
            break
        case 'ubicacion':
            await msg.reply('Estamos en:\n' + config.direccion + '\n\n' + config.linkMaps)
            if (config.ubicacion) {
                const location = new Location(config.ubicacion.lat, config.ubicacion.lng, config.nombreNegocio)
                await client.sendMessage(numero, location)
            }
            break
        case 'cita':
            sesion.paso = 'cita_nombre'
            await msg.reply('Para agendar tu cita necesito algunos datos.\n\nCual es tu nombre completo?')
            break
        case 'cancelar_cita':
            sesion.paso = 'cancelar_cita'
            await msg.reply('Para cancelar tu cita escribe tu numero de folio.\nEj: 12')
            break
        case 'asesor':
            await msg.reply('En un momento un asesor te atendera.\nTambien puedes llamarnos al: ' + config.telefonoAsesor)
            break
        case 'pedido': {
            sesion.paso = 'pedido_producto'
            const disponibles = config.catalogo.filter(p => p.disponible)
            let respuesta = 'Que producto deseas pedir?\n\n'
            disponibles.forEach(p => { respuesta += '- ' + p.nombre + ' ($' + p.precio + ')\n' })
            respuesta += '\nEscribe el nombre del producto.'
            await msg.reply(respuesta)
            break
        }
        default:
            await msg.reply(item.respuesta || 'En breve te atendemos.')
    }
}

let client

function crearCliente() {
    return new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    })
}

function iniciarEventos(c) {
    c.on('qr', async (qr) => {
        console.log('QR generado')
        qrcode.generate(qr, { small: true })
        try {
            const qrImagen = await QRCode.toDataURL(qr)
            guardarEstado({ conectado: false, qr: qrImagen, numero: null })
        } catch (e) {
            console.log('Error generando QR:', e.message)
        }
    })

    c.on('ready', () => {
        console.log('Bot conectado correctamente!')
        const info = c.info
        const numero = info?.wid?.user || 'Desconocido'
        guardarEstado({ conectado: true, qr: null, numero })

        setInterval(async () => {
            const licenciaData = getLicencia()
            if (!licenciaData.codigo) return
            const resultado = await verificarLicencia(licenciaData.codigo)
            if (!resultado.valida) {
                console.log('Licencia vencida o invalida. Deteniendo bot...')
                guardarEstado({ conectado: false, qr: null, numero: null, licencia: resultado })
                try { await c.destroy() } catch (e) {}
            }
        }, 6 * 60 * 60 * 1000)

        setInterval(async () => {
            try {
                if (!existsSync('./envio_masivo.json')) return
                const envio = JSON.parse(readFileSync('./envio_masivo.json', 'utf-8'))
                if (!envio.pendiente) return
                console.log('Iniciando envio masivo...')
                const contactos = envio.contactosSeleccionados || todosLosContactos()
                writeFileSync('./envio_masivo.json', JSON.stringify({ ...envio, pendiente: false }), 'utf-8')
                let enviados = 0
                for (const contacto of contactos) {
                    try {
                        await c.sendMessage(contacto.numero, envio.mensaje)
                        enviados++
                        await new Promise(r => setTimeout(r, 2000))
                    } catch (e) {
                        console.log('Error enviando a ' + contacto.numero + ': ' + e.message)
                    }
                }
                console.log('Envio masivo completado. Enviados: ' + enviados)
            } catch (e) {
                console.log('Error en envio masivo: ' + e.message)
            }
        }, 30000)
    })

    c.on('disconnected', () => {
        guardarEstado({ conectado: false, qr: null, numero: null })
    })

    c.on('message', async (msg) => {
        if (msg.from === 'status@broadcast') return
        if (msg.type === 'e2e_notification') return
        if (msg.type === 'notification_template') return
        if (!msg.body || msg.body.trim() === '') return

        const config = getConfig()
        const texto = msg.body.trim()
        const textoMin = texto.toLowerCase()
        const numero = msg.from
        console.log('Mensaje de ' + numero + ': ' + texto)

        guardarContacto(numero, null)

        const licActual = getLicencia()
        if (!licActual.codigo) return

        const sesion = getSesion(numero)
        await esperar(tiempoAleatorio())

        if (!dentroDeHorario()) {
            if (puedeResponder(sesion, 'fuera_horario')) {
                registrarRespuesta(sesion, 'fuera_horario')
                await msg.reply('Hola! Gracias por escribir a ' + config.nombreNegocio + '.\n\nEn este momento estamos fuera de horario.\n\nNuestros horarios son:\n' + config.horarios + '\n\nTe atenderemos en cuanto abramos.')
            }
            return
        }

        if (textoMin === 'cancelar') {
            sesion.paso = null
            sesion.ultimaRespuesta = {}
            await msg.reply('Operacion cancelada. Escribe *hola* para ver el menu principal.')
            return
        }

        // FLUJO CITAS
        if (sesion.paso === 'cita_nombre') {
            if (texto.length < 3 || /^\d+$/.test(texto)) {
                await msg.reply('Por favor escribe tu nombre completo.\nEj: Juan Lopez')
                return
            }
            sesion.nombre = texto
            sesion.paso = 'cita_servicio'
            await msg.reply('Gracias ' + texto + '! Que servicio necesitas?\n\nO escribe *cancelar* para salir.')
            return
        }

        if (sesion.paso === 'cita_servicio') {
            if (texto.length < 3) {
                await msg.reply('Por favor describe el servicio que necesitas.\nEj: Corte de cabello, Consulta general')
                return
            }
            sesion.servicio = texto
            sesion.paso = 'cita_dia'
            await msg.reply('Que dia prefieres?\nEj: Lunes, Martes o una fecha: 25/03/2026')
            return
        }

        if (sesion.paso === 'cita_dia') {
            if (!esDiaValido(texto)) {
                await msg.reply('Por favor escribe un dia valido.\nEj: Lunes, Martes, Miercoles\nO una fecha: 25/03/2026')
                return
            }
            sesion.dia = texto
            sesion.paso = 'cita_hora'
            await msg.reply('A que hora?\nEj: 10:00am, 2:00pm, 14:00')
            return
        }

        if (sesion.paso === 'cita_hora') {
            if (!esHoraValida(texto)) {
                await msg.reply('Por favor escribe una hora valida.\nEj: 10:00am, 2:00pm, 14:00')
                return
            }
            const intervalo = config.intervaloCitas || 60
            const disponible = horarioDisponibleConIntervalo(sesion.dia, texto, intervalo)
            if (!disponible) {
                await msg.reply('Lo sentimos, el horario *' + sesion.dia + ' a las ' + texto + '* no esta disponible.\n\nRecuerda que el intervalo entre citas es de ' + intervalo + ' minutos.\n\nPor favor elige otro horario:')
                return
            }
            const id = agendarCita(numero, sesion.nombre, sesion.dia, texto, sesion.servicio)
            sesion.paso = null
            sesion.ultimaRespuesta = {}
            await msg.reply('Cita confirmada!\n\nResumen:\n- Nombre: ' + sesion.nombre + '\n- Servicio: ' + sesion.servicio + '\n- Dia: ' + sesion.dia + '\n- Hora: ' + texto + '\n- Folio: #' + id + '\n\nGuarda tu folio para cualquier cambio.')
            return
        }

        // FLUJO CANCELAR CITA
        if (sesion.paso === 'cancelar_cita') {
            const id = parseInt(texto)
            if (isNaN(id) || id <= 0) {
                await msg.reply('Por favor escribe solo el numero de folio.\nEj: 12')
                return
            }
            cancelarCita(id)
            sesion.paso = null
            sesion.ultimaRespuesta = {}
            await msg.reply('Tu cita #' + id + ' ha sido cancelada.\n\nEscribe *cita* para agendar una nueva.')
            return
        }

        // FLUJO PEDIDOS
        if (sesion.paso === 'pedido_producto') {
            const encontrado = config.catalogo.find(p => p.nombre.toLowerCase().includes(textoMin))
            if (encontrado) {
                if (encontrado.disponible) {
                    sesion.productoElegido = encontrado
                    sesion.paso = 'pedido_confirmar'
                    await msg.reply('Encontramos: *' + encontrado.nombre + '* por $' + encontrado.precio + '\n\nConfirmas tu pedido?\nEscribe *si* para confirmar o *no* para cancelar.')
                } else {
                    await msg.reply('Lo sentimos, *' + encontrado.nombre + '* no esta disponible.\n\nEscribe *catalogo* para ver productos disponibles.')
                    sesion.paso = null
                }
            } else {
                await msg.reply('No encontramos ese producto. Escribe el nombre exacto o *catalogo* para verlos.')
            }
            return
        }

        if (sesion.paso === 'pedido_confirmar') {
            if (textoMin !== 'si' && textoMin !== 'no') {
                await msg.reply('Por favor escribe *si* para confirmar o *no* para cancelar.')
                return
            }
            if (textoMin === 'si') {
                const id = guardarPedido(numero, null, sesion.productoElegido.nombre, sesion.productoElegido.precio)
                sesion.paso = null
                sesion.ultimaRespuesta = {}
                await msg.reply('Pedido confirmado!\n\n- Producto: ' + sesion.productoElegido.nombre + '\n- Precio: $' + sesion.productoElegido.precio + '\n- Folio: #' + id + '\n\nUn asesor te contactara para coordinar la entrega.')
            } else {
                sesion.paso = null
                sesion.ultimaRespuesta = {}
                await msg.reply('Pedido cancelado. Escribe *catalogo* para ver nuestros productos.')
            }
            return
        }

        if (['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'inicio', 'menu'].some(p => textoMin.includes(p))) {
            sesion.ultimaRespuesta = {}
            registrarRespuesta(sesion, 'menu')
            await msg.reply(construirMenu(config))
            return
        }

        const menu = config.menuPersonalizado || []
        const opcionElegida = menu.find(item =>
            textoMin === item.opcion || textoMin.includes(item.nombre.toLowerCase())
        )
        if (opcionElegida) {
            if (puedeResponder(sesion, 'opcion_' + opcionElegida.id)) {
                registrarRespuesta(sesion, 'opcion_' + opcionElegida.id)
                await procesarOpcion(opcionElegida, msg, sesion, config, numero)
            }
            return
        }

        const productoDetectado = config.catalogo.find(p => textoMin.includes(p.nombre.toLowerCase()))
        if (productoDetectado) {
            if (puedeResponder(sesion, 'producto_' + productoDetectado.id)) {
                registrarRespuesta(sesion, 'producto_' + productoDetectado.id)
                if (productoDetectado.disponible) {
                    sesion.paso = 'pedido_confirmar'
                    sesion.productoElegido = productoDetectado
                    await msg.reply('Vimos que te interesa *' + productoDetectado.nombre + '* por $' + productoDetectado.precio + '\n\nConfirmas tu pedido?\nEscribe *si* para confirmar o *no* para cancelar.')
                } else {
                    await msg.reply('Lo sentimos, *' + productoDetectado.nombre + '* no esta disponible.\n\nEscribe *catalogo* para ver productos disponibles.')
                }
            }
            return
        }

        if (textoMin === 'pedido' || textoMin.includes('quiero pedir') || textoMin.includes('hacer pedido')) {
            if (puedeResponder(sesion, 'pedido')) {
                registrarRespuesta(sesion, 'pedido')
                sesion.paso = 'pedido_producto'
                const disponibles = config.catalogo.filter(p => p.disponible)
                let respuesta = 'Que producto deseas pedir?\n\n'
                disponibles.forEach(p => { respuesta += '- ' + p.nombre + ' ($' + p.precio + ')\n' })
                respuesta += '\nEscribe el nombre del producto.'
                await msg.reply(respuesta)
            }
            return
        }

        if (puedeResponder(sesion, 'no_entendi')) {
            registrarRespuesta(sesion, 'no_entendi')
            await msg.reply('No entendi tu mensaje. Escribe *hola* para ver el menu principal.')
        }
    })
}

async function arrancarBot() {
    const licenciaData = getLicencia()

    if (!licenciaData.codigo) {
        console.log('Sin licencia. Bot arranca pero no responde mensajes.')
        guardarEstado({ conectado: false, qr: null, numero: null, licencia: { valida: false, motivo: 'Sin licencia' } })
    } else {
        console.log('Verificando licencia...')
        const resultado = await verificarLicencia(licenciaData.codigo)
        if (!resultado.valida) {
            console.log('Licencia invalida:', resultado.motivo)
            guardarEstado({ conectado: false, qr: null, numero: null, licencia: resultado })
            return
        }
        console.log('Licencia valida hasta:', resultado.vencimiento)
        guardarEstado({ conectado: false, qr: null, numero: null, licencia: resultado })
    }

    client = crearCliente()
    iniciarEventos(client)
    client.initialize()
}

arrancarBot()

setInterval(async () => {
    try {
        if (!existsSync('./bot_comando.json')) return
        const cmd = JSON.parse(readFileSync('./bot_comando.json', 'utf-8'))
        if (!cmd.pendiente) return

        writeFileSync('./bot_comando.json', JSON.stringify({ ...cmd, pendiente: false }), 'utf-8')

        if (cmd.accion === 'reiniciar') {
            console.log('Reiniciando bot...')
            try { await client.destroy() } catch (e) {}
            client = crearCliente()
            iniciarEventos(client)
            client.initialize()
        }

        if (cmd.accion === 'desvincular') {
            console.log('Desvinculando bot...')
            try { await client.logout() } catch (e) {}
            try { await client.destroy() } catch (e) {}
            const { rmSync } = await import('fs')
            if (existsSync('./.wwebjs_auth')) rmSync('./.wwebjs_auth', { recursive: true, force: true })
            guardarEstado({ conectado: false, qr: null, numero: null })
            client = crearCliente()
            iniciarEventos(client)
            client.initialize()
        }
    } catch (e) {
        console.log('Error procesando comando:', e.message)
    }
}, 3000)