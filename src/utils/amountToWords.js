/**
 * Convert a number to Indian words (lakhs/crores system)
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ones[n]
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
}

function threeDigits(n) {
  if (n >= 100) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '')
  return twoDigits(n)
}

export function amountToWords(amount) {
  const num = Math.round(Number(amount) || 0)
  if (num === 0) return 'Zero Rupees Only'

  let result = ''
  const crore = Math.floor(num / 10000000)
  const lakh = Math.floor((num % 10000000) / 100000)
  const thousand = Math.floor((num % 100000) / 1000)
  const rest = num % 1000

  if (crore) result += threeDigits(crore) + ' Crore '
  if (lakh) result += twoDigits(lakh) + ' Lakh '
  if (thousand) result += twoDigits(thousand) + ' Thousand '
  if (rest) result += threeDigits(rest)

  return result.trim() + ' Rupees Only'
}
