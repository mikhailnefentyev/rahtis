/**
 * Границы модуля роутинга.
 *
 * Всё, что знает о конкретном поставщике, живёт за этим интерфейсом.
 * Замер по Финляндии выбрал TomTom, но выбор не вечный: смена поставщика
 * должна быть новой реализацией RoutingProvider, а не правкой формы,
 * карточки заказа и карты.
 *
 * Единицы фиксированы здесь и не обсуждаются в реализациях: метры и
 * секунды. У TomTom габариты в метрах, у HERE в сантиметрах — расхождение,
 * на котором ошибиться легко, а заметить трудно, поэтому пересчёт делает
 * реализация, а наружу выходит одно представление.
 */

/** Точка на карте. Порядок полей всюду один: сначала широта. */
export type LatLon = { lat: number; lon: number };

/** Подсказка адреса при наборе. */
export type AddressSuggestion = {
  /** Идентификатор поставщика — по нему берутся точные координаты. */
  id: string;
  /** Строка, которую видит человек: «Satamakatu 1, 10900 Hanko». */
  label: string;
  /** Город отдельно: он же регион стола заказов. */
  city: string | null;
  postalCode: string | null;
  position: LatLon | null;
  /**
   * Оценка совпадения. Замер: настоящие адреса дают 7,9–10,3,
   * несуществующие 4,7–6,1.
   */
  score: number;
  /** Точный адрес с номером дома или что-то менее определённое. */
  precise: boolean;
};

/** Плечо маршрута между двумя соседними точками. */
export type RouteLeg = {
  distanceM: number;
  durationS: number;
};

export type RouteResult = {
  distanceM: number;
  durationS: number;
  legs: RouteLeg[];
  /** Закодированная полилиния, точность 5. */
  geometry: string;
  /** [minLon, minLat, maxLon, maxLat] — для выставления вида карты. */
  bounds: [number, number, number, number];
};

/**
 * Профиль грузовика для расчёта.
 *
 * Финляндия — исключение в Европе: до 76 тонн и 34,5 метра для сцепок HCT
 * против 40 тонн и 16,5 метра по ЕС. Профиль поэтому выбирается по стране
 * точки забора, а не одной константой на всю платформу: европейский
 * профиль увёл бы финскую сцепку с дорог, где она проедет законно.
 */
export type TruckProfile = {
  grossWeightKg: number;
  weightPerAxleKg: number;
  heightM: number;
  widthM: number;
  lengthM: number;
  axleCount: number;
};

export type SuggestOptions = {
  /** Смещение выдачи к месту: без него «Satamak» отдаёт Вааса раньше Ханко. */
  near?: LatLon;
  limit?: number;
};

export interface RoutingProvider {
  readonly name: string;

  /** Подсказка при наборе адреса. */
  suggest(query: string, options?: SuggestOptions): Promise<AddressSuggestion[]>;

  /** Точные координаты выбранной подсказки. */
  resolve(id: string): Promise<AddressSuggestion | null>;

  /** Маршрут по дорогам для грузовика через все точки по порядку. */
  route(points: LatLon[], profile: TruckProfile): Promise<RouteResult>;
}
