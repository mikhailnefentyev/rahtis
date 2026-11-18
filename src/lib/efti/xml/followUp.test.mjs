/*
 * eFTI FTI025: разбор сообщения инспектора, защита от XXE и прочего. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMAS, validate } from './testSupport.mjs';

const { parseFollowUpRequest, FollowUpParseError } = await import('./followUp.ts');
const { parseXml, XmlParseError } = await import('./parse.ts');

const NS = 'xmlns="http://efti.fi/v1/platform/follow-up-request" xmlns:ram="urn:eu:move:eFTI:data:standard:ReusableAggregateBusinessInformationEntity:34"';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- пример от шлюза -->
<followUpRequest ${NS}>
  <message>
    <ram:FollowUp languageID="fi">Tarkastus Vaalimaalla &amp; kuljettaja &#x2192; soita &lt;heti&gt;</ram:FollowUp>
    <ram:AttachedSpecifiedBinaryFile>
      <ram:FileName>poytakirja.pdf</ram:FileName>
      <ram:MIMECode>application/pdf</ram:MIMECode>
      <ram:IncludedBinaryObject format="base64Binary">JVBERi0x
LjQK</ram:IncludedBinaryObject>
    </ram:AttachedSpecifiedBinaryFile>
  </message>
</followUpRequest>`;

test('пример проходит XSD и разбирается', async () => {
  const r = await validate(SAMPLE, SCHEMAS.followUp);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(parseFollowUpRequest(SAMPLE), {
    message: 'Tarkastus Vaalimaalla & kuljettaja → soita <heti>',
    languageId: 'fi',
    attachments: [
      { fileName: 'poytakirja.pdf', mimeCode: 'application/pdf', known: true, base64: 'JVBERi0xLjQK', sizeBytes: 9 },
    ],
  });
});

test('другой префикс и CDATA — то же самое', () => {
  const xml = `<fr:followUpRequest xmlns:fr="http://efti.fi/v1/platform/follow-up-request" xmlns:x="urn:eu:move:eFTI:data:standard:ReusableAggregateBusinessInformationEntity:34"><fr:message><x:FollowUp languageID="en"><![CDATA[Stop <here> & wait]]></x:FollowUp></fr:message></fr:followUpRequest>`;
  assert.deepEqual(parseFollowUpRequest(xml), { message: 'Stop <here> & wait', languageId: 'en', attachments: [] });
});

test('только вложение, без текста', () => {
  const xml = `<followUpRequest ${NS}><message><ram:AttachedSpecifiedBinaryFile><ram:FileName>a.txt</ram:FileName><ram:MIMECode>text/csv</ram:MIMECode><ram:IncludedBinaryObject format="base64Binary">aGk=</ram:IncludedBinaryObject></ram:AttachedSpecifiedBinaryFile></message></followUpRequest>`;
  const r = parseFollowUpRequest(xml);
  assert.equal(r.message, '');
  assert.equal(r.languageId, null);
  assert.deepEqual(r.attachments[0], { fileName: 'a.txt', mimeCode: 'text/csv', known: false, base64: 'aGk=', sizeBytes: 2 });
});

test('XXE и DOCTYPE отвергаются', () => {
  const attacks = [
    `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><followUpRequest ${NS}><message><ram:FollowUp languageID="fi">&x;</ram:FollowUp></message></followUpRequest>`,
    `<!DOCTYPE followUpRequest><followUpRequest ${NS}><message/></followUpRequest>`,
    `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><followUpRequest ${NS}><message><ram:FollowUp languageID="fi">&lol2;</ram:FollowUp></message></followUpRequest>`,
    `<followUpRequest ${NS}><message><ram:FollowUp languageID="fi">&x;</ram:FollowUp></message></followUpRequest>`,
    `<followUpRequest ${NS}><!ENTITY x "y"><message/></followUpRequest>`,
  ];
  for (const xml of attacks) assert.throws(() => parseFollowUpRequest(xml), FollowUpParseError);
});

test('чужой корень, лишние/недостающие элементы — ошибка', () => {
  const bad = [
    `<cmdsResponse xmlns="http://efti.fi/v1/platform/cmds-response"/>`,
    `<followUpRequest xmlns="urn:other"><message/></followUpRequest>`,
    `<followUpRequest ${NS}/>`,
    `<followUpRequest ${NS}><message/><message/></followUpRequest>`,
    `<followUpRequest ${NS}><message><ram:FollowUp>без языка</ram:FollowUp></message></followUpRequest>`,
    `<followUpRequest ${NS}><message><ram:FollowUp languageID="fi">${'x'.repeat(513)}</ram:FollowUp></message></followUpRequest>`,
    `<followUpRequest ${NS}><message><ram:AttachedSpecifiedBinaryFile><ram:FileName>a</ram:FileName><ram:MIMECode>text/plain</ram:MIMECode><ram:IncludedBinaryObject format="base64Binary">не base64</ram:IncludedBinaryObject></ram:AttachedSpecifiedBinaryFile></message></followUpRequest>`,
    `<followUpRequest ${NS}><message><ram:AttachedSpecifiedBinaryFile><ram:FileName>a</ram:FileName></ram:AttachedSpecifiedBinaryFile></message></followUpRequest>`,
    `<followUpRequest ${NS}><message>`,
    'не xml',
    '',
  ];
  for (const xml of bad) assert.throws(() => parseFollowUpRequest(xml), FollowUpParseError, xml.slice(0, 80));
});

test('parseXml: пространства имён, атрибуты, ссылки на символы', () => {
  const root = parseXml(`<a xmlns="urn:a" xmlns:b="urn:b" k='1 &amp; 2'><b:c x="&#65;&#x42;">t<!-- c -->u</b:c><d/></a>`);
  assert.equal(root.ns, 'urn:a');
  assert.equal(root.attrs.k, '1 & 2');
  assert.equal(root.children[0].ns, 'urn:b');
  assert.equal(root.children[0].local, 'c');
  assert.equal(root.children[0].attrs.x, 'AB');
  assert.equal(root.children[0].text, 'tu');
  assert.equal(root.children[1].ns, 'urn:a');
});

test('parseXml: битый документ и пределы', () => {
  const bad = [
    '<a><b></a></b>',
    '<a>',
    '<a/><b/>',
    '<a x="1" x="2"/>',
    '<p:a/>',
    '<a>&#0;</a>',
    '<a>& b</a>',
    '<a x=1/>',
    'text<a/>',
  ];
  for (const xml of bad) assert.throws(() => parseXml(xml), XmlParseError, xml);
  assert.throws(() => parseXml('<a>' + '<b>'.repeat(50) + '</b>'.repeat(50) + '</a>', { maxDepth: 20 }), /too deep/);
  assert.throws(() => parseXml('<a/>' + ' '.repeat(100), { maxLength: 50 }), /too large/);
  assert.throws(() => parseXml('<a>' + '<b/>'.repeat(20) + '</a>', { maxElements: 10 }), /too many/);
});
