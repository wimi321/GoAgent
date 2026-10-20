// Splits a sentence after full-width commas and enumeration marks, so CJK headings can wrap
// between phrases instead of in the middle of a word. Latin text has none and stays whole.
/** @param {string} text @returns {string[]} */
export const phrases = (text) => text.split(/(?<=[，、：；])/u)
