import type { MockUser } from "@/lib/types";

export const MOCK_USER: MockUser = {
  id: "user_zengo",
  name: "Zengo",
  email: "zengo@verlab.io",
  plan: "pro",
  streak: {
    current: 1,
    goal: 30,
    daysToGo: 29,
    days: [
      { label: "M", status: "today" },
      { label: "T", status: "future" },
      { label: "W", status: "future" },
      { label: "T", status: "future" },
      { label: "F", status: "future" },
      { label: "S", status: "future" },
      { label: "S", status: "future" },
    ],
  },
};
