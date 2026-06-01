# Production Packages

> These are representative package structures from the Chiangway LINE rich menu and confirmed client cases. They are reference templates — actual pricing and itinerary details vary per case and must be confirmed with Eric.
>
> All prices below are placeholders / approximate structures. Always use the internal quote calculator for real pricing. Mark as `需驗證` any price you cannot confirm.

## Package 1: 清邁 5 天 4 夜 親子家庭包車

**Target**: Families with children 3–12, requesting a relaxed-to-normal pace.

**Standard structure**:
```
D1: Airport pickup → hotel check-in → nearby dinner (afternoon arrival)
    OR airport pickup → 換匯 → 1–2 light stops → hotel (morning arrival)
D2: Full day — Elephant camp + afternoon stop (waterfall or market area)
D3: Full day — Doi Suthep temple + Old City / Nimmanhaemin area + evening market
D4: Full day — optional water park / Thai cooking class / Kad Farang Mae Rim / Baan Kang Wat (not Tuesday)
D5: Checkout → airport dropoff (departure day per flight time)
```

**Included (standard)**:
- Vehicle (1 large van for ≤ 6 adults + 2 children; 2 vans for larger groups)
- Chinese-speaking guide (all active touring days)
- Fuel, parking, tolls
- Passenger insurance

**Excluded (standard)**:
- All meals
- All attraction tickets (Night Safari, elephant camp, water park listed separately when included)
- Tips
- Overtime

**Key requirements to collect**:
- Child ages (for car seats, ticket pricing, pacing)
- Airport arrival/departure times
- Lodging location (Old City, Nimman, Riverside affect routing)
- Desired attractions and must-haves
- Guide requirement (yes/no)

---

## Package 2: 清邁 1 日包車 (Day Charter)

**Target**: Families or couples wanting a single flexible day of touring.

**Standard structure**:
```
Pickup 09:00 from hotel
→ 3–4 attraction stops (customer-chosen)
→ Lunch (customer-paid)
→ 1–2 afternoon stops
→ Return to hotel ~18:30–19:00
```

**Car time included**: 10 hours.

**Common day routes**:
- Temple circuit: Doi Suthep + Old City (วัดพระสิงห์, วัดเจดีย์หลวง) + Nimmanhaemin area.
- Nature circuit: Doi Inthanon (longer day, up to 11h), twin pagodas, summit, waterfall, Karen village.
- Market circuit: Baan Kang Wat (not Tue) + Kad Farang Mae Rim + Marimekko / JJ Market (Sat–Sun only).
- Cultural circuit: Thai cooking class + Old City temples + evening market.

---

## Package 3: 清邁 + 清萊 1 日跨區行程

**Target**: Families wanting to visit Chiang Rai from a Chiang Mai base (day trip or overnight).

**Day trip structure** (清邁出發同天回):
```
Depart Chiang Mai 07:00
→ White Temple (白廟) ~09:30
→ Blue Temple (藍廟) ~10:30
→ Baan Dam Museum (黑屋博物館) ~11:30
→ Lunch in Chiang Rai ~12:30
→ Golden Triangle (金三角) ~14:00
→ Optional: Singha Park / Long Neck Village ~15:30 (depending on pace)
→ Return to Chiang Mai ~19:00–20:00
```

**Car time included**: 12 hours (清萊 standard).

**Key notes**:
- Confirm family can accept ~3h each way in the car.
- Not recommended for infants or toddlers unless family specifically requests.
- Day trip vs. overnight: if overnight in Chiang Rai, lodging assistance may be needed.
- Chiang Rai → Mae Sai border area is a separate route (further north); confirm scope.

---

## Package 4: 清邁 3 天 2 夜 短程親子包車

**Target**: Families with limited time or connecting to/from other Thai cities.

**Standard structure**:
```
D1: Arrival (morning) → hotel → Elephant camp PM (if arriving early enough)
    OR arrival (afternoon/evening) → hotel check-in + rest
D2: Full day — Doi Suthep + Old City + Nimmanhaemin + Night Safari (optional)
D3: Checkout → airport
```

**Pacing note**: Night Safari on D2 only if no children under 5, or family explicitly requests it and accepts late return.

---

## Parser Hint: Identifying Package Type from Raw Text

The itinerary parser should detect package type from these signals:
- Number of `Day` headers → approximate trip duration.
- Presence of "清萊" / "白廟" / "藍廟" / "黑屋" → Chiang Rai cross-region.
- Presence of "夜間動物園" → Night Safari flag (needs child ages).
- Presence of "大象" → elephant camp (needs child ages for ticket pricing).
- Presence of "流水樂園" → water park (needs seasonal availability check).
- Single-day itinerary with no lodging → day charter.
