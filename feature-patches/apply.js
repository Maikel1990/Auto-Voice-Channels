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
    warn(`${rel}: anker voor "${label}" niet gevonden  upstream is mogelijk gewijzigd.`);
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

  {
    let content = readFile(rel);
    const oldImport = `import { DiscordAPIError } from 'discord.js';`;
    const newImport = `import { DiscordAPIError, type ActionRowBuilder, type ButtonBuilder } from 'discord.js';`;
    if (content.includes(newImport)) {
      console.log(`[feature-panel] ${rel}: import ActionRowBuilder/ButtonBuilder al aanwezig, overgeslagen.`);
    } else if (content.includes(oldImport)) {
      content = content.replace(oldImport, newImport);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: import vervangen.`);
      changed++;
    } else {
      warn(`${rel}: import-anker niet gevonden  upstream is mogelijk gewijzigd.`);
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
      warn(`${rel}: import-anker niet gevonden  upstream is mogelijk gewijzigd.`);
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

  patch(
    rel,
    `import { getBlocked } from './blocklist.js';`,
    `import { buildControlPanelRows } from './controlPanel.js';`,
    `\nimport { getBlocked } from './blocklist.js';`,
    'import getBlocked',
  );

  {
    let content = readFile(rel);
    const marker = "'could not post control panel'";
    const anchor = 'try {\n      await this.deps.actions.moveMember(guildId, member.id, newChannelId);';
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: paneel-hook al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor moveMember niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      const insertion =
        `try {\n      await this.deps.actions.postMessage(guildId, newChannelId, {\n        content: '**Snelle acties**',\n        components: buildControlPanelRows(newChannelId),\n      });\n    } catch (err) {\n      this.deps.logger.warn(\n        { guildId, secondaryId: newChannelId, err },\n        'could not post control panel',\n      );\n    }\n\n    ` + anchor;
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: paneel-hook toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `'could not apply owner blocklist to new channel'`;
    const anchor = `try {\n      await this.deps.actions.postMessage(guildId, newChannelId, {\n        content: '**Snelle acties**',\n        components: buildControlPanelRows(newChannelId),\n      });\n    } catch (err) {\n      this.deps.logger.warn(\n        { guildId, secondaryId: newChannelId, err },\n        'could not post control panel',\n      );\n    }`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: blocklist auto-apply hook al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor postMessage try/catch niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      const insertion =
        anchor +
        `\n\n    try {\n      const blockedIds = getBlocked(member.id);\n      for (const blockedId of blockedIds) {\n        await this.deps.actions\n          .setMemberConnect(guildId, newChannelId, blockedId, false)\n          .catch(() => undefined);\n      }\n    } catch (err) {\n      this.deps.logger.warn(\n        { guildId, secondaryId: newChannelId, err },\n        'could not apply owner blocklist to new channel',\n      );\n    }`;
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: blocklist auto-apply hook toegevoegd.`);
      changed++;
    }
  }
}

