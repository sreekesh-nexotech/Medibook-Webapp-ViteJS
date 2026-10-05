/** Patient-messaging vocabulary shared by the template preview and the send flow. */

/** The channels a message can go out on. */
const MESSAGE_CHANNELS = ['SMS', 'Email', 'Push', 'WhatsApp'] as const;

export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
