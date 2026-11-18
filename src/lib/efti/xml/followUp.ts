/**
 * FTI025 — сообщение инспектора по набору (POST
 * /v1/consignments/{datasetId}/follow-up; тело followUpRequest по
 * platform-api-for-gate/v1-follow-up-request.xsd, внутри message типа
 * MessageInformationType семантической схемы FTI025):
 *   · FollowUp (eFTI2018, до 512 символов) с обязательным languageID (CL-063);
 *   · AttachedSpecifiedBinaryFile (0..n): FileName, MIMECode (CL-069),
 *     IncludedBinaryObject (base64).
 *
 * Разбор безопасный (parse.ts): DOCTYPE/сущности отвергаются, ничего не
 * загружается и не исполняется. Ошибка структуры — FollowUpParseError.
 */

import { XmlParseError, childNamed, childrenNamed, parseXml, type XmlElement } from './parse';

const NS_FOLLOW_UP = 'http://efti.fi/v1/platform/follow-up-request';
const NS_RAM = 'urn:eu:move:eFTI:data:standard:ReusableAggregateBusinessInformationEntity:34';

/** Предел тела: сообщение + вложения в base64 (10 МБ). */
export const FOLLOW_UP_MAX_LENGTH = 10 * 1024 * 1024;

export const FOLLOW_UP_MIME_CODES = ['application/pdf', 'image/JPEG', 'image/png', 'text/plain', 'video/JPEG'] as const;

export class FollowUpParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FollowUpParseError';
  }
}

export type FollowUpAttachment = {
  fileName: string;
  /** Как прислано (CL-069); `known` — входит ли в CL-069. */
  mimeCode: string;
  known: boolean;
  /** Содержимое в base64 без пробелов. */
  base64: string;
  sizeBytes: number;
};

export type FollowUpRequest = {
  /** Текст сообщения инспектора ('' — если только вложения). */
  message: string;
  /** Язык текста (CL-063) или null, если текста нет. */
  languageId: string | null;
  attachments: FollowUpAttachment[];
};

/** Разбирает тело followUpRequest. Бросает FollowUpParseError. */
export function parseFollowUpRequest(xml: string): FollowUpRequest {
  let root: XmlElement;
  try {
    root = parseXml(xml, { maxLength: FOLLOW_UP_MAX_LENGTH, maxDepth: 20, maxElements: 5000 });
  } catch (e) {
    if (e instanceof XmlParseError) throw new FollowUpParseError(e.message);
    throw e;
  }
  if (root.ns !== NS_FOLLOW_UP || root.local !== 'followUpRequest') {
    throw new FollowUpParseError('root element is not followUpRequest');
  }
  const messages = childrenNamed(root, NS_FOLLOW_UP, 'message');
  if (messages.length !== 1) throw new FollowUpParseError('expected exactly one message element');
  const msg = messages[0];

  const followUps = childrenNamed(msg, NS_RAM, 'FollowUp');
  if (followUps.length > 1) throw new FollowUpParseError('more than one FollowUp');
  const followUp = followUps[0];
  let message = '';
  let languageId: string | null = null;
  if (followUp) {
    message = followUp.text.trim();
    if (Array.from(message).length > 512) throw new FollowUpParseError('FollowUp longer than 512 characters');
    languageId = (followUp.attrs.languageID ?? '').trim() || null;
    if (!languageId) throw new FollowUpParseError('FollowUp without languageID');
  }

  const attachments = childrenNamed(msg, NS_RAM, 'AttachedSpecifiedBinaryFile').map(attachment);
  return { message, languageId, attachments };
}

function attachment(el: XmlElement): FollowUpAttachment {
  const req = (local: string) => {
    const c = childNamed(el, NS_RAM, local);
    if (!c) throw new FollowUpParseError(`attachment without ${local}`);
    return c;
  };
  const fileName = req('FileName').text.trim();
  if (!fileName) throw new FollowUpParseError('attachment with empty FileName');
  const mimeCode = req('MIMECode').text.trim();
  const base64 = req('IncludedBinaryObject').text.replace(/\s+/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new FollowUpParseError('attachment is not valid base64');
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return {
    fileName,
    mimeCode,
    known: (FOLLOW_UP_MIME_CODES as readonly string[]).includes(mimeCode),
    base64,
    sizeBytes: (base64.length / 4) * 3 - padding,
  };
}
