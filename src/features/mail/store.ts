/**
 * Optic Mail — the data + crypto layer for Eyes-Only email.
 *
 * Mail bodies are sealed with the SAME non-extractable app document key used
 * for Eyes-Only documents (secure.ts), with AES-GCM. Records live alongside
 * documents in STORES.suite, distinguished by `kind: 'mail-message'`.
 *
 * Recipient / sender matching goes through identityService.isSameAccount so
 * duplicate records of one person all count as the same account.
 */
import { seal, unseal, type Sealed } from '../../core/identity/crypto'
import { openStore, STORES, type KeyValueStore } from '../../core/identity/db'
import { identityService } from '../../core/identity/IdentityService'

let storePromise: Promise<KeyValueStore> | null = null
const store = () => (storePromise ??= openStore())

const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`

// Same shared app document key as Eyes-Only documents (secure.ts DOC_KEY_ID).
const DOC_KEY_ID = 'suite-doc-key-v1'

async function docKey(): Promise<CryptoKey> {
  const s = await store()
  const existing = await s.get<CryptoKey>(STORES.keys, DOC_KEY_ID)
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await s.put(STORES.keys, key, DOC_KEY_ID)
  return key
}

export interface MailMessage {
  id: string
  kind: 'mail-message'
  fromId: string
  fromName: string
  toId: string
  toName: string
  subject: string
  createdAt: number
  readAt: number | null
  revoked: boolean
  docIds: string[]
  sealed: { iv: string; data: string }
}

export interface MailDraft {
  toId: string
  toName: string
  subject: string
  body: string
  docIds?: string[]
}

const strip = ({ sealed: _s, ...meta }: MailMessage): Omit<MailMessage, 'sealed'> => meta

async function allMail(): Promise<MailMessage[]> {
  const all = await (await store()).getAll<MailMessage>(STORES.suite)
  return all.filter((r) => r.kind === 'mail-message')
}

/** Seals the body, stores the message, and returns it (the key is never exposed). */
export async function sendMail(from: { id: string; name: string }, draft: MailDraft): Promise<MailMessage> {
  const sealed: Sealed = await seal(await docKey(), draft.body)
  const message: MailMessage = {
    id: rid('mail'),
    kind: 'mail-message',
    fromId: from.id,
    fromName: from.name,
    toId: draft.toId,
    toName: draft.toName,
    subject: draft.subject,
    createdAt: Date.now(),
    readAt: null,
    revoked: false,
    docIds: draft.docIds ?? [],
    sealed,
  }
  await (await store()).put(STORES.suite, message)
  return message
}

/** Messages addressed to this account, not revoked, newest first. */
export async function inbox(identityId: string): Promise<Omit<MailMessage, 'sealed'>[]> {
  return (await allMail())
    .filter((m) => !m.revoked && identityService.isSameAccount(m.toId, identityId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(strip)
}

/** Messages sent from this account, newest first. */
export async function sent(identityId: string): Promise<Omit<MailMessage, 'sealed'>[]> {
  return (await allMail())
    .filter((m) => identityService.isSameAccount(m.fromId, identityId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(strip)
}

/** Decrypts and returns the body text. Callers must have verified the reader is the recipient. */
export async function openMail(id: string): Promise<string | null> {
  const m = await (await store()).get<MailMessage>(STORES.suite, id)
  if (!m || m.kind !== 'mail-message') return null
  return unseal<string>(await docKey(), m.sealed)
}

export async function markRead(id: string): Promise<void> {
  const s = await store()
  const m = await s.get<MailMessage>(STORES.suite, id)
  if (m && m.kind === 'mail-message' && m.readAt === null) await s.put(STORES.suite, { ...m, readAt: Date.now() })
}

/** Sender recall: flags the message as revoked so it drops out of inboxes. */
export async function revokeMail(id: string): Promise<void> {
  const s = await store()
  const m = await s.get<MailMessage>(STORES.suite, id)
  if (m && m.kind === 'mail-message') await s.put(STORES.suite, { ...m, revoked: true })
}

export async function deleteMail(id: string): Promise<void> {
  await (await store()).delete(STORES.suite, id)
}
