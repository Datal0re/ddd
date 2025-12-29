const chalk = require('chalk');

// Custom colors for logo
const l1 = '#001219'; // Just a hex value to insert into .bgHex()
const l2 = chalk.hex('#005F73');
const l3 = chalk.hex('#0A9396');
const l4 = chalk.hex('#94D2BD');
const l5 = chalk.hex('#E9D8A6');
const l6 = chalk.hex('#EE9B00');
const l7 = chalk.hex('#CA6702');
const l8 = chalk.hex('#BB3E03');
const l9 = chalk.hex('#AE2012');
const l10 = chalk.hex('#9B2226');

const logo = 
`${l2.bgHex(l1)(`╔══════════════════════════════════════╗`)}
${l2.bgHex(l1)(`║.-                                  -.║`)}
${l3.bgHex(l1)(`║   ${l7('     █████     █████     █████')}     ║`)}
${l4.bgHex(l1)(`║:  ${l6('    ░░███     ░░███     ░░███ ')}    :║`)}
${l5.bgHex(l1)(`║   ${l6('  ███████   ███████   ███████ ')}     ║`)}
${l5.bgHex(l1)(`║.  ${l7(' ███░░███  ███░░███  ███░░███ ')}    .║`)}
${l5.bgHex(l1)(`║   ${l7('░███ ░███ ░███ ░███ ░███ ░███ ')}     ║`)}
${l4.bgHex(l1)(`║:  ${l8('░███ ░███ ░███ ░███ ░███ ░███ ')}    :║`)}
${l3.bgHex(l1)(`║   ${l9('░░████████░░████████░░████████')}     ║`)}
${l2.bgHex(l1)(`║._${l10('  ░░░░░░░░  ░░░░░░░░  ░░░░░░░░')}    _.║`)}
${l2.bgHex(l1)(`╠══════════════════════════════════════╣`)}
${l3.bgHex(l1)(`╟───────{ ${l6.bold('Data Dumpster Diver')} }────────╢`)}
${l2.bgHex(l1)(`╚══════════════════════════════════════╝`)}`;

module.exports = logo;