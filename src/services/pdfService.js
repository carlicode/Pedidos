/**
 * Servicio para generación de PDFs
 * Contiene todas las funciones relacionadas con la generación de reportes PDF
 * 
 * Nota: jsPDF se importa dinámicamente para evitar problemas de carga
 */

/**
 * Genera un PDF usando una plantilla como imagen de fondo
 * @param {Object} datosFiltrados - Datos del cliente y pedidos filtrados
 * @param {string} fechaInicio - Fecha de inicio del filtro
 * @param {string} fechaFin - Fecha de fin del filtro
 * @param {Function} showNotification - Función para mostrar notificaciones
 * @param {Function} generarPDFConHTML - Función fallback si falla la plantilla
 */
export const generarPDFConPlantilla = async (datosFiltrados, fechaInicio, fechaFin, showNotification, generarPDFConHTML) => {
  try {
    // Importar jsPDF dinámicamente
    const { jsPDF } = await import('jspdf')
    
    // Crear PDF
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    // Cargar la plantilla como imagen de fondo
    const plantillaImg = new Image()
    
    plantillaImg.onload = () => {
      try {
        // Agregar la plantilla como imagen de fondo (A4: 210x297 mm)
        pdf.addImage(plantillaImg, 'PNG', 0, 0, 210, 297)
        
        // Configurar fuente y colores
        pdf.setFont('helvetica')
        pdf.setFontSize(12)
        pdf.setTextColor(51, 51, 51) // #333
        
        // Agregar contenido del reporte encima de la plantilla
        // Título del reporte
        pdf.setFontSize(18)
        pdf.setTextColor(40, 167, 69) // #28a745 (verde)
        pdf.text('💰 RESUMEN FINANCIERO', 105, 50, { align: 'center' })
        
        // Información del cliente
        pdf.setFontSize(14)
        pdf.setTextColor(44, 62, 80) // #2c3e50
        pdf.text(`Cliente: ${datosFiltrados.cliente}`, 20, 70)
        
        // Fecha de generación
        pdf.setFontSize(12)
        pdf.setTextColor(108, 117, 125) // #6c757d
        const fechaGeneracion = new Date().toLocaleDateString('es-BO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        pdf.text(`Fecha de generación: ${fechaGeneracion}`, 20, 80)
        
        // Período del filtro
        if (fechaInicio || fechaFin) {
          let periodoTexto = '📅 Período: '
          if (fechaInicio && fechaFin) {
            periodoTexto += `${new Date(fechaInicio).toLocaleDateString('es-BO')} hasta ${new Date(fechaFin).toLocaleDateString('es-BO')}`
          } else if (fechaInicio) {
            periodoTexto += `desde ${new Date(fechaInicio).toLocaleDateString('es-BO')}`
          } else if (fechaFin) {
            periodoTexto += `hasta ${new Date(fechaFin).toLocaleDateString('es-BO')}`
          }
          pdf.text(periodoTexto, 20, 90)
        }
        
        // Resumen de totales
        pdf.setFontSize(16)
        pdf.setTextColor(40, 167, 69) // Verde
        pdf.text('RESUMEN DE TOTALES', 105, 110, { align: 'center' })
        
        // Grid de totales
        const startX = 20
        const startY = 125
        const cardWidth = 50
        const cardHeight = 30
        const spacing = 10
        
        // Total Cobros
        pdf.setFillColor(212, 237, 218) // #d4edda (verde claro)
        pdf.rect(startX, startY, cardWidth, cardHeight, 'F')
        pdf.setTextColor(21, 87, 36) // #155724
        pdf.setFontSize(10)
        pdf.text('COBROS', startX + cardWidth/2, startY + 8, { align: 'center' })
        pdf.setFontSize(14)
        pdf.text(`Bs${datosFiltrados.subtotalCobros.toFixed(2)}`, startX + cardWidth/2, startY + 20, { align: 'center' })
        
        // Total Carreras
        pdf.setFillColor(255, 243, 205) // #fff3cd (amarillo claro)
        pdf.rect(startX + cardWidth + spacing, startY, cardWidth, cardHeight, 'F')
        pdf.setTextColor(133, 100, 4) // #856404
        pdf.setFontSize(10)
        pdf.text('CARRERAS', startX + cardWidth + spacing + cardWidth/2, startY + 8, { align: 'center' })
        pdf.setFontSize(14)
        pdf.text(`Bs${datosFiltrados.subtotalCarreras.toFixed(2)}`, startX + cardWidth + spacing + cardWidth/2, startY + 20, { align: 'center' })
        
        // Total Pagos
        pdf.setFillColor(248, 215, 218) // #f8d7da (rojo claro)
        pdf.rect(startX + (cardWidth + spacing) * 2, startY, cardWidth, cardHeight, 'F')
        pdf.setTextColor(114, 28, 36) // #721c24
        pdf.setFontSize(10)
        pdf.text('PAGOS', startX + (cardWidth + spacing) * 2 + cardWidth/2, startY + 8, { align: 'center' })
        pdf.setFontSize(14)
        pdf.text(`Bs${datosFiltrados.subtotalPagos.toFixed(2)}`, startX + (cardWidth + spacing) * 2 + cardWidth/2, startY + 20, { align: 'center' })
        
        // Subtotal General
        pdf.setFillColor(226, 227, 229) // #e2e3e5 (gris claro)
        pdf.rect(startX + (cardWidth + spacing) * 3, startY, cardWidth, cardHeight, 'F')
        pdf.setTextColor(56, 61, 65) // #383d41
        pdf.setFontSize(10)
        pdf.text('SUBTOTAL', startX + (cardWidth + spacing) * 3 + cardWidth/2, startY + 8, { align: 'center' })
        pdf.setFontSize(14)
        pdf.text(`Bs${datosFiltrados.subtotalGeneral.toFixed(2)}`, startX + (cardWidth + spacing) * 3 + cardWidth/2, startY + 20, { align: 'center' })
        
        // Descuento (solo si existe)
        if (datosFiltrados.porcentajeDescuento > 0) {
          pdf.setFillColor(248, 215, 218) // #f8d7da (rojo claro)
          pdf.rect(startX + (cardWidth + spacing) * 4, startY, cardWidth, cardHeight, 'F')
          pdf.setTextColor(114, 28, 36) // #721c24
          pdf.setFontSize(10)
          pdf.text(`DESC ${datosFiltrados.porcentajeDescuento}%`, startX + (cardWidth + spacing) * 4 + cardWidth/2, startY + 8, { align: 'center' })
          pdf.setFontSize(14)
          pdf.text(`-Bs${datosFiltrados.montoDescuento.toFixed(2)}`, startX + (cardWidth + spacing) * 4 + cardWidth/2, startY + 20, { align: 'center' })
        }
        
        // Saldo Final
        const saldoColor = datosFiltrados.saldo >= 0 ? [212, 237, 218] : [248, 215, 218]
        const saldoTextColor = datosFiltrados.saldo >= 0 ? [21, 87, 36] : [114, 28, 36]
        pdf.setFillColor(...saldoColor)
        pdf.rect(startX + (cardWidth + spacing) * (datosFiltrados.porcentajeDescuento > 0 ? 5 : 4), startY, cardWidth, cardHeight, 'F')
        pdf.setTextColor(...saldoTextColor)
        pdf.setFontSize(10)
        pdf.text(datosFiltrados.saldo >= 0 ? 'NOS DEBE' : 'LE DEBEMOS', startX + (cardWidth + spacing) * (datosFiltrados.porcentajeDescuento > 0 ? 5 : 4) + cardWidth/2, startY + 8, { align: 'center' })
        pdf.setFontSize(14)
        pdf.text(`Bs${Math.abs(datosFiltrados.saldo).toFixed(2)}`, startX + (cardWidth + spacing) * (datosFiltrados.porcentajeDescuento > 0 ? 5 : 4) + cardWidth/2, startY + 20, { align: 'center' })
        
        // Tabla de transacciones
        pdf.setFontSize(14)
        pdf.setTextColor(40, 167, 69) // Verde
        pdf.text('DETALLE DE TRANSACCIONES', 105, 170, { align: 'center' })
        
        // Encabezados de tabla
        pdf.setFontSize(10)
        pdf.setTextColor(255, 255, 255) // Blanco
        pdf.setFillColor(40, 167, 69) // Verde
        const tableStartY = 180
        const colWidths = [15, 25, 25, 25, 30, 40, 25, 25]
        let currentX = 20
        
        // Encabezados
        const headers = ['Nº', 'FECHA', 'TIPO', 'MONTO', 'CARRERA', 'DESCRIPCIÓN', 'BIKER', 'ESTADO']
        headers.forEach((header, index) => {
          pdf.rect(currentX, tableStartY, colWidths[index], 10, 'F')
          pdf.text(header, currentX + colWidths[index]/2, tableStartY + 7, { align: 'center' })
          currentX += colWidths[index]
        })
        
        // Datos de la tabla
        pdf.setTextColor(51, 51, 51) // #333
        pdf.setFontSize(9)
        let currentY = tableStartY + 15
        
        datosFiltrados.pedidos.forEach((pedido, index) => {
          if (currentY > 270) { // Nueva página si no hay espacio
            pdf.addPage()
            currentY = 20
            // Agregar plantilla en nueva página
            pdf.addImage(plantillaImg, 'PNG', 0, 0, 210, 297)
          }
          
          currentX = 20
          const rowData = [
            (index + 1).toString(),
            pedido.fecha || 'N/A',
            pedido.cobro_pago || 'N/A',
            `Bs${pedido.monto_cobro_pago || '0.00'}`,
            `Bs${pedido.precio_bs || '0.00'}`,
            pedido.detalles_carrera || 'N/A',
            pedido.biker || 'N/A',
            '✅ Entregado'
          ]
          
          rowData.forEach((cell, cellIndex) => {
            const bgColor = pedido.cobro_pago === 'Cobro' ? [212, 237, 218] : [248, 215, 218]
            pdf.setFillColor(...bgColor)
            pdf.rect(currentX, currentY, colWidths[cellIndex], 8, 'F')
            pdf.text(cell, currentX + colWidths[cellIndex]/2, currentY + 5, { align: 'center' })
            currentX += colWidths[cellIndex]
          })
          
          currentY += 10
        })
        
        // Guardar el PDF
        const nombreArchivo = `Resumen_${datosFiltrados.cliente.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
        pdf.save(nombreArchivo)
        showNotification('✅ PDF generado exitosamente con plantilla', 'success')

      } catch (error) {
        console.error('Error al usar plantilla:', error)
        showNotification('⚠️ Error al usar plantilla, usando modo HTML', 'warning')
        // Fallback a HTML si hay error
        generarPDFConHTML(datosFiltrados, fechaInicio, fechaFin, showNotification)
      }
    }
    
    plantillaImg.onerror = () => {
      console.warn('No se pudo cargar plantilla')
      showNotification('⚠️ No se pudo cargar la plantilla, usando modo HTML', 'warning')
      generarPDFConHTML(datosFiltrados, fechaInicio, fechaFin, showNotification)
    }
    
    // Intentar cargar la plantilla desde la raíz del proyecto
    plantillaImg.src = './plantilla.pdf'
    
  } catch (error) {
    console.error('Error al generar PDF con plantilla:', error)
    showNotification('⚠️ Error al usar plantilla, usando modo HTML', 'warning')
    generarPDFConHTML(datosFiltrados, fechaInicio, fechaFin, showNotification)
  }
}

/**
 * Genera un PDF con resumen financiero (con soporte para descuentos)
 * @param {Object} clienteData - Datos del cliente y pedidos
 * @param {string} fechaInicio - Fecha de inicio del filtro
 * @param {string} fechaFin - Fecha de fin del filtro
 * @param {Object} descuentosClientes - Mapa de descuentos por cliente
 * @param {Function} showNotification - Función para mostrar notificaciones
 * @param {Function} generarPDFConPlantillaFn - Función para generar con plantilla
 * @param {Function} generarPDFConHTMLFn - Función para generar con HTML
 */
export const generatePDFResumen = async (clienteData, fechaInicio = null, fechaFin = null, descuentosClientes = {}, showNotification, generarPDFConPlantillaFn, generarPDFConHTMLFn) => {
  try {
    showNotification('🔄 Generando PDF...', 'success')
    
    // Filtrar pedidos por fecha si se especifican filtros
    let pedidosFiltrados = clienteData.pedidos
    if (fechaInicio || fechaFin) {
      pedidosFiltrados = clienteData.pedidos.filter(pedido => {
        if (!pedido.fecha) return false
        
        const pedidoFecha = new Date(pedido.fecha)
        const inicio = fechaInicio ? new Date(fechaInicio) : null
        const fin = fechaFin ? new Date(fechaFin) : null
        
        if (inicio && fin) {
          return pedidoFecha >= inicio && pedidoFecha <= fin
        } else if (inicio) {
          return pedidoFecha >= inicio
        } else if (fin) {
          return pedidoFecha <= fin
        }
        return true
      })
    }
    
    // Recalcular totales basados en pedidos filtrados
    const totalCobros = pedidosFiltrados
      .filter(p => p.cobro_pago === 'Cobro')
      .reduce((sum, p) => sum + (parseFloat(p.monto_cobro_pago) || 0), 0)
    
    const totalPagos = pedidosFiltrados
      .filter(p => p.cobro_pago === 'Pago')
      .reduce((sum, p) => sum + (parseFloat(p.monto_cobro_pago) || 0), 0)
    
    const totalCarreras = pedidosFiltrados
      .filter(p => p.precio_bs && parseFloat(p.precio_bs) > 0)
      .reduce((sum, p) => sum + (parseFloat(p.precio_bs) || 0), 0)
    
    // Calcular subtotales
    const subtotalCobros = totalCobros
    const subtotalPagos = totalPagos
    const subtotalCarreras = totalCarreras
    
    // Calcular total general sin descuento
    const subtotalGeneral = subtotalCarreras + subtotalPagos - subtotalCobros
    
    // Aplicar descuento individual del cliente solo a las CARRERAS
    const porcentajeDescuento = descuentosClientes[clienteData.cliente] || 0
    const montoDescuento = (subtotalCarreras * porcentajeDescuento) / 100
    const carrerasConDescuento = subtotalCarreras - montoDescuento
    
    // Saldo final con descuento aplicado solo a las carreras
    const saldo = subtotalGeneral - montoDescuento
    
    // Crear objeto de datos filtrados
    const datosFiltrados = {
      ...clienteData,
      pedidos: pedidosFiltrados,
      totalCobros,
      totalPagos,
      totalCarreras,
      subtotalCobros,
      subtotalPagos,
      subtotalCarreras,
      subtotalGeneral,
      porcentajeDescuento,
      montoDescuento,
      carrerasConDescuento,
      saldo
    }
    
    // Intentar usar la plantilla PDF como base
    let usePDFTemplate = false
    
    try {
      const templateResponse = await fetch('./plantilla.pdf')
      if (templateResponse.ok) {
        usePDFTemplate = true
        showNotification('🎨 Usando plantilla PDF con membretado...', 'info')
      }
    } catch (error) {
      console.log('Plantilla no disponible, usando HTML')
    }
    
    if (usePDFTemplate) {
      await generarPDFConPlantillaFn(datosFiltrados, fechaInicio, fechaFin)
    } else {
      await generarPDFConHTMLFn(datosFiltrados, fechaInicio, fechaFin)
    }
    
    showNotification(`📄 PDF generado para ${datosFiltrados.cliente}`, 'success')
  } catch (error) {
    console.error('Error al generar PDF:', error)
    showNotification('❌ Error al generar PDF', 'error')
  }
}

/**
 * Genera un PDF usando HTML como fallback (sin plantilla)
 * @param {Object} datosFiltrados - Datos del cliente y pedidos filtrados
 * @param {string} fechaInicio - Fecha de inicio del filtro
 * @param {string} fechaFin - Fecha de fin del filtro
 * @param {Function} showNotification - Función para mostrar notificaciones
 */
export const generarPDFConHTML = async (datosFiltrados, fechaInicio, fechaFin, showNotification) => {
  try {
    // Crear ventana nueva para imprimir con plantilla HTML
    const printWindow = window.open('', '_blank')
    
    // Crear contenido HTML para el PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Resumen de Cobros y Pagos - ${datosFiltrados.cliente}${fechaInicio || fechaFin ? ' (Filtrado por Fecha)' : ''}</title>
        <style>
          @page { 
            size: A4; 
            margin: 1.5cm; 
          }
          body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 0;
            background: white;
            color: #333;
            line-height: 1.3;
          }
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #28a745;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #28a745;
            margin-right: 15px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }
          .client-info {
            background: #e8f5e8;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #28a745;
          }
          .client-name {
            font-size: 16px;
            font-weight: bold;
            color: #155724;
            margin-bottom: 5px;
          }
          .generation-date {
            color: #6c757d;
            font-size: 13px;
          }
          .summary-section {
            margin-bottom: 25px;
          }
          .summary-title {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            text-align: center;
            margin-bottom: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            border: 1px solid #dee2e6;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
          }
          .summary-item {
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            border: 2px solid;
          }
          .cobros-item {
            background: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
          }
          .pagos-item {
            background: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
          }
          .summary-label {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .summary-value {
            font-size: 18px;
            font-weight: bold;
          }
          .transactions-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            font-size: 11px;
          }
          .transactions-table th,
          .transactions-table td {
            border: 1px solid #dee2e6;
            padding: 8px;
            text-align: left;
          }
          .transactions-table th {
            background-color: #28a745;
            color: white;
            font-weight: bold;
            font-size: 10px;
          }
          .cobro-row {
            background-color: #d4edda;
          }
          .pago-row {
            background-color: #f8d7da;
          }
          .total-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
          }
          .total-item {
            text-align: center;
            padding: 10px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background: #f8f9fa;
            min-width: 100px;
          }
          .total-label {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 3px;
            text-transform: uppercase;
            color: #6c757d;
          }
          .total-value {
            font-size: 14px;
            font-weight: bold;
            color: #28a745;
          }
          .footer {
            text-align: center;
            font-size: 10px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
            padding-top: 15px;
            margin-top: 30px;
          }
          .wave-footer {
            height: 20px;
            background: linear-gradient(45deg, #28a745, #20c997);
            border-radius: 10px 10px 0 0;
            opacity: 0.3;
            margin-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🚚</div>
          <div class="title">RESUMEN DE COBROS Y PAGOS</div>
        </div>
        
        <div class="client-info">
          <div class="client-name">Cliente: ${datosFiltrados.cliente}</div>
          <div class="generation-date">
            Fecha de generación: ${new Date().toLocaleDateString('es-BO', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          ${fechaInicio || fechaFin ? `
          <div style="color: #6c757d; font-size: 13px; margin-top: 5px;">
            📅 Período: ${fechaInicio ? new Date(fechaInicio).toLocaleDateString('es-BO') : 'Desde el inicio'} 
            ${fechaFin ? `hasta ${new Date(fechaFin).toLocaleDateString('es-BO')}` : ''}
          </div>
          ` : ''}
        </div>
        
        <div class="summary-section">
          <div class="summary-title">RESUMEN FINANCIERO</div>
          <div class="summary-grid">
            <div class="summary-item cobros-item">
              <div class="summary-label">Cobros</div>
              <div class="summary-value">Bs${datosFiltrados.subtotalCobros.toFixed(2)}</div>
            </div>
            <div class="summary-item" style="background: #fff3cd; border-color: #ffeaa7; color: #856404;">
              <div class="summary-label">Carreras</div>
              <div class="summary-value">Bs${datosFiltrados.subtotalCarreras.toFixed(2)}</div>
            </div>
            <div class="summary-item pagos-item">
              <div class="summary-label">Pagos</div>
              <div class="summary-value">Bs${datosFiltrados.subtotalPagos.toFixed(2)}</div>
            </div>
            <div class="summary-item" style="background: #e2e3e5; border-color: #d6d8db; color: #383d41;">
              <div class="summary-label">Subtotal</div>
              <div class="summary-value">Bs${datosFiltrados.subtotalGeneral.toFixed(2)}</div>
            </div>
            ${datosFiltrados.porcentajeDescuento > 0 ? `
            <div class="summary-item" style="background: #f8d7da; border-color: #f5c6cb; color: #721c24;">
              <div class="summary-label">Descuento ${datosFiltrados.porcentajeDescuento}%</div>
              <div class="summary-value">-Bs${datosFiltrados.montoDescuento.toFixed(2)}</div>
            </div>
            ` : ''}
            <div class="summary-item" style="background: ${datosFiltrados.saldo >= 0 ? '#d4edda' : '#f8d7da'}; border-color: ${datosFiltrados.saldo >= 0 ? '#c3e6cb' : '#f5c6cb'}; color: ${datosFiltrados.saldo >= 0 ? '#155724' : '#721c24'};">
              <div class="summary-label">${datosFiltrados.saldo >= 0 ? 'Nos debe' : 'Le debemos'}</div>
              <div class="summary-value">Bs${Math.abs(datosFiltrados.saldo).toFixed(2)}</div>
            </div>
          </div>
        </div>
        
        <table class="transactions-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>FECHA</th>
              <th>TIPO</th>
              <th>MONTO</th>
              <th>PRECIO CARRERA</th>
              <th>DESCRIPCIÓN</th>
              <th>BIKER</th>
              <th>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            ${datosFiltrados.pedidos.map((pedido, index) => `
              <tr class="${pedido.cobro_pago === 'Cobro' ? 'cobro-row' : 'pago-row'}">
                <td>${index + 1}</td>
                <td>${pedido.fecha || 'N/A'}</td>
                <td><strong>${pedido.cobro_pago}</strong></td>
                <td><strong>Bs${pedido.monto_cobro_pago || '0.00'}</strong></td>
                <td><strong>Bs${pedido.precio_bs || '0.00'}</strong></td>
                <td>${pedido.detalles_carrera || 'N/A'}</td>
                <td>${pedido.biker || 'N/A'}</td>
                <td>✅ Entregado</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-item">
            <div class="total-label">Total Cobros</div>
            <div class="total-value">Bs${datosFiltrados.totalCobros.toFixed(2)}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Total Pagos</div>
            <div class="total-value">Bs${datosFiltrados.totalPagos.toFixed(2)}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Total Carreras</div>
            <div class="total-value">Bs${datosFiltrados.totalCarreras.toFixed(2)}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Saldo Final</div>
            <div class="total-value">Bs${datosFiltrados.saldo.toFixed(2)}</div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>Documento generado automáticamente por el sistema BEEZY</p>
          <p>Para consultas contactar al administrador del sistema</p>
        </div>
        
        <div class="wave-footer"></div>
      </body>
      </html>
    `
    
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // Esperar a que se cargue el contenido y luego imprimir
    printWindow.onload = () => {
      printWindow.print()
      printWindow.close()
    }
    
    showNotification('📄 PDF HTML generado exitosamente', 'success')
    
  } catch (error) {
    console.error('Error al generar PDF HTML:', error)
    showNotification('❌ Error al generar PDF HTML', 'error')
  }
}

