import { renderEmail, renderText, type EmailBlock } from '../layout';
import { emailText, type EmailLocale } from '../text';
import type { EmailMessage } from '../types';

export type OnboardingStage = 'ACTIVATE' | 'SETUP' | 'FIRST_ORDER';

/**
 * Напоминание компании, остановившейся на пути к первой работе.
 *
 * Одно письмо на шаг и день (2, 5, 10) — журнал в onboarding_reminders.
 * Ответ приходит оператору (Reply-To), поэтому в конце — приглашение
 * просто ответить: застрявшему проще написать, чем искать, куда нажать.
 */
export function onboardingEmail(input: {
  to: string;
  companyName: string;
  companyId: string;
  stage: OnboardingStage;
  link: string;
  operatorEmail: string;
  locale: EmailLocale;
}): EmailMessage {
  const t = emailText(input.locale);
  const o = t.onboarding;
  const heading = o.heading[input.stage];

  const blocks: EmailBlock[] = [
    { kind: 'text', value: t.greeting },
    { kind: 'text', value: o.body[input.stage] },
    { kind: 'button', label: o.button[input.stage], href: input.link },
    { kind: 'note', value: o.help(input.operatorEmail) },
  ];

  return {
    template: `onboarding.${input.stage.toLowerCase()}`,
    to: input.to,
    subject: o.subject[input.stage](input.companyName),
    text: renderText({
      heading,
      blocks,
      operatorEmail: input.operatorEmail,
      signature: t.signature,
      neverAsk: t.neverAsk,
    }),
    html: renderEmail({
      heading,
      preheader: o.body[input.stage].slice(0, 90),
      blocks,
      operatorEmail: input.operatorEmail,
      tagline: t.brandTagline,
      neverAsk: t.neverAsk,
    }),
    companyId: input.companyId,
  };
}
