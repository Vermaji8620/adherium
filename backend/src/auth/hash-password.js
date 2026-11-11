const { StringDecoder } = require('node:string_decoder');
const { hashPassword } = require('./session');

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive terminal.'));
      return;
    }

    const decoder = new StringDecoder('utf8');
    let value = '';
    let finished = false;
    const oldRawMode = input.isRaw;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      input.removeListener('data', onData);
      input.setRawMode(oldRawMode);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003') {
          finish(new Error('Password setup cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = [...value].slice(0, -1).join('');
          process.stdout.write('\b \b');
          continue;
        }
        value += character;
        process.stdout.write('*');
      }
    };

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function main() {
  const first = await readSecret('New password: ');
  const second = await readSecret('Confirm password: ');
  if (first !== second) throw new Error('The passwords did not match.');
  const encoded = await hashPassword(first);
  process.stdout.write(`AUTH_PASSWORD_HASH=${encoded}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
