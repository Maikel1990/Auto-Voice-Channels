import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

let changed = 0;
let warnings = 0;

function warn(msg) {
  console.warn(`[feature-panel] WAARSCHUWING: ${msg}`);
  warnings++;
}
function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function writeFile(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}
function patch(rel, marker, anchor, insertion, label) {
  let content = readFile(rel);
  if (content.includes(marker)) {
    console.log(`[feature-panel] ${rel}: ${label} al aanwezig, overgeslagen.`);
    return;
  }
  if (!content.includes(anchor)) {
    warn(`${rel}: anker voor "${label}" niet gevonden — upstream is mogelijk gewijzigd.`);
    return;
  }
  content = content.replace(anchor, anchor + insertion);
  writeFile(rel, content);
  console.log(`[feature-panel] ${rel}: ${label} toegevoegd.`);
  changed++;
}

// ---------------------------------------------------------------------------
// 1. actions.ts
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/features/voice/actions.ts';

  patch(
    rel,
    'type ActionRowBuilder',
    `import { DiscordAPIError } from 'discord.js';`,
    ``.replace(
      `import { DiscordAPIError } from 'discord.js';`,
      `import { DiscordAPIError, type ActionRowBuilder, type ButtonBuilder } from 'discord.js';`,
    ),
    'import ActionRowBuilder/ButtonBuilder',
  );
  // The generic patch() appends after the anchor; for a full-line replace we
  // do it directly instead (import line has to be REPLACED, not appended to).
  {
    let content = readFile(rel);
    const oldImport = `import { DiscordAPIError } from 'discord.js';`;
    const newImport = `import { DiscordAPIError, type ActionRowBuilder, type ButtonBuilder } from 'discord.js';`;
    if (content.includes(oldImport)) {
      content = content.replace(oldImport, newImport);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: import vervangen.`);
      changed++;
    } else if (!content.includes(newImport)) {
      warn(`${rel}: import-anker niet gevonden — upstream is mogelijk gewijzigd.`);
    }
  }

  patch(
    rel,
    'postMessage(\n    guildId: string,\n    channelId: string,\n    payload: { content?: string; components?: readonly ActionRowBuilder<ButtonBuilder>[] },\n  ): Promise<string | undefined>;',
    `setVoiceStatus(guildId: string, channelId: string, status: string): Promise<void>;`,
    `\n  /** Posts a message with components (e.g. buttons) to a text-based channel. */\n  postMessage(\n    guildId: string,\n    channelId: string,\n    payload: { content?: string; components?: readonly ActionRowBuilder<ButtonBuilder>[] },\n  ): Promise<string | undefined>;`,
    'VoiceActions.postMessage interface',
  );

  patch(
    rel,
    `type: 'postMessage';`,
    `| { type: 'status'; guildId: string; channelId: string; status: string }`,
    `\n  | {\n      type: 'postMessage';\n      guildId: string;\n      channelId: string;\n      payload: { content?: string; components?: readonly ActionRowBuilder<ButtonBuilder>[] };\n    }`,
    'RecordedAction postMessage variant',
  );

  patch(
    rel,
    'postMessage(\n    guildId: string,\n    channelId: string,\n    payload: { content?: string; components?: readonly ActionRowBuilder<ButtonBuilder>[] },\n  ): Promise<string | undefined> {',
    `setVoiceStatus(guildId: string, channelId: string, status: string): Promise<void> {\n    this.actions.push({ type: 'status', guildId, channelId, status });\n    return Promise.resolve();\n  }`,
    `\n  postMessage(\n    guildId: string,\n    channelId: string,\n    payload: { content?: string; components?: readonly ActionRowBuilder<ButtonBuilder>[] },\n  ): Promise<string | undefined> {\n    const messageId = \`\${this.idPrefix}-msg-\${++this.seq}\`;\n    this.actions.push({ type: 'postMessage', guildId, channelId, payload });\n    return Promise.resolve(messageId);\n  }`,
    'RecordingVoiceActions.postMessage implementation',
  );
}

// ---------------------------------------------------------------------------
// 2. discordAdapter.ts
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/features/voice/discordAdapter.ts';

  {
    let content = readFile(rel);
    const marker = 'type ActionRowBuilder,\n  type ButtonBuilder,';
    const anchor = 'import {\n  ActivityType,';
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: import ActionRowBuilder/ButtonBuilder al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: import-anker niet gevonden — upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, `import {\n  type ActionRowBuilder,\n  type ButtonBuilder,\n  ActivityType,`);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: import toegevoegd.`);
      changed++;
    }
  }

  patch(
    rel,
    'async postMessage(',
    `async moveMember(guildId: string, memberId: string, channelId: string | null): Promise<void> {\n    try {\n      const guild = await this.client.guilds.fetch(guildId);\n      const member = await guild.members.fetch(memberId);\n      await member.voice.setChannel(channelId);\n    } catch (err) {\n      if (isApiError(err, UNKNOWN_MEMBER) || isApiError(err, UNKNOWN_CHANNEL)) return;\n      throw err;\n    }\n  }`,
    `\n  async postMessage(\n    _guildId: string,\n    channelId: string,\n    payload: { content?: string; components?: readonly ActionRowBuilder<ButtonBuilder>[] },\n  ): Promise<string | undefined> {\n    try {\n      const channel = await this.client.channels.fetch(channelId);\n      if (!channel?.isTextBased() || !('send' in channel)) return undefined;\n      const sent = await channel.send(payload);\n      return sent.id;\n    } catch (err) {\n      if (isApiError(err, UNKNOWN_CHANNEL)) return undefined;\n      throw err;\n    }\n  }`,
    'DiscordVoiceActions.postMessage implementation',
  );
}

// ---------------------------------------------------------------------------
// 3. handler.ts
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/features/voice/handler.ts';

  patch(
    rel,
    `import { buildControlPanelRows } from './controlPanel.js';`,
    `import { isPermissionError } from './discordAdapter.js';`,
    `\nimport { buildControlPanelRows } from './controlPanel.js';`,
    'import buildControlPanelRows',
  );

  {
    let content = readFile(rel);
    const marker = "'could not post control panel'";
    const anchor = 'try {\n      await this.deps.actions.moveMember(guildId, member.id, newChannelId);';
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: paneel-hook al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor moveMember niet gevonden — upstream is mogelijk gewijzigd.`);
    } else {
      const insertion =
        `try {\n      await this.deps.actions.postMessage(guildId, newChannelId, {\n        content: '**Snelle acties**',\n        components: buildControlPanelRows(newChannelId),\n      });\n    } catch (err) {\n      this.deps.logger.warn(\n        { guildId, secondaryId: newChannelId, err },\n        'could not post control panel',\n      );\n    }\n\n    ` + anchor;
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: paneel-hook toegevoegd.`);
      changed++;
    }
  }
}

// ---------------------------------------------------------------------------
// 4. interactions.ts
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/commands/interactions.ts';

  // -- imports --
  patch(
    rel,
    'type UserSelectMenuInteraction,',
    `type ChannelSelectMenuInteraction,`,
    `\n  type UserSelectMenuInteraction,`,
    'import UserSelectMenuInteraction type',
  );

  patch(
    rel,
    `import { PANEL_PREFIX, PANEL_MODAL_PREFIX } from '../features/voice/controlPanel.js';`,
    `import { IMPORT_PREFIX, type ImportSessionStore } from './importPanel.js';`,
    `\nimport { handlePanelButton, handlePanelModal, handlePanelSelect } from '../features/voice/controlPanelHandlers.js';\nimport { PANEL_PREFIX, PANEL_MODAL_PREFIX } from '../features/voice/controlPanel.js';`,
    'import PANEL_PREFIX/PANEL_MODAL_PREFIX + handlers',
  );

  // -- route(): user select routing --
  patch(
    rel,
    `if (interaction.isUserSelectMenu()) return handleUserSelect(interaction);`,
    `if (interaction.isStringSelectMenu()) return handleStringSelect(interaction);`,
    `\n    if (interaction.isUserSelectMenu()) return handleUserSelect(interaction);`,
    'route() user-select-menu dispatch',
  );

  // -- handleUserSelect function --
  {
    let content = readFile(rel);
    const marker = 'async function handleUserSelect(';
    const anchor = 'async function handleChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<void> {';
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: handleUserSelect al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor handleChannelSelect niet gevonden — upstream is mogelijk gewijzigd.`);
    } else {
      const insertion =
        `async function handleUserSelect(interaction: UserSelectMenuInteraction): Promise<void> {\n    const handled = await handlePanelSelect(interaction, {\n      voiceCommands: deps.voiceCommands,\n      privacy: deps.privacy,\n      votekick: deps.votekick,\n      run,\n      formatResult,\n    });\n    if (!handled) {\n      await interaction.reply({\n        content: 'Dat menu is verlopen. Klik opnieuw op Overdragen.',\n        ephemeral: true,\n      });\n    }\n  }\n  ` + anchor;
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: handleUserSelect toegevoegd.`);
      changed++;
    }
  }

  // -- handleButton: PANEL_PREFIX block (with name special-case) --
  patch(
    rel,
    `if (interaction.customId.startsWith(PANEL_PREFIX)) {`,
    `if (interaction.customId.startsWith(SETUP_PREFIX)) return handleSetupButton(interaction);`,
    `\n    if (interaction.customId.startsWith(PANEL_PREFIX)) {\n      const parsedPanel = interaction.customId.slice(PANEL_PREFIX.length).split(':');\n      if (parsedPanel[0] === 'name') {\n        const targetChannelId = parsedPanel[1];\n        if (targetChannelId) {\n          const state = await run(interaction.guildId!, 'panel:name:state', () =>\n            deps.feature.getEditorState('channel', interaction.guildId!, targetChannelId),\n          );\n          if (!state.found) {\n            await interaction.reply({\n              content: "Dat is geen door de bot beheerd spraakkanaal.",\n              ephemeral: true,\n            });\n            return;\n          }\n          await interaction.reply({\n            ...renderEditorPanel('channel', targetChannelId, state),\n            ephemeral: true,\n          });\n          return;\n        }\n      }\n      const handled = await handlePanelButton(interaction, {\n        voiceCommands: deps.voiceCommands,\n        privacy: deps.privacy,\n        votekick: deps.votekick,\n        run,\n        formatResult,\n      });\n      if (handled) return;\n    }`,
    'handleButton PANEL_PREFIX block',
  );

  // -- handleModal: PANEL_MODAL_PREFIX block --
  patch(
    rel,
    `if (interaction.customId.startsWith(PANEL_MODAL_PREFIX)) {`,
    `if (interaction.customId.startsWith(ALIAS_PREFIX)) return handleAliasEditSubmit(interaction);`,
    `\n    if (interaction.customId.startsWith(PANEL_MODAL_PREFIX)) {\n      const handled = await handlePanelModal(interaction, {\n        voiceCommands: deps.voiceCommands,\n        privacy: deps.privacy,\n        votekick: deps.votekick,\n        run,\n        formatResult,\n      });\n      if (handled) return;\n    }`,
    'handleModal PANEL_MODAL_PREFIX block',
  );
}

console.log(`\n[feature-panel] Klaar: ${changed} bestand(en) gewijzigd, ${warnings} waarschuwing(en).`);
if (warnings > 0) {
  console.warn('[feature-panel] Controleer de waarschuwingen — mogelijk is upstream code gewijzigd en moet dit script bijgewerkt worden.');
  process.exit(1);
}
