/**
 * Номер контейнера по ISO 6346: три буквы владельца, категория (U, J или
 * Z), шесть цифр и контрольная цифра — «MSCU1234566».
 *
 * Контрольная цифра проверяется, а не только формат: водитель ищет
 * контейнер в терминале по номеру, и одна перепутанная цифра — это чужой
 * контейнер или пустой проезд. Прогон 26.09.2026 показал, что форма
 * принимала любой номер, а образец в подсказке сам был неверным.
 *
 * Буквы стоят 10–38, пропуская кратные 11 (11, 22, 33); вес позиции —
 * 2 в степени её номера; остаток от 11, а 10 записывается как 0.
 */
export function isValidContainerNumber(value: string): boolean {
  const code = value.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(code)) return false;

  const letterValue = (char: string) => {
    let n = 10;
    for (let c = 65; c < char.charCodeAt(0); c += 1) {
      n += 1;
      if (n % 11 === 0) n += 1;
    }
    return n;
  };

  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const char = code[i];
    const value = /\d/.test(char) ? Number(char) : letterValue(char);
    sum += value * 2 ** i;
  }
  return (sum % 11) % 10 === Number(code[10]);
}
