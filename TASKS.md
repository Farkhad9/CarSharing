# ElectroStreet Tasks

Этот документ фиксирует порядок реализации и актуальное направление проекта. Кодовые изменения выполняются отдельными этапами; здесь описан только план.

## Актуальное направление

ElectroStreet развивается как современный EV car-sharing продукт в стиле оригинального сайта:

- светлая тема как основа;
- белый фон;
- красный акцент как основной цвет бренда;
- чистый современный visual style;
- Hero остается первым экраном;
- интерфейс продукта, а не внутренняя admin-панель;
- admin-панель будет отдельной страницей на backend;
- пункт Admin не добавлять в Navbar.

## Что можно оставить из текущего проекта

- Технологический стек: React, Vite, Tailwind.
- Компонентную структуру `src/components`, `src/layouts`, `src/data`, `src/utils`.
- `Navbar` как основу верхней навигации.
- `ResponsiveMenu` как основу мобильного меню.
- `Hero` как обязательный первый экран.
- `Location` как основу для location / charging / nearby блоков.
- `CarList`, `CarCard`, `Modal` как заготовки для fleet preview, карточки EV и резервации.
- `react-icons` для EV/status/action иконок.
- AOS-анимации, если они поддерживают чистое современное ощущение.

## Что нужно изменить в подходе

- Не уводить интерфейс в темную тему.
- Не превращать публичный сайт в dashboard.
- Не использовать generic rental wording как основной продуктовый язык.
- Не делать `$ / day` главным форматом цены.
- Не использовать Admin как пункт публичной навигации.
- Перенести визуальную основу на белый фон и красный брендовый action color.

## Порядок реализации

1. Branding + UI foundation
2. Navbar
3. Hero
4. Fleet preview
5. Reservation flow
6. Ride flow
7. Charging system
8. Dynamic pricing
9. Backend admin page
10. Polish

## Этап 1. Branding + UI foundation

Цель:
Зафиксировать визуальную основу ElectroStreet: светлая тема, белый фон, красный акцент, чистый современный стиль оригинального сайта, брендовые тексты и единый язык интерфейса.

Компоненты затронутся:

- `App`
- `Navbar`
- `Hero`
- `CarCard`
- `CarList`
- `Modal`
- будущие shared UI элементы

Файлы предположительно изменятся:

- `my-project/tailwind.config.js`
- `my-project/src/index.css`
- `my-project/src/App.jsx`
- `my-project/src/data/vehicles.js`
- `my-project/src/data/statuses.js`
- возможно новый `my-project/src/utils/formatters.js`

Ожидаемый результат:
Единая светлая основа, красные брендовые акценты, продуктовый tone of voice и базовые EV mock data.

Чеклист:

- [ ] Зафиксировать светлую тему и белый фон.
- [ ] Сделать красный главным брендовым акцентом.
- [ ] Зафиксировать бренд ElectroStreet.
- [ ] Убрать generic rental terminology из ключевых UI-текстов.
- [ ] Описать `VehicleStatus`: `Available`, `Reserved`, `InUse`, `Charging`, `Completed`.
- [ ] Подготовить EV mock data: charge, range, location, price per minute.
- [ ] Подготовить user balance mock.
- [ ] Подготовить pricing/station/event mock foundations.

## Этап 2. Navbar

Цель:
Сделать навигацию частью чистого светлого публичного сайта ElectroStreet.

Компоненты затронутся:

- `Navbar`
- `ResponsiveMenu`
- возможно `BalanceWidget`

Файлы предположительно изменятся:

- `my-project/src/components/Navbar/Navbar.jsx`
- `my-project/src/components/ResponsiveMenu.jsx`
- возможно новый `my-project/src/components/BalanceWidget/BalanceWidget.jsx`

Ожидаемый результат:
Верхняя навигация показывает ElectroStreet, публичные разделы продукта и account/balance state. Admin в Navbar не добавляется.

Чеклист:

- [ ] Заменить текущий бренд на ElectroStreet, если нужно.
- [ ] Убрать корзину.
- [ ] Обновить пункты меню без Admin.
- [ ] Добавить баланс или компактный account status, если это нужно для MVP.
- [ ] Привести mobile menu к светлому стилю.

## Этап 3. Hero

Цель:
Оставить Hero как сильный первый экран в оригинальном split layout: текст слева, автомобиль справа, чистый светлый фон и красный CTA.

Компоненты затронутся:

- `Hero`

Файлы предположительно изменятся:

- `my-project/src/components/Hero/Hero.jsx`
- `my-project/src/data/vehicles.js`

