/**
 * Настройки почты.
 *
 * Читаются через мягкие значения по умолчанию, а не через строгую
 * проверку env.server.ts. Причина: пока провайдер — заглушка, ключа
 * Resend нет и быть не должно, а падение всего приложения на старте
 * из-за незаполненной переменной, которая сегодня не нужна, — плохой
 * обмен.
 *
 * Строгость появляется там, где она уместна: адаптер Resend отказывается
 * работать без ключа и говорит, какой переменной не хватает.
 */

/** Какой провайдер отправляет. Одна строка в .env — весь переключатель. */
export function emailProviderName(): 'stub' | 'resend' {
  return process.env.EMAIL_PROVIDER === 'resend' ? 'resend' : 'stub';
}

/**
 * Отправитель. Формат «Имя <адрес>» или голый адрес.
 *
 * Умолчание — подтверждённый в Resend домен rahtis.eu. Это не удобство:
 * письмо с адреса на неподтверждённом домене провайдер отклонит, а если
 * и пропустит, оно уйдёт в спам и испортит репутацию домена, которую
 * потом восстанавливать неделями.
 */
export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? 'RAHTIS <noreply@rahtis.eu>';
}

/** Куда писать оператору. Он же адрес ответа в письмах платформы. */
export function emailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO ?? 'admin@rahtis.eu';
}

/** Ящик оператора: сюда идут вопросы из кабинетов. */
export function operatorInbox(): string {
  return process.env.EMAIL_OPERATOR ?? emailReplyTo();
}

export function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

/**
 * Язык писем.
 *
 * Один и финский. У компании нет поля языка, и заводить его ради писем
 * рано: рынок финский, а английский кабинет существует для тех, кто
 * читает интерфейс, а не для переписки.
 */
export const EMAIL_LOCALE = 'fi' as const;
