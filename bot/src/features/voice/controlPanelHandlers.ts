import type { ButtonInteraction, ModalSubmitInteraction, UserSelectMenuInteraction } from 'discord.js';
import type {
  CommandResult,
  PrivacyService,
  VoiceCommands,
  VoteKickManager,
  VoiceActions,
} from './index.js';
import {
  parsePanelId,
  parsePanelModalId,
  parsePanelSelectId,
  parseBlocklistSelectId,
  buildLimitModal,
  buildKickModal,
  buildTransferSelectRow,
  buildBlocklistMessage,
} from './controlPanel.js';
import { getBlocked, addBlocked, removeBlocked } from './blocklist.js';

export interface PanelDeps {
  voiceCommands: VoiceCommands;
  privacy: PrivacyService;
  votekick: VoteKickManager;
  actions: VoiceActions;
  run: <T>(guildId: string, name: string, task: () => Promise<T>) => Promise<T>;
  formatResult: (res: CommandResult) => string;
}

/**
 * Handles every panel button EXCEPT 'name', which the caller (interactions.ts)
 * handles itself by reusing the existing `nameCore` editor flow — that logic
 * lives in a closure there and isn't exported, so 'name' is special-cased at
 * the call site instead of duplicated here.
 */
export async function handlePanelButton(
  interaction: ButtonInteraction,
  deps: PanelDeps,
): Promise<boolean> {
  const parsed = parsePanelId(interaction.customId);
  if (!parsed) return false;
  const { action, channelId } = parsed;
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (action === 'limit') {
    await interaction.showModal(buildLimitModal(channelId));
    return true;
  }
  if (action === 'transfer') {
    await interaction.reply({
      content: 'Kies de nieuwe eigenaar:',
      components: [buildTransferSelectRow(channelId)],
      ephemeral: true,
    });
    return true;
  }
  if (action === 'kick') {
    await interaction.showModal(buildKickModal(channelId));
    return true;
  }
  if (action === 'unlimit') {
    const res = await deps.run<CommandResult>(guildId, 'panel:unlimit', () =>
      deps.voiceCommands.unlimit(guildId, channelId, userId),
    );
    await interaction.reply({ content: deps.formatResult(res), ephemeral: true });
    return true;
  }
  if (action === 'private') {
    const res = await deps.run<CommandResult>(guildId, 'panel:private', () =>
      deps.privacy.makePrivate(guildId, channelId, userId),
    );
    await interaction.reply({ content: deps.formatResult(res), ephemeral: true });
    return true;
  }
  if (action === 'public') {
    const res = await deps.run<CommandResult>(guildId, 'panel:public', () =>
      deps.privacy.makePublic(guildId, channelId, userId),
    );
    await interaction.reply({ content: deps.formatResult(res), ephemeral: true });
    return true;
  }
  if (action === 'blocklist') {
    const blocked = getBlocked(userId);
    const { content, components } = buildBlocklistMessage(channelId, blocked);
    await interaction.reply({ content, components, ephemeral: true });
    return true;
  }
  if (action === 'reclaim') {
    const res = await deps.run<CommandResult>(guildId, 'panel:reclaim', () =>
      deps.voiceCommands.claim(guildId, channelId, userId),
    );
    await interaction.reply({ content: deps.formatResult(res), ephemeral: true });
    return true;
  }
  return false;
}

export async function handlePanelSelect(
  interaction: UserSelectMenuInteraction,
  deps: PanelDeps,
): Promise<boolean> {
  const blockParsed = parseBlocklistSelectId(interaction.customId);
  if (blockParsed) {
    const { action, channelId } = blockParsed;
    const userId = interaction.user.id;
    const targetId = interaction.values[0];
    if (!targetId) return false;

    const res =
      action === 'blockadd' ? addBlocked(userId, targetId) : removeBlocked(userId, targetId);

    if (res.ok) {
      const allow = action === 'blockremove';
      await deps.actions
        .setMemberConnect(interaction.guildId!, channelId, targetId, allow)
        .catch(() => undefined);
    }

    if (!res.ok) {
      await interaction.reply({ content: `?? ${res.message}`, ephemeral: true });
      return true;
    }

    const blocked = getBlocked(userId);
    const { content, components } = buildBlocklistMessage(channelId, blocked);
    const verb = action === 'blockadd' ? 'geblokkeerd' : 'gedeblokkeerd';
    await interaction.update({
      content: `? <@${targetId}> ${verb}.\n\n${content}`,
      components,
    });
    return true;
  }

  const parsed = parsePanelSelectId(interaction.customId);
  if (!parsed) return false;
  const { channelId } = parsed;
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const newOwnerId = interaction.values[0];
  if (!newOwnerId) return false;

  const res = await deps.run<CommandResult>(guildId, 'panel:transfer', () =>
    deps.voiceCommands.transfer(guildId, channelId, userId, newOwnerId),
  );
  await interaction.update({ content: deps.formatResult(res), components: [] });
  return true;
}

export async function handlePanelModal(
  interaction: ModalSubmitInteraction,
  deps: PanelDeps,
): Promise<boolean> {
  const parsed = parsePanelModalId(interaction.customId);
  if (!parsed) return false;
  const { action, channelId } = parsed;
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (action === 'limit') {
    const count = parseInt(interaction.fields.getTextInputValue('count'), 10);
    const res = await deps.run<CommandResult>(guildId, 'panel:limit', () =>
      deps.voiceCommands.setLimit(guildId, channelId, userId, count),
    );
    await interaction.reply({ content: deps.formatResult(res), ephemeral: true });
    return true;
  }
  if (action === 'kick') {
    const memberId = interaction.fields.getTextInputValue('member').replace(/[<@!>]/g, '');
    const reason = interaction.fields.getTextInputValue('reason') || undefined;
    const res = await deps.run<CommandResult>(guildId, 'panel:kick', () =>
      deps.votekick.start(guildId, channelId, userId, memberId, reason),
    );
    await interaction.reply({ content: deps.formatResult(res), ephemeral: true });
    return true;
  }
  return false;
}
