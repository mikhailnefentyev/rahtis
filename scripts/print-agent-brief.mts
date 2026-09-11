/**
 * Показать, что платформа пришлёт воркфлоу для каждой роли.
 *
 * Наставление и список инструментов живут в коде и едут вместе с ним.
 * Прочитать их глазами — единственный способ заметить, что оператору
 * сказано «ты видишь только свою компанию», а такой ошибки уже
 * достаточно, чтобы помощник отказал в том, ради чего его звали.
 *
 * Запуск: npx tsx scripts/print-agent-brief.mts
 */
import { agentSystemPrompt, agentTools } from '../src/lib/agent/brief';

const roles = ['SHIPPER', 'CARRIER', 'DRIVER', 'ADMIN'] as const;

for (const audience of roles) {
  const tools = agentTools(audience).map((t) => t.name);
  console.log(audience.padEnd(8), '| инструментов', String(tools.length).padStart(2), '|', tools.join(', '));
}

for (const audience of roles) {
  console.log(`\n--- наставление · ${audience} ---`);
  console.log(agentSystemPrompt({ audience, companyName: 'Esimerkki Oy' }));
}
