import { test, expect, Page } from "@playwright/test";

const FIXED_NOW = new Date("2026-07-01T12:00:00Z");

async function pinClock(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW);
}

async function captureOpenedLinks(page: Page) {
  await page.addInitScript(() => {
    (window as any).__openedLinks = [];
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      (window as any).__openedLinks.push({ url: String(url), target, features });
      return null;
    }) as typeof window.open;
  });
}

async function openedLinks(page: Page) {
  return page.evaluate(() => (window as any).__openedLinks || []);
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 2);
}

async function expectInViewport(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 2);
  expect(box!.y + Math.min(box!.height, viewport!.height)).toBeGreaterThan(0);
}

async function routeAirports(page: Page) {
  await page.route("**/api/airports?q=**", async (route) => {
    const url = new URL(route.request().url());
    const q = (url.searchParams.get("q") || "").toUpperCase();
    const options = [
      { iata: "SEA", name: "Seattle-Tacoma International Airport", city: "Seattle", country: "United States", lat: 47.45, lon: -122.31 },
      { iata: "NRT", name: "Narita International Airport", city: "Tokyo", country: "Japan", lat: 35.77, lon: 140.39 },
      { iata: "DEN", name: "Denver International Airport", city: "Denver", country: "United States", lat: 39.86, lon: -104.67 },
      { iata: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", country: "United States", lat: 33.94, lon: -118.41 },
    ];
    await route.fulfill({
      json: {
        results: options
          .filter((airport) => airport.iata.includes(q) || airport.city.toUpperCase().includes(q))
          .map((airport) => ({ ...airport, label: `${airport.iata} - ${airport.city}` })),
      },
    });
  });
}

function providerSearchResponse() {
  return {
    source: "google-flights (live)",
    priceLevel: "low",
    cached: true,
    query: {
      origin: "SEA",
      destination: "NRT",
      originCity: "Seattle",
      destinationCity: "Tokyo",
      departDate: "2026-08-01",
      returnDate: null,
      trip: "one-way",
      seat: "economy",
      adults: 1,
      maxStops: null,
      airlineCode: null,
    },
    results: [
      {
        id: "0",
        airlines: ["Frontier Airlines operated by Republic Airways", "Japan Airlines (JAL)"],
        airlineCodes: ["F9", "JL"],
        stops: 2,
        durationMinutes: 1095,
        durationText: "18 hr 15 min",
        priceText: "$1234",
        priceValue: 1234,
        departure: "6:05 AM · Jul 16",
        arrival: "3:20 PM · Jul 17",
        arrivalTimeAhead: "+1",
        isBest: false,
        legsDetailed: true,
        estimated: true,
        bookingUrl: "https://www.google.com/travel/flights?tfs=provider-ui-boundary&hl=en&curr=USD",
        dealLevel: "low",
        dealReason: "Cheapest in these results",
        legs: [
          {
            from: "SEA",
            to: "DEN",
            fromName: "Seattle-Tacoma International Airport",
            toName: "Denver International Airport",
            fromCity: "Seattle",
            toCity: "Denver",
            fromLat: 47.45,
            fromLon: -122.31,
            toLat: 39.86,
            toLon: -104.67,
            airlineCode: "F9",
            airline: "Frontier Airlines",
            flightNumber: "",
            aircraft: "",
            durationMinutes: 165,
            durationText: "2h 45m",
          },
          {
            from: "DEN",
            to: "LAX",
            fromName: "Denver International Airport",
            toName: "Los Angeles International Airport",
            fromCity: "Denver",
            toCity: "Los Angeles",
            fromLat: 39.86,
            fromLon: -104.67,
            toLat: 33.94,
            toLon: -118.41,
            airlineCode: "F9",
            airline: "Frontier Airlines",
            flightNumber: "",
            aircraft: "",
            durationMinutes: 150,
            durationText: "2h 30m",
          },
          {
            from: "LAX",
            to: "NRT",
            fromName: "Los Angeles International Airport",
            toName: "Narita International Airport",
            fromCity: "Los Angeles",
            toCity: "Tokyo",
            fromLat: 33.94,
            fromLon: -118.41,
            toLat: 35.77,
            toLon: 140.39,
            airlineCode: "JL",
            airline: "Japan Airlines",
            flightNumber: "",
            aircraft: "",
            durationMinutes: 525,
            durationText: "8h 45m",
          },
        ],
        layovers: [
          {
            airport: "DEN",
            name: "Denver International Airport",
            city: "Denver",
            durationMinutes: 39,
            durationText: "39m",
            short: true,
            long: false,
          },
          {
            airport: "LAX",
            name: "Los Angeles International Airport",
            city: "Los Angeles",
            durationMinutes: 255,
            durationText: "4h 15m",
            short: false,
            long: true,
          },
        ],
      },
    ],
  };
}

function providerNonstopSearchResponse() {
  return {
    ...providerSearchResponse(),
    query: {
      ...providerSearchResponse().query,
      maxStops: 0,
    },
    results: [
      {
        id: "0",
        airlines: ["Delta Air Lines"],
        airlineCodes: ["DL"],
        stops: 0,
        durationMinutes: 615,
        durationText: "10 hr 15 min",
        priceText: "$640",
        priceValue: 640,
        departure: "9:00 AM · Jul 16",
        arrival: "11:15 AM · Jul 17",
        arrivalTimeAhead: "+1",
        isBest: true,
        legsDetailed: true,
        bookingUrl: "https://www.google.com/travel/flights?tfs=provider-nonstop-boundary&hl=en&curr=USD",
        dealLevel: "low",
        dealReason: "Cheapest in these results",
        legs: [
          {
            from: "SEA",
            to: "NRT",
            fromName: "Seattle-Tacoma International Airport",
            toName: "Narita International Airport",
            fromCity: "Seattle",
            toCity: "Tokyo",
            fromLat: 47.45,
            fromLon: -122.31,
            toLat: 35.77,
            toLon: 140.39,
            airlineCode: "DL",
            airline: "Delta Air Lines",
            flightNumber: "",
            aircraft: "",
            durationMinutes: 615,
            durationText: "10h 15m",
          },
        ],
        layovers: [],
      },
    ],
  };
}

function providerOutOfOrderSearchResponse() {
  const cheapRawFirst: any = providerNonstopSearchResponse().results[0];
  const visibleBestSecond: any = providerSearchResponse().results[0];
  cheapRawFirst.id = "0";
  cheapRawFirst.isBest = false;
  visibleBestSecond.id = "1";
  visibleBestSecond.isBest = true;
  return {
    ...providerSearchResponse(),
    results: [cheapRawFirst, visibleBestSecond],
  };
}

test("served artifact contains the current frontend source fingerprint", async ({ page }) => {
  test.skip(!process.env.EXPECTED_SOURCE_HASH, "EXPECTED_SOURCE_HASH is only set by the bounded artifact runner");

  await page.goto("/");
  await expect.poll(
    () => page.evaluate(() => window.__flightScannerSourceHash),
    { timeout: 10_000 },
  ).toBe(process.env.EXPECTED_SOURCE_HASH);
});

// Drive a one-way search and wait for results.
async function search(page: Page, from: string, to: string, depart = "2026-12-15") {
  await pinClock(page);
  await page.goto("/");
  await page.getByText("One way").click();
  const f = page.locator('input[placeholder="City or airport"]').first();
  await f.click();
  await f.type(from, { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const t = page.locator('input[placeholder="City or airport"]').nth(1);
  await t.click();
  await t.type(to, { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const dep = page.locator('input[placeholder="Type or pick a date"]').first();
  await dep.click();
  await dep.fill(depart);
  await page.keyboard.press("Enter");
  await page.getByText("Scan flights").click();
  await page.waitForSelector("text=options", { timeout: 40_000 });
}

async function selectStops(page: Page, value: string) {
  await page.getByLabel("Num stops").selectOption(value);
}

async function selectAirline(page: Page, value: string) {
  await page.getByLabel("Airline").selectOption(value);
}

test("app loads with no JS errors and shows the search form", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await pinClock(page);
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(/Flight Scanner/);
  await expect(page.getByText("Scan flights")).toBeVisible();
  expect(errors).toEqual([]);
});

test("search renders results, the 3D globe, and an animated plane", async ({ page }) => {
  await search(page, "SEA", "LHR");
  await expect(page.locator("ul.space-y-2 > li").first()).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);

  // Plane mesh exists and moves along the arc over time (WebGL, via test hook).
  await page.waitForTimeout(1500);
  const a = await page.evaluate(() => {
    const p = (window as any).__geoGlobeMarkers?.[0];
    return p ? { x: p.position.x, y: p.position.y, z: p.position.z } : null;
  });
  expect(a).not.toBeNull();
  await page.waitForTimeout(900);
  const b = await page.evaluate(() => {
    const p = (window as any).__geoGlobeMarkers?.[0];
    return p ? { x: p.position.x, y: p.position.y, z: p.position.z } : null;
  });
  const moved = Math.abs(a!.x - b!.x) + Math.abs(a!.y - b!.y) + Math.abs(a!.z - b!.z);
  expect(moved).toBeGreaterThan(0.5);
});

test("selected itinerary shows layover details and a Google Flights booking link", async ({ page }) => {
  await captureOpenedLinks(page);
  const airlineRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/airlines/")) {
      airlineRequests.push(request.url());
    }
  });
  await search(page, "SEA", "LHR");
  await page.locator("ul.space-y-2 > li").filter({ hasText: "1 stop" }).first().click();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  expect(body).toMatch(/Layover in .+ \(\w{3}\)/); // e.g. "Layover in ... (FRA)"
  // Airline experience cards: heading is static; each resolved carrier renders a
  // card with curated details once its /api/airlines/{iata} fetch settles.
  await expect(page.getByText("Airline experience")).toBeVisible();
  await expect(page.getByText("Seat pitch (legroom)").first()).toBeVisible();
  await expect(page.getByText(/Loading \w{2}/)).toHaveCount(0); // no card stuck loading
  expect(airlineRequests.length).toBeGreaterThan(0); // the card actually fetched
  // Booking is a shared <Button> that opens the URL; the target is on data-href.
  const href = await page.getAttribute('[data-href*="google.com/travel/flights"]', "data-href");
  expect(href).toContain("google.com/travel/flights");
  // The selected itinerary's airline is baked into both booking links so they
  // open filtered to that carrier, not the whole market. Kayak surfaces it as a
  // readable result filter (the Google tfs field-6 encoding is asserted in the
  // backend unit tests, where the base64 protobuf can be decoded precisely).
  const kkHref = await page.getAttribute('[data-href*="kayak.com/flights"]', "data-href");
  expect(kkHref).toMatch(/fs=airlines=[A-Z0-9]{2}/);
  await page.getByRole("button", { name: /Open on Google Flights/ }).click();
  await expect.poll(() => openedLinks(page)).toEqual([
    expect.objectContaining({
      url: expect.stringContaining("https://www.google.com/travel/flights?tfs="),
      target: "_blank",
      features: "noopener,noreferrer",
    }),
  ]);
});

