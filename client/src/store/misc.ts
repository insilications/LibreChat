import { atom } from 'recoil';
import { TAttachment } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { atomWithLocalStorage } from './utils';
import { BadgeItem } from '~/common';
import { logger } from '~/utils';

const hideBannerHint = atomWithLocalStorage('hideBannerHint', [] as string[]);

const messageAttachmentsMap = atom<Record<string, TAttachment[] | undefined>>({
  key: 'messageAttachmentsMap',
  default: {},
});

const queriesEnabled = atom<boolean>({
  key: 'queriesEnabled',
  default: true,
});

const isEditingBadges = atom<boolean>({
  key: 'isEditingBadges',
  default: false,
});

const chatBadges = atomWithLocalStorage<Pick<BadgeItem, 'id'>[]>('chatBadges', [
  // When adding new badges, make sure to add them to useChatBadges.ts as well and add them as last item
  // DO NOT CHANGE THE ORDER OF THE BADGES ALREADY IN THE ARRAY
  { id: '1' },
  // { id: '2' },
]);

// When this atom is true, the user is selecting the messages that will be used to generate the title
const isAddingTitle = atom<boolean>({
  key: 'isAddingTitle',
  default: false,
});

// This atom stores the messages that are selected to generate the title
export const AddingTitleMessages = atom<TMessage[]>({
  key: 'AddingTitleMessages',
  default: [],
  effects: [
    ({ onSet }) => {
      onSet(async (newValue) => {
        logger.log('Recoil Effect: Setting AddingTitleMessages', newValue);
      });
    },
  ] as const,
});

export default {
  hideBannerHint,
  messageAttachmentsMap,
  queriesEnabled,
  isEditingBadges,
  chatBadges,
  isAddingTitle,
  AddingTitleMessages,
};
