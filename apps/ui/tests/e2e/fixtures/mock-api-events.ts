import type { Page } from "@playwright/test";
import type { RehoboamEvent } from "@repo/types";

export const MOCK_API_EVENTS: RehoboamEvent[] = [
  {
    id: "e2e-001",
    date: "2025-06-15",
    title: "Infrastructure Grid Realignment",
    location: "Berlin, Germany",
    severity: "high",
    category: "economy",
  },
  {
    id: "e2e-002",
    date: "2025-07-22",
    title: "Coastal Barrier Breach Warning",
    location: "Jakarta, Indonesia",
    severity: "critical",
    category: "climate",
  },
  {
    id: "e2e-003",
    date: "2025-08-03",
    title: "Diplomatic Summit Escalation",
    location: "Geneva, Switzerland",
    severity: "medium",
    category: "diplomacy",
  },
];

export const interceptEventsApi = async (
  page: Page,
  events: RehoboamEvent[] = MOCK_API_EVENTS
): Promise<void> => {
  await page.route("**/api/events", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(events),
    });
  });
};

export const interceptEventsApiError = async (
  page: Page,
  status = 500
): Promise<void> => {
  await page.route("**/api/events", (route) => {
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: "Internal Server Error" }),
    });
  });
};