Ожидаемый результат:
Первый экран выглядит как ElectroStreet: светлый, чистый, современный, с EV copy и понятным reserve action.

Чеклист:

- [ ] Переписать hero copy под ElectroStreet.
- [ ] Убрать `Sell Your Car`, если он есть.
- [ ] Убрать pick-up/drop-off date паттерн, если он мешает car-sharing сценарию.
- [ ] Добавить CTA `Reserve EV` или похожее действие.
- [ ] Добавить вторичное действие для просмотра доступных EV.
- [ ] Сохранить split layout.

## Этап 4. Fleet preview

Цель:
Показать пользователю подборку доступных EV после Hero: машины, статусы, заряд, расстояние, цену и основное действие.

Компоненты затронутся:

- `CarList`
- `CarCard`
- возможно новый `FleetPreview`
- возможно новый `VehicleStatusBadge`
- `Modal`

Файлы предположительно изменятся:

- `my-project/src/components/CarList/CarList.jsx`
- `my-project/src/layouts/CarCard.jsx`
- возможно новый `my-project/src/components/FleetPreview/FleetPreview.jsx`
- возможно новый `my-project/src/components/VehicleStatusBadge/VehicleStatusBadge.jsx`
- `my-project/src/App.jsx`
- `my-project/src/data/vehicles.js`

Ожидаемый результат:
Пользователь видит светлый fleet preview, может сравнить EV и выбрать машину для резервации.

Чеклист:

- [ ] Подключить fleet preview к основному экрану.
- [ ] Привести поля данных и карточек к одному формату.
- [ ] Показать status badge.
- [ ] Показать battery, range, distance, price/min.
- [ ] Добавить фильтры по статусу, заряду, расстоянию.
- [ ] Заменить `Rent Now` на `Reserve EV`.
- [ ] Добавить empty state для отсутствия доступных EV.

## Этап 5. Reservation flow

Цель:
Сделать первый интерактивный сценарий: пользователь выбирает доступный EV, резервирует его, видит таймер и может отменить резерв.

Компоненты затронутся:

- `CarCard`
- `CarList` / `FleetPreview`
- `Modal`
- возможно новый `ReservationPanel`
- возможно новый `VehicleDetails`

Файлы предположительно изменятся:

- `my-project/src/components/CarList/CarList.jsx`
- `my-project/src/layouts/CarCard.jsx`
- `my-project/src/components/Modal.jsx`
- возможно новый `my-project/src/components/ReservationPanel/ReservationPanel.jsx`
- возможно новый `my-project/src/components/VehicleDetails/VehicleDetails.jsx`
- возможно новый `my-project/src/utils/reservation.js`

Ожидаемый результат:
Автомобиль переходит из `Available` в `Reserved`, пользователь видит активную резервацию, таймер удержания и следующие действия.

Чеклист:

- [ ] Проверять, что резервировать можно только `Available`.
- [ ] Создавать активную резервацию.
- [ ] Показывать таймер удержания.
- [ ] Позволить отменить резерв.
- [ ] Блокировать повторную резервацию другой машины при активном резерве.
- [ ] Показывать pending hold на балансе.
- [ ] Добавлять событие `vehicle.reserved`.

## Этап 6. Ride flow

Цель:
Продолжить сценарий после резервации: открыть автомобиль, начать поездку, перевести автомобиль в `InUse`, показывать время и текущую стоимость.

Компоненты затронутся:

- `ReservationPanel`
- возможно новый `RidePanel`
- возможно новый `RideStatus`
- `Navbar`
- `CarCard`
- `BalanceWidget`

Файлы предположительно изменятся:

- `my-project/src/App.jsx`
- возможно новый `my-project/src/components/RidePanel/RidePanel.jsx`
- возможно новый `my-project/src/components/RideStatus/RideStatus.jsx`
- возможно новый `my-project/src/utils/ride.js`
- возможно новый `my-project/src/utils/pricing.js`

Ожидаемый результат:
После старта поездки пользователь видит active ride state, время, примерную дистанцию, текущий тариф и нарастающую стоимость.

Чеклист:

- [ ] Добавить действие `Unlock`.
- [ ] Добавить действие `Start ride`.
- [ ] Переводить авто из `Reserved` в `InUse`.
- [ ] Показывать таймер поездки.
- [ ] Показывать live cost.
- [ ] Завершать поездку действием `End ride`.
- [ ] Списывать итоговую сумму с баланса.
- [ ] Добавлять запись в историю.
- [ ] Добавлять события `vehicle.unlocked`, `ride.started`, `ride.completed`, `balance.updated`.

