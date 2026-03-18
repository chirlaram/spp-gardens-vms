/**
 * Consolidated Bill PDF generation and print.
 * Same pattern as receiptGenerator.js — renders HTML template, captures via
 * html2canvas, produces jsPDF output.
 */
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import ConsolidatedBillTemplate from '../components/ConsolidatedBillTemplate'
import { shortId } from './formatters'

function renderBillNode(booking, isFinal) {
  return new Promise(resolve => {
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
    document.body.appendChild(container)

    const root = createRoot(container)
    root.render(createElement(ConsolidatedBillTemplate, { booking, isFinal }))

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve({ node: container.firstElementChild, container, root })
      })
    })
  })
}

function cleanup({ container, root }) {
  root.unmount()
  document.body.removeChild(container)
}

export async function downloadBill(booking, isFinal = false) {
  const { node, container, root } = await renderBillNode(booking, isFinal)

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = (canvas.height / canvas.width) * pdfW
  pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
  pdf.save(`SPP-Bill-${shortId(booking.id)}.pdf`)

  cleanup({ container, root })
}

export async function viewBill(booking, isFinal = false) {
  const { node, container, root } = await renderBillNode(booking, isFinal)

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  cleanup({ container, root })

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>SPP Gardens Bill ${shortId(booking.id)}</title>
  <style>
    body { margin: 0; padding: 20px; background: #f5f5f5; display: flex; justify-content: center; }
    img { max-width: 794px; width: 100%; box-shadow: 0 2px 16px rgba(0,0,0,0.15); }
    @media print { body { padding: 0; background: #fff; } img { box-shadow: none; } @page { margin: 0; } }
  </style>
</head>
<body>
  <img src="${imgData}" />
</body>
</html>`)
  win.document.close()
}