test("date picker blocks past dates (calendar + typed)", async ({ page }) => {
  await pinClock(page);
  await page.goto("/");
  await page.locator('button[aria-label="Open calendar"]').first().click();
  await page.waitForSelector("text=Su");
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByText("June 2026")).toBeVisible();
  const disabled = await page.evaluate(
    () => [...document.querySelectorAll("button")].filter((b) => /^\d+$/.test(b.textContent!.trim()) && (b as HTMLButtonElement).disabled).length
  );
  expect(disabled).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  const dep = page.locator('input[placeholder="Type or pick a date"]').first();
  await dep.click();
  await dep.fill("2020-01-01");
  await page.keyboard.press("Enter");
  await expect(dep).toHaveValue(""); // past date rejected/cleared
});

test("calendar popover renders above the WebGL globe", async ({ page }) => {
  await search(page, "SEA", "LHR");
  await page.locator('button[aria-label="Open calendar"]').first().click();
  await page.waitForTimeout(300);
  const onTop = await page.evaluate(() => {
    const pop = [...document.querySelectorAll("div")].find(
      (d) => (d as HTMLElement).style.position === "fixed" && /Su\s*Mo\s*Tu/.test(d.textContent!.replace(/\s+/g, " "))
    ) as HTMLElement | undefined;
    if (!pop) return { found: false, onTop: false };
    const r = pop.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { found: true, onTop: pop.contains(el) };
  });
  expect(onTop.found).toBe(true);
  expect(onTop.onTop).toBe(true);
});