## Этап 7. Charging system

Цель:
Добавить EV-инфраструктуру: станции зарядки, доступные порты, состояние `Charging`, переход машины на зарядку после поездки или при низком заряде.

Компоненты затронутся:

- `Location`
- возможно новый `ChargingStations`
- возможно новый `StationCard`
- `CarCard`
- `RidePanel`

Файлы предположительно изменятся:

- `my-project/src/components/Location/Location.jsx`
- возможно новый `my-project/src/components/ChargingStations/ChargingStations.jsx`
- возможно новый `my-project/src/layouts/StationCard.jsx`
- `my-project/src/data/vehicles.js`
- возможно новый `my-project/src/data/stations.js`
- возможно новый `my-project/src/utils/charging.js`

Ожидаемый результат:
Пользователь видит charging layer как часть EV-сервиса ElectroStreet, а автомобили могут переходить в `Charging`.

Чеклист:

- [ ] Добавить список charging stations.
- [ ] Показывать доступные порты.
- [ ] Показывать мощность станции.
- [ ] Показывать distance до станции.
- [ ] Связывать завершение поездки с ближайшей станцией или зоной.
- [ ] Переводить низко заряженные авто в `Charging`.
- [ ] Добавлять событие `vehicle.charging.started`.

## Этап 8. Dynamic pricing

Цель:
Сделать тариф car-sharing моделью: цена за минуту, спрос, зона, заряд, доступность флота и понятный breakdown.

Компоненты затронутся:

- `Hero`
- `CarCard`
- `RidePanel`
- возможно новый `PricingBreakdown`

Файлы предположительно изменятся:

- возможно новый `my-project/src/utils/pricing.js`
- возможно новый `my-project/src/data/pricing.js`
- `my-project/src/components/Hero/Hero.jsx`
- `my-project/src/layouts/CarCard.jsx`
- возможно новый `my-project/src/components/PricingBreakdown/PricingBreakdown.jsx`

Ожидаемый результат:
Цена отображается как понятная EV car-sharing стоимость, а не фиксированный дневной тариф.

Чеклист:

- [ ] Ввести базовую цену за минуту.
- [ ] Добавить коэффициент спроса.
- [ ] Добавить коэффициент зоны.
- [ ] Добавить корректировку по заряду/дефициту.
- [ ] Показывать pricing multiplier.
- [ ] Показывать breakdown пользователю.
- [ ] Использовать один pricing helper для hero, карточки и ride flow.

## Этап 9. Backend admin page

Цель:
Подготовить отдельную backend-страницу для управления флотом, поездками, пользователями, тарифами, станциями и событиями.

Компоненты публичного фронтенда:

- Admin не добавляется в Navbar.
- Публичный UI не превращается в admin dashboard.

Ожидаемый результат:
Admin существует как отдельная backend-страница, а публичный ElectroStreet остается чистым пользовательским продуктом.

Чеклист:

- [ ] Определить backend route для admin.
- [ ] Подготовить fleet overview.
- [ ] Подготовить rides overview.
- [ ] Подготовить users and balances overview.
- [ ] Подготовить tariffs overview.
- [ ] Подготовить charging stations overview.
- [ ] Подготовить event log.
- [ ] Определить единый формат событий.

## Этап 10. Polish

Цель:
Довести MVP до цельного состояния: responsive, microinteractions, пустые состояния, ошибки, визуальная целостность, подготовка к backend/API.

Компоненты затронутся:

- Все пользовательские компоненты.

Файлы предположительно изменятся:

- `my-project/src/App.jsx`
- `my-project/src/index.css`
- `my-project/tailwind.config.js`
- возможно новый `my-project/src/services/api.js`
- `my-project/README.md`
- `my-project/index.html`

Ожидаемый результат:
Приложение выглядит как цельный светлый EV car-sharing MVP: сильный бренд, рабочий hero, fleet preview, reservation flow, ride flow, charging system и pricing.

Чеклист:

- [ ] Проверить desktop layout.
- [ ] Проверить mobile layout.
- [ ] Проверить hero на разных viewport.
- [ ] Проверить active ride/reservation panel.
- [ ] Добавить пустые состояния.
- [ ] Добавить disabled-состояния кнопок.
- [ ] Добавить ошибки недостаточного баланса.
- [ ] Проверить контрастность светлого UI.
- [ ] Проверить, что публичный интерфейс не выглядит как внутренняя admin-панель.
- [ ] Подготовить сервисный слой для API.
- [ ] Обновить README под ElectroStreet.
- [ ] Обновить `index.html` title.
