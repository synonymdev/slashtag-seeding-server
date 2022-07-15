// Time format
// Examples: 12 -> 12, 12s -> 12000, 12m -> 720000
const regex = /^(([0-9]*[.])?[0-9]+)(d|h|m|s|w|y)?$/

function _unitsMultiple(unit) {
  if (unit === 's') return 1000
  if (unit === 'm') return 60 * 1000
  if (unit === 'h') return 60 * 60 * 1000
  if (unit === 'd') return 24 * 60 * 60 * 1000
  if (unit === 'w') return 7 * 24 * 60 * 60 * 1000
  if (unit === 'y') return 365 * 24 * 60 * 60 * 1000

  return 1
}

/**
 * given a time and unit, return milliseconds
 * @param {*} t
 * @param {*} unit
 * @returns
 */
function _delayByUnit(t, unit) {
  return t * _unitsMultiple(unit)
}

/**
 * Converts a time string (12, 12s, 12h, 12m) to an int number of milliseconds
 * postfix with s for seconds, m for minutes, h for hours or d for days
 * Examples:
 * "1234" -> 1234 ms
 * "1s" -> 1000 ms
 * "5m" -> 300,000 ms
 * @param timeStr - string of the duration, such as "24h" for 24 hours
 * @returns {number}
 */
export default function ms(timeStr) {
  if (typeof timeStr !== 'string') {
    return 0
  }

  // crazy long strings do not need to be parsed - they are clearly not a time
  if (timeStr.length > 200) {
    return 0
  }

  const m = regex.exec(timeStr)
  if (m === null) return 0

  const delay = Math.max(parseFloat(m[1]), 0)
  return Math.floor(_delayByUnit(delay, m[3]))
}
