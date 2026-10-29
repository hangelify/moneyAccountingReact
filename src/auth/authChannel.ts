import type { TokenResponseDto } from '@/types/auth';

export type SignOutReason = 'expired' | 'revoked' | 'user';

export type AuthMessage =
  | { type: 'token'; res: TokenResponseDto }
  | { type: 'logout'; reason: SignOutReason };

const CHANNEL_NAME = 'auth';

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export const authChannel = {
  post(msg: AuthMessage): void {
    getChannel()?.postMessage(msg);
  },
  subscribe(handler: (msg: AuthMessage) => void): () => void {
    const ch = getChannel();
    if (!ch) return () => undefined;
    const listener = (ev: MessageEvent<AuthMessage>): void => handler(ev.data);
    ch.addEventListener('message', listener);
    return () => ch.removeEventListener('message', listener);
  },
};
