import dayjs from 'dayjs';
import { produce } from 'immer';
import { StateCreator } from 'zustand/vanilla';

import { DEFAULT_USER_AVATAR_URL } from '@/const/meta';
import { genShareGPTUrl } from '@/services/shareGPT';
import { SessionStore } from '@/store/session';
import { ShareGPTConversation } from '@/types/share';

import { agentSelectors } from '../../agentConfig';
import { sessionSelectors } from '../../session/selectors';
import { chatSelectors } from '../selectors';

interface ShareMessage {
  from: 'human' | 'gpt';
  value: string;
}

const Footer: ShareMessage = {
  from: 'gpt',
  value: `Share from [**🤯 LobeChat**](https://github.com/SFYYH/lobe-chat) - ${dayjs().format(
    'YYYY-MM-DD',
  )}`,
};

const PLUGIN_INFO = (plugin: {
  apiName: string;
  content: string;
  identifier: string;
}): ShareMessage => ({
  from: 'gpt',
  value: [
    `**🧩 Function Calling Plugin**`,
    `- Identifier: \`${plugin.identifier}\``,
    `- API name: \`${plugin.apiName}\``,
    `- Result:`,
    ``,
    '```json',
    plugin.content,
    '```',
  ].join('\n'),
});

// const t = setNamespace('chat/share');
export interface ShareAction {
  shareToShareGPT: (props: {
    avatar?: string;
    withPluginInfo?: boolean;
    withSystemRole?: boolean;
  }) => void;
}

export const chatShare: StateCreator<
  SessionStore,
  [['zustand/devtools', never]],
  [],
  ShareAction
> = (set, get) => ({
  shareToShareGPT: async ({ withSystemRole, withPluginInfo, avatar }) => {
    const session = sessionSelectors.currentSession(get());
    if (!session) return;
    const messages = chatSelectors.currentChats(get());
    const config = agentSelectors.currentAgentConfig(get());
    const meta = agentSelectors.currentAgentMeta(get());

    const defaultMsg: ShareGPTConversation['items'] = [];
    const showSystemRole = withSystemRole && !!config.systemRole;
    const shareMsgs = produce(defaultMsg, (draft) => {
      draft.push({
        from: 'gpt',
        value: [
          `${meta.avatar} **${meta.title}** - ${meta.description}`,
          showSystemRole && '---',
          showSystemRole && config.systemRole,
        ]
          .filter(Boolean)
          .join('\n\n'),
      });

      for (const i of messages) {
        switch (i.role) {
          case 'assistant': {
            draft.push({ from: 'gpt', value: i.content });
            break;
          }
          case 'function': {
            if (withPluginInfo)
              draft.push(
                PLUGIN_INFO({
                  apiName: i.plugin?.apiName || 'undefined',
                  content: i.content,
                  identifier: i.plugin?.identifier || 'undefined',
                }),
              );
            break;
          }
          case 'user': {
            draft.push({ from: 'human', value: i.content });
            break;
          }
        }
      }

      draft.push(Footer);
    });

    set({ shareLoading: true });

    const res = await genShareGPTUrl({
      avatarUrl: avatar || DEFAULT_USER_AVATAR_URL,
      items: shareMsgs,
    });
    set({ shareLoading: false });

    window.open(res, '_blank');
  },
  // genShareUrl: () => {
  //   const session = sessionSelectors.currentSession(get());
  //   if (!session) return '';
  //
  //   const agent = session.config;
  //   return genShareMessagesUrl(session.chats, agent.systemRole);
  // },
});