test("results and detail show both departure and arrival times", async ({ page }) => {
  await search(page, "SEA", "LHR");
  // results row: "8:10 AM · ... → 6:22 PM · ..."
  await expect(page.locator("ul.space-y-2 > li").first()).toContainText("→");
  // detail timeline has explicit Departs / Arrives labels
  await expect(page.getByText("Departs").first()).toBeVisible();
  await expect(page.getByText("Arrives").first()).toBeVisible();
});

test("round trip visualizes and describes the return flight", async ({ page }) => {
  await pinClock(page);
  await page.goto("/");
  // round-trip is the default; fill both dates
  const f = page.locator('input[placeholder="City or airport"]').first();
  await f.click();
  await f.type("SEA", { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const t = page.locator('input[placeholder="City or airport"]').nth(1);
  await t.click();
  await t.type("LHR", { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const dep = page.locator('input[placeholder="Type or pick a date"]').first();
  await dep.click();
  await dep.fill("2026-12-15");
  await page.keyboard.press("Enter");
  const ret = page.locator('input[placeholder="Type or pick a date"]').nth(1);
  await ret.click();
  await ret.fill("2026-12-29");
  await page.keyboard.press("Enter");
  await page.getByText("Scan flights").click();
  await page.waitForSelector("text=options", { timeout: 40_000 });
  await page.waitForTimeout(2500);

  // Return section in the description + globe legend.
  const returnHeading = page.getByText(/Return ·/);
  const bookingHeading = page.getByText("Book this flight");
  await expect(returnHeading).toBeVisible();
  await expect(bookingHeading).toBeVisible();
  const returnBox = await returnHeading.boundingBox();
  const bookingBox = await bookingHeading.boundingBox();
  expect(returnBox).not.toBeNull();
  expect(bookingBox).not.toBeNull();
  expect(bookingBox!.y).toBeGreaterThan(returnBox!.y);
  await expect(page.getByText("Outbound", { exact: true })).toBeVisible();
  // Planes animate for BOTH directions (outbound legs + return legs).
  const planes = await page.evaluate(() => (window as any).__geoGlobeMarkers?.length || 0);
  expect(planes).toBeGreaterThan(1);
});

test("layout is usable on a mobile viewport", async ({ page }) => {
  await pinClock(page);
  await page.goto("/");
  // Header + form fit and are visible on small screens.
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByText("Scan flights")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectInViewport(page, "h1");
  await expectInViewport(page, "button:has-text('Scan flights')");
});

test("provider-backed search flow sends the final API payload and renders cached provider details", async ({ page }) => {
  await captureOpenedLinks(page);
  await routeAirports(page);
  let searchPayload: unknown = null;
  await page.route("**/api/search", async (route) => {
    searchPayload = route.request().postDataJSON();
    await route.fulfill({ json: providerSearchResponse() });
  });

  await search(page, "SEA", "NRT", "2026-08-01");

  expect(searchPayload).toEqual({
    origin: "SEA",
    destination: "NRT",
    departDate: "2026-08-01",
    returnDate: null,
    trip: "one-way",
    seat: "economy",
    adults: 1,
    maxStops: null,
    airlineCode: null,
  });
  await expect(page.locator("ul.space-y-2 > li")).toHaveCount(1);
  await expect(page.locator("ul.space-y-2 > li").first()).toContainText("$1234");
  await expect(page.getByRole("heading", { name: /Seattle.*Tokyo.*\$1234/ })).toBeVisible();
  await expect(page.getByText("Layover in Denver (DEN)")).toBeVisible();
  await expect(page.getByText("39m")).toBeVisible();
  await expect(page.getByText("Layover in Los Angeles (LAX)")).toBeVisible();
  await expect(page.getByText("4h 15m")).toBeVisible();
  await expect(page.getByText(/source: google-flights \(live\).*cached/)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  const googleButton = page.getByRole("button", { name: /Open on Google Flights/ });
  await googleButton.scrollIntoViewIfNeeded();
  await expectInViewport(page, "button:has-text('Open on Google Flights')");
  await googleButton.click();
  await expect.poll(() => openedLinks(page)).toContainEqual(
    expect.objectContaining({
      url: "https://www.google.com/travel/flights?tfs=provider-ui-boundary&hl=en&curr=USD",
      target: "_blank",
      features: "noopener,noreferrer",
    }),
  );
});

test("search selects the first visible result by default", async ({ page }) => {
  await routeAirports(page);
  await page.route("**/api/search", async (route) => {
    await route.fulfill({ json: providerOutOfOrderSearchResponse() });
  });

  await search(page, "SEA", "NRT", "2026-08-01");

  const rows = page.locator("ul.space-y-2 > li");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Japan Airlines");
  await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: /Seattle.*Tokyo.*\$1234/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Seattle.*Tokyo.*\$640/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("num stops filter sends the final API payload and renders nonstop provider results", async ({ page }) => {
  await routeAirports(page);
  let searchPayload: unknown = null;
  await page.route("**/api/search", async (route) => {
    searchPayload = route.request().postDataJSON();
    await route.fulfill({ json: providerNonstopSearchResponse() });
  });

  await pinClock(page);
  await page.goto("/");
  await page.getByText("One way").click();
  const f = page.locator('input[placeholder="City or airport"]').first();
  await f.click();
  await f.type("SEA", { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const t = page.locator('input[placeholder="City or airport"]').nth(1);
  await t.click();
  await t.type("NRT", { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const dep = page.locator('input[placeholder="Type or pick a date"]').first();
  await dep.click();
  await dep.fill("2026-08-01");
  await page.keyboard.press("Enter");
  await selectStops(page, "0");
  await page.getByText("Scan flights").click();

  await expect(page.locator("ul.space-y-2 > li")).toHaveCount(1);
  expect(searchPayload).toEqual({
    origin: "SEA",
    destination: "NRT",
    departDate: "2026-08-01",
    returnDate: null,
    trip: "one-way",
    seat: "economy",
    adults: 1,
    maxStops: 0,
    airlineCode: null,
  });
  await expect(page.locator("ul.space-y-2 > li").first()).toContainText("Nonstop");
  await expect(page.locator("ul.space-y-2 > li").first()).not.toContainText("2 stops");
  await expect(page.getByRole("heading", { name: /Seattle.*Tokyo.*\$640/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("airline filter sends the final API payload and renders matching provider results", async ({ page }) => {
  await routeAirports(page);
  let searchPayload: unknown = null;
  await page.route("**/api/search", async (route) => {
    searchPayload = route.request().postDataJSON();
    const response: any = providerSearchResponse();
    response.query.airlineCode = "JL";
    await route.fulfill({ json: response });
  });

  await pinClock(page);
  await page.goto("/");
  await page.getByText("One way").click();
  const f = page.locator('input[placeholder="City or airport"]').first();
  await f.click();
  await f.type("SEA", { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const t = page.locator('input[placeholder="City or airport"]').nth(1);
  await t.click();
  await t.type("NRT", { delay: 20 });
  await page.waitForSelector("ul li");
  await page.locator("ul li").first().click();
  const dep = page.locator('input[placeholder="Type or pick a date"]').first();
  await dep.click();
  await dep.fill("2026-08-01");
  await page.keyboard.press("Enter");
  await selectAirline(page, "JL");
  await page.getByText("Scan flights").click();

  await expect(page.locator("ul.space-y-2 > li")).toHaveCount(1);
  expect(searchPayload).toEqual({
    origin: "SEA",
    destination: "NRT",
    departDate: "2026-08-01",
    returnDate: null,
    trip: "one-way",
    seat: "economy",
    adults: 1,
    maxStops: null,
    airlineCode: "JL",
  });
  await expect(page.locator("ul.space-y-2 > li").first()).toContainText("Japan Airlines");
  await expect(page.locator("ul.space-y-2 > li").first()).not.toContainText("Delta Air Lines");
  await expect(page.getByRole("heading", { name: /Seattle.*Tokyo.*\$1234/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
