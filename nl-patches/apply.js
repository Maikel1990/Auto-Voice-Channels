import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
let totalChanged = 0;
let totalMissing = 0;

// --- 1. Command description localizations ---
const commandsFile = path.join(ROOT, 'bot/src/commands/definitions.ts');
const commandTranslations = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'commands.json'), 'utf8'),
);

let commandsContent = fs.readFileSync(commandsFile, 'utf8');

for (const [english, dutch] of Object.entries(commandTranslations)) {
  if (commandsContent.includes(dutch)) continue; // al gepatcht

  // Zoek de exacte string, gevolgd door een sluitende quote (' of ") en )
  const patterns = [`'${english}')`, `"${english}")`, `\`${english}\`)`];
  let found = false;

  for (const pattern of patterns) {
    const idx = commandsContent.indexOf(pattern);
    if (idx !== -1) {
      const insertAt = idx + pattern.length;
      const call = `\n        .setDescriptionLocalizations({ nl: ${JSON.stringify(dutch)} })`;
      commandsContent =
        commandsContent.slice(0, insertAt) + call + commandsContent.slice(insertAt);
      totalChanged++;
      found = true;
      break;
    }
  }

  if (!found) {
    console.warn(`[commands] niet gevonden: "${english.slice(0, 50)}..."`);
    totalMissing++;
  }
}

fs.writeFileSync(commandsFile, commandsContent, 'utf8');

// --- 2. Directe berichttekst-vervangingen (knoppen, meldingen) ---
const messageTranslations = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'messages.json'), 'utf8'),
);

for (const [relFile, replacements] of Object.entries(messageTranslations)) {
  const filePath = path.join(ROOT, relFile);
  let content = fs.readFileSync(filePath, 'utf8');

  for (const [english, dutch] of Object.entries(replacements)) {
    if (content.includes(dutch)) continue; // al gepatcht

    if (!content.includes(english)) {
      console.warn(`[messages] niet gevonden in ${relFile}: "${english.slice(0, 50)}..."`);
      totalMissing++;
      continue;
    }

    content = content.split(english).join(dutch);
    totalChanged++;
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`NL-patch klaar: ${totalChanged} wijzigingen, ${totalMissing} niet gevonden.`);