// ---------------------------------------------------------------------------
// 4. interactions.ts
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/commands/interactions.ts';

  patch(
    rel,
    'type UserSelectMenuInteraction,',
    `type ChannelSelectMenuInteraction,`,
    `\n  type UserSelectMenuInteraction,`,
    'import UserSelectMenuInteraction type',
  );

  patch(
    rel,
    `type VoiceActions,`,
    `type VoiceCommands,`,
    `\n  type VoiceActions,`,
    'import VoiceActions type',
  );

  {
    let content = readFile(rel);
    const marker = `handlePanelSelect } from '../features/voice/controlPanelHandlers.js';`;
    const oldImport = `import { handlePanelButton, handlePanelModal } from '../features/voice/controlPanelHandlers.js';`;
    const importAnchor = `import { IMPORT_PREFIX, type ImportSessionStore } from './importPanel.js';`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: controlPanelHandlers import al aanwezig, overgeslagen.`);
    } else if (content.includes(oldImport)) {
      content = content.replace(
        oldImport,
        `import { handlePanelButton, handlePanelModal, handlePanelSelect } from '../features/voice/controlPanelHandlers.js';`,
      );
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: controlPanelHandlers import bijgewerkt.`);
      changed++;
    } else if (content.includes(importAnchor)) {
      content = content.replace(
        importAnchor,
        `${importAnchor}\nimport { handlePanelButton, handlePanelModal, handlePanelSelect } from '../features/voice/controlPanelHandlers.js';`,
      );
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: controlPanelHandlers import aangemaakt.`);
      changed++;
    } else {
      warn(`${rel}: geen enkel anker voor controlPanelHandlers-import gevonden — upstream is mogelijk gewijzigd.`);
    }
  }

  patch(
    rel,
    `import { PANEL_PREFIX, PANEL_MODAL_PREFIX } from '../features/voice/controlPanel.js';`,
    `import { IMPORT_PREFIX, type ImportSessionStore } from './importPanel.js';`,
    `\nimport { PANEL_PREFIX, PANEL_MODAL_PREFIX } from '../features/voice/controlPanel.js';`,
    'import PANEL_PREFIX/PANEL_MODAL_PREFIX',
  );

  {
    let content = readFile(rel);
    const marker = `actions: VoiceActions;`;
    const anchor = `export interface InteractionDeps {\n  client: Client;\n  dispatcher: GuildDispatcher;\n  voiceCommands: VoiceCommands;`;
    const replacement = `export interface InteractionDeps {\n  client: Client;\n  dispatcher: GuildDispatcher;\n  voiceCommands: VoiceCommands;\n  actions: VoiceActions;`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: InteractionDeps.actions al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor InteractionDeps interface niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: InteractionDeps.actions toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `if (interaction.customId.startsWith(PANEL_PREFIX)) {`;
    const anchor = `if (interaction.customId.startsWith(SETUP_PREFIX)) return handleSetupButton(interaction);`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: handleButton PANEL_PREFIX block al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor SETUP_PREFIX niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      const insertion =
        anchor +
        `\n    if (interaction.customId.startsWith(PANEL_PREFIX)) {\n      const parsedPanel = interaction.customId.slice(PANEL_PREFIX.length).split(':');\n      if (parsedPanel[0] === 'name') {\n        const targetChannelId = parsedPanel[1];\n        if (targetChannelId) {\n          const state = await run(interaction.guildId!, 'panel:name:state', () =>\n            deps.feature.getEditorState('channel', interaction.guildId!, targetChannelId),\n          );\n          if (!state.found) {\n            await interaction.reply({\n              content: "Dat is geen door de bot beheerd spraakkanaal.",\n              ephemeral: true,\n            });\n            return;\n          }\n          await interaction.reply({\n            ...renderEditorPanel('channel', targetChannelId, state),\n            ephemeral: true,\n          });\n          return;\n        }\n      }\n      const handled = await handlePanelButton(interaction, {\n        voiceCommands: deps.voiceCommands,\n        actions: deps.actions,\n        privacy: deps.privacy,\n        votekick: deps.votekick,\n        run,\n        formatResult,\n      });\n      if (handled) return;\n    }`;
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: handleButton PANEL_PREFIX block toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `if (interaction.customId.startsWith(PANEL_MODAL_PREFIX)) {`;
    const anchor = `if (interaction.customId.startsWith(ALIAS_PREFIX)) return handleAliasEditSubmit(interaction);`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: handleModal PANEL_MODAL_PREFIX block al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor ALIAS_PREFIX niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      const insertion =
        anchor +
        `\n    if (interaction.customId.startsWith(PANEL_MODAL_PREFIX)) {\n      const handled = await handlePanelModal(interaction, {\n        voiceCommands: deps.voiceCommands,\n        actions: deps.actions,\n        privacy: deps.privacy,\n        votekick: deps.votekick,\n        run,\n        formatResult,\n      });\n      if (handled) return;\n    }`;
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: handleModal PANEL_MODAL_PREFIX block toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `async function handleUserSelect(`;
    const anchor = `async function handleChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<void> {`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: handleUserSelect al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor handleChannelSelect niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      const insertion =
        `async function handleUserSelect(interaction: UserSelectMenuInteraction): Promise<void> {\n    const handled = await handlePanelSelect(interaction, {\n      voiceCommands: deps.voiceCommands,\n      actions: deps.actions,\n      privacy: deps.privacy,\n      votekick: deps.votekick,\n      run,\n      formatResult,\n    });\n    if (!handled) {\n      await interaction.reply({\n        content: 'Dat menu is verlopen. Klik opnieuw op Overdragen.',\n        ephemeral: true,\n      });\n    }\n  }\n  ` + anchor;
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: handleUserSelect toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `if (interaction.isUserSelectMenu()) return handleUserSelect(interaction);`;
    const anchor = `if (interaction.isStringSelectMenu()) return handleStringSelect(interaction);`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: route() user-select-menu dispatch al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor handleStringSelect route niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, `${anchor}\n    if (interaction.isUserSelectMenu()) return handleUserSelect(interaction);`);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: route() user-select-menu dispatch toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const occurrences = content.split('voiceCommands: deps.voiceCommands,').length - 1;
    const alreadyPatched = content.split('actions: deps.actions,').length - 1;
    if (alreadyPatched >= 3) {
      console.log(`[feature-panel] ${rel}: actions: deps.actions doorgeefpunten al aanwezig, overgeslagen.`);
    } else if (occurrences < 3) {
      warn(`${rel}: verwachtte 3 voorkomens van "voiceCommands: deps.voiceCommands," maar vond er ${occurrences}  upstream is mogelijk gewijzigd.`);
    } else {
      content = content
        .split('voiceCommands: deps.voiceCommands,')
        .join('voiceCommands: deps.voiceCommands,\n        actions: deps.actions,');
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: actions: deps.actions toegevoegd op 3 plekken.`);
      changed++;
    }
  }
}

// ---------------------------------------------------------------------------
// 5. index.ts
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/index.ts';

  {
    let content = readFile(rel);
    const marker = `\n    actions,\n    settings: settingsService,`;
    const anchor = `    voiceCommands,\n    settings: settingsService,`;
    const replacement = `    voiceCommands,\n    actions,\n    settings: settingsService,`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: actions doorgeefpunt al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor registerInteractionHandler object niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: actions doorgeefpunt toegevoegd.`);
      changed++;
    }
  }
}

// ---------------------------------------------------------------------------
// 6. controlPanel.ts  blocklist knop + select-menu builders
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/features/voice/controlPanel.ts';

  {
    let content = readFile(rel);
    const marker = `| 'blocklist';`;
    const anchor = `export type PanelAction =\n  | 'name'\n  | 'limit'\n  | 'unlimit'\n  | 'private'\n  | 'public'\n  | 'reclaim'\n  | 'transfer'\n  | 'kick';`;
    const replacement = `export type PanelAction =\n  | 'name'\n  | 'limit'\n  | 'unlimit'\n  | 'private'\n  | 'public'\n  | 'reclaim'\n  | 'transfer'\n  | 'kick'\n  | 'blocklist';`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: PanelAction blocklist type al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor PanelAction type niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: PanelAction blocklist type toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `'kick',\n    'blocklist',`;
    const anchor = `const valid: PanelAction[] = [\n    'name',\n    'limit',\n    'unlimit',\n    'private',\n    'public',\n    'reclaim',\n    'transfer',\n    'kick',\n  ];`;
    const replacement = `const valid: PanelAction[] = [\n    'name',\n    'limit',\n    'unlimit',\n    'private',\n    'public',\n    'reclaim',\n    'transfer',\n    'kick',\n    'blocklist',\n  ];`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: valid[] blocklist entry al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor valid[] array niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: valid[] blocklist entry toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(`;
    const anchor = `  return [row1, row2];`;
    const replacement = `  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(\n    new ButtonBuilder()\n      .setCustomId(panelId('blocklist', channelId))\n      .setLabel('Geblokkeerd')\n      .setStyle(ButtonStyle.Secondary),\n  );\n  return [row1, row2, row3];`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: row3 (Geblokkeerd-knop) al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor "return [row1, row2];" niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: row3 (Geblokkeerd-knop) toegevoegd.`);
      changed++;
    }
  }

  patch(
    rel,
    'export function blockAddSelectId(',
    `export function buildTransferSelectRow(\n  channelId: string,\n): ActionRowBuilder<UserSelectMenuBuilder> {\n  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(\n    new UserSelectMenuBuilder()\n      .setCustomId(transferSelectId(channelId))\n      .setPlaceholder('Kies de nieuwe eigenaar')\n      .setMinValues(1)\n      .setMaxValues(1),\n  );\n}`,
    `\n\nexport function blockAddSelectId(channelId: string): string {\n  return \`\${PANEL_SELECT_PREFIX}blockadd:\${channelId}\`;\n}\n\nexport function blockRemoveSelectId(channelId: string): string {\n  return \`\${PANEL_SELECT_PREFIX}blockremove:\${channelId}\`;\n}\n\nexport function parseBlocklistSelectId(\n  customId: string,\n): { action: 'blockadd' | 'blockremove'; channelId: string } | null {\n  if (!customId.startsWith(PANEL_SELECT_PREFIX)) return null;\n  const [, , action, channelId] = customId.split(':');\n  if (!action || !['blockadd', 'blockremove'].includes(action) || !channelId) return null;\n  return { action: action as 'blockadd' | 'blockremove', channelId };\n}\n\nexport function buildBlockAddSelectRow(\n  channelId: string,\n): ActionRowBuilder<UserSelectMenuBuilder> {\n  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(\n    new UserSelectMenuBuilder()\n      .setCustomId(blockAddSelectId(channelId))\n      .setPlaceholder('Kies iemand om te blokkeren')\n      .setMinValues(1)\n      .setMaxValues(1),\n  );\n}\n\nexport function buildBlocklistMessage(\n  channelId: string,\n  blockedIds: string[],\n): { content: string; components: ActionRowBuilder<UserSelectMenuBuilder>[] } {\n  const list =\n    blockedIds.length === 0\n      ? 'Je hebt nog niemand geblokkeerd.'\n      : blockedIds.map((id) => \`<@\${id}>\`).join(', ');\n  const content = \`**Geblokkeerde leden**\\n\${list}\\n\\nDeze mensen kunnen niet meer joinen in kanalen die jij aanmaakt.\`;\n\n  const components = [buildBlockAddSelectRow(channelId)];\n  if (blockedIds.length > 0) {\n    const removeRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(\n      new UserSelectMenuBuilder()\n        .setCustomId(blockRemoveSelectId(channelId))\n        .setPlaceholder('Kies iemand om te deblokkeren')\n        .setMinValues(1)\n        .setMaxValues(1),\n    );\n    components.push(removeRow);\n  }\n  return { content, components };\n}`,
    'blocklist select-menu builders',
  );
}

// ---------------------------------------------------------------------------
// 7. controlPanelHandlers.ts  blocklist knop + select handling
// ---------------------------------------------------------------------------
{
  const rel = 'bot/src/features/voice/controlPanelHandlers.ts';

  {
    let content = readFile(rel);
    const marker = `parseBlocklistSelectId,`;
    const anchor = `import {\n  parsePanelId,\n  parsePanelModalId,\n  parsePanelSelectId,\n  buildLimitModal,\n  buildKickModal,\n  buildTransferSelectRow,\n} from './controlPanel.js';`;
    const replacement = `import {\n  parsePanelId,\n  parsePanelModalId,\n  parsePanelSelectId,\n  parseBlocklistSelectId,\n  buildLimitModal,\n  buildKickModal,\n  buildTransferSelectRow,\n  buildBlocklistMessage,\n} from './controlPanel.js';\nimport { getBlocked, addBlocked, removeBlocked } from './blocklist.js';`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: blocklist imports al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor controlPanel-import niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: blocklist imports toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `if (action === 'blocklist') {`;
    const anchor = `  if (action === 'reclaim') {`;
    const insertion =
      `if (action === 'blocklist') {\n    const blocked = getBlocked(userId);\n    const { content, components } = buildBlocklistMessage(channelId, blocked);\n    await interaction.reply({ content, components, ephemeral: true });\n    return true;\n  }\n  ` + anchor;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: blocklist knop-handler al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor "if (action === 'reclaim')" niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: blocklist knop-handler toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `actions: VoiceActions;`;
    const anchor = `export interface PanelDeps {\n  voiceCommands: VoiceCommands;\n  privacy: PrivacyService;\n  votekick: VoteKickManager;\n  run: <T>(guildId: string, name: string, task: () => Promise<T>) => Promise<T>;\n  formatResult: (res: CommandResult) => string;\n}`;
    const replacement = `export interface PanelDeps {\n  voiceCommands: VoiceCommands;\n  privacy: PrivacyService;\n  votekick: VoteKickManager;\n  actions: VoiceActions;\n  run: <T>(guildId: string, name: string, task: () => Promise<T>) => Promise<T>;\n  formatResult: (res: CommandResult) => string;\n}`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: PanelDeps.actions al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor PanelDeps interface niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: PanelDeps.actions toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `VoiceActions,\n} from './index.js';`;
    const anchor = `import type {\n  CommandResult,\n  PrivacyService,\n  VoiceCommands,\n  VoteKickManager,\n} from './index.js';`;
    const replacement = `import type {\n  CommandResult,\n  PrivacyService,\n  VoiceCommands,\n  VoteKickManager,\n  VoiceActions,\n} from './index.js';`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: VoiceActions type-import al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor index.js type-import niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, replacement);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: VoiceActions type-import toegevoegd.`);
      changed++;
    }
  }

  {
    let content = readFile(rel);
    const marker = `const blockParsed = parseBlocklistSelectId(interaction.customId);`;
    const anchor = `export async function handlePanelSelect(\n  interaction: UserSelectMenuInteraction,\n  deps: PanelDeps,\n): Promise<boolean> {`;
    const insertion =
      anchor +
      `\n  const blockParsed = parseBlocklistSelectId(interaction.customId);\n  if (blockParsed) {\n    const { action, channelId } = blockParsed;\n    const userId = interaction.user.id;\n    const targetId = interaction.values[0];\n    if (!targetId) return false;\n\n    const res =\n      action === 'blockadd' ? addBlocked(userId, targetId) : removeBlocked(userId, targetId);\n\n    if (res.ok) {\n      const allow = action === 'blockremove';\n      await deps.actions\n        .setMemberConnect(interaction.guildId!, channelId, targetId, allow)\n        .catch(() => undefined);\n    }\n\n    if (!res.ok) {\n      await interaction.reply({ content: \`?? \${res.message}\`, ephemeral: true });\n      return true;\n    }\n\n    const blocked = getBlocked(userId);\n    const { content, components } = buildBlocklistMessage(channelId, blocked);\n    const verb = action === 'blockadd' ? 'geblokkeerd' : 'gedeblokkeerd';\n    await interaction.update({\n      content: \`? <@\${targetId}> \${verb}.\\n\\n\${content}\`,\n      components,\n    });\n    return true;\n  }\n`;
    if (content.includes(marker)) {
      console.log(`[feature-panel] ${rel}: blocklist select-handler al aanwezig, overgeslagen.`);
    } else if (!content.includes(anchor)) {
      warn(`${rel}: anker voor handlePanelSelect functie-start niet gevonden  upstream is mogelijk gewijzigd.`);
    } else {
      content = content.replace(anchor, insertion);
      writeFile(rel, content);
      console.log(`[feature-panel] ${rel}: blocklist select-handler toegevoegd.`);
      changed++;
    }
  }
}

console.log(`\n[feature-panel] Klaar: ${changed} bestand(en) gewijzigd, ${warnings} waarschuwing(en).`);
if (warnings > 0) {
  console.warn('[feature-panel] Controleer de waarschuwingen  mogelijk is upstream code gewijzigd en moet dit script bijgewerkt worden.');
  process.exit(1);
}