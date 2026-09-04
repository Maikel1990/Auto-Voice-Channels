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
  | 'kick';

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
  return [row1, row2];
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
