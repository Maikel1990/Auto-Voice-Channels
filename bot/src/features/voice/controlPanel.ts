import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from 'discord.js';

export const PANEL_PREFIX = 'avc:panel:';
export const PANEL_MODAL_PREFIX = 'avc:panelmodal:';

export type PanelAction =
  | 'name'
  | 'limit'
  | 'unlimit'
  | 'private'
  | 'public'
  | 'reclaim'
  | 'transfer'
  | 'kick'
  | 'blocklist';

export function panelId(action: PanelAction, channelId: string): string {
  return `${PANEL_PREFIX}${action}:${channelId}`;
}

export function parsePanelId(
  customId: string,
): { action: PanelAction; channelId: string } | null {
  if (!customId.startsWith(PANEL_PREFIX)) return null;
  const [, , action, channelId] = customId.split(':');
  const valid: PanelAction[] = [
    'name',
    'limit',
    'unlimit',
    'private',
    'public',
    'reclaim',
    'transfer',
    'kick',
    'blocklist',
  ];
  if (!action || !valid.includes(action as PanelAction) || !channelId) return null;
  return { action: action as PanelAction, channelId };
}

/** Two button rows for the per-channel quick-actions panel. */
export function buildControlPanelRows(
  channelId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(panelId('name', channelId))
      .setLabel('Naam')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(panelId('limit', channelId))
      .setLabel('Limiet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(panelId('unlimit', channelId))
      .setLabel('Onbeperkt')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(panelId('private', channelId))
      .setLabel('Privé')
      .setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(panelId('public', channelId))
      .setLabel('Publiek')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(panelId('transfer', channelId))
      .setLabel('Overdragen')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(panelId('reclaim', channelId))
      .setLabel('Terugvorderen')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(panelId('kick', channelId))
      .setLabel('Kick')
      .setStyle(ButtonStyle.Danger),
  );
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(panelId('blocklist', channelId))
      .setLabel('Geblokkeerd')
      .setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2, row3];
}

export function buildLimitModal(channelId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PANEL_MODAL_PREFIX}limit:${channelId}`)
    .setTitle('Gebruikerslimiet instellen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('count')
          .setLabel('Maximaal aantal leden (0 = onbeperkt)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
    );
}

export const PANEL_SELECT_PREFIX = 'avc:panelselect:';

export function transferSelectId(channelId: string): string {
  return `${PANEL_SELECT_PREFIX}transfer:${channelId}`;
}

export function parsePanelSelectId(
  customId: string,
): { action: 'transfer'; channelId: string } | null {
  if (!customId.startsWith(PANEL_SELECT_PREFIX)) return null;
  const [, , action, channelId] = customId.split(':');
  if (action !== 'transfer' || !channelId) return null;
  return { action, channelId };
}

export function buildTransferSelectRow(
  channelId: string,
): ActionRowBuilder<UserSelectMenuBuilder> {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(transferSelectId(channelId))
      .setPlaceholder('Kies de nieuwe eigenaar')
      .setMinValues(1)
      .setMaxValues(1),
  );
}

export function blockAddSelectId(channelId: string): string {
  return `${PANEL_SELECT_PREFIX}blockadd:${channelId}`;
}

export function blockRemoveSelectId(channelId: string): string {
  return `${PANEL_SELECT_PREFIX}blockremove:${channelId}`;
}

export function parseBlocklistSelectId(
  customId: string,
): { action: 'blockadd' | 'blockremove'; channelId: string } | null {
  if (!customId.startsWith(PANEL_SELECT_PREFIX)) return null;
  const [, , action, channelId] = customId.split(':');
  if (!action || !['blockadd', 'blockremove'].includes(action) || !channelId) return null;
  return { action: action as 'blockadd' | 'blockremove', channelId };
}

/** User-select to add someone to the owner's blocklist. */
export function buildBlockAddSelectRow(
  channelId: string,
): ActionRowBuilder<UserSelectMenuBuilder> {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(blockAddSelectId(channelId))
      .setPlaceholder('Kies iemand om te blokkeren')
      .setMinValues(1)
      .setMaxValues(1),
  );
}

/** Builds the blocklist management message: current list + add/remove selects. */
export function buildBlocklistMessage(
  channelId: string,
  blockedIds: string[],
): { content: string; components: ActionRowBuilder<UserSelectMenuBuilder>[] } {
  const list =
    blockedIds.length === 0
      ? 'Je hebt nog niemand geblokkeerd.'
      : blockedIds.map((id) => `<@${id}>`).join(', ');
  const content = `**Geblokkeerde leden**\n${list}\n\nDeze mensen kunnen niet meer joinen in kanalen die jij aanmaakt.`;

  const components = [buildBlockAddSelectRow(channelId)];
  if (blockedIds.length > 0) {
    const removeRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(blockRemoveSelectId(channelId))
        .setPlaceholder('Kies iemand om te deblokkeren')
        .setMinValues(1)
        .setMaxValues(1),
    );
    components.push(removeRow);
  }
  return { content, components };
}

export function buildTransferModal(channelId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PANEL_MODAL_PREFIX}transfer:${channelId}`)
    .setTitle('Eigenaarschap overdragen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('member')
          .setLabel('Gebruikers-ID of @mention')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
    );
}

export function buildKickModal(channelId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PANEL_MODAL_PREFIX}kick:${channelId}`)
    .setTitle('Stemming starten om lid te verwijderen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('member')
          .setLabel('Gebruikers-ID of @mention')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reden (optioneel)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
    );
}

export function parsePanelModalId(
  customId: string,
): { action: 'limit' | 'transfer' | 'kick'; channelId: string } | null {
  if (!customId.startsWith(PANEL_MODAL_PREFIX)) return null;
  const [, , action, channelId] = customId.split(':');
  if (!action || !['limit', 'transfer', 'kick'].includes(action) || !channelId) return null;
  return { action: action as 'limit' | 'transfer' | 'kick', channelId };
}
